import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

const AMOUNT_CHIPS = [
  { amount: 10000000, label: '+1000만' },
  { amount: 100000000, label: '+1억' },
];

// finpilot/js/calculators.js의 calculateGoalPlanner(2.5 목표 자산 역계산기)를 그대로 이식.
export default function GoalPlannerCalculator() {
  const [goal, setGoal] = useState(500000000);
  const [current, setCurrent] = useState(0);
  const [ratePct, setRatePct] = useState(6);
  const [years, setYears] = useState(10);

  const result = useMemo(() => {
    if (goal <= 0 || years <= 0) return null;
    const rate = ratePct / 100;
    const monthlyRate = rate / 12;
    const months = years * 12;

    let requiredMonthly: number;
    if (rate === 0) {
      requiredMonthly = (goal - current) / months;
    } else {
      const futureValueOfCurrent = current * Math.pow(1 + monthlyRate, months);
      const remainingGoal = goal - futureValueOfCurrent;
      requiredMonthly = remainingGoal <= 0 ? 0 : (remainingGoal * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
    }

    const totalPrincipal = current + requiredMonthly * months;
    const totalProfit = goal - totalPrincipal;
    return { requiredMonthly, totalPrincipal, totalProfit };
  }, [goal, current, ratePct, years]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="목표 금액" value={goal} onChange={setGoal} suffix="원" quickAdds={AMOUNT_CHIPS} showKoreanHint />
        <NumberField label="현재 보유 자산 (선택)" value={current} onChange={setCurrent} suffix="원" showKoreanHint />
        <NumberField label="연 수익률" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="목표 기간" value={years} onChange={setYears} suffix="년" />
      </InputPanel>

      {result ? (
        <ResultCard
          title="매월 필요 적립액"
          mainValue={`₩ ${formatResult(Math.max(0, result.requiredMonthly))}`}
          rows={[
            { label: '총 납입 원금', value: `₩ ${formatResult(result.totalPrincipal)}` },
            { label: '예상 총 수익', value: `₩ ${formatResult(result.totalProfit)}`, tone: 'profit' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
