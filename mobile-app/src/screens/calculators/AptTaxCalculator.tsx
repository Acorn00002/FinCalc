import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';

const COMP_TAX_BRACKETS = [
  { limit: 300000000, rate: 0.005, deduction: 0 },
  { limit: 600000000, rate: 0.007, deduction: 600000 },
  { limit: 1200000000, rate: 0.01, deduction: 2400000 },
  { limit: 2500000000, rate: 0.013, deduction: 6000000 },
  { limit: 5000000000, rate: 0.015, deduction: 11000000 },
  { limit: 9400000000, rate: 0.02, deduction: 36000000 },
  { limit: Infinity, rate: 0.027, deduction: 101800000 },
];

function getPropertyTaxRaw(base: number): number {
  if (base <= 60000000) return base * 0.001;
  if (base <= 150000000) return 60000 + (base - 60000000) * 0.0015;
  if (base <= 300000000) return 195000 + (base - 150000000) * 0.0025;
  return 570000 + (base - 300000000) * 0.004;
}

function getCompCalculatedTax(taxBase: number): number {
  for (const b of COMP_TAX_BRACKETS) {
    if (taxBase <= b.limit) return Math.max(0, taxBase * b.rate - b.deduction);
  }
  return 0;
}

// finpilot/js/calculators.js의 calculateAptHoldingTax(22. 보유세 계산기)를 그대로 이식.
export default function AptTaxCalculator() {
  const [publicPrice, setPublicPrice] = useState(1000000000);
  const [houseCount, setHouseCount] = useState('1');
  const [isElderly, setIsElderly] = useState(false);
  const [isLongHold, setIsLongHold] = useState(false);

  const result = useMemo(() => {
    if (publicPrice <= 0) return null;
    const propertyTaxBase = publicPrice * 0.6;
    const propertyTaxRaw = getPropertyTaxRaw(propertyTaxBase);
    const urbanAreaTax = propertyTaxBase * 0.0014;
    const localEduTax = propertyTaxRaw * 0.2;
    const propertyTaxWithUrban = propertyTaxRaw + urbanAreaTax;

    const compDeduction = houseCount === '1' ? 1200000000 : 900000000;
    const compTaxBase = Math.max(0, publicPrice - compDeduction) * 0.6;
    const compCalculatedTax = getCompCalculatedTax(compTaxBase);

    let creditRate = 0;
    if (houseCount === '1') {
      creditRate = Math.min(0.8, (isElderly ? 0.2 : 0) + (isLongHold ? 0.2 : 0));
    }
    const compCredit = compCalculatedTax * creditRate;
    const compAfterCredit = compCalculatedTax - compCredit;
    const compRuralTax = compAfterCredit * 0.2;
    const compTotal = compAfterCredit + compRuralTax;
    const grandTotal = propertyTaxWithUrban + localEduTax + compTotal;

    return { propertyTaxWithUrban, localEduTax, compCalculatedTax, compCredit, compTotal, grandTotal };
  }, [publicPrice, houseCount, isElderly, isLongHold]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="공시가격" value={publicPrice} onChange={setPublicPrice} suffix="원" showKoreanHint />
        <SegmentedControl
          options={[
            { value: '1', label: '1주택' },
            { value: '2+', label: '2주택 이상' },
          ]}
          value={houseCount}
          onChange={setHouseCount}
        />
        {houseCount === '1' ? (
          <>
            <SegmentedControl
              options={[
                { value: 'no', label: '만 60세 미만' },
                { value: 'yes', label: '만 60세 이상(고령자)' },
              ]}
              value={isElderly ? 'yes' : 'no'}
              onChange={(v) => setIsElderly(v === 'yes')}
            />
            <SegmentedControl
              options={[
                { value: 'no', label: '5년 미만 보유' },
                { value: 'yes', label: '5년 이상 장기보유' },
              ]}
              value={isLongHold ? 'yes' : 'no'}
              onChange={(v) => setIsLongHold(v === 'yes')}
            />
          </>
        ) : null}
      </InputPanel>

      {result ? (
        <ResultCard
          title="연간 보유세 합계 (재산세+종부세)"
          mainValue={`₩ ${formatResult(result.grandTotal)}`}
          rows={[
            { label: '재산세 (도시지역분 포함)', value: `₩ ${formatResult(result.propertyTaxWithUrban)}` },
            { label: '지방교육세', value: `₩ ${formatResult(result.localEduTax)}` },
            { label: '종합부동산세', value: `₩ ${formatResult(result.compCalculatedTax)}` },
            { label: '종부세 세액공제', value: `- ₩ ${formatResult(result.compCredit)}`, tone: 'profit' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
