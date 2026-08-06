import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { calcProgressiveTax, INCOME_TAX_BRACKETS } from '../../lib/calc/taxBrackets';

function calcServiceYearDeduction(years: number): number {
  if (years <= 5) return Math.max(1000000, years * 1000000);
  if (years <= 10) return 5000000 + (years - 5) * 2000000;
  if (years <= 20) return 15000000 + (years - 10) * 2500000;
  return 40000000 + (years - 20) * 3000000;
}
function calcConvertedIncomeDeduction(converted: number): number {
  if (converted <= 8000000) return converted;
  if (converted <= 70000000) return 8000000 + (converted - 8000000) * 0.6;
  if (converted <= 100000000) return 45200000 + (converted - 70000000) * 0.55;
  if (converted <= 300000000) return 62700000 + (converted - 100000000) * 0.45;
  return 152700000 + (converted - 300000000) * 0.35;
}

// taxpilot/index.html의 calcRetire(④ 퇴직소득세, 약 2549~2600번째 줄)를 그대로 이식.
// 웹은 입사일/퇴직일(+중간정산일) 날짜로 근속연수를 계산하지만, 네이티브에서는
// 근속연수(공제용)를 직접 입력받는다.
export default function RetireTab() {
  const [serviceYears, setServiceYears] = useState(10);
  const [amount, setAmount] = useState(50000000);

  const result = useMemo(() => {
    if (amount <= 0 || serviceYears <= 0) return null;
    const years = Math.max(1, Math.ceil(serviceYears));

    const serviceDeduction = calcServiceYearDeduction(years);
    const afterServiceDeduction = Math.max(0, amount - serviceDeduction);
    const convertedIncome = (afterServiceDeduction / years) * 12;
    const convertedDeduction = calcConvertedIncomeDeduction(convertedIncome);
    const taxBase = Math.max(0, convertedIncome - convertedDeduction);
    const convertedTax = calcProgressiveTax(taxBase, INCOME_TAX_BRACKETS);
    const calculatedTax = (convertedTax * years) / 12;
    const localTax = calculatedTax * 0.1;
    const totalTax = calculatedTax + localTax;
    const netAmount = Math.max(0, amount - totalTax);

    return { years, serviceDeduction, convertedIncome, convertedDeduction, taxBase, calculatedTax, localTax, totalTax, netAmount };
  }, [amount, serviceYears]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel style={{ borderRadius: 24, padding: 24 }}>
        <NumberField label="근속연수 (공제용)" value={serviceYears} onChange={setServiceYears} suffix="년" allowDecimal />
        <NumberField label="퇴직급여 총액 (세전)" value={amount} onChange={setAmount} suffix="원" showKoreanHint />
      </InputPanel>

      {result ? (
        <ResultCard
          title="세후 실수령 퇴직급여"
          mainValue={`₩ ${formatResult(result.netAmount)}`}
          subValue={`근속연수(공제용) ${result.years}년`}
          rows={[
            { label: '근속연수공제', value: `- ₩ ${formatResult(result.serviceDeduction)}`, tone: 'profit' },
            { label: '환산급여', value: `₩ ${formatResult(result.convertedIncome)}` },
            { label: '환산급여공제', value: `- ₩ ${formatResult(result.convertedDeduction)}`, tone: 'profit' },
            { label: '과세표준', value: `₩ ${formatResult(result.taxBase)}` },
            { label: '산출세액(환산)', value: `₩ ${formatResult(result.calculatedTax)}` },
            { label: '지방소득세(10%)', value: `₩ ${formatResult(result.localTax)}` },
          ]}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
});
