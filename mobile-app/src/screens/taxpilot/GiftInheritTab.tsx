import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard, { ResultRow } from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, GIFT_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

type Relation = 'spouse' | 'adult-child' | 'minor-child' | 'other-relative';

function getGiftRelationDeduction(relation: Relation): number {
  switch (relation) {
    case 'spouse':
      return 600000000;
    case 'adult-child':
      return 50000000;
    case 'minor-child':
      return 20000000;
    default:
      return 10000000;
  }
}

const RELATION_LABELS: Record<Relation, string> = {
  spouse: '배우자',
  'adult-child': '성인 자녀',
  'minor-child': '미성년 자녀',
  'other-relative': '기타친족',
};

function GiftSection() {
  const [relation, setRelation] = useState<Relation>('adult-child');
  const [amount, setAmount] = useState(100000000);
  const [hasPrior, setHasPrior] = useState(false);
  const [priorAmount, setPriorAmount] = useState(0);
  const [priorTaxPaid, setPriorTaxPaid] = useState(0);
  const [isSkip, setIsSkip] = useState(false);

  const result = useMemo(() => {
    if (amount <= 0) return null;
    const deduction = getGiftRelationDeduction(relation);
    const combinedAmount = amount + (hasPrior ? priorAmount : 0);
    const taxBase = Math.max(0, combinedAmount - deduction);
    const totalCalculatedTax = calcProgressiveTax(taxBase, GIFT_TAX_BRACKETS);
    const currentShareTax = combinedAmount > 0 ? totalCalculatedTax * (amount / combinedAmount) : 0;
    const afterPriorCredit = Math.max(0, currentShareTax - (hasPrior ? priorTaxPaid : 0));
    const skipSurcharge = isSkip ? afterPriorCredit * 0.3 : 0;
    const beforeReportCredit = afterPriorCredit + skipSurcharge;
    const reportCredit = beforeReportCredit * 0.03;
    const totalTax = Math.max(0, beforeReportCredit - reportCredit);

    const rows: ResultRow[] = [{ label: '이번 증여재산가액', value: `₩ ${formatResult(amount)}` }];
    if (hasPrior) {
      rows.push({ label: '과거 10년 내 증여액 합산', value: `₩ ${formatResult(priorAmount)}` });
      rows.push({ label: '합산 증여재산가액', value: `₩ ${formatResult(combinedAmount)}` });
    }
    rows.push({ label: `증여재산공제 (${RELATION_LABELS[relation]})`, value: `- ₩ ${formatResult(deduction)}`, tone: 'profit' });
    rows.push({ label: '과세표준', value: `₩ ${formatResult(taxBase)}` });
    rows.push({ label: '산출세액 (합산 기준)', value: `₩ ${formatResult(totalCalculatedTax)}` });
    if (hasPrior) rows.push({ label: '이번 증여분 안분세액', value: `₩ ${formatResult(currentShareTax)}` });
    if (hasPrior && priorTaxPaid > 0) rows.push({ label: '기납부세액공제', value: `- ₩ ${formatResult(priorTaxPaid)}`, tone: 'profit' });
    if (isSkip) rows.push({ label: '세대생략 할증(30%)', value: `+ ₩ ${formatResult(skipSurcharge)}`, tone: 'loss' });
    rows.push({ label: '신고세액공제(3%)', value: `- ₩ ${formatResult(reportCredit)}`, tone: 'profit' });

    return { totalTax, rows };
  }, [relation, amount, hasPrior, priorAmount, priorTaxPaid, isSkip]);

  return (
    <>
      <InputPanel style={{ borderRadius: 24, padding: 24 }}>
        <SegmentedControl
          options={[
            { value: 'adult-child', label: '성인 자녀' },
            { value: 'minor-child', label: '미성년 자녀' },
            { value: 'spouse', label: '배우자' },
            { value: 'other-relative', label: '기타친족' },
          ]}
          value={relation}
          onChange={(v) => setRelation(v as Relation)}
        />
        <NumberField label="증여받는 재산가액" value={amount} onChange={setAmount} suffix="원" showKoreanHint />
        <SegmentedControl
          options={[
            { value: 'no', label: '세대생략 아님' },
            { value: 'yes', label: '세대생략 증여(조부모→손자녀)' },
          ]}
          value={isSkip ? 'yes' : 'no'}
          onChange={(v) => setIsSkip(v === 'yes')}
        />
        <SegmentedControl
          options={[
            { value: 'no', label: '10년 내 동일인 증여 없음' },
            { value: 'yes', label: '10년 내 동일인 증여 있음' },
          ]}
          value={hasPrior ? 'yes' : 'no'}
          onChange={(v) => setHasPrior(v === 'yes')}
        />
        {hasPrior ? (
          <>
            <NumberField label="과거 증여액" value={priorAmount} onChange={setPriorAmount} suffix="원" showKoreanHint />
            <NumberField label="과거 납부세액" value={priorTaxPaid} onChange={setPriorTaxPaid} suffix="원" showKoreanHint />
          </>
        ) : null}
      </InputPanel>
      {result ? <ResultCard title="증여세 납부세액" mainValue={`₩ ${formatResult(result.totalTax)}`} rows={result.rows} /> : null}
    </>
  );
}

function InheritSection() {
  const [amount, setAmount] = useState(2000000000);
  const [debt, setDebt] = useState(0);
  const [funeralRaw, setFuneralRaw] = useState(5000000);
  const [hasSpouse, setHasSpouse] = useState(true);
  const [childCount, setChildCount] = useState(1);
  const [isSkip, setIsSkip] = useState(false);
  const [hasPrior, setHasPrior] = useState(false);
  const [priorAmount, setPriorAmount] = useState(0);
  const [priorTaxPaid, setPriorTaxPaid] = useState(0);

  const result = useMemo(() => {
    if (amount <= 0) return null;
    const funeral = funeralRaw > 0 ? Math.min(15000000, Math.max(funeralRaw, 5000000)) : 0;
    const netEstate = Math.max(0, amount - debt - funeral);

    const itemizedTotal = 200000000 + childCount * 50000000;
    const lumpSumDeduction = 500000000;
    const generalDeduction = Math.max(lumpSumDeduction, itemizedTotal);
    const spouseDeduction = hasSpouse ? 500000000 : 0;
    const totalDeduction = generalDeduction + spouseDeduction;

    const taxableEstate = Math.max(0, netEstate - totalDeduction);
    const combinedBase = taxableEstate + (hasPrior ? priorAmount : 0);
    const totalCalculatedTax = calcProgressiveTax(combinedBase, GIFT_TAX_BRACKETS);
    const currentShareTax = combinedBase > 0 ? totalCalculatedTax * (taxableEstate / combinedBase) : 0;
    const afterPriorCredit = Math.max(0, currentShareTax - (hasPrior ? priorTaxPaid : 0));
    const skipSurcharge = isSkip ? afterPriorCredit * 0.3 : 0;
    const beforeReportCredit = afterPriorCredit + skipSurcharge;
    const reportCredit = beforeReportCredit * 0.03;
    const totalTax = Math.max(0, beforeReportCredit - reportCredit);

    const rows: ResultRow[] = [
      { label: '총 상속재산가액', value: `₩ ${formatResult(amount)}` },
      { label: '채무', value: `- ₩ ${formatResult(debt)}`, tone: 'profit' },
      { label: '장례비용 공제', value: `- ₩ ${formatResult(funeral)}`, tone: 'profit' },
      { label: '순 상속재산가액', value: `₩ ${formatResult(netEstate)}` },
      { label: `상속공제 (${lumpSumDeduction >= itemizedTotal ? '일괄공제 5억' : '기초+인적공제'})`, value: `- ₩ ${formatResult(generalDeduction)}`, tone: 'profit' },
    ];
    if (spouseDeduction) rows.push({ label: '배우자상속공제', value: `- ₩ ${formatResult(spouseDeduction)}`, tone: 'profit' });
    rows.push({ label: '과세표준', value: `₩ ${formatResult(taxableEstate)}` });
    if (hasPrior) {
      rows.push({ label: '사전증여재산 합산', value: `₩ ${formatResult(priorAmount)}` });
      rows.push({ label: '합산 과세가액', value: `₩ ${formatResult(combinedBase)}` });
    }
    rows.push({ label: '산출세액 (합산 기준)', value: `₩ ${formatResult(totalCalculatedTax)}` });
    if (hasPrior) rows.push({ label: '이번 상속분 안분세액', value: `₩ ${formatResult(currentShareTax)}` });
    if (hasPrior && priorTaxPaid > 0) rows.push({ label: '기납부 증여세액공제', value: `- ₩ ${formatResult(priorTaxPaid)}`, tone: 'profit' });
    if (isSkip) rows.push({ label: '세대생략 할증(30%)', value: `+ ₩ ${formatResult(skipSurcharge)}`, tone: 'loss' });
    rows.push({ label: '신고세액공제(3%)', value: `- ₩ ${formatResult(reportCredit)}`, tone: 'profit' });

    return { totalTax, rows };
  }, [amount, debt, funeralRaw, hasSpouse, childCount, isSkip, hasPrior, priorAmount, priorTaxPaid]);

  return (
    <>
      <InputPanel style={{ borderRadius: 24, padding: 24 }}>
        <NumberField label="총 상속재산가액" value={amount} onChange={setAmount} suffix="원" showKoreanHint />
        <NumberField label="채무 (선택)" value={debt} onChange={setDebt} suffix="원" showKoreanHint />
        <NumberField label="장례비용" value={funeralRaw} onChange={setFuneralRaw} suffix="원" showKoreanHint />
        <SegmentedControl
          options={[
            { value: 'yes', label: '배우자 있음' },
            { value: 'no', label: '배우자 없음' },
          ]}
          value={hasSpouse ? 'yes' : 'no'}
          onChange={(v) => setHasSpouse(v === 'yes')}
        />
        <NumberField label="자녀 수" value={childCount} onChange={setChildCount} suffix="명" />
        <SegmentedControl
          options={[
            { value: 'no', label: '세대생략 아님' },
            { value: 'yes', label: '세대생략 상속' },
          ]}
          value={isSkip ? 'yes' : 'no'}
          onChange={(v) => setIsSkip(v === 'yes')}
        />
        <SegmentedControl
          options={[
            { value: 'no', label: '10년 내 사전증여 없음' },
            { value: 'yes', label: '10년 내 사전증여 있음' },
          ]}
          value={hasPrior ? 'yes' : 'no'}
          onChange={(v) => setHasPrior(v === 'yes')}
        />
        {hasPrior ? (
          <>
            <NumberField label="사전증여재산가액" value={priorAmount} onChange={setPriorAmount} suffix="원" showKoreanHint />
            <NumberField label="기납부 증여세액" value={priorTaxPaid} onChange={setPriorTaxPaid} suffix="원" showKoreanHint />
          </>
        ) : null}
      </InputPanel>
      {result ? <ResultCard title="상속세 납부세액" mainValue={`₩ ${formatResult(result.totalTax)}`} rows={result.rows} /> : null}
    </>
  );
}

// taxpilot/index.html의 calcGift/calcInherit(② 증여·상속세, 약 2238~2391번째 줄)를 그대로 이식.
export default function GiftInheritTab() {
  const [sub, setSub] = useState<'gift' | 'inherit'>('gift');

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SegmentedControl
        options={[
          { value: 'gift', label: '증여세' },
          { value: 'inherit', label: '상속세' },
        ]}
        value={sub}
        onChange={(v) => setSub(v as 'gift' | 'inherit')}
      />
      {sub === 'gift' ? <GiftSection /> : <InheritSection />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
});
