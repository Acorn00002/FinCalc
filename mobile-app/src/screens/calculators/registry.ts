import type { Ionicons } from '@expo/vector-icons';

export type CalcId =
  | 'compound-simple'
  | 'compound-periodic'
  | 'goal-planner'
  | 'water-ratio'
  | 'kelly'
  | 'roi'
  | 'exchange'
  | 'dividend'
  | 'salary'
  | 'loan'
  | 'deposit'
  | 'savings'
  | 'gift-tax'
  | 'inheritance-tax'
  | 'gains-tax'
  | 'inflation'
  | 'severance'
  | 'early-termination'
  | 'retirement'
  | 'loan-limit'
  | 'apt-buy'
  | 'apt-tax'
  | 'brokerage'
  | 'pyeong'
  | 'deposit-calc'
  | 'subscription'
  | 'home-budget'
  | 'global-stock-tax'
  | 'global-net'
  | 'fin-func';

// index.html의 #hubPills 필터(전체/금융/주식/세금/부동산/근로)와 동일한 분류.
export type CalcCategory = 'finance' | 'stock' | 'tax' | 'realestate' | 'labor';

export const CALC_CATEGORIES: { value: CalcCategory; label: string }[] = [
  { value: 'finance', label: '금융' },
  { value: 'stock', label: '주식' },
  { value: 'tax', label: '세금' },
  { value: 'realestate', label: '부동산' },
  { value: 'labor', label: '근로' },
];

export type CalcEntry = {
  id: CalcId;
  title: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  category: CalcCategory;
  /** finpilot/index.html의 .section-header 설명 문구 — 있는 계산기(7개)만 채워져 있다. */
  description?: string;
  /** index.html의 calc-card 중 <span class="calc-soon-badge new">New</span>가 붙은 항목과 동일. */
  isNew?: boolean;
  /** index.html calc-card의 data-search 값 — 검색창에서 이 문자열도 함께 매칭한다. */
  keywords?: string;
  /** 네이티브로 이식 완료된 계산기만 true — 나머지는 목록에 "준비 중"으로 표시된다. */
  implemented: boolean;
};

// index.html의 FINCALC_MAP(약 4986~5015번째 줄)과 calc-card의 data-category(약 516~689번째 줄)에 1:1 대응.
export const CALCULATORS: CalcEntry[] = [
  { id: 'compound-simple', title: '일반 복리 계산기', icon: 'trending-up-outline', category: 'stock', description: '초기 원금을 바탕으로 특정 수익률과 기간 동안의 자산 변화를 계산합니다.', keywords: '일반 복리 계산기', implemented: true },
  { id: 'compound-periodic', title: '적립식 복리 (SIP)', icon: 'wallet-outline', category: 'stock', description: '매월 일정 금액을 꾸준히 투자할 때의 놀라운 복리 효과를 확인하세요.', keywords: '적립식 복리 SIP', implemented: true },
  { id: 'goal-planner', title: '목표 자산 계산 (Goal)', icon: 'flag-outline', category: 'stock', description: '원하는 목표 금액을 모으기 위해 매월 얼마를 투자해야 하는지 역산합니다.', keywords: '목표 자산 계산 Goal', implemented: true },
  { id: 'water-ratio', title: '평단가 / 물타기', icon: 'swap-horizontal-outline', category: 'stock', description: '추가 매수 시 평균 단가와 수익률 변화를 실시간으로 시뮬레이션합니다.', keywords: '평단가 물타기 계산기 추가매수', implemented: true },
  { id: 'kelly', title: '켈리 공식 최적화', icon: 'shuffle-outline', category: 'stock', description: '승률과 손익비를 바탕으로 파산 위험을 최소화하고 수익을 극대화하는 최적의 투자 비중을 계산합니다.', keywords: '켈리 공식 최적화', implemented: true },
  { id: 'roi', title: '수익률 / 퍼센트', icon: 'stats-chart-outline', category: 'stock', description: '투자 금액 대비 수익률을 계산하거나 기본적인 퍼센트 비율을 확인합니다.', keywords: '수익률 퍼센트 계산기', implemented: true },
  { id: 'exchange', title: '실시간 환율 변환', icon: 'swap-horizontal-outline', category: 'finance', description: '통화 간 변환을 계산합니다. 실시간 환율을 반영하거나 직접 입력할 수 있습니다.', keywords: '실시간 환율 변환 환전', implemented: true },
  { id: 'dividend', title: '배당금 계산기', icon: 'cash-outline', category: 'stock', isNew: true, keywords: '배당금 계산기 재투자 DRIP 배당소득세', implemented: true },
  { id: 'salary', title: '연봉 실수령액 계산기', icon: 'card-outline', category: 'labor', isNew: true, keywords: '연봉 실수령액 계산기 4대보험 소득세', implemented: true },
  { id: 'loan', title: '대출이자 계산기', icon: 'business-outline', category: 'finance', isNew: true, keywords: '대출이자 계산기 원리금균등 원금균등 만기일시', implemented: true },
  { id: 'deposit', title: '정기예금 계산기', icon: 'cash-outline', category: 'finance', isNew: true, keywords: '정기예금 계산기 단리 복리 이자과세', implemented: true },
  { id: 'savings', title: '정기적금 계산기', icon: 'save-outline', category: 'finance', isNew: true, keywords: '정기적금 계산기 단리 복리 이자과세', implemented: true },
  { id: 'gift-tax', title: '증여세 계산기', icon: 'gift-outline', category: 'tax', isNew: true, keywords: '증여세 계산기 면제한도 증여재산공제', implemented: true },
  { id: 'inheritance-tax', title: '상속세 계산기', icon: 'heart-outline', category: 'tax', isNew: true, keywords: '상속세 계산기 면제한도 배우자공제 일괄공제', implemented: true },
  { id: 'gains-tax', title: '양도소득세 계산기', icon: 'receipt-outline', category: 'tax', isNew: true, keywords: '양도소득세 계산기 부동산 1세대1주택 비과세 장기보유특별공제', implemented: true },
  { id: 'inflation', title: '인플레이션 계산기', icon: 'trending-down-outline', category: 'finance', isNew: true, keywords: '인플레이션 계산기 물가상승률 화폐가치', implemented: true },
  { id: 'severance', title: '퇴직금 계산기', icon: 'briefcase-outline', category: 'labor', isNew: true, keywords: '퇴직금 계산기 평균임금 근속연수공제 퇴직소득세', implemented: true },
  { id: 'early-termination', title: '예금중도해지 계산기', icon: 'cut-outline', category: 'finance', isNew: true, keywords: '예금중도해지 계산기 중도해지이율 손실액', implemented: true },
  { id: 'retirement', title: '은퇴자금 계산기', icon: 'hourglass-outline', category: 'labor', isNew: true, keywords: '은퇴자금 계산기 노후 필요자금 은퇴시뮬레이터', implemented: true },
  { id: 'loan-limit', title: '대출한도 계산기', icon: 'business-outline', category: 'finance', isNew: true, keywords: '대출한도 계산기 LTV DSR 규제', implemented: true },
  { id: 'apt-buy', title: '취득세 계산기', icon: 'home-outline', category: 'tax', isNew: true, keywords: '취득세 계산기 주택 다주택 중과세율', implemented: true },
  { id: 'apt-tax', title: '보유세 계산기', icon: 'business-outline', category: 'tax', isNew: true, keywords: '보유세 계산기 재산세 종합부동산세 종부세 공시가격', implemented: true },
  { id: 'brokerage', title: '중개수수료 계산기', icon: 'people-outline', category: 'realestate', isNew: true, keywords: '부동산 중개수수료 계산기 매매 전월세 상한요율', implemented: true },
  { id: 'pyeong', title: '평수 변환기', icon: 'resize-outline', category: 'realestate', isNew: true, keywords: '평수 변환 계산기 제곱미터 평 단위 환산', implemented: true },
  { id: 'deposit-calc', title: '환산보증금 계산기', icon: 'storefront-outline', category: 'realestate', isNew: true, keywords: '환산보증금 계산기 상가건물임대차보호법', implemented: true },
  { id: 'subscription', title: '청약가점 계산기', icon: 'medal-outline', category: 'realestate', isNew: true, keywords: '청약가점 계산기 무주택기간 부양가족 청약통장', implemented: true },
  { id: 'home-budget', title: '내집마련 계산기', icon: 'key-outline', category: 'realestate', isNew: true, keywords: '내집마련 계산기 매수 가능 주택가격', implemented: true },
  { id: 'global-stock-tax', title: '해외주식 양도세 계산기', icon: 'globe-outline', category: 'stock', isNew: true, keywords: '해외주식 양도소득세 계산기 기본공제 250만원', implemented: true },
  { id: 'global-net', title: '해외주식 실수령 계산기', icon: 'globe-outline', category: 'stock', isNew: true, keywords: '해외주식 실수령액 계산기 환율 수수료', implemented: true },
  { id: 'fin-func', title: '재무함수 계산기', icon: 'calculator-outline', category: 'finance', isNew: true, keywords: '재무함수 계산기 현재가치 미래가치 순현재가치 PV FV NPV', implemented: true },
];
