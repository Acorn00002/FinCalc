// 금융상품 화면의 순수 로직 — 웹의 js/finance-products.js(커밋 1a88f82)와 같은 규칙을 그대로 옮긴 것이다.
// 상품 유형별 제목·정렬·대표 금리·카드/상세 필드·응답 검증을 한 곳에 모아, 웹과 앱이 같은 뜻으로 보여주게 한다.
// 값이 바뀌면 웹(js/finance-products.js)과 같이 고쳐야 하며, functions/test/financeProductsMobile.test.js가 두 구현의 출력을 비교한다.
//
//  - 응답에 type이 있으면 요청한 유형과 같은지 검증하고, 다르면 오류로 처리한다(다른 유형 데이터로 대체하지 않는다).
//  - API에 없는 값은 0·"없음"으로 채우지 않고 항목 자체를 표시하지 않는다.
//  - 예·적금은 높을수록, 대출은 낮을수록 유리하다.

export type FinanceCategory = 'deposit' | 'savings' | 'mortgage' | 'jeonse' | 'credit';

export type LiveFinanceProduct = {
  bank: string;
  name: string;
  joinWay: string;
  maturityInterest: string;
  specialCondition: string;
  joinDeny: string;
  joinMember: string;
  etcNote: string;
  maxLimit: string;
  baseRate: number | null;
  maxRate: number | null;
  avgRate?: number | null;
  term: string;
  disclosedMonth: string;
  // 유형별로 API가 값을 줄 때만 있는 항목
  intrRateType?: string;
  rsrvType?: string;
  repayType?: string;
  lendRateType?: string;
  mortgageType?: string;
  creditProductType?: string;
  rateKind?: string;
  loanLimit?: string;
  earlyRepayFee?: string;
  delayRate?: string;
  loanExpense?: string;
};

export type FinanceSortKey = 'rate-desc' | 'preferential' | 'min-asc' | 'max-asc';

type Meta = {
  title: string;
  isLoan: boolean;
  subtitle: string;
  sorts: { key: FinanceSortKey; label: string }[];
  spotlight: { label: string; desc: string };
  emptyText: string;
  errorText: string;
  disclaimer: string;
};

export const CATS: FinanceCategory[] = ['deposit', 'savings', 'mortgage', 'jeonse', 'credit'];

const DEPOSIT_DISCLAIMER =
  '실시간으로 조회한 공시 데이터이지만, 우대금리 조건과 한도는 은행별로 다를 수 있으니 가입 전 반드시 해당 은행에서 최신 조건을 다시 확인해 주세요.';
const LOAN_DISCLAIMER =
  '실시간으로 조회한 공시 데이터입니다. 대출 금리는 신용도·담보·소득 등 심사 결과에 따라 공시된 구간 안에서 개인별로 달라지고, 한도와 조건도 은행마다 다르니 신청 전 반드시 해당 은행에서 확인해 주세요.';
const DEPOSIT_SORTS: Meta['sorts'] = [
  { key: 'rate-desc', label: '최고금리 높은순' },
  { key: 'preferential', label: '우대금리순' },
];
const LOAN_SORTS: Meta['sorts'] = [
  { key: 'min-asc', label: '최저금리 낮은순' },
  { key: 'max-asc', label: '최고금리 낮은순' },
];
const DEPOSIT_SPOTLIGHT = {
  label: '최고금리',
  desc: '실시간 조회 상품 중 가장 높은 최고금리예요. 우대조건 충족 여부에 따라 실제 적용 금리는 달라질 수 있어요.',
};
const LOAN_SPOTLIGHT = {
  label: '최저금리',
  desc: '실시간 조회 상품 중 가장 낮은 최저금리예요. 실제 적용 금리는 심사 결과에 따라 달라질 수 있어요.',
};

export const META: Record<FinanceCategory, Meta> = {
  deposit: {
    title: '정기예금', isLoan: false,
    subtitle: '실시간으로 조회한 시중은행 정기예금 상품의 금리를 비교해보세요.',
    sorts: DEPOSIT_SORTS, spotlight: DEPOSIT_SPOTLIGHT,
    emptyText: '조회된 정기예금 상품이 없어요.',
    errorText: '정기예금 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    disclaimer: DEPOSIT_DISCLAIMER,
  },
  savings: {
    title: '정기적금', isLoan: false,
    subtitle: '실시간으로 조회한 정기적금 상품의 금리를 비교해보세요.',
    sorts: DEPOSIT_SORTS, spotlight: DEPOSIT_SPOTLIGHT,
    emptyText: '조회된 정기적금 상품이 없어요.',
    errorText: '정기적금 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    disclaimer: DEPOSIT_DISCLAIMER,
  },
  mortgage: {
    title: '주택담보대출', isLoan: true,
    subtitle: '주택 구입 자금용 대출의 실시간 금리를 비교해보세요. 정확한 한도는 은행 확인이 꼭 필요해요.',
    sorts: LOAN_SORTS, spotlight: LOAN_SPOTLIGHT,
    emptyText: '조회된 주택담보대출 상품이 없어요.',
    errorText: '주택담보대출 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    disclaimer: LOAN_DISCLAIMER,
  },
  jeonse: {
    title: '전월세보증금대출', isLoan: true,
    subtitle: '전세·월세 보증금 조달용 대출의 실시간 금리를 비교해보세요.',
    sorts: LOAN_SORTS, spotlight: LOAN_SPOTLIGHT,
    emptyText: '조회된 전월세보증금대출 상품이 없어요.',
    errorText: '전월세보증금대출 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    disclaimer: LOAN_DISCLAIMER,
  },
  credit: {
    title: '개인신용대출', isLoan: true,
    subtitle: '직장인 신용대출·마이너스통장의 실시간 금리를 비교해보세요. 신용평점에 따라 적용 금리가 크게 달라져요.',
    sorts: LOAN_SORTS,
    spotlight: {
      label: '최저금리',
      desc: '실시간 조회 상품 중 가장 낮은 최저금리예요. 실제 적용 금리는 신용평점과 심사 결과에 따라 달라질 수 있어요.',
    },
    emptyText: '조회된 개인신용대출 상품이 없어요.',
    errorText: '개인신용대출 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    disclaimer: LOAN_DISCLAIMER,
  },
};

export function isCat(cat: unknown): cat is FinanceCategory {
  return typeof cat === 'string' && Object.prototype.hasOwnProperty.call(META, cat);
}
export function meta(cat: unknown): Meta { return META[isCat(cat) ? cat : 'deposit']; }
export function isLoan(cat: unknown): boolean { return isCat(cat) && META[cat].isLoan; }
export function defaultSort(cat: unknown): FinanceSortKey { return meta(cat).sorts[0].key; }
export function validSort(cat: unknown, key: string): boolean { return meta(cat).sorts.some((s) => s.key === key); }

export function requestPath(cat: unknown): string {
  if (!isCat(cat)) throw new Error('알 수 없는 금융상품 유형: ' + String(cat));
  return '/api/finance-products?type=' + cat;
}
export function cacheKey(cat: unknown): string {
  if (!isCat(cat)) throw new Error('알 수 없는 금융상품 유형: ' + String(cat));
  return 'finance-products:' + cat;
}

// ---------- 숫자·문구 ----------
function isNum(n: unknown): n is number { return typeof n === 'number' && !isNaN(n); }
export function formatRate(n: unknown): string | null { return isNum(n) ? n.toFixed(2) + '%' : null; }
function text(v: unknown): string { return v === null || v === undefined ? '' : String(v).trim(); }
function oneLine(v: unknown, max: number): string {
  const s = text(v).replace(/\s+/g, ' ');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

// ---------- 정렬 ----------
// 값이 없는 상품은 어느 정렬에서도 맨 뒤로 보낸다.
export function sortProducts(cat: unknown, list: LiveFinanceProduct[], sortKey: string): LiveFinanceProduct[] {
  const arr = (list || []).slice();
  const key = validSort(cat, sortKey) ? sortKey : defaultSort(cat);
  const val = (p: LiveFinanceProduct, field: 'baseRate' | 'maxRate'): number | null => (isNum(p[field]) ? (p[field] as number) : null);
  const top = (p: LiveFinanceProduct): number | null => (val(p, 'maxRate') !== null ? val(p, 'maxRate') : val(p, 'baseRate'));
  const cmp = (a: LiveFinanceProduct, b: LiveFinanceProduct, getter: (p: LiveFinanceProduct) => number | null, desc: boolean): number => {
    const x = getter(a);
    const y = getter(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return desc ? y - x : x - y;
  };
  if (key === 'rate-desc') arr.sort((a, b) => cmp(a, b, top, true));
  else if (key === 'preferential') arr.sort((a, b) => cmp(a, b, (p) => (isNum(p.maxRate) && isNum(p.baseRate) ? p.maxRate - p.baseRate : null), true));
  else if (key === 'min-asc') arr.sort((a, b) => cmp(a, b, (p) => val(p, 'baseRate'), false) || cmp(a, b, (p) => val(p, 'maxRate'), false));
  else if (key === 'max-asc') arr.sort((a, b) => cmp(a, b, top, false));
  return arr;
}

// 대표 상품: 예·적금은 최고금리가 가장 높은 상품, 대출은 최저금리가 가장 낮은 상품
export function bestProduct(cat: unknown, list: LiveFinanceProduct[]): LiveFinanceProduct | null {
  let best: LiveFinanceProduct | null = null;
  (list || []).forEach((p) => {
    if (isLoan(cat)) {
      if (isNum(p.baseRate) && (best === null || p.baseRate < (best.baseRate as number))) best = p;
    } else {
      const v = isNum(p.maxRate) ? p.maxRate : p.baseRate;
      const bv = best === null ? null : isNum(best.maxRate) ? best.maxRate : best.baseRate;
      if (isNum(v) && (best === null || v > (bv as number))) best = p;
    }
  });
  return best;
}

export type Spotlight = { bank: string; name: string; value: string; label: string; desc: string };
export function spotlight(cat: unknown, list: LiveFinanceProduct[]): Spotlight | null {
  const p = bestProduct(cat, list);
  if (!p) return null;
  const m = meta(cat);
  return {
    bank: p.bank,
    name: p.name,
    value: formatRate(isLoan(cat) ? p.baseRate : isNum(p.maxRate) ? p.maxRate : p.baseRate) || '—',
    label: m.spotlight.label,
    desc: m.spotlight.desc,
  };
}

// ---------- 카드 · 상세 ----------
export type CardModel = { bank: string; name: string; primaryValue: string; primaryLabel: string; secondary: string; tags: string[]; meta: string };

export function cardModel(cat: unknown, item: LiveFinanceProduct): CardModel {
  const loan = isLoan(cat);
  let primaryValue: string;
  let primaryLabel: string;
  const secondary: string[] = [];
  const tags: string[] = [];
  const meta2: string[] = [];
  if (!loan) {
    const top = isNum(item.maxRate) ? item.maxRate : item.baseRate;
    primaryValue = formatRate(top) || '—';
    primaryLabel = isNum(item.maxRate) && isNum(item.baseRate) && item.maxRate !== item.baseRate ? '최고' : '';
    if (formatRate(item.baseRate)) secondary.push('기본 ' + formatRate(item.baseRate));
    if (text(item.term)) secondary.push(text(item.term));
    if (cat === 'savings' && text(item.rsrvType)) tags.push(text(item.rsrvType));
    if (text(item.intrRateType)) tags.push(text(item.intrRateType));
    if (text(item.joinMember)) meta2.push('가입 대상 ' + oneLine(item.joinMember, 24));
  } else {
    primaryValue = formatRate(item.baseRate) || formatRate(item.maxRate) || '—';
    primaryLabel = '최저';
    if (formatRate(item.maxRate) && item.maxRate !== item.baseRate) secondary.push('최고 ' + formatRate(item.maxRate));
    if (formatRate(item.avgRate)) secondary.push('평균 ' + formatRate(item.avgRate));
    if (cat === 'credit') {
      if (text(item.creditProductType)) tags.push(text(item.creditProductType));
    } else {
      if (text(item.lendRateType)) tags.push(text(item.lendRateType));
      if (text(item.repayType)) tags.push(text(item.repayType));
      if (cat === 'mortgage' && text(item.mortgageType)) tags.push(text(item.mortgageType));
    }
    if (text(item.loanLimit)) meta2.push('한도 ' + oneLine(item.loanLimit, 30));
  }
  if (text(item.joinWay)) meta2.push('가입 방법 ' + oneLine(item.joinWay, 28));
  return {
    bank: text(item.bank) || '은행 미확인',
    name: text(item.name) || '상품명 미확인',
    primaryValue,
    primaryLabel,
    secondary: secondary.join(' · '),
    tags,
    meta: meta2.join(' · '),
  };
}

export function detailRows(cat: unknown, item: LiveFinanceProduct): [string, string][] {
  const rows: [string, string][] = [];
  const add = (label: string, v: unknown) => { const t = text(v); if (t) rows.push([label, t]); };
  if (!isLoan(cat)) {
    if (formatRate(item.maxRate) && item.maxRate !== item.baseRate) add('최고금리', formatRate(item.maxRate));
    if (formatRate(item.baseRate)) add('기본금리', formatRate(item.baseRate) + (text(item.term) ? ' (' + text(item.term) + ')' : ''));
    if (cat === 'savings') add('적립 방식', item.rsrvType);
    add('이자 계산 방식', item.intrRateType);
    add('우대조건', item.specialCondition);
    add('가입 방법', item.joinWay);
    add('가입 대상', item.joinMember);
    add('최고 한도', item.maxLimit);
    add('만기 후 이자율', item.maturityInterest);
    add('기타 유의사항', item.etcNote);
  } else {
    if (formatRate(item.maxRate) && item.maxRate !== item.baseRate) add('최고금리', formatRate(item.maxRate));
    if (formatRate(item.avgRate)) add('평균금리', formatRate(item.avgRate));
    if (cat === 'credit') add('대출 종류', item.creditProductType);
    else {
      add('금리 방식', item.lendRateType);
      add('상환 방식', item.repayType);
      if (cat === 'mortgage') add('담보 유형', item.mortgageType);
    }
    add('대출 한도', item.loanLimit || item.maxLimit);
    add('가입 방법', item.joinWay);
    add('중도상환수수료', item.earlyRepayFee);
    add('연체이자율', item.delayRate);
    add('대출 부대비용', item.loanExpense);
    add('우대조건', item.specialCondition);
    add('기타 유의사항', item.etcNote);
  }
  return rows;
}

export function detailHead(cat: unknown, item: LiveFinanceProduct): { label: string; value: string } {
  const loan = isLoan(cat);
  return {
    label: loan ? '최저금리' : '최고금리',
    value: formatRate(loan ? item.baseRate : isNum(item.maxRate) ? item.maxRate : item.baseRate) || '—',
  };
}

// ---------- 응답 검증 ----------
export type FinanceResult = {
  cat: string;
  status: 'ok' | 'empty' | 'error';
  products: LiveFinanceProduct[];
  asOf: string;
  error: string;
};

function normalize(cat: string, status: FinanceResult['status'], data: { products?: LiveFinanceProduct[]; asOf?: unknown } | null, error: string): FinanceResult {
  return { cat, status, products: data && data.products ? data.products : [], asOf: data ? text(data.asOf) : '', error };
}

export function validate(cat: string, httpOk: boolean, data: unknown): FinanceResult {
  if (!data || typeof data !== 'object') return normalize(cat, 'error', null, 'invalid_payload');
  const d = data as { error?: unknown; type?: unknown; products?: unknown; asOf?: unknown };
  if (!httpOk || d.error) return normalize(cat, 'error', null, String(d.error || 'http_error'));
  if (d.type !== undefined && d.type !== cat) return normalize(cat, 'error', null, 'type_mismatch');
  if (!Array.isArray(d.products)) return normalize(cat, 'error', null, 'invalid_products');
  return normalize(cat, d.products.length ? 'ok' : 'empty', d as { products: LiveFinanceProduct[]; asOf?: unknown }, '');
}
