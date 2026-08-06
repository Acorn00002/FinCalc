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

// finpilot/js/calculators.js의 calculateLoanLimit(20. 대출한도 계산기)를 그대로 이식.
export default function LoanLimitCalculator() {
  const [area, setArea] = useState<Area>('regulated');
  const [homePrice, setHomePrice] = useState(600000000);
  const [income, setIncome] = useState(60000000);
  const [existingDebt, setExistingDebt] = useState(0);
  const [ratePct, setRatePct] = useState(4);
  const [termYears, setTermYears] = useState(30);

  const result = useMemo(() => {
    if (homePrice <= 0) return null;
    const ltvPct = area === 'regulated' ? 0.6 : 0.7;
    const ltvAmount = homePrice * ltvPct;
    const dsrBudget = Math.max(0, income * 0.4 - existingDebt);
    const dsrAmount = calcDsrLoanAmount(dsrBudget, ratePct, termYears);
    const finalAmount = Math.max(0, Math.min(ltvAmount, dsrAmount));
    const appliedRule = ltvAmount <= dsrAmount ? 'LTV 기준 (더 낮은 한도가 적용돼요)' : 'DSR 기준 (더 낮은 한도가 적용돼요)';
    return { ltvPct, ltvAmount, dsrAmount, dsrBudget, finalAmount, appliedRule };
  }, [area, homePrice, income, existingDebt, ratePct, termYears]);

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
        <NumberField label="주택가격" value={homePrice} onChange={setHomePrice} suffix="원" showKoreanHint />
        <NumberField label="연소득" value={income} onChange={setIncome} suffix="원" showKoreanHint />
        <NumberField label="기존 대출 연 상환액 (선택)" value={existingDebt} onChange={setExistingDebt} suffix="원" showKoreanHint />
        <NumberField label="예상 금리" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="대출 기간" value={termYears} onChange={setTermYears} suffix="년" />
      </InputPanel>

      {result ? (
        <ResultCard
          title="최종 대출한도"
          mainValue={`₩ ${formatResult(result.finalAmount)}`}
          subValue={result.appliedRule}
          rows={[
            { label: `LTV 기준 (${Math.round(result.ltvPct * 100)}%)`, value: `₩ ${formatResult(result.ltvAmount)}` },
            { label: 'DSR 기준 (40%)', value: `₩ ${formatResult(result.dsrAmount)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
