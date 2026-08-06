import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

// finpilot/js/calculators.js의 calculateFinFunc(30. 재무함수 계산기)를 그대로 이식.
export default function FinFuncCalculator() {
  const [principal, setPrincipal] = useState(10000000);
  const [cashflow, setCashflow] = useState(0);
  const [years, setYears] = useState(5);
  const [ratePct, setRatePct] = useState(5);

  const result = useMemo(() => {
    if (principal <= 0) return null;
    const r = ratePct / 100;
    const fv = principal * Math.pow(1 + r, years);
    const pv = principal / Math.pow(1 + r, years);
    let npv = -principal;
    for (let t = 1; t <= years; t++) npv += cashflow / Math.pow(1 + r, t);
    return { fv, pv, npv };
  }, [principal, cashflow, years, ratePct]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="기준 금액 (원금)" value={principal} onChange={setPrincipal} suffix="원" showKoreanHint />
        <NumberField label="연간 현금흐름 (NPV 계산용, 선택)" value={cashflow} onChange={setCashflow} suffix="원" showKoreanHint />
        <NumberField label="기간" value={years} onChange={setYears} suffix="년" />
        <NumberField label="할인율(수익률)" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
      </InputPanel>

      {result ? (
        <ResultCard
          title="미래가치 (FV)"
          mainValue={`₩ ${formatResult(result.fv)}`}
          rows={[
            { label: '현재가치 (PV)', value: `₩ ${formatResult(result.pv)}` },
            { label: '순현재가치 (NPV)', value: `₩ ${formatResult(result.npv)}`, tone: result.npv >= 0 ? 'profit' : 'loss' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
