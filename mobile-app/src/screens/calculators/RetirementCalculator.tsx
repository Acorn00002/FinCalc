import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import GrowthChart, { ChartPoint } from '../../components/calc/GrowthChart';
import { formatResult } from '../../lib/calc/format';

// finpilot/js/calculators.js의 calculateRetirement(13. 은퇴자금 계산기)를 그대로 이식.
export default function RetirementCalculator() {
  const [currentAge, setCurrentAge] = useState(35);
  const [retireAge, setRetireAge] = useState(60);
  const [lifeExpectancy, setLifeExpectancy] = useState(90);
  const [monthlyExpense, setMonthlyExpense] = useState(3000000);
  const [currentSavings, setCurrentSavings] = useState(50000000);
  const [returnPct, setReturnPct] = useState(3);

  const result = useMemo(() => {
    if (monthlyExpense <= 0 || retireAge <= currentAge || lifeExpectancy <= retireAge) return null;
    const r = returnPct / 100;
    const t = retireAge - currentAge;
    const n = lifeExpectancy - retireAge;

    const mFuture = monthlyExpense * Math.pow(1 + r, t);
    const annualExpenseAtRetirement = mFuture * 12;
    const totalNeeded = annualExpenseAtRetirement * n;

    const points: ChartPoint[] = [{ label: `${retireAge}세`, value: totalNeeded }];
    let balance = totalNeeded;
    for (let k = 0; k < n; k++) {
      const withdrawal = annualExpenseAtRetirement * Math.pow(1 + r, k);
      balance = Math.max(0, (balance - withdrawal) * (1 + r));
      points.push({ label: `${retireAge + k + 1}세`, value: balance });
    }

    const futureValueOfCurrentSavings = currentSavings * Math.pow(1 + r, t);
    const shortfall = Math.max(0, totalNeeded - futureValueOfCurrentSavings);

    const monthlyRate = r / 12;
    const months = t * 12;
    const requiredMonthly =
      months > 0 ? (monthlyRate === 0 ? shortfall / months : (shortfall * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1)) : 0;

    return { t, n, mFuture, totalNeeded, shortfall, requiredMonthly, points };
  }, [currentAge, retireAge, lifeExpectancy, monthlyExpense, currentSavings, returnPct]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="현재 나이" value={currentAge} onChange={setCurrentAge} suffix="세" />
        <NumberField label="은퇴 나이" value={retireAge} onChange={setRetireAge} suffix="세" />
        <NumberField label="기대 수명" value={lifeExpectancy} onChange={setLifeExpectancy} suffix="세" />
        <NumberField label="은퇴 후 희망 월 생활비 (현재가치)" value={monthlyExpense} onChange={setMonthlyExpense} suffix="원" showKoreanHint />
        <NumberField label="현재 보유 자산" value={currentSavings} onChange={setCurrentSavings} suffix="원" showKoreanHint />
        <NumberField label="연 실질 수익률" value={returnPct} onChange={setReturnPct} suffix="%" allowDecimal />
      </InputPanel>

      {result ? (
        <>
          <ResultCard
            title="매월 추가로 필요한 저축액"
            mainValue={`₩ ${formatResult(Math.max(0, result.requiredMonthly))}`}
            subValue={`은퇴 시점(${result.t}년 후) 총 필요자금 ₩ ${formatResult(result.totalNeeded)}`}
            rows={[
              { label: '부족 자금', value: `₩ ${formatResult(result.shortfall)}`, tone: 'loss' },
              { label: '은퇴 후 생존 기간', value: `${result.n}년` },
            ]}
          />
          <GrowthChart points={result.points} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
