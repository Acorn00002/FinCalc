import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

const BASIC_DEDUCTION = 2500000;

// finpilot/js/calculators.js의 calculateGlobalStockTax(28. 해외주식 양도세 계산기)를 그대로 이식.
export default function GlobalStockTaxCalculator() {
  const [gain, setGain] = useState(10000000);

  const result = useMemo(() => {
    if (gain <= 0) return null;
    const deduction = Math.min(BASIC_DEDUCTION, gain);
    const taxBase = Math.max(0, gain - BASIC_DEDUCTION);
    const incomeTax = taxBase * 0.2;
    const localTax = taxBase * 0.02;
    const totalTax = incomeTax + localTax;
    const netGain = gain - totalTax;
    return { deduction, taxBase, incomeTax, localTax, totalTax, netGain };
  }, [gain]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="연간 총 양도차익" value={gain} onChange={setGain} suffix="원" showKoreanHint />
      </InputPanel>

      {result ? (
        <ResultCard
          title="세후 순수익"
          mainValue={`₩ ${formatResult(result.netGain)}`}
          subValue={`기본공제 ₩250만 적용 후 22%(양도세 20%+지방세 2%) 과세`}
          rows={[
            { label: '과세표준', value: `₩ ${formatResult(result.taxBase)}` },
            { label: '양도소득세', value: `- ₩ ${formatResult(result.incomeTax)}`, tone: 'loss' },
            { label: '지방소득세', value: `- ₩ ${formatResult(result.localTax)}`, tone: 'loss' },
            { label: '총 세액', value: `₩ ${formatResult(result.totalTax)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
