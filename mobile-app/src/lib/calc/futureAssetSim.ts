// 미래 자산 예측 시뮬레이터의 순수 계산 로직 — 슬라이더 두 개(월 저축액/대출 상환금)를 독립적으로
// 계산한다. 저축은 매월 적립 복리(연 4% 가정, finpilot 적립식 복리 계산기와 같은 공식), 대출은
// "3억원 · 연 4% · 30년 원리금균등"을 기준 시나리오로 두고 매월 추가 상환액만큼 원금을 더 갚았을 때
// 줄어드는 총이자를 월별 시뮬레이션으로 구한다.
const ASSUMED_SAVINGS_RATE = 0.04;
const SIM_YEARS = 5;
const BASE_LOAN_AMOUNT = 300000000;
const BASE_LOAN_RATE = 0.04;
const BASE_LOAN_TERM_MONTHS = 360;

export function projectFutureSavings(monthlyAmount: number): { futureValue: number; principal: number; profit: number } {
  const months = SIM_YEARS * 12;
  const r = ASSUMED_SAVINGS_RATE / 12;
  const principal = monthlyAmount * months;
  const futureValue = r === 0 ? principal : monthlyAmount * ((Math.pow(1 + r, months) - 1) / r);
  return { futureValue, principal, profit: futureValue - principal };
}

function simulateLoanTotalInterest(extraMonthlyPayment: number): number {
  const r = BASE_LOAN_RATE / 12;
  const basePmt =
    r === 0
      ? BASE_LOAN_AMOUNT / BASE_LOAN_TERM_MONTHS
      : (BASE_LOAN_AMOUNT * (r * Math.pow(1 + r, BASE_LOAN_TERM_MONTHS))) / (Math.pow(1 + r, BASE_LOAN_TERM_MONTHS) - 1);

  let balance = BASE_LOAN_AMOUNT;
  let totalInterest = 0;
  for (let m = 0; m < BASE_LOAN_TERM_MONTHS && balance > 0; m++) {
    const interest = balance * r;
    let principalPaid = basePmt - interest + extraMonthlyPayment;
    if (principalPaid > balance) principalPaid = balance;
    balance -= principalPaid;
    totalInterest += interest;
  }
  return totalInterest;
}

export function projectLoanInterestSaved(extraMonthlyPayment: number): { interestSaved: number; baseInterest: number; newInterest: number } {
  const baseInterest = simulateLoanTotalInterest(0);
  const newInterest = simulateLoanTotalInterest(extraMonthlyPayment);
  return { interestSaved: Math.max(0, baseInterest - newInterest), baseInterest, newInterest };
}

export { BASE_LOAN_AMOUNT, BASE_LOAN_RATE, BASE_LOAN_TERM_MONTHS, ASSUMED_SAVINGS_RATE, SIM_YEARS };
