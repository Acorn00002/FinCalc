import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

const AMOUNT_CHIPS = [
  { amount: 1000000, label: '+100만' },
  { amount: 10000000, label: '+1000만' },
  { amount: 100000000, label: '+1억' },
];

type InterestType = 'simple' | 'compound';
type TaxType = 'general' | 'preferential' | 'tax-free';

// finpilot/js/calculators.js의 calculateDeposit(9. 정기예금 계산기)을 그대로 이식.
// 은행 추천 상품 피드는 실데이터가 아닌 모의 마케팅 데이터라 이식 대상에서 제외.
function getGrossInterest(P: number, R: number, n: number, interestType: InterestType) {
  if (interestType === 'simple') return P * (R / 100) * (n / 12);
  return P * Math.pow(1 + R / (12 * 100), n) - P;
}

export default function DepositCalculator() {
  const [amount, setAmount] = useState(10000000);
  const [ratePct, setRatePct] = useState(3.5);
  const [termMonths, setTermMonths] = useState(12);
  const [interestType, setInterestType] = useState<InterestType>('compound');
  const [taxType, setTaxType] = useState<TaxType>('general');

  const result = useMemo(() => {
    const grossInterest = getGrossInterest(amount, ratePct, termMonths, interestType);
    const taxRate = taxType === 'general' ? 0.154 : taxType === 'preferential' ? 0.095 : 0;
    const tax = grossInterest * taxRate;
    const netInterest = grossInterest - tax;
    const total = amount + netInterest;
    return { grossInterest, tax, netInterest, total };
  }, [amount, ratePct, termMonths, interestType, taxType]);

  const hasInput = amount > 0 && termMonths > 0;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="예치 금액" value={amount} onChange={setAmount} suffix="원" quickAdds={AMOUNT_CHIPS} showKoreanHint />
        <NumberField label="연 이율" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
        <NumberField label="예치 기간" value={termMonths} onChange={setTermMonths} suffix="개월" />
        <SegmentedControl
          options={[
            { value: 'compound', label: '월복리' },
            { value: 'simple', label: '단리' },
          ]}
          value={interestType}
          onChange={(v) => setInterestType(v as InterestType)}
        />
        <SegmentedControl
          options={[
            { value: 'general', label: '일반과세' },
            { value: 'preferential', label: '세금우대' },
            { value: 'tax-free', label: '비과세' },
          ]}
          value={taxType}
          onChange={(v) => setTaxType(v as TaxType)}
        />
      </InputPanel>

      {hasInput ? (
        <ResultCard
          title="만기 수령액"
          mainValue={`₩ ${formatResult(result.total)}`}
          rows={[
            { label: '세전 이자', value: `₩ ${formatResult(result.grossInterest)}` },
            { label: '이자 과세', value: `- ₩ ${formatResult(result.tax)}`, tone: 'loss' },
            { label: '세후 이자', value: `+ ₩ ${formatResult(result.netInterest)}`, tone: 'profit' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
