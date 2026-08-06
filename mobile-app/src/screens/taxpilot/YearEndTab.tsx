import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import SegmentedControl from '../../components/calc/SegmentedControl';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard, { ResultRow } from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../../lib/calc/taxBrackets';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

function calcEarnedIncomeDeduction(salary: number): number {
  if (salary <= 5000000) return salary * 0.7;
  if (salary <= 15000000) return 3500000 + (salary - 5000000) * 0.4;
  if (salary <= 45000000) return 7500000 + (salary - 15000000) * 0.15;
  if (salary <= 100000000) return 12000000 + (salary - 45000000) * 0.05;
  return 14750000 + (salary - 100000000) * 0.02;
}
function calcCardDeduction(salary: number, credit: number, debit: number): number {
  const threshold = salary * 0.25;
  const totalUsed = credit + debit;
  if (totalUsed <= threshold) return 0;
  const excess = totalUsed - threshold;
  const debitPortion = Math.min(excess, debit);
  const creditPortion = Math.max(0, excess - debitPortion);
  return Math.min(debitPortion * 0.3 + creditPortion * 0.15, 3000000);
}
function calcPensionCredit(salary: number, pension: number, irp: number) {
  const pensionCapped = Math.min(pension, 6000000);
  const combined = Math.min(pensionCapped + irp, 9000000);
  const rate = salary <= 55000000 ? 0.165 : 0.132;
  return { base: combined, rate, credit: combined * rate };
}
const calcInsuranceCredit = (insurance: number) => Math.min(insurance, 1000000) * 0.12;
const calcMedicalCredit = (salary: number, medical: number) => Math.max(0, medical - salary * 0.03) * 0.15;
const calcEducationCredit = (education: number) => Math.min(education, 9000000) * 0.15;

// taxpilot/index.html의 recalcYearend(③ 연말정산, 약 2422~2498번째 줄)를 그대로 이식.
export default function YearEndTab() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sub, setSub] = useState<'consume' | 'save' | 'fixed'>('consume');
  const [salary, setSalary] = useState(50000000);
  const [dependents, setDependents] = useState(1);
  const [withheld, setWithheld] = useState(2000000);
  const [cardCredit, setCardCredit] = useState(15000000);
  const [cardDebit, setCardDebit] = useState(5000000);
  const [pension, setPension] = useState(0);
  const [irp, setIrp] = useState(0);
  const [insurance, setInsurance] = useState(0);
  const [medical, setMedical] = useState(0);
  const [education, setEducation] = useState(0);

  const result = useMemo(() => {
    if (salary <= 0) return null;
    const earnedDeduction = calcEarnedIncomeDeduction(salary);
    const personalDeduction = 1500000 * (1 + dependents);
    const cardDeduction = calcCardDeduction(salary, cardCredit, cardDebit);

    const incomeBase = Math.max(0, salary - earnedDeduction);
    const taxBase = Math.max(0, incomeBase - personalDeduction - cardDeduction);
    const calculatedTax = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS);

    const pensionResult = calcPensionCredit(salary, pension, irp);
    const insuranceCredit = calcInsuranceCredit(insurance);
    const medicalCredit = calcMedicalCredit(salary, medical);
    const educationCredit = calcEducationCredit(education);
    const totalCredit = pensionResult.credit + insuranceCredit + medicalCredit + educationCredit;

    const decidedTax = Math.max(0, calculatedTax - totalCredit);
    const refund = withheld - decidedTax;

    const rows: ResultRow[] = [
      { label: '총급여액', value: `₩ ${formatResult(salary)}` },
      { label: '근로소득공제', value: `- ₩ ${formatResult(earnedDeduction)}`, tone: 'profit' },
      { label: `인적공제 (본인+부양가족 ${dependents}명)`, value: `- ₩ ${formatResult(personalDeduction)}`, tone: 'profit' },
      { label: '신용카드 등 소득공제', value: `- ₩ ${formatResult(cardDeduction)}`, tone: 'profit' },
      { label: '과세표준', value: `₩ ${formatResult(taxBase)}` },
      { label: '산출세액', value: `₩ ${formatResult(calculatedTax)}` },
      { label: '연금저축·IRP 세액공제', value: `- ₩ ${formatResult(pensionResult.credit)}`, tone: 'profit' },
    ];
    if (insuranceCredit) rows.push({ label: '보험료 세액공제', value: `- ₩ ${formatResult(insuranceCredit)}`, tone: 'profit' });
    if (medicalCredit) rows.push({ label: '의료비 세액공제', value: `- ₩ ${formatResult(medicalCredit)}`, tone: 'profit' });
    if (educationCredit) rows.push({ label: '교육비 세액공제', value: `- ₩ ${formatResult(educationCredit)}`, tone: 'profit' });
    rows.push({ label: '결정세액', value: `₩ ${formatResult(decidedTax)}` });
    rows.push({ label: '기납부세액', value: `₩ ${formatResult(withheld)}` });

    const pensionMax = 9000000;
    const remainPension = pensionMax - pensionResult.base;
    const microCopy =
      remainPension > 0
        ? `지금 세액공제 한도를 채우면 ₩${formatResult(Math.round(remainPension * pensionResult.rate))}를 더 돌려받아요`
        : '연금저축·IRP 세액공제 한도를 모두 채웠어요!';

    return { refund, rows, microCopy };
  }, [salary, dependents, withheld, cardCredit, cardDebit, pension, irp, insurance, medical, education]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel style={{ borderRadius: 24, padding: 24 }}>
        <NumberField label="총급여액 (연)" value={salary} onChange={setSalary} suffix="원" showKoreanHint />
        <NumberField label="부양가족 수 (본인 제외)" value={dependents} onChange={setDependents} suffix="명" />
        <NumberField label="기납부세액 (원천징수)" value={withheld} onChange={setWithheld} suffix="원" showKoreanHint />

        <SegmentedControl
          options={[
            { value: 'consume', label: '소비 (카드)' },
            { value: 'save', label: '저축 (연금·IRP)' },
            { value: 'fixed', label: '고정비' },
          ]}
          value={sub}
          onChange={(v) => setSub(v as typeof sub)}
        />
        {sub === 'consume' ? (
          <>
            <NumberField label="신용카드 연간 사용액" value={cardCredit} onChange={setCardCredit} suffix="원" showKoreanHint />
            <NumberField label="체크카드·현금영수증 연간 사용액" value={cardDebit} onChange={setCardDebit} suffix="원" showKoreanHint />
          </>
        ) : null}
        {sub === 'save' ? (
          <>
            <NumberField label="연금저축 연간 납입액 (최대 600만원 인정)" value={pension} onChange={setPension} suffix="원" showKoreanHint />
            <NumberField label="IRP 연간 납입액" value={irp} onChange={setIrp} suffix="원" showKoreanHint />
          </>
        ) : null}
        {sub === 'fixed' ? (
          <>
            <NumberField label="보장성보험료 연간 납입액" value={insurance} onChange={setInsurance} suffix="원" showKoreanHint />
            <NumberField label="의료비 연간 지출액" value={medical} onChange={setMedical} suffix="원" showKoreanHint />
            <NumberField label="교육비 연간 지출액" value={education} onChange={setEducation} suffix="원" showKoreanHint />
          </>
        ) : null}
      </InputPanel>

      {result ? (
        <>
          <ResultCard
            title={result.refund >= 0 ? '예상 환급액' : '예상 추가납부액'}
            mainValue={`₩ ${formatResult(Math.abs(result.refund))}`}
            rows={result.rows}
          />
          <Text style={styles.microCopy}>{result.microCopy}</Text>
        </>
      ) : (
        <Text style={styles.microCopy}>총급여액을 입력하면 실시간으로 환급액이 계산돼요.</Text>
      )}
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16 },
    microCopy: { fontSize: 13, color: colors.ink2, lineHeight: 19, marginTop: -4, marginBottom: 12 },
  });
}
