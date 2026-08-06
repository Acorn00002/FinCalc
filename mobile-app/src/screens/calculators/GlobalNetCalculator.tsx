import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

// finpilot/js/calculators.js의 calculateGlobalNet(29. 해외주식 실수령 계산기)를 그대로 이식.
export default function GlobalNetCalculator() {
  const [grossUsd, setGrossUsd] = useState(1000);
  const [feeRatePct, setFeeRatePct] = useState(0.25);
  const [taxRatePct, setTaxRatePct] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1350);

  const result = useMemo(() => {
    if (grossUsd <= 0 || exchangeRate <= 0) return null;
    const feeDeducted = grossUsd * (feeRatePct / 100);
    const taxDeducted = grossUsd * (taxRatePct / 100);
    const netUsd = Math.max(0, grossUsd - feeDeducted - taxDeducted);
    const netKrw = netUsd * exchangeRate;
    return { feeDeducted, taxDeducted, netUsd, netKrw };
  }, [grossUsd, feeRatePct, taxRatePct, exchangeRate]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="매도 총액" value={grossUsd} onChange={setGrossUsd} suffix="USD" allowDecimal />
        <NumberField label="수수료율" value={feeRatePct} onChange={setFeeRatePct} suffix="%" allowDecimal />
        <NumberField label="원천징수세율 (선택)" value={taxRatePct} onChange={setTaxRatePct} suffix="%" allowDecimal />
        <NumberField label="적용 환율" value={exchangeRate} onChange={setExchangeRate} suffix="원/$" allowDecimal />
      </InputPanel>

      {result ? (
        <ResultCard
          title="원화 실수령액"
          mainValue={`₩ ${formatResult(result.netKrw)}`}
          subValue={`실수령 $${formatResult(result.netUsd)}`}
          rows={[
            { label: '수수료', value: `- $${formatResult(result.feeDeducted)}`, tone: 'loss' },
            { label: '원천징수세', value: `- $${formatResult(result.taxDeducted)}`, tone: 'loss' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
