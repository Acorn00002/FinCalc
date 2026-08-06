import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AppScreen from '../components/AppScreen';
import ScreenTitleBar from '../components/ui/ScreenTitleBar';
import Card from '../components/ui/Card';
import InputPanel from '../components/calc/InputPanel';
import NumberField from '../components/calc/NumberField';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getAssetProfile, saveAssetProfile, AssetProfile } from '../lib/assetProfile';
import { AGE_BRACKETS, computeAssetHealthScore, estimateTopPercentile } from '../lib/calc/netWorthBenchmark';
import { formatKoreanUnit } from '../lib/calc/format';
import type { ThemeColors } from '../constants/theme';
import type { AgeBracketId } from '../lib/calc/netWorthBenchmark';

const ASSET_QUICK_ADDS = [
  { amount: 10_000_000, label: '+1000만' },
  { amount: 100_000_000, label: '+1억' },
];
const DEBT_QUICK_ADDS = [
  { amount: 10_000_000, label: '+1000만' },
  { amount: 100_000_000, label: '+1억' },
];

// 자산 비교 & 자산 점수 카드 — 통계청 2024년 가계금융복지조사의 연령대별 평균 순자산을 기준으로
// "내 연령대 상위 OO%"와 "자산 체력 점수"를 계산해 보여주는 토스 스타일 화면. 로그인 계정에
// 연령/자산 필드가 없어(스키마 밖 값), 최초 1회 직접 입력받아 기기에 저장하고 이후엔 그 값을 재사용한다.
export default function AssetScoreScreen() {
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [profile, setProfile] = useState<AssetProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [ageBracket, setAgeBracket] = useState<AgeBracketId>('20s');
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);

  useEffect(() => {
    getAssetProfile().then((saved) => {
      if (saved) {
        setProfile(saved);
        setAgeBracket(saved.ageBracket);
        setTotalAssets(saved.totalAssets);
        setTotalDebt(saved.totalDebt);
      } else {
        setEditing(true);
      }
      setLoading(false);
    });
  }, []);

  const result = useMemo(() => {
    if (!profile) return null;
    const netWorth = profile.totalAssets - profile.totalDebt;
    return {
      netWorth,
      topPercentile: estimateTopPercentile(profile.ageBracket, netWorth),
      score: computeAssetHealthScore(profile.ageBracket, profile.totalAssets, profile.totalDebt),
    };
  }, [profile]);

  const bracketLabel = (id: AgeBracketId) => AGE_BRACKETS.find((b) => b.id === id)!.label;

  const handleSubmit = async () => {
    const next: AssetProfile = { ageBracket, totalAssets, totalDebt };
    await saveAssetProfile(next);
    setProfile(next);
    setEditing(false);
  };

  if (loading) return <AppScreen><ScreenTitleBar title="자산 비교 & 점수" /></AppScreen>;

  return (
    <AppScreen>
      <ScreenTitleBar title="자산 비교 & 점수" />
      <ScrollView contentContainerStyle={styles.content}>
        {!editing && profile && result ? (
          <>
            <Card style={styles.heroCard}>
              <Text style={styles.heroName}>
                {(user?.displayName || '회원')}님은 {bracketLabel(profile.ageBracket)} 상위 {result.topPercentile}%입니다
              </Text>
              <View style={styles.gaugeTrack}>
                <View style={[styles.gaugeFill, { width: `${100 - result.topPercentile}%` }]} />
              </View>
              <Text style={styles.gaugeCaption}>상위 {result.topPercentile}% · 순자산 {formatKoreanUnit(result.netWorth)}</Text>
            </Card>

            <Card style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>자산 체력 점수</Text>
              <Text style={styles.scoreValue}>{result.score}<Text style={styles.scoreMax}> / 100점</Text></Text>
              <View style={styles.gaugeTrack}>
                <View style={[styles.gaugeFill, styles.scoreFill, { width: `${result.score}%` }]} />
              </View>
              <Text style={styles.disclaimer}>
                통계청 2024년 가계금융복지조사(연령대별 평균 순자산) 기준 추정치예요. 순자산 위치와 부채비율을 함께
                반영했어요.
              </Text>
            </Card>

            <Pressable style={styles.editBtn} onPress={() => setEditing(true)}>
              <Text style={styles.editBtnText}>내 자산 정보 다시 입력하기</Text>
            </Pressable>
          </>
        ) : (
          <>
            <InputPanel>
              <Text style={styles.fieldLabel}>연령대</Text>
              <View style={styles.bracketRow}>
                {AGE_BRACKETS.map((b) => (
                  <Pressable
                    key={b.id}
                    style={[styles.bracketChip, ageBracket === b.id && styles.bracketChipActive]}
                    onPress={() => setAgeBracket(b.id)}
                  >
                    <Text style={[styles.bracketChipText, ageBracket === b.id && styles.bracketChipTextActive]}>
                      {b.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <NumberField
                label="총자산 (부동산·예적금·주식 등 합계)"
                value={totalAssets}
                onChange={setTotalAssets}
                suffix="원"
                quickAdds={ASSET_QUICK_ADDS}
                showKoreanHint
              />
              <NumberField
                label="총부채 (대출·카드론 등 합계)"
                value={totalDebt}
                onChange={setTotalDebt}
                suffix="원"
                quickAdds={DEBT_QUICK_ADDS}
                showKoreanHint
              />
            </InputPanel>
            <Pressable style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitBtnText}>내 자산 등급 확인하기</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, paddingBottom: 40 },
    heroCard: { alignItems: 'flex-start', paddingVertical: 22, marginBottom: 14 },
    heroName: { fontSize: 19, fontWeight: '800', color: colors.ink1, marginBottom: 16, lineHeight: 26 },
    gaugeTrack: { width: '100%', height: 10, borderRadius: 999, backgroundColor: colors.cardSoft, overflow: 'hidden' },
    gaugeFill: { height: '100%', borderRadius: 999, backgroundColor: colors.brand },
    gaugeCaption: { fontSize: 12.5, color: colors.ink3, marginTop: 8, fontWeight: '600' },
    scoreCard: { alignItems: 'flex-start', paddingVertical: 22, marginBottom: 16 },
    scoreLabel: { fontSize: 13, fontWeight: '700', color: colors.ink3, marginBottom: 6 },
    scoreValue: { fontSize: 32, fontWeight: '800', color: colors.brand, marginBottom: 14 },
    scoreMax: { fontSize: 15, fontWeight: '700', color: colors.ink3 },
    scoreFill: { backgroundColor: colors.profit },
    disclaimer: { fontSize: 11.5, color: colors.ink3, marginTop: 12, lineHeight: 16 },
    editBtn: { alignItems: 'center', paddingVertical: 14 },
    editBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink3 },
    fieldLabel: { fontSize: 13.5, fontWeight: '700', color: colors.ink2, marginBottom: 10 },
    bracketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
    bracketChip: { backgroundColor: colors.cardSoft, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
    bracketChipActive: { backgroundColor: colors.brand },
    bracketChipText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
    bracketChipTextActive: { color: '#fff' },
    submitBtn: { backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    submitBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  });
}
