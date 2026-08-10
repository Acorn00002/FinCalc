import {
  getFirestoreDocument,
  updateFirestoreDocument,
  setFirestoreDocument,
  fetchFirestoreCollection,
} from './firestoreRest';

// index.html의 마이페이지 "내 자산 현황" 대시보드·자산 목표 트래커·월별 자산 기록을 그대로 이식.
// 웹은 Firestore 클라이언트 SDK로 userAssets/{uid}(+ /history/{YYYY-MM} 서브컬렉션)를 실시간
// 구독하지만, 네이티브는 REST(firestoreRest.ts)로 필요할 때만 읽고 쓴다 — 데이터 모델(필드명·문서
// 구조)은 완전히 동일해서 firestore.rules도 그대로 재사용된다.

export type UserAssetsDoc = {
  cash: number;
  stock: number;
  realestate: number;
  goalAmount?: number;
  goalDate?: string; // "YYYY-MM-DD"
};

export type AssetHistoryEntry = {
  id: string; // "YYYY-MM"
  total: number;
  cash: number;
  stock: number;
  realestate: number;
};

function toNonNegativeNumber(v: unknown): number {
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
}

export async function fetchUserAssets(uid: string, idToken: string): Promise<UserAssetsDoc> {
  const doc = await getFirestoreDocument(`userAssets/${uid}`, idToken);
  return {
    cash: toNonNegativeNumber(doc?.cash),
    stock: toNonNegativeNumber(doc?.stock),
    realestate: toNonNegativeNumber(doc?.realestate),
    goalAmount: typeof doc?.goalAmount === 'number' && doc.goalAmount > 0 ? doc.goalAmount : undefined,
    goalDate: typeof doc?.goalDate === 'string' ? doc.goalDate : undefined,
  };
}

// 자산 항목(현금/주식/부동산)만 merge 저장 — updateFirestoreDocument가 updateMask를 함께 보내므로
// goalAmount/goalDate 같은 다른 필드는 건드리지 않는다(웹의 set(..., {merge:true})와 동일 효과).
export async function saveUserAssetBreakdown(
  uid: string,
  idToken: string,
  data: { cash: number; stock: number; realestate: number }
): Promise<void> {
  await updateFirestoreDocument(`userAssets/${uid}`, data, idToken);
}

// 자산 목표(금액/기한)만 merge 저장. goalDate가 빈 문자열이면 그 필드는 아예 보내지 않는다 — REST
// updateMask는 "필드를 null로 설정"과 "필드 삭제"를 구분하지 않고 보안 규칙이 goalDate를 문자열
// 타입으로만 허용해서, 빈 값을 null로 보내면 규칙에서 거부된다. 대신 생략하면(merge라서) 이전 값이
// 그대로 남는다 — 날짜를 지우고 저장하는 예외 케이스는 웹(FieldValue.delete 사용)만큼 완벽하진
// 않지만, 실사용에서 드문 경로라 이 정도 단순화로 충분하다.
export async function saveUserAssetGoal(
  uid: string,
  idToken: string,
  data: { goalAmount: number; goalDate?: string }
): Promise<void> {
  const payload: Record<string, unknown> = { goalAmount: data.goalAmount };
  if (data.goalDate) payload.goalDate = data.goalDate;
  await updateFirestoreDocument(`userAssets/${uid}`, payload, idToken);
}

export async function fetchAssetHistory(uid: string, idToken: string): Promise<AssetHistoryEntry[]> {
  // pageSize를 넉넉히 잡아 최근 기록이 기본 페이지 크기(20)에 잘리지 않게 한다. 서버가 정렬을
  // 보장하지 않으므로 문서 ID(YYYY-MM, 제로패딩)를 문자열로 내림차순 정렬해 최신 달이 먼저 오게 한다.
  const rows = await fetchFirestoreCollection(`userAssets/${uid}/history?pageSize=36`, idToken);
  return rows
    .map((row) => ({
      id: String(row.id),
      total: toNonNegativeNumber(row.total),
      cash: toNonNegativeNumber(row.cash),
      stock: toNonNegativeNumber(row.stock),
      realestate: toNonNegativeNumber(row.realestate),
    }))
    .sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

function currentMonthId(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// 이번 달 스냅샷을 upsert한다 — 같은 달에 여러 번 호출해도 그 달 문서 하나만 최신값으로 덮어써진다.
export async function recordAssetHistorySnapshot(
  uid: string,
  idToken: string,
  snapshot: { total: number; cash: number; stock: number; realestate: number }
): Promise<void> {
  const monthId = currentMonthId();
  await setFirestoreDocument(
    `userAssets/${uid}/history/${monthId}`,
    { ...snapshot, recordedAt: new Date().toISOString() },
    idToken
  );
}