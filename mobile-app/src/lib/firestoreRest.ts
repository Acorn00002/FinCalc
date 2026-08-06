// Firebase JS SDK 없이, 공개 읽기(firestore.rules: allow read: if true)가 허용된 컬렉션을
// Firestore REST API로 직접 fetch하기 위한 최소 파서. index.html은 firebase.firestore() 클라이언트
// SDK를 쓰지만, 네이티브는 이 컬렉션 하나만 읽으면 되므로 무거운 SDK 대신 REST + 얇은 파서로 충분하다.
const PROJECT_ID = 'asset-filot';

type FirestoreValue = Record<string, unknown>;

function parseValue(v: FirestoreValue): unknown {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue as string, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) {
    const arr = (v.arrayValue as { values?: FirestoreValue[] }).values || [];
    return arr.map(parseValue);
  }
  if ('mapValue' in v) {
    const fields = (v.mapValue as { fields?: Record<string, FirestoreValue> }).fields || {};
    return parseFields(fields);
  }
  return null;
}

function parseFields(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) out[key] = parseValue(fields[key]);
  return out;
}

// 컬렉션의 모든 문서를 { id, ...fields } 형태로 반환한다 (supportPrograms는 문서 수가 적어 페이지네이션 불필요).
export async function fetchFirestoreCollection(collection: string): Promise<Record<string, unknown>[]> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`firestore fetch failed: ${res.status}`);
  const json = await res.json();
  const documents: { name: string; fields?: Record<string, FirestoreValue> }[] = json.documents || [];
  return documents.map((doc) => ({
    id: doc.name.split('/').pop() as string,
    ...parseFields(doc.fields || {}),
  }));
}

function toFirestoreValue(v: unknown): Record<string, unknown> {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } };
  return { nullValue: null };
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) out[key] = toFirestoreValue(obj[key]);
  return out;
}

// users/{uid}처럼 로그인한 사용자 본인만 읽고 쓸 수 있는 문서용 — Authorization: Bearer <Firebase
// idToken>을 실어 보내야 보안 규칙(request.auth.uid == userId)을 통과한다.
export async function getFirestoreDocument(path: string, idToken?: string): Promise<Record<string, unknown> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore get failed: ${res.status}`);
  const json = await res.json();
  return parseFields(json.fields || {});
}

export async function setFirestoreDocument(
  path: string,
  data: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore set failed: ${res.status}`);
}

// updateMask 없이 PATCH하면 문서 전체가 덮어써지므로, 일부 필드만 바꿀 땐 updateMask.fieldPaths를
// 함께 보내 나머지 필드는 그대로 둔다(자산 라운지 댓글수 증가처럼 다른 필드 보존이 중요한 경우).
export async function updateFirestoreDocument(
  path: string,
  data: Record<string, unknown>,
  idToken: string
): Promise<void> {
  const mask = Object.keys(data).map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}?${mask}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore update failed: ${res.status}`);
}

export async function deleteFirestoreDocument(path: string, idToken: string): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${idToken}` } });
  if (!res.ok) throw new Error(`firestore delete failed: ${res.status}`);
}

// db.collection(x).add() 대응 — 문서 ID를 서버가 자동 생성한다.
export async function addFirestoreDocument(
  collection: string,
  data: Record<string, unknown>,
  idToken: string
): Promise<string> {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ fields: toFirestoreFields(data) }),
  });
  if (!res.ok) throw new Error(`firestore add failed: ${res.status}`);
  const json = await res.json();
  return (json.name as string).split('/').pop() as string;
}

export type OrderDirection = 'ASCENDING' | 'DESCENDING';

// db.collection(x).where(...).orderBy(...) 대응 — 단순 GET으론 정렬/필터가 안 돼서 runQuery를 쓴다.
export async function runFirestoreQuery(params: {
  collection: string;
  whereEquals?: { field: string; value: string };
  orderByField: string;
  orderDirection?: OrderDirection;
  idToken?: string;
}): Promise<Record<string, unknown>[]> {
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId: params.collection }],
    orderBy: [{ field: { fieldPath: params.orderByField }, direction: params.orderDirection ?? 'DESCENDING' }],
  };
  if (params.whereEquals) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: params.whereEquals.field },
        op: 'EQUAL',
        value: { stringValue: params.whereEquals.value },
      },
    };
  }
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.idToken ? { Authorization: `Bearer ${params.idToken}` } : {}),
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`firestore query failed: ${res.status}`);
  const json: { document?: { name: string; fields?: Record<string, FirestoreValue> } }[] = await res.json();
  return json
    .filter((row) => row.document)
    .map((row) => ({
      id: row.document!.name.split('/').pop() as string,
      ...parseFields(row.document!.fields || {}),
    }));
}

type FieldTransform =
  | { fieldPath: string; increment: number }
  | { fieldPath: string; appendToArray: unknown[] }
  | { fieldPath: string; removeFromArray: unknown[] };

// FieldValue.increment()/arrayUnion()/arrayRemove()에 대응하는 원자적 필드 변형 — 읽고-계산하고-쓰는
// 과정 없이 서버에서 한 번에 처리되어, 좋아요 동시 클릭 같은 경쟁 상태에서도 안전하다.
export async function commitFieldTransforms(
  path: string,
  transforms: FieldTransform[],
  idToken: string
): Promise<void> {
  const fieldTransforms = transforms.map((t) => {
    if ('increment' in t) {
      return { fieldPath: t.fieldPath, increment: { integerValue: String(t.increment) } };
    }
    if ('appendToArray' in t) {
      return { fieldPath: t.fieldPath, appendMissingElements: { values: t.appendToArray.map(toFirestoreValue) } };
    }
    return { fieldPath: t.fieldPath, removeAllFromArray: { values: t.removeFromArray.map(toFirestoreValue) } };
  });
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({
      writes: [{ transform: { document: `projects/${PROJECT_ID}/databases/(default)/documents/${path}`, fieldTransforms } }],
    }),
  });
  if (!res.ok) throw new Error(`firestore transform failed: ${res.status}`);
}
