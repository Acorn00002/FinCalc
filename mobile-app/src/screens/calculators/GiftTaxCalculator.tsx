import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, GIFT_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

type Relation = 'spouse' | 'lineal-ascendant' | 'lineal-descendant' | 'other-relative';

function getRelationDeduction(relation: Relation, isMinor: boolean): number {
  switch (relation) {
    case 'spouse':
      return 600000000;
    case 'lineal-ascendant':
      return 50000000;
    case 'lineal-descendant':
      return isMinor ? 20000000 : 50000000;
    default:
      return 10000000;
  }
}

// finpilot/js/calculators.js의 calculateGiftTax(17. 증여세 계산기)를 그대로 이식.
// 절세 인사이트 아티클은 고정 콘텐츠라 이식 대상에서 제외.
export default function GiftTaxCalculator() {
  const [relation, setRelation] = useState<Relation>('lineal-descendant');
  const [isMinor, setIsMinor] = useState(false);
  const [taxBorne, setTaxBorne] = useState(false);
  const [priorGiftCombine, setPriorGiftCombine] = useState(false);
  const [giftAmount, setGiftAmount] = useState(100000000);
  const [debtAmount, setDebtAmount] = useState(0);
  const [appraisalFee, setAppraisalFee] = useState(0);
  const [nonTaxable, setNonTaxable] = useState(0);
  const [priorGiftAmount, setPriorGiftAmount] = useState(0);
  const [priorGiftTaxPaid, setPriorGiftTaxPaid] = useState(0);

  const result = useMemo(() => {
    if (giftAmount <= 0) return null;
    const cappedAppraisalFee = Math.min(appraisalFee, 5000000);
    const effectivePrior = priorGiftCombine ? priorGiftAmount : 0;
    const effectivePriorTax = priorGiftCombine ? priorGiftTaxPaid : 0;

    const combinedGiftAmount = giftAmount + effectivePrior;
    const taxableGiftValue = Math.max(0, combinedGiftAmount - debtAmount - nonTaxable);
    const deduction = getRelationDeduction(relation, isMinor);
    const taxBase = Math.max(0, taxableGiftValue - deduction - cappedAppraisalFee);
    const calculatedTax = calcProgressiveTax(taxBase, GIFT_TAX_BRACKETS);

    let taxBorneAddition = 0;
    let finalCalculatedTax = calculatedTax;
    if (taxBorne) {
      const adjustedTaxableValue = taxableGiftValue + calculatedTax;
      const adjustedTaxBase = Math.max(0, adjustedTaxableValue - deduction - cappedAppraisalFee);
      const grossedUpTax = calcProgressiveTax(adjustedTaxBase, GIFT_TAX_BRACKETS);
      taxBorneAddition = grossedUpTax - calculatedTax;
      finalCalculatedTax = grossedUpTax;
    }

    const reportingCredit = finalCalculatedTax * 0.03;
    const priorTaxCredit = effectivePriorTax;
    const totalPayable = Math.max(0, finalCalculatedTax - reportingCredit - priorTaxCredit);

    return { taxableGiftValue, deduction, taxBase, calculatedTax: finalCalculatedTax, taxBorneAddition, reportingCredit, totalPayable };
  }, [relation, isMinor, taxBorne, priorGiftCombine, giftAmount, debtAmount, appraisalFee, nonTaxable, priorGiftAmount, priorGiftTaxPaid]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'lineal-descendant', label: '직계비속' },
            { value: 'lineal-ascendant', label: '직계존속' },
            { value: 'spouse', label: '배우자' },
            { value: 'other-relative', label: '기타친족' },
          ]}
          value={relation}
          onChange={(v) => setRelation(v as Relation)}
        />
        {relation === 'lineal-descendant' ? (
          <SegmentedControl
            options={[
              { value: 'no', label: '성인' },
              { value: 'yes', label: '미성년자' },
            ]}
            value={isMinor ? 'yes' : 'no'}
            onChange={(v) => setIsMinor(v === 'yes')}
          />
        ) : null}
        <NumberField label="증여 금액" value={giftAmount} onChange={setGiftAmount} suffix="원" showKoreanHint />
        <NumberField label="채무 금액 (부담부증여, 선택)" value={debtAmount} onChange={setDebtAmount} suffix="원" showKoreanHint />
        <NumberField label="감정평가수수료 (선택, 최대 500만원)" value={appraisalFee} onChange={setAppraisalFee} suffix="원" showKoreanHint />
        <NumberField label="비과세액 (선택)" value={nonTaxable} onChange={setNonTaxable} suffix="원" showKoreanHint />
        <SegmentedControl
          options={[
            { value: 'no', label: '증여세 수증자 부담' },
            { value: 'yes', label: '증여자가 세금 대납' },
          ]}
          value={taxBorne ? 'yes' : 'no'}
          onChange={(v) => setTaxBorne(v === 'yes')}
        />
        <SegmentedControl
          options={[
            { value: 'no', label: '10년 내 동일인 증여 없음' },
            { value: 'yes', label: '10년 내 동일인 증여 있음' },
          ]}
          value={priorGiftCombine ? 'yes' : 'no'}
          onChange={(v) => setPriorGiftCombine(v === 'yes')}
        />
        {priorGiftCombine ? (
          <>
            <NumberField label="과거 증여액 (10년 이내)" value={priorGiftAmount} onChange={setPriorGiftAmount} suffix="원" showKoreanHint />
            <NumberField label="과거 납부세액" value={priorGiftTaxPaid} onChange={setPriorGiftTaxPaid} suffix="원" showKoreanHint />
          </>
        ) : null}
      </InputPanel>

      {result ? (
        <ResultCard
          title="최종 납부세액"
          mainValue={`₩ ${formatResult(result.totalPayable)}`}
          rows={[
            { label: '증여과세가액', value: `₩ ${formatResult(result.taxableGiftValue)}` },
            { label: '증여재산공제', value: `- ₩ ${formatResult(result.deduction)}`, tone: 'profit' },
            { label: '과세표준', value: `₩ ${formatResult(result.taxBase)}` },
            { label: '산출세액', value: `₩ ${formatResult(result.calculatedTax)}` },
            { label: '신고세액공제(3%)', value: `- ₩ ${formatResult(result.reportingCredit)}`, tone: 'profit' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
