import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

type DealType = 'sale' | 'lease';
type Bracket = { limit: number; rate: number; cap: number };

const SALE_BRACKETS: Bracket[] = [
  { limit: 50000000, rate: 0.006, cap: 250000 },
  { limit: 200000000, rate: 0.005, cap: 800000 },
  { limit: 900000000, rate: 0.004, cap: Infinity },
  { limit: 1200000000, rate: 0.005, cap: Infinity },
  { limit: 1500000000, rate: 0.006, cap: Infinity },
  { limit: Infinity, rate: 0.007, cap: Infinity },
];
const LEASE_BRACKETS: Bracket[] = [
  { limit: 50000000, rate: 0.005, cap: 200000 },
  { limit: 100000000, rate: 0.004, cap: 300000 },
  { limit: 600000000, rate: 0.003, cap: Infinity },
  { limit: 1200000000, rate: 0.004, cap: Infinity },
  { limit: 1500000000, rate: 0.005, cap: Infinity },
  { limit: Infinity, rate: 0.006, cap: Infinity },
];

function getBracket(amount: number, brackets: Bracket[]): Bracket {
  return brackets.find((b) => amount <= b.limit) ?? brackets[brackets.length - 1];
}

// finpilot/js/calculators.js의 calculateBrokerageFee(23. 중개수수료 계산기)를 그대로 이식.
export default function BrokerageCalculator() {
  const [type, setType] = useState<DealType>('sale');
  const [amount, setAmount] = useState(500000000);
  const [rent, setRent] = useState(0);

  const result = useMemo(() => {
    if (amount <= 0) return null;
    let convertedAmount = amount;
    if (type === 'lease') {
      convertedAmount = amount + rent * 100;
      if (convertedAmount < 50000000) convertedAmount = amount + rent * 70;
    }
    const bracket = getBracket(convertedAmount, type === 'sale' ? SALE_BRACKETS : LEASE_BRACKETS);
    const feeRaw = convertedAmount * bracket.rate;
    const capApplied = feeRaw > bracket.cap;
    const fee = Math.min(feeRaw, bracket.cap);
    const vat = fee * 0.1;
    const totalWithVat = fee + vat;
    return { convertedAmount, rate: bracket.rate, capApplied, fee, vat, totalWithVat };
  }, [type, amount, rent]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'sale', label: '매매' },
            { value: 'lease', label: '전월세' },
          ]}
          value={type}
          onChange={(v) => setType(v as DealType)}
        />
        <NumberField label={type === 'lease' ? '보증금' : '매매가'} value={amount} onChange={setAmount} suffix="원" showKoreanHint />
        {type === 'lease' ? <NumberField label="월세" value={rent} onChange={setRent} suffix="원" showKoreanHint /> : null}
      </InputPanel>

      {result ? (
        <ResultCard
          title="중개보수 (VAT 포함)"
          mainValue={`₩ ${formatResult(result.totalWithVat)}`}
          subValue={`요율 ${(result.rate * 100).toFixed(2)}% · ${result.capApplied ? '한도액으로 제한 적용됨' : '요율 그대로 적용'}`}
          rows={[
            { label: '중개보수 (VAT 별도)', value: `₩ ${formatResult(result.fee)}` },
            { label: '부가세(10%)', value: `₩ ${formatResult(result.vat)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
