// index.html의 FINANCE_DATA(약 1669~1747번째 줄)를 그대로 이식 — 실제 은행 상품을 조사해 만든
// 정적 데이터라 Firestore/API 없이 그대로 복사한다. 값이 바뀌면 웹/앱 양쪽을 같이 갱신해야 한다.
export type FinanceCategory = 'deposit' | 'savings' | 'mortgage' | 'jeonse' | 'credit';

export type FinanceProduct = {
  bank: string;
  name: string;
  baseRate: number;
  maxRate: number;
  term: string;
  prepayFee?: string;
  tags: string[];
};

export type FinanceSort = { key: string; label: string };

export type FinanceCategoryData = {
  title: string;
  subtitle: string;
  asOf: string;
  source: string;
  sorts: FinanceSort[];
  products: FinanceProduct[];
};

export const LOAN_FINANCE_CATEGORIES: FinanceCategory[] = ['mortgage', 'jeonse', 'credit'];

export const FINANCE_DATA: Record<FinanceCategory, FinanceCategoryData> = {
  deposit: {
    title: '정기예금',
    subtitle: '실제 판매 중인 시중은행 정기예금 상품의 조사 시점 금리를 비교해보세요.',
    asOf: '2026년 7월 기준',
    source: '은행별 정기예금 금리 비교 조사 자료',
    sorts: [
      { key: 'rate-desc', label: '금리 높은순' },
      { key: 'preferential', label: '우대금리순' },
    ],
    products: [
      { bank: '우리은행', name: 'WON플러스예금', baseRate: 4.02, maxRate: 4.05, term: '6~36개월', tags: ['비대면 가입'] },
      { bank: '카카오뱅크', name: '카카오뱅크 정기예금', baseRate: 3.9, maxRate: 4.0, term: '6~36개월', tags: ['비대면 전용', '중도해지 시 유리'] },
      { bank: '하나은행', name: '하나 정기예금', baseRate: 2.3, maxRate: 4.05, term: '6~36개월', tags: ['장기 가입 시 우대'] },
      { bank: '신한은행', name: '쏠편한 정기예금', baseRate: 2.75, maxRate: 4.05, term: '6~36개월', tags: ['비대면', '자동이체 우대'] },
      { bank: 'KB국민은행', name: 'KB Star 정기예금', baseRate: 2.3, maxRate: 4.0, term: '6~36개월', tags: ['비대면 가입'] },
    ],
  },
  savings: {
    title: '정기적금',
    subtitle: '월 납입액 기준 실제 적금 상품의 조사 시점 금리를 비교해보세요.',
    asOf: '2026년 7월 3일 기준',
    source: '은행별 정기적금 금리 비교 조사 자료 (월 100만원 납입 기준)',
    sorts: [
      { key: 'rate-desc', label: '금리 높은순' },
      { key: 'preferential', label: '우대금리순' },
    ],
    products: [
      { bank: '우리은행', name: '우리 사장님 성장 적금', baseRate: 2.0, maxRate: 6.0, term: '12개월', tags: ['사업자 우대조건 충족 시'] },
      { bank: '하나은행', name: '급여하나 월복리 적금', baseRate: 2.75, maxRate: 5.05, term: '12개월', tags: ['월복리', '급여이체 우대'] },
      { bank: 'IBK기업은행', name: 'IBK 중기근로자우대적금', baseRate: 2.5, maxRate: 4.7, term: '12개월', tags: ['중소기업 재직자 우대'] },
      { bank: '케이뱅크', name: '주거래우대 자유적금', baseRate: 3.6, maxRate: 4.2, term: '12개월', tags: ['주거래 우대', '자유적립식'] },
      { bank: '신한은행', name: '신한 플랫폼 적금(병역명문가)', baseRate: 1.5, maxRate: 4.5, term: '12개월', tags: ['병역명문가 우대조건'] },
    ],
  },
  mortgage: {
    title: '주택담보대출',
    subtitle: '주택 구입 자금용 대출의 조사 시점 금리를 비교해보세요. 정확한 한도·중도상환수수료는 은행 확인이 꼭 필요해요.',
    asOf: '2026년 3월 말 기준 (변동성 큰 상품군 — 최신 금리 별도 확인 필수)',
    source: '은행별 가계대출 금리 비교 조사 자료',
    sorts: [{ key: 'rate-asc', label: '금리 낮은순' }],
    products: [
      { bank: '우리은행', name: '우리 주택담보대출', baseRate: 4.1, maxRate: 5.3, term: '혼합형·고정형', prepayFee: '있음 (은행 확인 필요)', tags: ['혼합형/고정형'] },
      { bank: '신한은행', name: '신한 주택담보대출', baseRate: 4.09, maxRate: 5.5, term: '혼합형·고정형', prepayFee: '있음 (은행 확인 필요)', tags: ['혼합형/고정형'] },
      { bank: '하나은행', name: '하나 주택담보대출', baseRate: 4.164, maxRate: 5.364, term: '혼합형·고정형', prepayFee: '있음 (은행 확인 필요)', tags: ['혼합형/고정형'] },
      { bank: 'NH농협은행', name: 'NH농협 주택담보대출', baseRate: 3.91, maxRate: 6.21, term: '혼합형·고정형', prepayFee: '있음 (은행 확인 필요)', tags: ['혼합형/고정형'] },
    ],
  },
  jeonse: {
    title: '전월세보증금대출',
    subtitle: '전세·월세 보증금 조달용 대출의 조사 시점 금리를 비교해보세요.',
    asOf: '2026년 3월 말 기준 (변동성 큰 상품군 — 최신 금리 별도 확인 필수)',
    source: '은행별 전세자금대출 금리 비교 조사 자료',
    sorts: [{ key: 'rate-asc', label: '금리 낮은순' }],
    products: [
      { bank: '케이뱅크', name: '케이뱅크 전세대출', baseRate: 3.42, maxRate: 3.42, term: '임대차 계약 기간 연동', prepayFee: '중도상환수수료 없음(정책 변경 가능)', tags: ['시중은행 중 최저 수준'] },
      { bank: 'NH농협은행', name: 'NH농협 전세자금대출', baseRate: 3.68, maxRate: 3.68, term: '임대차 계약 기간 연동', prepayFee: '있음 (은행 확인 필요)', tags: [] },
      { bank: '주택도시기금(버팀목)', name: '청년버팀목 전세자금대출', baseRate: 2.0, maxRate: 3.1, term: '임대차 계약 기간 연동', prepayFee: '정책대출 — 별도 규정', tags: ['정책대출', '소득 5천만원 이하'] },
    ],
  },
  credit: {
    title: '신용대출',
    subtitle: '직장인 신용대출·마이너스통장의 조사 시점 금리를 비교해보세요.',
    asOf: '2026년 3~4월 기준 (변동성 큰 상품군 — 최신 금리 별도 확인 필수)',
    source: '은행별 신용대출·마이너스통장 금리 비교 조사 자료',
    sorts: [{ key: 'rate-asc', label: '금리 낮은순' }],
    products: [
      { bank: '우리은행', name: '우리WON 신용대출', baseRate: 3.7, maxRate: 3.7, term: '변동금리(신규 COFIX 연동)', prepayFee: '중도상환수수료 없음(신용대출 특성상)', tags: ['최저금리 기준'] },
      { bank: 'KB국민은행', name: 'KB 마이너스통장', baseRate: 3.6, maxRate: 6.01, term: '마이너스통장(한도대출)', prepayFee: '중도상환수수료 없음(마이너스통장 특성상)', tags: ['기준일 2026.04.13'] },
      { bank: '토스뱅크', name: '토스뱅크 신용대출', baseRate: 5.17, maxRate: 12.22, term: '일반 신용대출', prepayFee: '중도상환수수료 없음', tags: ['중도상환수수료 면제'] },
    ],
  },
};
