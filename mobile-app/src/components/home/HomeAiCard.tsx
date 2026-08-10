import React, { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../ui/Card';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { requestAiAssist } from '../../lib/aiAssist';
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

// index.html의 "AI 자산파일럿 서포터" 카드를 그대로 이식 — 마크다운 렌더링 라이브러리를 새로
// 추가하지 않고 우선 일반 텍스트로 답변을 보여준다(v1 단순화).
const PORTFOLIO_CHIP = PROMPT_CHIPS.filter((c) => c.mode === 'fill')[0];

export default function HomeAiCard() {
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
    const idToken = await getFreshIdToken();
    const result = await requestAiAssist(trimmed, idToken);
    setLoading(false);
    if (result.ok) {
      setAnswer(result.reply);
      setInput('');
      setShowGuide(false);
    } else if (result.code !== 'unauthenticated') {
      setError(result.message);
    }
  };

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
        <Pressable style={styles.submitBtn} onPress={() => ask(input)} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitBtnText}>질문하기</Text>}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {answer ? (
        <View style={styles.answerBox}>
          <Text style={styles.answerText}>{answer}</Text>
        </View>
      ) : null}
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
    inputRow: { gap: 10 },
    input: {
      backgroundColor: colors.cardSoft,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 13.5,
      color: colors.ink1,
      minHeight: 46,
      maxHeight: 140,
    },
    submitBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
    submitBtnText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
    error: { fontSize: 12, color: colors.loss, marginTop: 10 },
    answerBox: { marginTop: 14, backgroundColor: colors.cardSoft, borderRadius: 14, padding: 14 },
    answerText: { fontSize: 13.5, color: colors.ink1, lineHeight: 20 },
  });
}