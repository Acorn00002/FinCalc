import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

const EXEMPTION_CAP = 1200000000;

// finpilot/js/calculators.js의 calculateCapitalGainsTax(16. 양도소득세 계산기)를 그대로 이식.
// 웹은 취득일/양도일 두 날짜로 보유기간을 계산하지만, 네이티브에서는 "보유기간(년)"을 직접 입력받는다.
export default function GainsTaxCalculator() {
  const [houseCount, setHouseCount] = useState('1');
  const [isRegulatedArea, setIsRegulatedArea] = useState(false);
  const [isResident, setIsResident] = useState(true);
  const [applyBasicDeduction, setApplyBasicDeduction] = useState(true);
  const [holdingYears, setHoldingYears] = useState(5);
  const [transferValue, setTransferValue] = useState(1000000000);
  const [acquisitionValue, setAcquisitionValue] = useState(600000000);
  const [necessaryExpense, setNecessaryExpense] = useState(20000000);

  const result = useMemo(() => {
    if (transferValue <= 0) return null;
    const holdingYearsFloor = Math.floor(holdingYears);
    const gain = Math.max(0, transferValue - acquisitionValue - necessaryExpense);

    const isOneHouse = houseCount === '1';
    const meetsHoldingReq = holdingYears >= 2;
    const meetsResidenceReq = !isRegulatedArea || isResident;
    const qualifiesForExemption = isOneHouse && meetsHoldingReq && meetsResidenceReq;

    if (qualifiesForExemption && transferValue <= EXEMPTION_CAP) {
      return { exempt: true as const };
    }

    let taxableGain = gain;
    if (qualifiesForExemption && transferValue > EXEMPTION_CAP) {
      taxableGain = (gain * (transferValue - EXEMPTION_CAP)) / transferValue;
    }

    const ltDeductionRate = holdingYearsFloor >= 3 ? Math.min(holdingYearsFloor * 0.02, 0.3) : 0;
    const ltDeduction = taxableGain * ltDeductionRate;
    const gainAmount = Math.max(0, taxableGain - ltDeduction);

    const basicDeductionAmount = applyBasicDeduction ? 2500000 : 0;
    const taxBase = Math.max(0, gainAmount - basicDeductionAmount);
    const calculatedTax = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS);
    const localTax = calculatedTax * 0.1;
    const totalPayable = calculatedTax + localTax;

    return { exempt: false as const, gain, ltDeduction, gainAmount, taxBase, calculatedTax, localTax, totalPayable };
  }, [houseCount, isRegulatedArea, isResident, applyBasicDeduction, holdingYears, transferValue, acquisitionValue, necessaryExpense]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: '1', label: '1주택' },
            { value: '2', label: '2주택' },
            { value: '3', label: '3주택 이상' },
          ]}
          value={houseCount}
          onChange={setHouseCount}
        />
        <SegmentedControl
          options={[
            { value: 'no', label: '비조정대상지역' },
            { value: 'yes', label: '조정대상지역' },
          ]}
          value={isRegulatedArea ? 'yes' : 'no'}
          onChange={(v) => setIsRegulatedArea(v === 'yes')}
        />
        {isRegulatedArea ? (
          <SegmentedControl
            options={[
              { value: 'yes', label: '거주함' },
              { value: 'no', label: '거주 안 함' },
            ]}
            value={isResident ? 'yes' : 'no'}
            onChange={(v) => setIsResident(v === 'yes')}
          />
        ) : null}
        <NumberField label="보유기간" value={holdingYears} onChange={setHoldingYears} suffix="년" allowDecimal />
        <NumberField label="양도가액" value={transferValue} onChange={setTransferValue} suffix="원" showKoreanHint />
        <NumberField label="취득가액" value={acquisitionValue} onChange={setAcquisitionValue} suffix="원" showKoreanHint />
        <NumberField label="필요경비 (선택)" value={necessaryExpense} onChange={setNecessaryExpense} suffix="원" showKoreanHint />
        <SegmentedControl
          options={[
            { value: 'yes', label: '기본공제 적용' },
            { value: 'no', label: '기본공제 미적용' },
          ]}
          value={applyBasicDeduction ? 'yes' : 'no'}
          onChange={(v) => setApplyBasicDeduction(v === 'yes')}
        />
      </InputPanel>

      {result?.exempt ? (
        <ResultCard
          title="양도소득세"
          mainValue="₩ 0"
          subValue="양도가액 12억원 이하 1세대 1주택으로, 보유·거주 요건을 충족해 전액 비과세돼요."
        />
      ) : result ? (
        <ResultCard
          title="납부할 총 세액"
          mainValue={`₩ ${formatResult(result.totalPayable)}`}
          rows={[
            { label: '양도차익', value: `₩ ${formatResult(result.gain)}` },
            { label: '장기보유특별공제', value: `- ₩ ${formatResult(result.ltDeduction)}`, tone: 'profit' },
            { label: '과세표준', value: `₩ ${formatResult(result.taxBase)}` },
            { label: '양도소득세', value: `₩ ${formatResult(result.calculatedTax)}` },
            { label: '지방소득세', value: `₩ ${formatResult(result.localTax)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
