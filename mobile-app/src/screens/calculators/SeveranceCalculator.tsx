import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

// 퇴직일 기준 직전 3개월의 실제 달력일수는 89~92일로 변동하지만, 입/퇴사일 두 날짜 입력 없이
// 재직일수만 받는 네이티브 버전에서는 91일(약 3개월 평균)로 근사한다.
const APPROX_QUARTER_DAYS = 91;

function getServiceYearDeduction(years: number): number {
  if (years <= 5) return Math.max(1000000, years * 1000000);
  if (years <= 10) return 5000000 + (years - 5) * 2000000;
  if (years <= 20) return 15000000 + (years - 10) * 2500000;
  return 40000000 + (years - 20) * 3000000;
}

function getConvertedIncomeDeduction(convertedIncome: number): number {
  if (convertedIncome <= 8000000) return convertedIncome;
  if (convertedIncome <= 70000000) return 8000000 + (convertedIncome - 8000000) * 0.6;
  if (convertedIncome <= 100000000) return 45200000 + (convertedIncome - 70000000) * 0.55;
  if (convertedIncome <= 300000000) return 61200000 + (convertedIncome - 100000000) * 0.45;
  return 151200000 + (convertedIncome - 300000000) * 0.35;
}

function getSeveranceTaxApprox(severancePay: number, years: number) {
  const serviceYears = Math.max(1, Math.round(years));
  const serviceDeduction = getServiceYearDeduction(serviceYears);
  const afterServiceDeduction = Math.max(0, severancePay - serviceDeduction);
  const convertedIncome = (afterServiceDeduction * 12) / serviceYears;
  const convertedDeduction = getConvertedIncomeDeduction(convertedIncome);
  const taxBase = Math.max(0, convertedIncome - convertedDeduction);
  const convertedTax = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS);
  const calculatedTax = (convertedTax * serviceYears) / 12;
  const localTax = calculatedTax * 0.1;
  return { calculatedTax, localTax, total: calculatedTax + localTax };
}

// finpilot/js/calculators.js의 calculateSeverance(19. 퇴직금 계산기)를 그대로 이식.
// 웹은 입사일/퇴사일 두 날짜로 재직일수(D)를 계산하지만, 네이티브에서는 재직일수를 직접 입력받는다.
export default function SeveranceCalculator() {
  const [days, setDays] = useState(1095);
  const [baseWage3m, setBaseWage3m] = useState(9000000);
  const [allowance3m, setAllowance3m] = useState(0);
  const [annualBonus, setAnnualBonus] = useState(0);
  const [annualLeavePay, setAnnualLeavePay] = useState(0);

  const result = useMemo(() => {
    if (days < 365) return { ineligible: true as const, days };

    const totalWage3m = baseWage3m + allowance3m;
    const bonusPortion = annualBonus * (3 / 12);
    const leavePayPortion = annualLeavePay * (3 / 12);
    const averageWage = (totalWage3m + bonusPortion + leavePayPortion) / APPROX_QUARTER_DAYS;
    const severancePay = averageWage * 30 * (days / 365);

    const years = days / 365;
    const tax = getSeveranceTaxApprox(severancePay, years);
    const netSeverancePay = Math.max(0, severancePay - tax.total);

    return { ineligible: false as const, years, severancePay, tax, netSeverancePay };
  }, [days, baseWage3m, allowance3m, annualBonus, annualLeavePay]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="재직일수" value={days} onChange={setDays} suffix="일" />
        <NumberField label="최근 3개월 기본급 합계" value={baseWage3m} onChange={setBaseWage3m} suffix="원" showKoreanHint />
        <NumberField label="최근 3개월 제수당 합계 (선택)" value={allowance3m} onChange={setAllowance3m} suffix="원" showKoreanHint />
        <NumberField label="연간 상여금 (선택)" value={annualBonus} onChange={setAnnualBonus} suffix="원" showKoreanHint />
        <NumberField label="연간 연차수당 (선택)" value={annualLeavePay} onChange={setAnnualLeavePay} suffix="원" showKoreanHint />
      </InputPanel>

      {result.ineligible ? (
        <ResultCard
          title="퇴직금 지급 대상 아님"
          mainValue="₩ 0"
          subValue={`현재 입력된 재직일수는 ${formatResult(result.days)}일이에요. 근로기준법상 퇴직금은 계속근로기간 1년(365일) 이상인 근로자에게만 지급돼요.`}
        />
      ) : (
        <ResultCard
          title="세후 실수령 퇴직금"
          mainValue={`₩ ${formatResult(result.netSeverancePay)}`}
          subValue={`재직 약 ${result.years.toFixed(1)}년`}
          rows={[
            { label: '세전 퇴직금', value: `₩ ${formatResult(result.severancePay)}` },
            { label: '퇴직소득세', value: `- ₩ ${formatResult(result.tax.calculatedTax)}`, tone: 'loss' },
            { label: '지방소득세', value: `- ₩ ${formatResult(result.tax.localTax)}`, tone: 'loss' },
          ]}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
