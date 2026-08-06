import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import SegmentedControl from '../../components/calc/SegmentedControl';
import ResultCard from '../../components/calc/ResultCard';
import DataTable from '../../components/calc/DataTable';
import { formatResult } from '../../lib/calc/format';

const AMOUNT_CHIPS = [
  { amount: 10000000, label: '+1000만' },
  { amount: 100000000, label: '+1억' },
  { amount: 1000000000, label: '+10억' },
];

const TABLE_COLUMNS = [
  { key: 'month', label: '회차' },
  { key: 'principal', label: '납입원금' },
  { key: 'interest', label: '이자' },
  { key: 'payment', label: '월상환액' },
  { key: 'balance', label: '대출잔액' },
];

type LoanType = 'mortgage' | 'jeonse' | 'credit';
type RepayMethod = 'equal-payment' | 'equal-principal' | 'bullet';

type Props = { initialLoanType?: LoanType };

// finpilot/js/calculators.js의 calculateLoan(7. 대출이자 계산기)을 그대로 이식.
// 은행 추천 상품 피드는 모의 마케팅 데이터라 이식 대상에서 제외 — loanType은 화면 진입 시
// 초기 탭 선택에만 쓰인다(계산식 자체에는 영향 없음, 웹과 동일).
export default function LoanCalculator({ initialLoanType }: Props) {
  const [loanType, setLoanType] = useState<LoanType>(initialLoanType ?? 'mortgage');
  const [repayMethod, setRepayMethod] = useState<RepayMethod>('equal-payment');
  const [amount, setAmount] = useState(300000000);
  const [termMonths, setTermMonths] = useState(360);
  const [graceMonths, setGraceMonths] = useState(0);
  const [ratePct, setRatePct] = useState(4);

  const result = useMemo(() => {
    const L = amount;
    let n = termMonths;
    let g = Math.max(0, graceMonths);
    if (g >= n) g = n - 1;
    const r = ratePct / 12 / 100;
    if (L <= 0 || n <= 0) return null;

    const repayMonths = n - g;
    let totalInterest = 0;
    let maxPayment = 0;
    const gracePayment = L * r;
    type ScheduleRow = { month: number; principal: number; interest: number; payment: number; balance: number };
    const schedule: ScheduleRow[] = [];
    if (g > 0) {
      totalInterest += gracePayment * g;
      maxPayment = Math.max(maxPayment, gracePayment);
      for (let t = 1; t <= g; t++) {
        schedule.push({ month: t, principal: 0, interest: gracePayment, payment: gracePayment, balance: L });
      }
    }

    if (repayMethod === 'equal-payment') {
      const pmt = r === 0 ? L / repayMonths : (L * (r * Math.pow(1 + r, repayMonths))) / (Math.pow(1 + r, repayMonths) - 1);
      let balance = L;
      for (let t = 1; t <= repayMonths; t++) {
        const interest = balance * r;
        const principal = pmt - interest;
        balance = Math.max(0, balance - principal);
        totalInterest += interest;
        schedule.push({ month: g + t, principal, interest, payment: pmt, balance });
      }
      maxPayment = Math.max(maxPayment, pmt);
    } else if (repayMethod === 'equal-principal') {
      const principalPerMonth = L / repayMonths;
      let balance = L;
      let firstPayment = 0;
      for (let t = 1; t <= repayMonths; t++) {
        const interest = balance * r;
        const payment = principalPerMonth + interest;
        if (t === 1) firstPayment = payment;
        balance = Math.max(0, balance - principalPerMonth);
        totalInterest += interest;
        schedule.push({ month: g + t, principal: principalPerMonth, interest, payment, balance });
      }
      maxPayment = Math.max(maxPayment, firstPayment);
    } else {
      const monthlyInterest = L * r;
      totalInterest += monthlyInterest * (repayMonths - 1);
      totalInterest += monthlyInterest;
      maxPayment = Math.max(maxPayment, L + monthlyInterest);
      for (let t = 1; t < repayMonths; t++) {
        schedule.push({ month: g + t, principal: 0, interest: monthlyInterest, payment: monthlyInterest, balance: L });
      }
      schedule.push({ month: g + repayMonths, principal: L, interest: monthlyInterest, payment: L + monthlyInterest, balance: 0 });
    }

    const totalPayment = L + totalInterest;
    const tableRows = schedule.map((row) => ({
      month: `${row.month}`,
      principal: `₩${formatResult(row.principal)}`,
      interest: `₩${formatResult(row.interest)}`,
      payment: `₩${formatResult(row.payment)}`,
      balance: `₩${formatResult(row.balance)}`,
    }));
    return { totalInterest, totalPayment, maxPayment, gracePayment, g, tableRows };
  }, [amount, termMonths, graceMonths, ratePct, repayMethod]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <SegmentedControl
          options={[
            { value: 'mortgage', label: '주택담보' },
            { value: 'jeonse', label: '전월세보증금' },
            { value: 'credit', label: '신용' },
          ]}
          value={loanType}
          onChange={(v) => setLoanType(v as LoanType)}
        />
        <SegmentedControl
          options={[
            { value: 'equal-payment', label: '원리금균등' },
            { value: 'equal-principal', label: '원금균등' },
            { value: 'bullet', label: '만기일시' },
          ]}
          value={repayMethod}
          onChange={(v) => setRepayMethod(v as RepayMethod)}
        />
        <NumberField label="대출 금액" value={amount} onChange={setAmount} suffix="원" quickAdds={AMOUNT_CHIPS} showKoreanHint />
        <NumberField label="대출 기간" value={termMonths} onChange={setTermMonths} suffix="개월" />
        <NumberField label="거치 기간 (선택)" value={graceMonths} onChange={setGraceMonths} suffix="개월" />
        <NumberField label="연 이율" value={ratePct} onChange={setRatePct} suffix="%" allowDecimal />
      </InputPanel>

      {result ? (
        <>
          <ResultCard
            title="월 상환액"
            mainValue={`₩ ${formatResult(result.maxPayment)}`}
            subValue={result.g > 0 ? `거치기간 ${result.g}개월 동안은 이자만 납부` : undefined}
            rows={[
              { label: '총 이자', value: `₩ ${formatResult(result.totalInterest)}`, tone: 'loss' },
              { label: '총 상환액', value: `₩ ${formatResult(result.totalPayment)}` },
            ]}
          />
          <DataTable columns={TABLE_COLUMNS} rows={result.tableRows} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
});
