// finpilot/js/calculators.js의 formatResult/formatKoreanUnit을 그대로 이식.
export function formatResult(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
}

// 예: 250000000 -> "2억 5,000만 원"
export function formatKoreanUnit(n: number): string {
  n = Math.max(0, Math.round(n));
  if (n === 0) return '0원';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = n % 10000;
  let out = '';
  if (eok) out += eok.toLocaleString('ko-KR') + '억 ';
  if (man) out += man.toLocaleString('ko-KR') + '만 ';
  if (rest) out += rest.toLocaleString('ko-KR') + ' ';
  return out.trim() + '원';
}
