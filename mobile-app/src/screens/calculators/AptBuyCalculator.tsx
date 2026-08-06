import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

function getStandardAcquisitionRate(price: number): number {
  if (price <= 600000000) return 0.01;
  if (price <= 900000000) return ((price / 100000000) * (2 / 3) - 3) / 100;
  return 0.03;
}

function getAcquisitionRate(price: number, houseCount: string, isRegulated: boolean): number {
  if (houseCount === '1') return getStandardAcquisitionRate(price);
  if (houseCount === '2') return isRegulated ? 0.08 : getStandardAcquisitionRate(price);
  return isRegulated ? 0.12 : 0.08;
}

// finpilot/js/calculators.js의 calculateAptBuyTax(21. 취득세 계산기)를 그대로 이식.
export default function AptBuyCalculator() {
  const [price, setPrice] = useState(600000000);
  const [houseCount, setHouseCount] = useState('1');
  const [isRegulated, setIsRegulated] = useState(false);
  const [isOverArea, setIsOverArea] = useState(false);

  const result = useMemo(() => {
    if (price <= 0) return null;
    const rate = getAcquisitionRate(price, houseCount, isRegulated);
    const baseTax = price * rate;
    const localEduTax = baseTax * 0.1;
    const ruralTax = isOverArea ? price * 0.002 : 0;
    const total = baseTax + localEduTax + ruralTax;
    return { rate, baseTax, localEduTax, ruralTax, total };
  }, [price, houseCount, isRegulated, isOverArea]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="주택 가액" value={price} onChange={setPrice} suffix="원" showKoreanHint />
        <SegmentedControl
          options={[
            { value: '1', label: '1주택' },
            { value: '2', label: '2주택' },
            { value: '3', label: '3주택+' },
          ]}
          value={houseCount}
          onChange={setHouseCount}
        />
        <SegmentedControl
          options={[
            { value: 'no', label: '비조정대상지역' },
            { value: 'yes', label: '조정대상지역' },
          ]}
          value={isRegulated ? 'yes' : 'no'}
          onChange={(v) => setIsRegulated(v === 'yes')}
        />
        <SegmentedControl
          options={[
            { value: 'under', label: '전용 85㎡ 이하' },
            { value: 'over', label: '전용 85㎡ 초과' },
          ]}
          value={isOverArea ? 'over' : 'under'}
          onChange={(v) => setIsOverArea(v === 'over')}
        />
      </InputPanel>

      {result ? (
        <ResultCard
          title="총 취득 관련 세금"
          mainValue={`₩ ${formatResult(result.total)}`}
          subValue={`취득세율 ${(result.rate * 100).toFixed(2)}%`}
          rows={[
            { label: '취득세', value: `₩ ${formatResult(result.baseTax)}` },
            { label: '지방교육세', value: `₩ ${formatResult(result.localEduTax)}` },
            { label: '농어촌특별세', value: `₩ ${formatResult(result.ruralTax)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
