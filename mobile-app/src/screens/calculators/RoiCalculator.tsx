import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

// finpilot/js/calculators.js의 calculateROI(5. 수익률/퍼센트 계산기)를 그대로 이식.
export default function RoiCalculator() {
  const [invested, setInvested] = useState(10000000);
  const [current, setCurrent] = useState(12000000);

  const result = useMemo(() => {
    if (invested === 0) return null;
    const profit = current - invested;
    const roiPct = (profit / invested) * 100;
    return { profit, roiPct };
  }, [invested, current]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="투자 원금" value={invested} onChange={setInvested} suffix="원" showKoreanHint />
        <NumberField label="현재 평가금액" value={current} onChange={setCurrent} suffix="원" showKoreanHint />
      </InputPanel>

      {result ? (
        <ResultCard
          title="수익률"
          mainValue={`${result.profit >= 0 ? '+' : ''}${formatResult(result.roiPct)}%`}
          rows={[
            {
              label: '손익 금액',
              value: `${result.profit >= 0 ? '+' : ''}₩ ${formatResult(result.profit)}`,
              tone: result.profit >= 0 ? 'profit' : 'loss',
            },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
