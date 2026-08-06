import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import AppScreen from '../components/AppScreen';
import ScreenTitleBar from '../components/ui/ScreenTitleBar';
import Card from '../components/ui/Card';
import GrowthChart, { ChartPoint } from '../components/calc/GrowthChart';
import { useAppTheme } from '../context/ThemeContext';
import { formatKoreanUnit, formatResult } from '../lib/calc/format';
import { projectFutureSavings, projectLoanInterestSaved, SIM_YEARS } from '../lib/calc/futureAssetSim';
import type { ThemeColors } from '../constants/theme';

const SAVINGS_MAX = 2000000;
const SAVINGS_QUICK_ADDS = [100000, 500000];
const LOAN_MAX = 1000000;
const LOAN_QUICK_ADDS = [100000, 500000];

// 토스 스타일 "미래 자산 예측 시뮬레이터" — 입력창 없이 슬라이더 + 원터치 버튼만으로 월 저축액/대출
// 추가상환액을 조절하면 5년 뒤 예상 자산과 절감 이자가 그 자리에서 부드럽게 갱신된다.
export default function FutureSimulatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [monthlySavings, setMonthlySavings] = useState(500000);
  const [extraLoanPayment, setExtraLoanPayment] = useState(200000);

  const savingsResult = useMemo(() => projectFutureSavings(monthlySavings), [monthlySavings]);
  const loanResult = useMemo(() => projectLoanInterestSaved(extraLoanPayment), [extraLoanPayment]);

  const chartPoints: ChartPoint[] = useMemo(() => {
    // 연도별 곡선은 매년 시점까지의 월 적립 복리 공식을 그대로 적용해 근사한다.
    const r = 0.04 / 12;
    const points: ChartPoint[] = [];
    for (let y = 0; y <= SIM_YEARS; y++) {
      const months = y * 12;
      const fv = months === 0 ? 0 : monthlySavings * ((Math.pow(1 + r, months) - 1) / r);
      points.push({ label: `${y}년`, value: fv });
    }
    return points;
  }, [monthlySavings]);

  return (
    <AppScreen>
      <ScreenTitleBar title="미래 자산 시뮬레이터" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>월 {formatResult(monthlySavings)}원씩 모으면</Text>
          <Text style={styles.heroValue}>{SIM_YEARS}년 뒤 +{formatKoreanUnit(savingsResult.futureValue)}</Text>
          <Text style={styles.heroSub}>
            원금 ₩{formatResult(savingsResult.principal)} · 수익 ₩{formatResult(savingsResult.profit)} (연 4% 가정)
          </Text>
        </Card>

        <GrowthChart points={chartPoints} />

        <Text style={styles.sliderLabel}>월 저축액</Text>
        <Text style={styles.sliderValue}>{formatKoreanUnit(monthlySavings)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={SAVINGS_MAX}
          step={10000}
          value={monthlySavings}
          onValueChange={setMonthlySavings}
          minimumTrackTintColor={colors.brand}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.brand}
        />
        <View style={styles.quickRow}>
          {SAVINGS_QUICK_ADDS.map((amt) => (
            <Pressable
              key={amt}
              style={styles.quickBtn}
              onPress={() => setMonthlySavings((v) => Math.min(SAVINGS_MAX, v + amt))}
            >
              <Text style={styles.quickBtnText}>+{formatKoreanUnit(amt)}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.quickBtn} onPress={() => setMonthlySavings(0)}>
            <Text style={styles.quickBtnText}>초기화</Text>
          </Pressable>
        </View>

        <Card style={[styles.heroCard, styles.loanCard]}>
          <Text style={styles.heroLabel}>매달 {formatResult(extraLoanPayment)}원씩 더 갚으면</Text>
          <Text style={styles.heroValueLoss}>이자 -{formatKoreanUnit(loanResult.interestSaved)} 절감</Text>
          <Text style={styles.heroSub}>3억원 · 연 4% · 30년 대출 기준 시나리오</Text>
        </Card>

        <Text style={styles.sliderLabel}>대출 추가 상환금</Text>
        <Text style={styles.sliderValue}>{formatKoreanUnit(extraLoanPayment)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={LOAN_MAX}
          step={10000}
          value={extraLoanPayment}
          onValueChange={setExtraLoanPayment}
          minimumTrackTintColor={colors.loss}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.loss}
        />
        <View style={styles.quickRow}>
          {LOAN_QUICK_ADDS.map((amt) => (
            <Pressable
              key={amt}
              style={styles.quickBtn}
              onPress={() => setExtraLoanPayment((v) => Math.min(LOAN_MAX, v + amt))}
            >
              <Text style={styles.quickBtnText}>+{formatKoreanUnit(amt)}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.quickBtn} onPress={() => setExtraLoanPayment(0)}>
            <Text style={styles.quickBtnText}>초기화</Text>
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, paddingBottom: 40 },
    heroCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 16 },
    loanCard: { marginTop: 8 },
    heroLabel: { fontSize: 13, color: colors.ink3, marginBottom: 8 },
    heroValue: { fontSize: 24, fontWeight: '800', color: colors.brand, marginBottom: 8 },
    heroValueLoss: { fontSize: 24, fontWeight: '800', color: colors.loss, marginBottom: 8 },
    heroSub: { fontSize: 12, color: colors.ink3 },
    sliderLabel: { fontSize: 13, fontWeight: '700', color: colors.ink2, marginTop: 20 },
    sliderValue: { fontSize: 20, fontWeight: '800', color: colors.ink1, marginTop: 4, marginBottom: 4 },
    slider: { width: '100%', height: 40 },
    quickRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
    quickBtn: { backgroundColor: colors.cardSoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    quickBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
  });
}
