// 정부지원금 목록 조회 — 서버 필터 + cursor 페이지네이션(/api/support-programs).
// 예전에는 Firestore REST로 supportPrograms 컬렉션을 통째로 읽었지만, 데이터가 늘어도 비용·시간이 늘지 않도록
// 페이지(최대 50건) 단위로만 가져온다. www가 붙은 도메인을 쓰는 이유는 aiAssist.ts와 같다(308 리다이렉트 회피).
const DEFAULT_URL = 'https://www.gofincalc.com/api/support-programs';
// 미리보기(Preview) 배포를 가리켜 테스트할 때만 EXPO_PUBLIC_SUPPORT_PROGRAMS_API_URL로 덮어쓴다.
const API_URL = process.env.EXPO_PUBLIC_SUPPORT_PROGRAMS_API_URL || DEFAULT_URL;

export const SUBSIDY_PAGE_LIMIT = 50;

export type SubsidyPageQuery = {
  category?: string; // '' 또는 undefined = 전체
  region?: string;
  sort: 'deadline' | 'latest';
  cursor?: string | null;
};

export type SubsidyPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

export class SubsidyApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, status: number) {
    super(`support-programs ${status} ${code}`);
    this.code = code;
    this.status = status;
  }
}

export function buildSubsidyUrl(q: SubsidyPageQuery): string {
  const params: string[] = [`limit=${SUBSIDY_PAGE_LIMIT}`, `sort=${q.sort}`, 'status=all'];
  if (q.category) params.push(`category=${encodeURIComponent(q.category)}`);
  if (q.region) params.push(`region=${encodeURIComponent(q.region)}`);
  if (q.cursor) params.push(`cursor=${encodeURIComponent(q.cursor)}`);
  return `${API_URL}?${params.join('&')}`;
}

export async function fetchSubsidyPage<T extends { id: string }>(q: SubsidyPageQuery): Promise<SubsidyPage<T>> {
  const res = await fetch(buildSubsidyUrl(q));
  let json: { items?: T[]; nextCursor?: string | null; error?: string } = {};
  try {
    json = await res.json();
  } catch {
    // 본문이 JSON이 아니면 아래에서 상태 코드로 오류 처리한다.
  }
  if (!res.ok) throw new SubsidyApiError(json.error || 'http_error', res.status);
  const nextCursor = typeof json.nextCursor === 'string' && json.nextCursor ? json.nextCursor : null;
  return { items: Array.isArray(json.items) ? json.items : [], nextCursor, hasMore: !!nextCursor };
}

// 이미 가진 목록 뒤에 새 페이지를 붙인다. 같은 id는 한 번만 둔다(중복 제거).
export function mergeUnique<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const seen = new Set(prev.map((p) => p.id));
  const out = prev.slice();
  for (const it of next) {
    if (!it || !it.id || seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}
