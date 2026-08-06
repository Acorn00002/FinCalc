import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

// finpilot/js/calculators.js의 calculateKelly(3. 켈리 공식 계산기)를 그대로 이식.
export default function KellyCalculator() {
  const [winRatePct, setWinRatePct] = useState(55);
  const [profitRatio, setProfitRatio] = useState(1.5);
  const [lossRatio, setLossRatio] = useState(1);

  const result = useMemo(() => {
    if (!winRatePct || !profitRatio || !lossRatio) return null;
    const winRate = winRatePct / 100;
    const R = profitRatio / lossRatio;
    const kellyPct = (winRate - (1 - winRate) / R) * 100;
    return { kellyPct };
  }, [winRatePct, profitRatio, lossRatio]);

  const isNegative = result !== null && result.kellyPct <= 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="승률" value={winRatePct} onChange={setWinRatePct} suffix="%" allowDecimal />
        <NumberField label="이익 비율 (이길 때 배수)" value={profitRatio} onChange={setProfitRatio} allowDecimal />
        <NumberField label="손실 비율 (질 때 배수)" value={lossRatio} onChange={setLossRatio} allowDecimal />
      </InputPanel>

      {result ? (
        <ResultCard
          title="켈리 비중"
          mainValue={isNegative ? '0%' : `${formatResult(result.kellyPct)}%`}
          subValue={
            isNegative
              ? '기대 수익이 마이너스이거나 너무 낮아요. 투자를 권장하지 않아요.'
              : `안정성을 위해 Half-Kelly (${formatResult(result.kellyPct / 2)}%) 비중을 추천해요.`
          }
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
