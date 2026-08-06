import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

const NATIONAL_PENSION_RATE = 0.045;
const NATIONAL_PENSION_FLOOR = 400000;
const NATIONAL_PENSION_CEIL = 6370000;
const HEALTH_INSURANCE_RATE = 0.03545;
const LONG_TERM_CARE_RATE = 0.1295;
const EMPLOYMENT_INSURANCE_RATE = 0.009;

function getEarnedIncomeDeduction(gross: number): number {
  if (gross <= 5000000) return gross * 0.7;
  if (gross <= 15000000) return 3500000 + (gross - 5000000) * 0.4;
  if (gross <= 45000000) return 7500000 + (gross - 15000000) * 0.15;
  if (gross <= 100000000) return 12000000 + (gross - 45000000) * 0.05;
  return 14750000 + (gross - 100000000) * 0.02;
}

function getEarnedIncomeTaxCredit(calculatedTax: number, gross: number): number {
  const credit = calculatedTax <= 1300000 ? calculatedTax * 0.55 : 715000 + (calculatedTax - 1300000) * 0.3;
  let cap: number;
  if (gross <= 33000000) cap = 740000;
  else if (gross <= 70000000) cap = Math.max(660000, 740000 - (gross - 33000000) * 0.008);
  else cap = Math.max(500000, 660000 - (gross - 70000000) * 0.5);
  return Math.min(credit, cap);
}

function getChildTaxCredit(childCount: number): number {
  if (childCount <= 0) return 0;
  if (childCount === 1) return 150000;
  if (childCount === 2) return 350000;
  return 350000 + (childCount - 2) * 300000;
}

type WageType = 'annual' | 'monthly';
type RetireType = 'separate' | 'included';

// finpilot/js/calculators.js의 calculateSalary(15. 연봉 실수령액 계산기)를 그대로 이식.
export default function SalaryCalculator() {
  const [wageType, setWageType] = useState<WageType>('annual');
  const [retireType, setRetireType] = useState<RetireType>('separate');
  const [amount, setAmount] = useState(40000000);
  const [nonTaxable, setNonTaxable] = useState(200000);
  const [dependents, setDependents] = useState(1);
  const [children, setChildren] = useState(0);

  const result = useMemo(() => {
    if (amount <= 0) return null;
    const monthlyGross = wageType === 'monthly' ? amount : retireType === 'included' ? amount / 13 : amount / 12;
    const monthlyTaxable = Math.max(0, monthlyGross - nonTaxable);

    const pensionBase = Math.min(Math.max(monthlyTaxable, NATIONAL_PENSION_FLOOR), NATIONAL_PENSION_CEIL);
    const nationalPension = Math.round(pensionBase * NATIONAL_PENSION_RATE);
    const healthInsurance = Math.round(monthlyTaxable * HEALTH_INSURANCE_RATE);
    const longTermCare = Math.round(healthInsurance * LONG_TERM_CARE_RATE);
    const employmentInsurance = Math.round(monthlyTaxable * EMPLOYMENT_INSURANCE_RATE);

    const annualGross = monthlyTaxable * 12;
    const earnedIncomeDeduction = getEarnedIncomeDeduction(annualGross);
    const earnedIncomeAmount = Math.max(0, annualGross - earnedIncomeDeduction);
    const personalDeduction = Math.max(1, dependents) * 1500000;
    const socialInsuranceAnnual = (nationalPension + healthInsurance + longTermCare + employmentInsurance) * 12;
    const taxBase = Math.max(0, earnedIncomeAmount - personalDeduction - socialInsuranceAnnual);

    const calculatedTax = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS);
    const earnedIncomeTaxCredit = getEarnedIncomeTaxCredit(calculatedTax, annualGross);
    const childCredit = getChildTaxCredit(children);
    const finalAnnualTax = Math.max(0, calculatedTax - earnedIncomeTaxCredit - childCredit);

    const incomeTax = Math.round(finalAnnualTax / 12);
    const localIncomeTax = Math.round(incomeTax * 0.1);
    const totalDeduction = nationalPension + healthInsurance + longTermCare + employmentInsurance + incomeTax + localIncomeTax;
    const netPay = Math.max(0, monthlyGross - totalDeduction);

    return { monthlyGross, netPay, totalDeduction, nationalPension, healthInsurance, longTermCare, employmentInsurance, incomeTax, localIncomeTax };
  }, [wageType, retireType, amount, nonTaxable, dependents, children]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'annual', label: '연봉' },
            { value: 'monthly', label: '월급' },
          ]}
          value={wageType}
          onChange={(v) => setWageType(v as WageType)}
        />
        {wageType === 'annual' ? (
          <SegmentedControl
            options={[
              { value: 'separate', label: '퇴직금 별도' },
              { value: 'included', label: '퇴직금 포함(13분할)' },
            ]}
            value={retireType}
            onChange={(v) => setRetireType(v as RetireType)}
          />
        ) : null}
        <NumberField label={wageType === 'monthly' ? '월급 (세전)' : '연봉 (세전)'} value={amount} onChange={setAmount} suffix="원" showKoreanHint />
        <NumberField label="비과세액 (월, 선택)" value={nonTaxable} onChange={setNonTaxable} suffix="원" showKoreanHint />
        <NumberField label="부양가족 수 (본인 포함)" value={dependents} onChange={setDependents} suffix="명" />
        <NumberField label="8세 이상 자녀 수" value={children} onChange={setChildren} suffix="명" />
      </InputPanel>

      {result ? (
        <ResultCard
          title="세후 월 실수령액"
          mainValue={`₩ ${formatResult(result.netPay)}`}
          subValue={`세전 월급여 ₩ ${formatResult(result.monthlyGross)} 중 ${formatResult((result.netPay / result.monthlyGross) * 100)}% 수령`}
          rows={[
            { label: '국민연금', value: `- ₩ ${formatResult(result.nationalPension)}` },
            { label: '건강보험', value: `- ₩ ${formatResult(result.healthInsurance)}` },
            { label: '장기요양보험', value: `- ₩ ${formatResult(result.longTermCare)}` },
            { label: '고용보험', value: `- ₩ ${formatResult(result.employmentInsurance)}` },
            { label: '소득세', value: `- ₩ ${formatResult(result.incomeTax)}` },
            { label: '지방소득세', value: `- ₩ ${formatResult(result.localIncomeTax)}` },
            { label: '공제 합계', value: `- ₩ ${formatResult(result.totalDeduction)}`, tone: 'loss' },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
