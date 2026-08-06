import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, GIFT_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

function getFinancialAssetDeduction(financialNet: number): number {
  if (financialNet <= 0) return 0;
  if (financialNet <= 20000000) return financialNet;
  if (financialNet <= 100000000) return 20000000;
  if (financialNet <= 1000000000) return financialNet * 0.2;
  return 200000000;
}

function getSpouseDeduction(hasSpouse: boolean, childCount: number, totalEstate: number): number {
  if (!hasSpouse) return 0;
  if (childCount === 0) return Math.min(Math.max(totalEstate, 500000000), 3000000000);
  const totalShares = childCount + 1.5;
  const spouseShare = 1.5 / totalShares;
  const legalPortion = totalEstate * spouseShare;
  return Math.min(Math.max(legalPortion, 500000000), 3000000000);
}

// finpilot/js/calculators.js의 calculateInheritanceTax(18. 상속세 계산기)를 그대로 이식.
// 절세 인사이트 아티클은 고정 콘텐츠라 이식 대상에서 제외.
export default function InheritanceTaxCalculator() {
  const [hasSpouse, setHasSpouse] = useState(true);
  const [priorGiftCombine, setPriorGiftCombine] = useState(false);
  const [totalEstate, setTotalEstate] = useState(2000000000);
  const [financialAsset, setFinancialAsset] = useState(0);
  const [debtAmount, setDebtAmount] = useState(0);
  const [funeralCostRaw, setFuneralCostRaw] = useState(5000000);
  const [otherDeduction, setOtherDeduction] = useState(0);
  const [priorGiftAmount, setPriorGiftAmount] = useState(0);
  const [priorGiftTaxPaid, setPriorGiftTaxPaid] = useState(0);
  const [childCount, setChildCount] = useState(2);
  const [elderlyCount, setElderlyCount] = useState(0);
  const [minorCount, setMinorCount] = useState(0);
  const [disabledCount, setDisabledCount] = useState(0);

  const result = useMemo(() => {
    if (totalEstate <= 0) return null;
    const effectivePrior = priorGiftCombine ? priorGiftAmount : 0;
    const effectivePriorTax = priorGiftCombine ? priorGiftTaxPaid : 0;
    const combinedEstate = totalEstate + effectivePrior;

    const funeralDeduction = Math.min(Math.max(funeralCostRaw, 5000000), 10000000);
    const taxableValue = Math.max(0, combinedEstate - debtAmount - funeralDeduction - otherDeduction);

    const basicDeduction = 200000000;
    const personalDeduction = childCount * 50000000 + minorCount * 10000000 + elderlyCount * 50000000 + disabledCount * 10000000 * 20;
    const basicPlusPersonal = basicDeduction + personalDeduction;

    const isSpouseSoleHeir = hasSpouse && childCount === 0 && elderlyCount === 0 && minorCount === 0 && disabledCount === 0;
    const unifiedDeduction = 500000000;
    const combinedBasicDeduction = isSpouseSoleHeir ? basicPlusPersonal : Math.max(basicPlusPersonal, unifiedDeduction);

    const spouseDeduction = getSpouseDeduction(hasSpouse, childCount, combinedEstate);
    const financialDeduction = getFinancialAssetDeduction(financialAsset);
    const totalDeduction = combinedBasicDeduction + spouseDeduction + financialDeduction;

    const taxBase = Math.max(0, taxableValue - totalDeduction);
    const calculatedTax = calcProgressiveTax(taxBase, GIFT_TAX_BRACKETS);
    const priorTaxCredit = effectivePriorTax;
    const afterPriorCredit = Math.max(0, calculatedTax - priorTaxCredit);
    const reportingCredit = afterPriorCredit * 0.03;
    const totalPayable = Math.max(0, afterPriorCredit - reportingCredit);

    return { taxableValue, combinedBasicDeduction, spouseDeduction, financialDeduction, taxBase, calculatedTax, reportingCredit, totalPayable };
  }, [
    hasSpouse,
    priorGiftCombine,
    totalEstate,
    financialAsset,
    debtAmount,
    funeralCostRaw,
    otherDeduction,
    priorGiftAmount,
    priorGiftTaxPaid,
    childCount,
    elderlyCount,
    minorCount,
    disabledCount,
  ]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'yes', label: '배우자 있음' },
            { value: 'no', label: '배우자 없음' },
          ]}
          value={hasSpouse ? 'yes' : 'no'}
          onChange={(v) => setHasSpouse(v === 'yes')}
        />
        <NumberField label="상속재산가액" value={totalEstate} onChange={setTotalEstate} suffix="원" showKoreanHint />
        <NumberField label="금융재산 순액 (선택)" value={financialAsset} onChange={setFinancialAsset} suffix="원" showKoreanHint />
        <NumberField label="채무 금액 (선택)" value={debtAmount} onChange={setDebtAmount} suffix="원" showKoreanHint />
        <NumberField label="장례비용" value={funeralCostRaw} onChange={setFuneralCostRaw} suffix="원" showKoreanHint />
        <NumberField label="기타 공제액 (선택)" value={otherDeduction} onChange={setOtherDeduction} suffix="원" showKoreanHint />
        <NumberField label="자녀 수" value={childCount} onChange={setChildCount} suffix="명" />
        <NumberField label="65세 이상 고령 상속인 수" value={elderlyCount} onChange={setElderlyCount} suffix="명" />
        <NumberField label="미성년 상속인 수" value={minorCount} onChange={setMinorCount} suffix="명" />
        <NumberField label="장애인 상속인 수" value={disabledCount} onChange={setDisabledCount} suffix="명" />
        <SegmentedControl
          options={[
            { value: 'no', label: '10년 내 사전증여 없음' },
            { value: 'yes', label: '10년 내 사전증여 있음' },
          ]}
          value={priorGiftCombine ? 'yes' : 'no'}
          onChange={(v) => setPriorGiftCombine(v === 'yes')}
        />
        {priorGiftCombine ? (
          <>
            <NumberField label="사전증여 금액" value={priorGiftAmount} onChange={setPriorGiftAmount} suffix="원" showKoreanHint />
            <NumberField label="기납부 증여세액" value={priorGiftTaxPaid} onChange={setPriorGiftTaxPaid} suffix="원" showKoreanHint />
          </>
        ) : null}
      </InputPanel>

      {result ? (
        <ResultCard
          title="최종 납부세액"
          mainValue={`₩ ${formatResult(result.totalPayable)}`}
          rows={[
            { label: '상속세 과세가액', value: `₩ ${formatResult(result.taxableValue)}` },
            { label: '기초·인적/일괄공제 (자동 최대선택)', value: `- ₩ ${formatResult(result.combinedBasicDeduction)}`, tone: 'profit' },
            { label: '배우자상속공제', value: `- ₩ ${formatResult(result.spouseDeduction)}`, tone: 'profit' },
            { label: '금융재산상속공제', value: `- ₩ ${formatResult(result.financialDeduction)}`, tone: 'profit' },
            { label: '과세표준', value: `₩ ${formatResult(result.taxBase)}` },
            { label: '산출세액', value: `₩ ${formatResult(result.calculatedTax)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
