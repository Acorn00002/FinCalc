import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import AdvancedOptions from '../../components/calc/AdvancedOptions';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import GrowthChart, { ChartPoint } from '../../components/calc/GrowthChart';
import DataTable from '../../components/calc/DataTable';
import { formatResult } from '../../lib/calc/format';

const AMOUNT_CHIPS = [
  { amount: 1000000, label: '+100만' },
  { amount: 10000000, label: '+1000만' },
  { amount: 100000000, label: '+1억' },
];
const ADDITION_CHIPS = [
  { amount: 100000, label: '+10만' },
  { amount: 500000, label: '+50만' },
  { amount: 1000000, label: '+100만' },
];

const TABLE_COLUMNS = [
  { key: 'year', label: '연차' },
  { key: 'principal', label: '원금' },
  { key: 'profit', label: '세전수익' },
  { key: 'final', label: '최종자산' },
];

// finpilot/js/calculators.js의 calculatePeriodicCompound(2. 적립식 복리 계산기)를 그대로 이식.
export default function CompoundPeriodicCalculator() {
  const [principal, setPrincipal] = useState(0);
  const [monthlyAddition, setMonthlyAddition] = useState(500000);
  const [ratePct, setRatePct] = useState(6);
  const [years, setYears] = useState(10);
  const [compoundsPerYear, setCompoundsPerYear] = useState('12');
  const [taxRatePct, setTaxRatePct] = useState(0);
  const [inflationRatePct, setInflationRatePct] = useState(0);

  const result = useMemo(() => {
    const rate = ratePct / 100;
    const taxRate = taxRatePct / 100;
    const inflationRate = inflationRatePct / 100;
    const freq = parseInt(compoundsPerYear, 10);

    let totalPrincipal = principal;
    let currentAmount = principal;
    const ratePerPeriod = rate / freq;
    const additionPerPeriod = (monthlyAddition * 12) / freq;
    const points: ChartPoint[] = [{ label: '0년', value: principal }];
    const tableRows: { year: string; principal: string; profit: string; final: string }[] = [
      { year: '0년', principal: `₩${formatResult(principal)}`, profit: `₩${formatResult(0)}`, final: `₩${formatResult(principal)}` },
    ];

    for (let y = 1; y <= years; y++) {
      for (let p = 0; p < freq; p++) {
        currentAmount += additionPerPeriod;
        currentAmount *= 1 + ratePerPeriod;
        totalPrincipal += additionPerPeriod;
      }
      points.push({ label: `${y}년`, value: currentAmount });
      const yearProfit = currentAmount - totalPrincipal;
      tableRows.push({
        year: `${y}년`,
        principal: `₩${formatResult(totalPrincipal)}`,
        profit: `₩${formatResult(yearProfit)}`,
        final: `₩${formatResult(currentAmount)}`,
      });
    }

    let profit = currentAmount - totalPrincipal;
    let taxAmount = 0;
    if (taxRate > 0 && profit > 0) {
      taxAmount = profit * taxRate;
      profit -= taxAmount;
    }
    const finalAmountAfterTax = totalPrincipal + profit;
    const realValue = inflationRate > 0 ? finalAmountAfterTax / Math.pow(1 + inflationRate, years) : null;

    return { points, tableRows, totalPrincipal, profit, taxAmount, finalAmountAfterTax, realValue };
  }, [principal, monthlyAddition, ratePct, years, compoundsPerYear, taxRatePct, inflationRatePct]);

  const hasInput = monthlyAddition > 0 && years > 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="초기 원금 (선택)" value={principal} onChange={setPrincipal} suffix="원" quickAdds={AMOUNT_CHIPS} showKoreanHint />
        <NumberField label="매월 적립액" value={monthlyAddition} onChange={setMonthlyAddition} suffix="원" quickAdds={ADDITION_CHIPS} showKoreanHint />
        <NumberField label="연 수익률" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="투자 기간" value={years} onChange={setYears} suffix="년" />
        <SegmentedControl
          options={[
            { value: '12', label: '월 복리' },
            { value: '1', label: '연 복리' },
            { value: '2', label: '반기 복리' },
          ]}
          value={compoundsPerYear}
          onChange={setCompoundsPerYear}
        />
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
              { label: '납입 원금', value: `₩ ${formatResult(result.totalPrincipal)}` },
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
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
