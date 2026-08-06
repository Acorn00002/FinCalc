// index.html의 LOUNGE_CATEGORY_LABELS/LOUNGE_TIER_TABLE을 그대로 이식.
export type LoungeCategory = 'stock' | 'realestate' | 'coin' | 'tax-tips';

export const LOUNGE_CATEGORIES: { value: LoungeCategory; label: string }[] = [
  { value: 'stock', label: '주식' },
  { value: 'realestate', label: '부동산' },
  { value: 'coin', label: '코인' },
  { value: 'tax-tips', label: '절세꿀팁' },
];

export const LOUNGE_CATEGORY_LABELS: Record<string, string> = {
  stock: '주식',
  realestate: '부동산',
  coin: '코인',
  'tax-tips': '절세꿀팁',
};

const LOUNGE_TIER_TABLE = [
  { min: 10000, label: '다이아 파일럿' },
  { min: 5000, label: '골드 파일럿' },
  { min: 2000, label: '실버 파일럿' },
  { min: 0, label: '브론즈 파일럿' },
];

export function getTierInfo(points: number): { min: number; label: string } {
  for (const t of LOUNGE_TIER_TABLE) {
    if (points >= t.min) return t;
  }
  return LOUNGE_TIER_TABLE[LOUNGE_TIER_TABLE.length - 1];
}

// index.html의 formatRelativeTime()을 그대로 이식.
export function formatRelativeTime(iso: string | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return '방금 전';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return `${diffWeek}주 전`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}개월 전`;
  return `${Math.floor(diffDay / 365)}년 전`;
}
