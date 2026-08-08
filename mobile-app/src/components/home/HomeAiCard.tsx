import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../ui/Card';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { requestAiAssist } from '../../lib/aiAssist';
import type { ThemeColors } from '../../constants/theme';

const PROMPT_CHIPS = [
  '오늘의 시장 브리핑을 요약해줘',
  '내 포트폴리오를 분석해줘',
  '오늘 주요 경제 뉴스를 요약해줘',
  '오늘 주요 세계 뉴스를 요약해줘',
];

const CHIP_LABELS = ['오늘의 시장 브리핑', '내 포트폴리오 분석', '주요 경제 뉴스 요약', '주요 세계 뉴스 요약'];

// index.html의 "AI 자산파일럿 서포터" 카드를 그대로 이식 — 마크다운 렌더링 라이브러리를 새로
// 추가하지 않고 우선 일반 텍스트로 답변을 보여준다(v1 단순화).
export default function HomeAiCard() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { user, signInWithGoogle, getFreshIdToken } = useAuth();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } else if (result.code !== 'unauthenticated') {
      setError(result.message);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <Ionicons name="sparkles" size={20} color={colors.brand} />
        <Text style={styles.title}>AI 자산파일럿 서포터</Text>
      </View>
      <Text style={styles.intro}>오늘 어떤 자산 정보를 도와드릴까요?</Text>

      <View style={styles.chipsRow}>
        {PROMPT_CHIPS.map((prompt, i) => (
          <Pressable key={prompt} style={styles.chip} onPress={() => ask(prompt)} disabled={loading}>
            <Text style={styles.chipText}>{CHIP_LABELS[i]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="절세 꿀팁이나 금융 상품을 물어보세요"
          placeholderTextColor={colors.ink3}
          value={input}
          onChangeText={setInput}
          maxLength={300}
          editable={!loading}
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
    inputRow: { gap: 10 },
    input: {
      backgroundColor: colors.cardSoft,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 13.5,
      color: colors.ink1,
    },
    submitBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
    submitBtnText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
    error: { fontSize: 12, color: colors.loss, marginTop: 10 },
    answerBox: { marginTop: 14, backgroundColor: colors.cardSoft, borderRadius: 14, padding: 14 },
    answerText: { fontSize: 13.5, color: colors.ink1, lineHeight: 20 },
  });
}