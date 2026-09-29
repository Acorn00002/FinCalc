import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../ui/Card';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { requestAiAssist, type AssetUpdateProposal } from '../../lib/aiAssist';
import { fetchUserAssets, saveUserAssetBreakdown } from '../../lib/userAssets';
import type { ThemeColors } from '../../constants/theme';

type PromptChip = { label: string; prompt: string; mode: 'ask' | 'fill' };

// "내 포트폴리오 분석" 칩만 mode:'fill'이다 — "분석해줘"라는 문장만 그대로 AI에 보내면 실제 보유
// 종목/비중 데이터가 없어 일반적인 안내 문구만 돌아온다. 그래서 이 칩은 바로 묻지 않고, 종목명·
// 비중 예시가 채워진 템플릿을 입력창에 넣어준 뒤 사용자가 숫자만 고쳐서 직접 보내게 한다.
// 나머지 칩(시장 브리핑/뉴스 요약)은 그 자체로 완결된 질문이라 탭 한 번에 바로 물어봐도 문제없다.
const PROMPT_CHIPS: PromptChip[] = [
  { label: '오늘의 시장 브리핑', prompt: '오늘의 시장 브리핑을 요약해줘', mode: 'ask' },
  {
    label: '내 포트폴리오 분석',
    prompt: '내 포트폴리오 분석해줘:\n- 삼성전자: 40%\n- SK하이닉스: 30%\n- 현금: 30%',
    mode: 'fill',
  },
  { label: '주요 경제 뉴스 요약', prompt: '오늘 주요 경제 뉴스를 요약해줘', mode: 'ask' },
  { label: '주요 세계 뉴스 요약', prompt: '오늘 주요 세계 뉴스를 요약해줘', mode: 'ask' },
];

// index.html의 "AI 자산파일럿 서포터" 카드를 그대로 이식.
const PORTFOLIO_CHIP = PROMPT_CHIPS.filter((c) => c.mode === 'fill')[0];

// 서버(GEMINI_SYSTEM_INSTRUCTION)가 답변을 마크다운(##/### 헤딩, "1. " 번호목록, "- " 불릿,
// **볼드**)으로 만들도록 지시해두므로, 웹은 marked+DOMPurify로 HTML 렌더링한다. RN에는 DOM이
// 없어 같은 라이브러리를 쓸 수 없고, 무거운 마크다운 렌더러 의존성을 새로 넣는 대신 이 화면에
// 실제로 나오는 문법(헤딩/번호목록/불릿/볼드)만 직접 파싱해 웹과 같은 위계로 보여준다.
type AnswerBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'numbered'; index: string; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'paragraph'; text: string };

function parseAnswerBlocks(raw: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  raw.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const heading = line.match(/^#{2,3}\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] });
      return;
    }
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (numbered) {
      blocks.push({ kind: 'numbered', index: numbered[1], text: numbered[2] });
      return;
    }
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: 'bullet', text: bullet[1] });
      return;
    }
    blocks.push({ kind: 'paragraph', text: line });
  });
  return blocks;
}

// "**굵게**" 구간만 나눠서 굵은 span으로 바꾼다. 그 외 마크다운 기호는 이 화면에서 쓰이지 않아
// 다루지 않는다.
function renderInline(text: string, keyPrefix: string, boldStyle: object) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p.length > 0);
  return parts.map((part, i) => {
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return (
        <Text key={`${keyPrefix}-${i}`} style={boldStyle}>
          {boldMatch[1]}
        </Text>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

function renderAnswer(raw: string, styles: ReturnType<typeof createStyles>) {
  return parseAnswerBlocks(raw).map((block, i) => {
    const key = `ans-${i}`;
    if (block.kind === 'heading') {
      return (
        <Text key={key} style={styles.answerHeading}>
          {renderInline(block.text, key, styles.answerHeadingBold)}
        </Text>
      );
    }
    if (block.kind === 'numbered') {
      return (
        <View key={key} style={styles.answerNumberedRow}>
          <Text style={styles.answerNumberedIndex}>{block.index}.</Text>
          <Text style={styles.answerNumberedText}>{renderInline(block.text, key, styles.answerBold)}</Text>
        </View>
      );
    }
    if (block.kind === 'bullet') {
      return (
        <View key={key} style={styles.answerBulletRow}>
          <Text style={styles.answerBulletDot}>{'•'}</Text>
          <Text style={styles.answerBulletText}>{renderInline(block.text, key, styles.answerBold)}</Text>
        </View>
      );
    }
    return (
      <Text key={key} style={styles.answerParagraph}>
        {renderInline(block.text, key, styles.answerBold)}
      </Text>
    );
  });
}

type Props = {
  /** 지원금 상세의 "신청 자격 AI에게 질문하기"에서 넘어온 요약 질문 — 있으면 autoAskNonce가
   *  바뀔 때마다(같은 문구라도) 곧바로 질문을 보낸다. */
  autoAskPrompt?: string;
  autoAskNonce?: number;
};

export default function HomeAiCard({ autoAskPrompt, autoAskNonce }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, signInWithGoogle, getFreshIdToken } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "내 포트폴리오 분석" 칩을 누르면 [종목명: 비중] 작성 가이드를 함께 보여준다(index.html의
  // 가이드 카드와 동일한 의도) — 처음 쓰는 사람도 예시만 보고 바로 감을 잡을 수 있게.
  const [showGuide, setShowGuide] = useState(false);

  // AI가 "자산이 이렇게 바뀌었다"는 말을 이해하면 곧바로 저장하지 않고 제안(proposal)만 돌려준다.
  // 사용자가 아래 승인 버튼을 눌러야만 Firestore에 실제로 써진다(마이페이지 저장 로직 재사용).
  // proposalBaseRef는 제안을 계산할 때 쓴 "그 시점의" 현재 자산값 — 값이 일부 항목만 온 제안(예:
  // 주식만 변경)을 승인할 때 언급 안 된 항목을 덮어쓰지 않고 이 기준값으로 채워 저장하기 위함이다.
  const [proposal, setProposal] = useState<AssetUpdateProposal | null>(null);
  const proposalBaseRef = useRef<{ cash: number; stock: number; realestate: number }>({ cash: 0, stock: 0, realestate: 0 });
  const [savingProposal, setSavingProposal] = useState(false);
  const [proposalSaved, setProposalSaved] = useState(false);

  const ask = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || loading) return;

    if (!user) {
      const result = await signInWithGoogle();
      if (!result.ok) return;
    }

    setLoading(true);
    setError(null);
    setAnswer(null);
    setProposal(null);
    setProposalSaved(false);
    const idToken = await getFreshIdToken();

    // 자산 제안을 정확히 계산하려면(예: "주식만 50만원 늘었어") 서버가 현재 자산을 알아야 하므로,
    // 매 질문마다 최신값을 가져와 함께 보낸다 — 로그인된 상태에서만 의미가 있고 실패해도 일반
    // 질문 자체는 계속 동작해야 하므로 실패를 조용히 무시한다.
    let currentAssets: { cash: number; stock: number; realestate: number } | undefined;
    if (idToken && user) {
      try {
        const doc = await fetchUserAssets(user.uid, idToken);
        currentAssets = { cash: doc.cash, stock: doc.stock, realestate: doc.realestate };
        proposalBaseRef.current = currentAssets;
      } catch {
        // 조회 실패해도 질문 자체는 계속 진행 — 이 경우 자산 제안 정확도만 낮아질 수 있음
      }
    }

    const result = await requestAiAssist(trimmed, idToken, currentAssets);
    setLoading(false);
    if (result.ok) {
      setAnswer(result.reply);
      setProposal(result.assetUpdateProposal);
      setInput('');
      setShowGuide(false);
    } else if (result.code !== 'unauthenticated') {
      setError(result.message);
    }
  };

  const handledAskNonceRef = useRef(0);
  useEffect(() => {
    if (!autoAskNonce || autoAskNonce === handledAskNonceRef.current) return;
    handledAskNonceRef.current = autoAskNonce;
    if (autoAskPrompt) ask(autoAskPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAskNonce, autoAskPrompt]);

  const confirmProposal = async () => {
    if (!proposal || !user) return;
    const idToken = await getFreshIdToken();
    if (!idToken) {
      Alert.alert('로그인이 필요해요', '로그인 후 저장할 수 있어요.');
      return;
    }
    const base = proposalBaseRef.current;
    const next = {
      cash: typeof proposal.cash === 'number' ? proposal.cash : base.cash,
      stock: typeof proposal.stock === 'number' ? proposal.stock : base.stock,
      realestate: typeof proposal.realestate === 'number' ? proposal.realestate : base.realestate,
    };
    setSavingProposal(true);
    try {
      await saveUserAssetBreakdown(user.uid, idToken, next);
      setProposal(null);
      setProposalSaved(true);
    } catch {
      Alert.alert('저장에 실패했어요', '다시 시도해주세요.');
    } finally {
      setSavingProposal(false);
    }
  };

  const dismissProposal = () => setProposal(null);

  const applyPortfolioTemplate = () => {
    if (!PORTFOLIO_CHIP) return;
    setInput(PORTFOLIO_CHIP.prompt);
    inputRef.current?.focus();
  };

  const handleChipPress = (chip: PromptChip) => {
    if (loading) return;
    if (chip.mode === 'fill') {
      applyPortfolioTemplate();
      setShowGuide(true);
      return;
    }
    setShowGuide(false);
    ask(chip.prompt);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="sparkles" size={20} color={colors.brand} />
        <Text style={styles.title}>AI 자산파일럿 서포터</Text>
      </View>
      <Text style={styles.intro}>오늘 어떤 자산 정보를 도와드릴까요?</Text>

      <View style={styles.chipsRow}>
        {PROMPT_CHIPS.map((chip) => (
          <Pressable key={chip.label} style={styles.chip} onPress={() => handleChipPress(chip)} disabled={loading}>
            <Text style={styles.chipText}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>

      {showGuide ? (
        <View style={styles.guideCard}>
          <View style={styles.guideHead}>
            <Ionicons name="pin" size={13} color={colors.brand} />
            <Text style={styles.guideTitle}>
              작성 예시: <Text style={styles.guideTitleStrong}>[종목명: 비중]</Text> 형태로 입력하시면 가장 정확해요
            </Text>
            <Pressable onPress={() => setShowGuide(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color={colors.ink3} />
            </Pressable>
          </View>
          <View style={styles.guideExample}>
            {[
              ['삼성전자', '40%'],
              ['SK하이닉스', '30%'],
              ['현금', '30%'],
            ].map(([label, pct]) => (
              <View key={label} style={styles.guideExampleRow}>
                <Text style={styles.guideExampleLabel}>{label}</Text>
                <Text style={styles.guideExampleValue}>{pct}</Text>
              </View>
            ))}
          </View>
          <Pressable style={styles.guideApplyBtn} onPress={applyPortfolioTemplate}>
            <Ionicons name="sparkles" size={13} color={colors.brand} />
            <Text style={styles.guideApplyBtnText}>이 예시 양식 그대로 적용하기</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="절세 꿀팁이나 금융 상품을 물어보세요"
          placeholderTextColor={colors.ink3}
          value={input}
          onChangeText={setInput}
          maxLength={300}
          editable={!loading}
          multiline
          textAlignVertical="top"
        />
        <Pressable
          style={[styles.submitBtn, (loading || !input.trim()) && styles.submitBtnDisabled]}
          onPress={() => ask(input)}
          disabled={loading || !input.trim()}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="질문하기"
        >
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={20} color="#fff" />}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {answer ? <View style={styles.answerBox}>{renderAnswer(answer, styles)}</View> : null}

      {proposal ? (
        <View style={styles.proposalBox}>
          <View style={styles.proposalRows}>
            {typeof proposal.cash === 'number' ? (
              <Text style={styles.proposalRow}>현금/예적금 → {proposal.cash.toLocaleString('ko-KR')}원</Text>
            ) : null}
            {typeof proposal.stock === 'number' ? (
              <Text style={styles.proposalRow}>주식/투자금 → {proposal.stock.toLocaleString('ko-KR')}원</Text>
            ) : null}
            {typeof proposal.realestate === 'number' ? (
              <Text style={styles.proposalRow}>부동산/기타 → {proposal.realestate.toLocaleString('ko-KR')}원</Text>
            ) : null}
          </View>
          <View style={styles.proposalBtnRow}>
            <Pressable style={styles.proposalCancelBtn} onPress={dismissProposal} disabled={savingProposal}>
              <Text style={styles.proposalCancelBtnText}>취소</Text>
            </Pressable>
            <Pressable style={styles.proposalConfirmBtn} onPress={confirmProposal} disabled={savingProposal}>
              {savingProposal ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.proposalConfirmBtnText}>승인하고 저장</Text>}
            </Pressable>
          </View>
        </View>
      ) : null}
      {proposalSaved ? <Text style={styles.proposalSavedText}>마이페이지 자산 현황에 반영했어요.</Text> : null}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { marginBottom: 20, paddingVertical: 18 },
    headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
    title: { fontSize: 15, fontWeight: '700', color: colors.ink1 },
    intro: { fontSize: 13, fontWeight: '600', color: colors.ink2, marginBottom: 10 },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    chip: { backgroundColor: colors.cardSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
    chipText: { fontSize: 12, fontWeight: '600', color: colors.ink2 },
    guideCard: {
      backgroundColor: colors.brandSoft,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    guideHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10 },
    guideTitle: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.ink2, lineHeight: 18 },
    guideTitleStrong: { color: colors.brand, fontWeight: '800' },
    guideExample: { backgroundColor: colors.card, borderRadius: 12, padding: 10, marginBottom: 10 },
    guideExampleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 5,
    },
    guideExampleLabel: { fontSize: 12.5, fontWeight: '600', color: colors.ink2 },
    guideExampleValue: { fontSize: 12.5, fontWeight: '800', color: colors.brand },
    guideApplyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 11,
    },
    guideApplyBtnText: { fontSize: 12, fontWeight: '700', color: colors.brand },
    // 입력창과 버튼을 한 줄에 놓고 아래쪽 기준으로 맞춘다 — 여러 줄로 늘어나도(최대 140) 버튼은
    // 항상 마지막 줄과 같은 높이에 붙어있어(메신저 앱들의 흔한 패턴) 어색하게 붕 뜨지 않는다.
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: colors.cardSoft,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 13.5,
      color: colors.ink1,
      minHeight: 48,
      maxHeight: 140,
    },
    // 입력창의 기본(한 줄) 높이(48)와 정확히 맞춘 정사각형 버튼 — 시스템 글자 크기를 키워도
    // 아이콘 크기는 고정이라 버튼 자체가 밀리거나 커지지 않는다.
    submitBtn: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    submitBtnDisabled: { backgroundColor: colors.ink3, opacity: 0.5 },
    error: { fontSize: 12, color: colors.loss, marginTop: 10 },
    answerBox: { marginTop: 14, backgroundColor: colors.cardSoft, borderRadius: 14, padding: 14, gap: 8 },
    answerHeading: { fontSize: 14.5, fontWeight: '800', color: colors.ink1, lineHeight: 20, marginTop: 4 },
    answerHeadingBold: { fontWeight: '800', color: colors.ink1 },
    answerParagraph: { fontSize: 13.5, color: colors.ink1, lineHeight: 21 },
    answerBold: { fontWeight: '800', color: colors.ink1 },
    answerNumberedRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    answerNumberedIndex: { fontSize: 14, fontWeight: '800', color: colors.brand },
    answerNumberedText: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.ink1, lineHeight: 20 },
    answerBulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
    answerBulletDot: { fontSize: 13.5, color: colors.ink3, lineHeight: 21 },
    answerBulletText: { flex: 1, fontSize: 13.5, color: colors.ink1, lineHeight: 21 },
    proposalBox: {
      marginTop: 14,
      backgroundColor: colors.brandSoft,
      borderRadius: 14,
      padding: 14,
    },
    proposalRows: { gap: 4, marginBottom: 12 },
    proposalRow: { fontSize: 13, fontWeight: '700', color: colors.ink1 },
    proposalBtnRow: { flexDirection: 'row', gap: 8 },
    proposalCancelBtn: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 999,
      paddingVertical: 11,
      alignItems: 'center',
    },
    proposalCancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
    proposalConfirmBtn: {
      flex: 1,
      backgroundColor: colors.brand,
      borderRadius: 999,
      paddingVertical: 11,
      alignItems: 'center',
    },
    proposalConfirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    proposalSavedText: { fontSize: 12, fontWeight: '600', color: colors.brand, marginTop: 10 },
  });
}