import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import AdvancedOptions from '../../components/calc/AdvancedOptions';
import ResultCard from '../../components/calc/ResultCard';
import GrowthChart, { ChartPoint } from '../../components/calc/GrowthChart';
import DataTable from '../../components/calc/DataTable';
import TheoryBox from '../../components/calc/TheoryBox';
import { formatResult } from '../../lib/calc/format';

const PRINCIPAL_CHIPS = [
  { amount: 10000, label: '+1만' },
  { amount: 100000, label: '+10만' },
  { amount: 1000000, label: '+100만' },
  { amount: 10000000, label: '+1000만' },
  { amount: 100000000, label: '+1억' },
];

const TABLE_COLUMNS = [
  { key: 'year', label: '연차' },
  { key: 'principal', label: '원금' },
  { key: 'profit', label: '세전수익' },
  { key: 'final', label: '최종자산' },
];

// finpilot/js/calculators.js의 calculateSimpleCompound(1. 일반 복리 계산기)를 그대로 이식.
export default function CompoundSimpleCalculator() {
  const [principal, setPrincipal] = useState(10000000);
  const [ratePct, setRatePct] = useState(5);
  const [years, setYears] = useState(10);
  const [taxRatePct, setTaxRatePct] = useState(0);
  const [inflationRatePct, setInflationRatePct] = useState(0);

  const result = useMemo(() => {
    const rate = ratePct / 100;
    const taxRate = taxRatePct / 100;
    const inflationRate = inflationRatePct / 100;

    const points: ChartPoint[] = [];
    const tableRows: { year: string; principal: string; profit: string; final: string }[] = [];
    let currentAmount = principal;
    for (let i = 0; i <= years; i++) {
      if (i > 0) currentAmount *= 1 + rate;
      points.push({ label: `${i}년`, value: currentAmount });
      const yearProfit = currentAmount - principal;
      tableRows.push({
        year: `${i}년`,
        principal: `₩${formatResult(principal)}`,
        profit: `₩${formatResult(yearProfit)}`,
        final: `₩${formatResult(currentAmount)}`,
      });
    }

    const finalAmount = principal * Math.pow(1 + rate, years);
    let profit = finalAmount - principal;
    let taxAmount = 0;
    if (taxRate > 0 && profit > 0) {
      taxAmount = profit * taxRate;
      profit -= taxAmount;
    }
    const finalAmountAfterTax = principal + profit;
    const realValue = inflationRate > 0 ? finalAmountAfterTax / Math.pow(1 + inflationRate, years) : null;

    return { points, tableRows, profit, taxAmount, finalAmountAfterTax, realValue };
  }, [principal, ratePct, years, taxRatePct, inflationRatePct]);

  const hasInput = principal > 0 && years > 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="원금" value={principal} onChange={setPrincipal} suffix="원" quickAdds={PRINCIPAL_CHIPS} showKoreanHint />
        <NumberField label="연 수익률" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="투자 기간" value={years} onChange={setYears} suffix="년" />
        <AdvancedOptions>
          <NumberField label="세율 (선택)" value={taxRatePct} onChange={setTaxRatePct} suffix="%" allowDecimal />
          <NumberField label="물가상승률 (선택)" value={inflationRatePct} onChange={setInflationRatePct} suffix="%" allowDecimal />
        </AdvancedOptions>
      </InputPanel>

      {hasInput ? (
        <>
          <ResultCard
            title="세후 최종 자산"
            mainValue={`₩ ${formatResult(result.finalAmountAfterTax)}`}
            subValue={result.realValue !== null ? `현재 가치 환산: ₩ ${formatResult(result.realValue)}` : undefined}
            rows={[
              { label: '원금', value: `₩ ${formatResult(principal)}` },
              {
                label: '수익',
                value:
                  result.taxAmount > 0
                    ? `₩ ${formatResult(result.profit)} (세후, 세금 ₩ ${formatResult(result.taxAmount)})`
                    : `₩ ${formatResult(result.profit)}`,
                tone: 'profit',
              },
            ]}
          />
          <GrowthChart points={result.points} />
          <DataTable columns={TABLE_COLUMNS} rows={result.tableRows} />
          <TheoryBox title="💡 72의 법칙" description="자산이 2배가 되는 데 걸리는 시간(년) = 72 ÷ 연 수익률" />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
