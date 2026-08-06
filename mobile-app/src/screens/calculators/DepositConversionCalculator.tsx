import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

const REGIONS = [
  { value: '900000000', label: '서울 (9억)' },
  { value: '690000000', label: '과밀억제권역·부산 (6.9억)' },
  { value: '540000000', label: '광역시 등 (5.4억)' },
  { value: '370000000', label: '그 밖의 지역 (3.7억)' },
];

// finpilot/js/calculators.js의 calculateDepositConversion(25. 환산보증금 계산기)을 그대로 이식.
export default function DepositConversionCalculator() {
  const [region, setRegion] = useState(REGIONS[0].value);
  const [deposit, setDeposit] = useState(50000000);
  const [rent, setRent] = useState(2000000);

  const result = useMemo(() => {
    if (deposit <= 0 && rent <= 0) return null;
    const threshold = parseFloat(region);
    const converted = deposit + rent * 100;
    const isWithinThreshold = converted <= threshold;
    return { threshold, converted, isWithinThreshold };
  }, [region, deposit, rent]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl options={REGIONS} value={region} onChange={setRegion} />
        <NumberField label="보증금" value={deposit} onChange={setDeposit} suffix="원" showKoreanHint />
        <NumberField label="월세" value={rent} onChange={setRent} suffix="원" showKoreanHint />
      </InputPanel>

      {result ? (
        <ResultCard
          title="환산보증금"
          mainValue={`₩ ${formatResult(result.converted)}`}
          subValue={
            result.isWithinThreshold
              ? '기준 이하 → 상가임대차보호법 전면 적용 대상이에요'
              : '기준 초과 → 대항력 등 일부 조항만 적용돼요'
          }
          rows={[{ label: '지역 기준액', value: `₩ ${formatResult(result.threshold)}` }]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
