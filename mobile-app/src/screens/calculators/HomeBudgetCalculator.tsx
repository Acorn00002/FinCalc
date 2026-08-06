import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

function calcDsrLoanAmount(dsrBudget: number, ratePct: number, termYears: number): number {
  const monthlyBudget = dsrBudget / 12;
  const monthlyRate = ratePct / 100 / 12;
  const totalMonths = termYears * 12;
  if (monthlyRate > 0) return (monthlyBudget * (1 - Math.pow(1 + monthlyRate, -totalMonths))) / monthlyRate;
  return monthlyBudget * totalMonths;
}

type Area = 'regulated' | 'non-regulated';

// finpilot/js/calculators.js의 calculateHomeBudget(27. 내집마련 계산기)를 그대로 이식.
export default function HomeBudgetCalculator() {
  const [area, setArea] = useState<Area>('regulated');
  const [cash, setCash] = useState(300000000);
  const [income, setIncome] = useState(60000000);
  const [existingDebt, setExistingDebt] = useState(0);
  const [ratePct, setRatePct] = useState(4);
  const [termYears, setTermYears] = useState(30);

  const result = useMemo(() => {
    if (cash <= 0) return null;
    const ltvPct = area === 'regulated' ? 0.6 : 0.7;
    const dsrBudget = Math.max(0, income * 0.4 - existingDebt);
    const dsrLoanAmount = calcDsrLoanAmount(dsrBudget, ratePct, termYears);

    const priceByLtv = cash / (1 - ltvPct);
    const priceByDsr = cash + dsrLoanAmount;
    const target = Math.min(priceByLtv, priceByDsr);
    const appliedRule = priceByLtv <= priceByDsr ? 'LTV 기준 (더 낮은 한도가 적용돼요)' : 'DSR 기준 (더 낮은 한도가 적용돼요)';
    const requiredLoan = Math.max(0, target - cash);

    return { priceByLtv, priceByDsr, target, appliedRule, requiredLoan };
  }, [area, cash, income, existingDebt, ratePct, termYears]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'regulated', label: '규제지역 (LTV 60%)' },
            { value: 'non-regulated', label: '비규제지역 (LTV 70%)' },
          ]}
          value={area}
          onChange={(v) => setArea(v as Area)}
        />
        <NumberField label="보유 현금" value={cash} onChange={setCash} suffix="원" showKoreanHint />
        <NumberField label="연소득" value={income} onChange={setIncome} suffix="원" showKoreanHint />
        <NumberField label="기존 대출 연 상환액 (선택)" value={existingDebt} onChange={setExistingDebt} suffix="원" showKoreanHint />
        <NumberField label="예상 금리" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="대출 기간" value={termYears} onChange={setTermYears} suffix="년" />
      </InputPanel>

      {result ? (
        <ResultCard
          title="매수 가능 목표가"
          mainValue={`₩ ${formatResult(result.target)}`}
          subValue={result.appliedRule}
          rows={[
            { label: 'LTV 기준 매수가능가', value: `₩ ${formatResult(result.priceByLtv)}` },
            { label: 'DSR 기준 매수가능가', value: `₩ ${formatResult(result.priceByDsr)}` },
            { label: '필요 대출액', value: `₩ ${formatResult(result.requiredLoan)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
