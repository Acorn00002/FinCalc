// taxpilot/index.html:1802-1827의 누진세율표/계산 함수를 그대로 이식.
// 소득세(양도소득세/연말정산/퇴직소득세)와 증여·상속세가 공유하는 엔진이라 한 곳에 모아둔다.
export type TaxBracket = { limit: number; rate: number; deduction: number };

export const INCOME_TAX_BRACKETS: TaxBracket[] = [
  { limit: 14000000, rate: 0.06, deduction: 0 },
  { limit: 50000000, rate: 0.15, deduction: 1260000 },
  { limit: 88000000, rate: 0.24, deduction: 5760000 },
  { limit: 150000000, rate: 0.35, deduction: 15440000 },
  { limit: 300000000, rate: 0.38, deduction: 19940000 },
  { limit: 500000000, rate: 0.4, deduction: 25940000 },
  { limit: 1000000000, rate: 0.42, deduction: 35940000 },
  { limit: Infinity, rate: 0.45, deduction: 65940000 },
];

export const GIFT_TAX_BRACKETS: TaxBracket[] = [
  { limit: 100000000, rate: 0.1, deduction: 0 },
  { limit: 500000000, rate: 0.2, deduction: 10000000 },
  { limit: 1000000000, rate: 0.3, deduction: 60000000 },
  { limit: 3000000000, rate: 0.4, deduction: 160000000 },
  { limit: Infinity, rate: 0.5, deduction: 460000000 },
];

export function calcProgressiveTax(base: number, brackets: TaxBracket[]): number {
  for (const b of brackets) {
    if (base <= b.limit) return Math.max(0, base * b.rate - b.deduction);
  }
  return 0;
}
