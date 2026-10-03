// 정부지원금(supportPrograms) 목록 조회 — 필터 + cursor 페이지네이션.
// 컬렉션 전체를 읽지 않고, 항상 limit이 걸린 Firestore runQuery(REST)만 보낸다.
// supportPrograms는 공개 읽기(firestore.rules: allow read: if true)라 별도 자격 증명이 필요 없다.
// 이 파일은 "읽기 전용"이다 — 어떤 경로에서도 쓰기·삭제 요청을 보내지 않는다.

export const PROJECT_ID = "asset-filot";
export const COLLECTION = "supportPrograms";           // 고정. 요청 값으로 컬렉션 이름을 바꿀 수 없다(supportProgramsStaging 등 노출 차단).
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 50;

// index.html의 SUPPORT_CATEGORY_META 키 / 지역 <select> 옵션과 같은 값만 허용한다.
export const CATEGORIES = ["보육·교육", "주거·자립", "농림축산어업", "행정·안전", "문화·환경", "보건·의료", "고용·창업", "생활안정"];
export const REGIONS = [
  "서울특별시", "경기도", "인천광역시", "부산광역시", "대구광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도", "전남광주통합특별시"
];
// 광주·전남은 2026년부터 통합특별시로 올라올 수 있어 서로를 함께 조회한다(array-contains-any 값 개수 제한 30 이내).
const REGION_ALIASES = {
  "전남광주통합특별시": ["광주광역시", "전라남도"],
  "광주광역시": ["전남광주통합특별시"],
  "전라남도": ["전남광주통합특별시"]
};
const SORTS = ["deadline", "latest"];
const STATUSES = ["all", "open"];

// 목록 응답에 포함하는 필드(허용 목록). source 등 나머지는 내려보내지 않는다.
// checklist/benefits는 적합도 판정(js/subsidy-match.js)과 상세 보기에 쓰이므로 유지한다.
export const LIST_FIELDS = ["title", "category", "summary", "targetAge", "targetRegions", "targetEmployment", "benefits", "deadlineText", "endDate", "applyUrl", "checklist", "updatedAt"];

const DOC_ID = /^[A-Za-z0-9_-]{1,64}$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?Z$/;

// ---------- 요청 파라미터 ----------
// 잘못된 값은 무시하지 않고 400으로 돌려보낸다(필터가 조용히 빠져 넓은 조회가 되는 일을 막는다).
export const MAX_IDS = 50;
export function parseParams(query) {
  const q = query || {};
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  // ids 모드: 정해진 문서 ID 목록만 조회(다른 필터·cursor와 함께 쓰지 않는다)
  const rawIds = one(q.ids);
  if (rawIds !== undefined && rawIds !== "") {
    const list = String(rawIds).split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.length || list.length > MAX_IDS || list.some((id) => !DOC_ID.test(id))) return { error: "invalid_ids" };
    if (q.cursor) return { error: "invalid_ids" };
    return { params: { ids: list.filter((v, i) => list.indexOf(v) === i), limit: MAX_IDS } };
  }
  const out = { limit: DEFAULT_LIMIT, category: "", region: "", sort: "deadline", status: "all", cursor: "" };

  const rawLimit = one(q.limit);
  if (rawLimit !== undefined && rawLimit !== "") {
    const n = Number(rawLimit);
    if (!Number.isFinite(n) || n < 1) return { error: "invalid_limit" };
    out.limit = Math.min(MAX_LIMIT, Math.floor(n));              // 상한은 서버에서 강제
  }
  const category = one(q.category);
  if (category !== undefined && category !== "") {
    if (CATEGORIES.indexOf(String(category)) === -1) return { error: "invalid_category" };
    out.category = String(category);
  }
  const region = one(q.region);
  if (region !== undefined && region !== "") {
    if (REGIONS.indexOf(String(region)) === -1) return { error: "invalid_region" };
    out.region = String(region);
  }
  const sort = one(q.sort);
  if (sort !== undefined && sort !== "") {
    if (SORTS.indexOf(String(sort)) === -1) return { error: "invalid_sort" };
    out.sort = String(sort);
  }
  const status = one(q.status);
  if (status !== undefined && status !== "") {
    if (STATUSES.indexOf(String(status)) === -1) return { error: "invalid_status" };
    out.status = String(status);
  }
  const cursor = one(q.cursor);
  if (cursor !== undefined && cursor !== "") {
    if (typeof cursor !== "string" || cursor.length > 400) return { error: "invalid_cursor" };
    out.cursor = cursor;
  }
  return { params: out };
}

// ---------- cursor ----------
// 불투명 문자열: base64url(JSON). 필터·정렬이 바뀐 요청에 재사용하면 거부한다.
export function filterKey(p, degraded) {
  return [p.sort, p.status, p.category, p.region, degraded ? "d" : "n"].join("|");
}
export function encodeCursor(c) {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}
export function decodeCursor(text, expectedKeys) {
  let c;
  try { c = JSON.parse(Buffer.from(String(text), "base64url").toString("utf8")); } catch (e) { return null; }
  if (!c || typeof c !== "object" || c.v !== 1) return null;
  if (expectedKeys.indexOf(c.k) === -1) return null;
  if (["dated", "indefinite", "past", "latest", "name"].indexOf(c.g) === -1) return null;
  if (typeof c.i !== "string" || !DOC_ID.test(c.i)) return null;
  if (c.g === "dated" || c.g === "past") { if (typeof c.e !== "string" || !YMD.test(c.e)) return null; }
  if (c.g === "latest") { if (typeof c.u !== "string" || !ISO_TS.test(c.u)) return null; }
  return c;
}

// 한국 날짜(YYYY-MM-DD) — endDate는 한국 날짜 문자열이다.
export function kstToday(now) {
  const d = new Date((now ? now.getTime() : Date.now()) + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

// ---------- Firestore 쿼리 ----------
const docRef = (id) => "projects/" + PROJECT_ID + "/databases/(default)/documents/" + COLLECTION + "/" + id;
const str = (s) => ({ stringValue: s });

function regionValues(region) {
  const list = [region, "전국"].concat(REGION_ALIASES[region] || []);
  return list.filter((v, i) => list.indexOf(v) === i);
}
function field(path, op, value) { return { fieldFilter: { field: { fieldPath: path }, op: op, value: value } }; }

// 세그먼트(마감 정렬): 기존 화면 정렬과 같다 — 마감일 있는 진행중(임박순) → 상시·문의(endDate=null, 문서ID순) → 마감 지남.
//  latest: updatedAt 내림차순. name: 인덱스가 없을 때의 안전 대체(문서ID순).
export function buildStructuredQuery(p, segment, today, limit, cursor) {
  const filters = [];
  if (p.category) filters.push(field("category", "EQUAL", str(p.category)));
  if (p.region) filters.push(field("targetRegions", "ARRAY_CONTAINS_ANY", { arrayValue: { values: regionValues(p.region).map(str) } }));
  let orderBy = [];
  let startValues = null;
  if (segment === "dated") {
    filters.push(field("endDate", "GREATER_THAN_OR_EQUAL", str(today)));
    orderBy = [{ field: { fieldPath: "endDate" }, direction: "ASCENDING" }, { field: { fieldPath: "__name__" }, direction: "ASCENDING" }];
    if (cursor) startValues = [str(cursor.e), { referenceValue: docRef(cursor.i) }];
  } else if (segment === "past") {
    filters.push(field("endDate", "LESS_THAN", str(today)));
    orderBy = [{ field: { fieldPath: "endDate" }, direction: "ASCENDING" }, { field: { fieldPath: "__name__" }, direction: "ASCENDING" }];
    if (cursor) startValues = [str(cursor.e), { referenceValue: docRef(cursor.i) }];
  } else if (segment === "indefinite") {
    filters.push({ unaryFilter: { op: "IS_NULL", field: { fieldPath: "endDate" } } });   // REST에서 null 비교는 unaryFilter로만 정확히 동작한다
    orderBy = [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }];
    if (cursor) startValues = [{ referenceValue: docRef(cursor.i) }];
  } else if (segment === "latest") {
    orderBy = [{ field: { fieldPath: "updatedAt" }, direction: "DESCENDING" }, { field: { fieldPath: "__name__" }, direction: "DESCENDING" }];
    if (cursor) startValues = [{ timestampValue: cursor.u }, { referenceValue: docRef(cursor.i) }];
  } else {                                                   // "name"
    orderBy = [{ field: { fieldPath: "__name__" }, direction: "ASCENDING" }];
    if (cursor) startValues = [{ referenceValue: docRef(cursor.i) }];
  }
  const q = {
    from: [{ collectionId: COLLECTION }],                    // 컬렉션 이름 고정
    select: { fields: LIST_FIELDS.map((f) => ({ fieldPath: f })) },
    orderBy: orderBy,
    limit: limit
  };
  if (filters.length === 1) q.where = filters[0];
  else if (filters.length > 1) q.where = { compositeFilter: { op: "AND", filters: filters } };
  if (startValues) q.startAt = { values: startValues, before: false };   // before:false = startAfter
  return q;
}

// Firestore REST 값 → JSON
export function parseValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(parseValue);
  if ("mapValue" in v) {
    const out = {};
    const fields = v.mapValue.fields || {};
    Object.keys(fields).forEach((k) => { out[k] = parseValue(fields[k]); });
    return out;
  }
  return null;
}
function docToItem(doc) {
  const item = { id: String(doc.name).split("/").pop() };
  const fields = doc.fields || {};
  LIST_FIELDS.forEach((f) => { if (f in fields) item[f] = parseValue(fields[f]); });   // 허용 필드만
  return item;
}

class IndexMissing extends Error {}

async function runQuery(structuredQuery, deps) {
  const base = deps.baseUrl || "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs || 8000);
  try {
    const res = await deps.fetchImpl(base + ":runQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ structuredQuery: structuredQuery }),
      signal: controller.signal
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const status = json && (json.error ? json.error.status : (Array.isArray(json) && json[0] && json[0].error && json[0].error.status));
      if (status === "FAILED_PRECONDITION") throw new IndexMissing("index");
      const err = new Error("firestore_" + res.status);
      err.code = "upstream";
      throw err;
    }
    if (!Array.isArray(json)) { const err = new Error("bad_response"); err.code = "upstream"; throw err; }
    return json.filter((r) => r && r.document).map((r) => r.document);
  } finally {
    clearTimeout(timer);
  }
}

// ID 목록 조회(batchGet). 없는 문서는 건너뛴다. 반환 형식은 목록 조회와 같다(nextCursor 없음).
export async function getSupportProgramsByIds(ids, deps) {
  deps = Object.assign({ fetchImpl: globalThis.fetch }, deps || {});
  const base = deps.baseUrl || "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs || 8000);
  try {
    const res = await deps.fetchImpl(base + ":batchGet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documents: ids.map(docRef), mask: { fieldPaths: LIST_FIELDS } }),
      signal: controller.signal
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(json)) return { error: "upstream_error", status: 502 };
    const byId = {};
    json.forEach((r) => { if (r && r.found) { const it = docToItem(r.found); byId[it.id] = it; } });
    const items = ids.filter((id) => byId[id]).map((id) => byId[id]);
    return { items: items, nextCursor: null, hasMore: false, degraded: false, stats: { queries: 1, reads: Math.max(1, ids.length) } };
  } catch (e) {
    return { error: "upstream_error", status: 502 };
  } finally {
    clearTimeout(timer);
  }
}

// 한 페이지 조회. 세그먼트를 순서대로 이어 붙여 limit까지 채운다(읽는 문서 = 반환 문서, 여분 조회 없음).
// 반환: { items, nextCursor, hasMore, degraded, stats:{queries, reads} } | { error, status }
export async function listSupportPrograms(params, deps) {
  deps = Object.assign({ fetchImpl: globalThis.fetch, now: new Date() }, deps || {});
  const p = params;
  const today = kstToday(deps.now);
  const stats = { queries: 0, reads: 0 };

  const normalSegments = p.sort === "latest" ? ["latest"] : (p.status === "open" ? ["dated", "indefinite"] : ["dated", "indefinite", "past"]);
  const attempt = async (degraded) => {
    const segments = degraded ? ["name"] : normalSegments;
    const key = filterKey(p, degraded);
    let cursor = null;
    let segIndex = 0;
    if (p.cursor) {
      cursor = decodeCursor(p.cursor, [key]);
      if (!cursor) return { error: "invalid_cursor", status: 400 };
      segIndex = segments.indexOf(cursor.g);
      if (segIndex === -1) return { error: "invalid_cursor", status: 400 };
    }
    const items = [];
    let lastItem = null;
    let lastSeg = segments[segIndex];
    for (let s = segIndex; s < segments.length && items.length < p.limit; s++) {
      const seg = segments[s];
      const remaining = p.limit - items.length;
      const docs = await runQuery(buildStructuredQuery(p, seg, today, remaining, s === segIndex ? cursor : null), deps);
      stats.queries += 1;
      stats.reads += Math.max(1, docs.length);                // 빈 결과도 최소 1회 읽기로 계산
      docs.forEach((d) => { const it = docToItem(d); items.push(it); lastItem = it; lastSeg = seg; });
    }
    const full = items.length >= p.limit;
    let nextCursor = null;
    if (full && lastItem) {
      const c = { v: 1, k: key, g: lastSeg, i: lastItem.id };
      if (lastSeg === "dated" || lastSeg === "past") c.e = lastItem.endDate;
      if (lastSeg === "latest") c.u = lastItem.updatedAt;
      nextCursor = encodeCursor(c);
    }
    return { items: items, nextCursor: nextCursor, hasMore: !!nextCursor, degraded: !!degraded };
  };

  try {
    // 인덱스 부족으로 문서ID순(degraded)으로 시작한 목록의 다음 페이지는 같은 방식으로 이어간다.
    if (p.cursor && decodeCursor(p.cursor, [filterKey(p, true)])) {
      const r = await attempt(true);
      if (r.error) return r;
      return Object.assign(r, { stats: stats });
    }
    const r = await attempt(false);
    if (r.error) return r;
    return Object.assign(r, { stats: stats });
  } catch (e) {
    if (!(e instanceof IndexMissing)) return { error: "upstream_error", status: 502 };
    // 필요한 복합 인덱스가 아직 없으면 문서ID순(단일 필드 인덱스만 필요)으로 안전하게 대체한다 — 정렬은 페이지 안에서만 유지된다.
    if (p.cursor) {
      const c0 = decodeCursor(p.cursor, [filterKey(p, false)]);
      if (c0) return { error: "index_unavailable", status: 503 };
    }
    try {
      const r = await attempt(true);
      if (r.error) return r;
      return Object.assign(r, { stats: stats });
    } catch (e2) {
      return { error: e2 instanceof IndexMissing ? "index_unavailable" : "upstream_error", status: e2 instanceof IndexMissing ? 503 : 502 };
    }
  }
}
