import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import GrowthChart, { ChartPoint } from '../../components/calc/GrowthChart';
import { formatResult } from '../../lib/calc/format';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Mode = 'forward' | 'backward';

// finpilot/js/calculators.js의 calculateInflation(11. 인플레이션 계산기)을 그대로 이식.
// 물가 상승 시 체감 예시(짜장면 등)는 지금 가격 하나만 하드코딩된 대표 품목이라 이식 대상에서 제외.
export default function InflationCalculator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState<Mode>('forward');
  const [amount, setAmount] = useState(10000000);
  const [years, setYears] = useState(10);
  const [ratePct, setRatePct] = useState(3);

  const result = useMemo(() => {
    if (amount <= 0 || years <= 0) return null;
    const r = ratePct / 100;
    const realValue = amount / Math.pow(1 + r, years);
    const nominalValue = amount * Math.pow(1 + r, years);
    const loss = amount - realValue;
    const lossPct = (loss / amount) * 100;

    const points: ChartPoint[] = [];
    for (let y = 0; y <= years; y++) {
      points.push({ label: `${y}년`, value: amount / Math.pow(1 + r, y) });
    }

    return { realValue, nominalValue, loss, lossPct, points };
  }, [amount, years, ratePct]);

  const isForward = mode === 'forward';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'forward', label: '미래가치' },
            { value: 'backward', label: '과거역산' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as Mode)}
        />
        <NumberField
          label={isForward ? '보유자산 (현재 금액)' : '지금 필요한 금액'}
          value={amount}
          onChange={setAmount}
          suffix="원"
          showKoreanHint
        />
        <NumberField label={isForward ? '유지 기간 (년)' : '몇 년 전 가치가 궁금한가요'} value={years} onChange={setYears} suffix="년" />
        <NumberField label="연 물가상승률" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
      </InputPanel>

      {result ? (
        <>
          <ResultCard
            title={isForward ? `${years}년 후 실질 구매력 가치` : `${years}년 전 이 금액의 가치`}
            mainValue={`₩ ${formatResult(isForward ? result.realValue : result.nominalValue)}`}
            rows={[
              { label: isForward ? '실질 가치 손실액' : '구매력 차이', value: `₩ ${formatResult(result.loss)}`, tone: 'loss' },
              { label: '구매력 감소율', value: `${formatResult(result.lossPct)}%`, tone: 'loss' },
            ]}
          />
          <Text style={styles.note}>
            {isForward
              ? `지금의 ₩${formatResult(amount)}은 ${years}년 뒤 ₩${formatResult(result.realValue)}의 가치밖에 안 돼요.`
              : `지금 ₩${formatResult(amount)}과 같은 구매력을 가지려면 ${years}년 전에는 ₩${formatResult(result.realValue)}만 있으면 됐어요.`}
          </Text>
          <GrowthChart points={result.points} />
        </>
      ) : null}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
    note: { fontSize: 13, color: colors.ink2, lineHeight: 19, marginBottom: 12 },
  });
}
