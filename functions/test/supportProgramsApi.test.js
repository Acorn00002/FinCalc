"use strict";
// /api/support-programs 조회 로직 테스트 — 네트워크·Firestore 없이, 질의 모양을 해석하는 작은 가짜 Firestore로 검증한다.
// (api/_lib/supportPrograms.js는 ESM이라 동적 import로 불러온다.)
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { pathToFileURL } = require("url");

let lib;
test.before(async () => {
  lib = await import(pathToFileURL(path.join(__dirname, "..", "..", "api", "_lib", "supportPrograms.js")).href);
});

const TODAY_NOW = new Date("2026-10-01T03:00:00Z");   // KST 2026-10-01
const TODAY = "2026-10-01";
const CATS = ["보육·교육", "주거·자립", "농림축산어업", "행정·안전", "문화·환경", "보건·의료", "고용·창업", "생활안정"];
const PROV = ["서울특별시", "경기도", "부산광역시", "광주광역시", "전라남도"];

// ---------- 가짜 Firestore ----------
function sv(v) { return v === null ? { nullValue: null } : typeof v === "string" ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(sv) } } : typeof v === "number" ? { integerValue: String(v) } : v && v.__ts ? { timestampValue: v.__ts } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sv(x)])) } }; }
function toDoc(d) { return { name: "projects/asset-filot/databases/(default)/documents/supportPrograms/" + d.id, fields: Object.fromEntries(Object.entries(d.data).map(([k, v]) => [k, sv(v)])) }; }
const val = (v) => ("stringValue" in v ? v.stringValue : "timestampValue" in v ? v.timestampValue : "referenceValue" in v ? v.referenceValue.split("/").pop() : "nullValue" in v ? null : null);

function makeDocs(n, seed) {
  let s = seed || 7; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const addDays = (k) => new Date(Date.parse(TODAY + "T00:00:00Z") + k * 86400000).toISOString().slice(0, 10);
  const docs = [];
  for (let i = 0; i < n; i++) {
    const r = rnd();
    const endDate = r < 0.9 ? null : r < 0.95 ? addDays(1 + Math.floor(rnd() * 90)) : addDays(-1 - Math.floor(rnd() * 200));
    docs.push({ id: String(1000000 + i * 3), data: {
      title: "사업 " + i, category: CATS[Math.floor(rnd() * 8)], summary: "요약", targetAge: { min: 0, max: 99 },
      targetRegions: [rnd() < 0.6 ? "전국" : PROV[Math.floor(rnd() * PROV.length)]], targetEmployment: [], benefits: "혜택", deadlineText: endDate || "상시신청", endDate: endDate,
      applyUrl: "https://example.test/" + i, checklist: ["a"], source: "gov24", secretInternal: "do-not-leak", eligibility: { schemaVersion: 2 },
      updatedAt: { __ts: new Date(Date.parse("2026-09-01T00:00:00Z") + i * 1000).toISOString() }
    } });
  }
  return docs;
}

// structuredQuery를 해석해 결과를 돌려주는 가짜 fetch. 통계: 쿼리별 limit·반환 행 수·컬렉션
function fakeFirestore(docs, opts) {
  const log = [];
  const indexed = !(opts && opts.requireCompositeIndex);
  const fetchImpl = async (url, init) => {
    assert.ok(String(url).endsWith(":runQuery"), "runQuery 외 요청 금지");
    assert.equal(init.method, "POST");
    const q = JSON.parse(init.body).structuredQuery;
    const entry = { collection: q.from[0].collectionId, limit: q.limit, rows: 0, filters: [] };
    log.push(entry);
    const filters = !q.where ? [] : q.where.compositeFilter ? q.where.compositeFilter.filters : [q.where];
    const fieldNames = filters.map((f) => (f.fieldFilter || f.unaryFilter).field.fieldPath);
    entry.filters = fieldNames;
    const orderField = q.orderBy[0].field.fieldPath;
    const otherFieldFilter = filters.some((f) => f.fieldFilter && f.fieldFilter.field.fieldPath !== orderField);
    if (!indexed && orderField !== "__name__" && otherFieldFilter) {
      // 다른 필드의 필터 + 정렬 = 복합 인덱스 필요 (실제 Firestore 동작 모사; 같은 필드의 범위 필터+정렬은 단일 필드 인덱스로 충분)
      return { ok: false, status: 400, json: async () => ({ error: { code: 400, status: "FAILED_PRECONDITION", message: "The query requires an index." } }) };
    }
    let list = docs.slice();
    filters.forEach((f) => {
      if (f.unaryFilter) { list = list.filter((d) => d.data.endDate === null); return; }
      const { field, op, value } = f.fieldFilter; const name = field.fieldPath; const v = val(value);
      if (op === "EQUAL") list = list.filter((d) => d.data[name] === v);
      else if (op === "ARRAY_CONTAINS_ANY") { const vals = value.arrayValue.values.map(val); list = list.filter((d) => d.data[name].some((x) => vals.indexOf(x) !== -1)); }
      else if (op === "GREATER_THAN_OR_EQUAL") list = list.filter((d) => typeof d.data[name] === "string" && d.data[name] >= v);
      else if (op === "LESS_THAN") list = list.filter((d) => typeof d.data[name] === "string" && d.data[name] < v);
      else throw new Error("unsupported op " + op);
    });
    const key = (d, f) => (f === "__name__" ? d.id : f === "updatedAt" ? d.data.updatedAt.__ts : d.data[f]);
    list.sort((a, b) => { for (const o of q.orderBy) { const f = o.field.fieldPath; const x = key(a, f), y = key(b, f); if (x === y) continue; const c = x < y ? -1 : 1; return o.direction === "DESCENDING" ? -c : c; } return 0; });
    if (q.startAt) {
      const sv2 = q.startAt.values.map(val);
      list = list.filter((d) => { for (let i = 0; i < sv2.length; i++) { const o = q.orderBy[i]; const x = key(d, o.field.fieldPath); if (x === sv2[i]) continue; const c = x < sv2[i] ? -1 : 1; return (o.direction === "DESCENDING" ? -c : c) > 0; } return false; });   // startAfter
    }
    list = list.slice(0, q.limit);
    entry.rows = list.length;
    const rows = list.length ? list.map((d) => {
      const doc = toDoc(d);
      if (q.select) { const keep = q.select.fields.map((f) => f.fieldPath); doc.fields = Object.fromEntries(Object.entries(doc.fields).filter(([k]) => keep.indexOf(k) !== -1)); }
      return { document: doc };
    }) : [{ readTime: "x" }];
    return { ok: true, status: 200, json: async () => rows };
  };
  return { fetchImpl, log };
}

async function drain(docs, query, fsOpts, maxPages) {
  const fs = fakeFirestore(docs, fsOpts);
  const ids = []; let cursor = ""; let pages = 0; let degraded = false;
  do {
    const p = lib.parseParams(Object.assign({}, query, { cursor })).params;
    const r = await lib.listSupportPrograms(p, { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
    assert.ok(!r.error, "error " + r.error);
    degraded = degraded || r.degraded;
    r.items.forEach((i) => ids.push(i.id)); cursor = r.nextCursor || ""; pages++;
  } while (cursor && pages < (maxPages || 500));
  return { ids, pages, log: fs.log, degraded };
}
const dd = (e) => { if (!e) return { c: false, i: true, d: Infinity }; const d = Math.round((Date.parse(e + "T00:00:00Z") - Date.parse(TODAY + "T00:00:00Z")) / 86400000); return d < 0 ? { c: true, i: false, d } : { c: false, i: false, d }; };
const rk = (x) => (x.c ? 2 : x.i ? 1 : 0);
function reference(docs, q) {
  let list = docs.slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  if (q.category) list = list.filter((d) => d.data.category === q.category);
  if (q.region) { const set = [q.region, "전국"].concat(q.region === "광주광역시" ? ["전남광주통합특별시"] : []); list = list.filter((d) => d.data.targetRegions.some((x) => set.indexOf(x) !== -1)); }
  if (q.status === "open") list = list.filter((d) => !dd(d.data.endDate).c);
  if (q.sort === "latest") list.sort((a, b) => (a.data.updatedAt.__ts < b.data.updatedAt.__ts ? 1 : -1));
  else list.sort((a, b) => { const A = dd(a.data.endDate), B = dd(b.data.endDate); return rk(A) !== rk(B) ? rk(A) - rk(B) : A.d - B.d; });
  return list.map((d) => d.id);
}

// ---------- 테스트 ----------
test("파라미터: 기본값·상한(50)·잘못된 값은 400 사유로 거부", () => {
  assert.deepEqual(lib.parseParams({}).params, { limit: 50, category: "", region: "", sort: "deadline", status: "all", cursor: "" });
  assert.equal(lib.parseParams({ limit: "9999" }).params.limit, 50);        // 서버에서 상한 강제
  assert.equal(lib.parseParams({ limit: "10" }).params.limit, 10);
  assert.equal(lib.parseParams({ limit: "10.9" }).params.limit, 10);
  ["0", "-5", "abc", "NaN"].forEach((v) => assert.equal(lib.parseParams({ limit: v }).error, "invalid_limit", v));
  assert.equal(lib.parseParams({ category: "임의" }).error, "invalid_category");
  assert.equal(lib.parseParams({ region: "달나라" }).error, "invalid_region");
  assert.equal(lib.parseParams({ sort: "price" }).error, "invalid_sort");
  assert.equal(lib.parseParams({ status: "deleted" }).error, "invalid_status");
  assert.equal(lib.parseParams({ cursor: "x".repeat(401) }).error, "invalid_cursor");
  assert.equal(lib.parseParams({ category: "고용·창업", region: "서울특별시", sort: "latest", status: "open" }).params.category, "고용·창업");
  assert.equal(lib.parseParams({ limit: ["20", "30"] }).params.limit, 20);    // 배열 파라미터도 안전하게 처리
});

test("쿼리: 컬렉션 고정·항상 limit·select 허용 필드만, 요청 값으로 컬렉션을 바꿀 수 없다", () => {
  const p = lib.parseParams({ category: "고용·창업", region: "광주광역시" }).params;
  ["dated", "indefinite", "past", "latest", "name"].forEach((seg) => {
    const q = lib.buildStructuredQuery(p, seg, TODAY, 50, null);
    assert.equal(q.from[0].collectionId, "supportPrograms");
    assert.equal(q.limit, 50);
    assert.deepEqual(q.select.fields.map((f) => f.fieldPath), lib.LIST_FIELDS);
    assert.ok(q.where, "필터가 있어야 한다");
  });
  const q = lib.buildStructuredQuery(p, "dated", TODAY, 50, null);
  const region = q.where.compositeFilter.filters.find((f) => f.fieldFilter && f.fieldFilter.field.fieldPath === "targetRegions").fieldFilter;
  assert.equal(region.op, "ARRAY_CONTAINS_ANY");
  assert.deepEqual(region.value.arrayValue.values.map((v) => v.stringValue).sort(), ["광주광역시", "전국", "전남광주통합특별시"].sort());   // 통합특별시 별칭 포함
  assert.equal(JSON.stringify(q).includes("supportProgramsStaging"), false);
});

test("cursor: 변조·다른 조건에 재사용·형식 오류는 거부된다", async () => {
  const docs = makeDocs(300);
  const fs = fakeFirestore(docs);
  const p1 = lib.parseParams({ category: "고용·창업", limit: "10" }).params;
  const r1 = await lib.listSupportPrograms(p1, { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.ok(r1.nextCursor);
  // 같은 조건 → 통과
  const ok = await lib.listSupportPrograms(Object.assign({}, p1, { cursor: r1.nextCursor }), { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.ok(!ok.error);
  // 다른 카테고리·정렬에 재사용 → invalid_cursor
  const other = await lib.listSupportPrograms(Object.assign({}, lib.parseParams({ category: "생활안정" }).params, { cursor: r1.nextCursor }), { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.equal(other.error, "invalid_cursor");
  const otherSort = await lib.listSupportPrograms(Object.assign({}, lib.parseParams({ category: "고용·창업", sort: "latest" }).params, { cursor: r1.nextCursor }), { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.equal(otherSort.error, "invalid_cursor");
  // 임의 문자열·경로 주입·잘못된 JSON
  for (const bad of ["zzz", lib.encodeCursor({ v: 1, k: lib.filterKey(p1, false), g: "indefinite", i: "../users/abc" }), lib.encodeCursor({ v: 2 }), lib.encodeCursor({ v: 1, k: lib.filterKey(p1, false), g: "evil", i: "1" })]) {
    const r = await lib.listSupportPrograms(Object.assign({}, p1, { cursor: bad }), { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
    assert.equal(r.error, "invalid_cursor");
    assert.equal(r.status, 400);
  }
});

test("응답 필드: 허용 목록 밖의 필드(source·eligibility·내부 필드)는 내려보내지 않는다", async () => {
  const docs = makeDocs(60);
  const fs = fakeFirestore(docs);
  const r = await lib.listSupportPrograms(lib.parseParams({ limit: "5" }).params, { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.equal(r.items.length, 5);
  r.items.forEach((it) => {
    const keys = Object.keys(it);
    assert.ok(keys.every((k) => k === "id" || lib.LIST_FIELDS.indexOf(k) !== -1), "허용 밖 필드: " + keys.join(","));
    assert.equal("secretInternal" in it, false);
    assert.equal("eligibility" in it, false);
    assert.equal("source" in it, false);
  });
  assert.equal(typeof r.items[0].updatedAt, "string");                            // 타임스탬프는 ISO 문자열
});

test("308건: 필터 없이 전부 이어 읽어도 중복 없이 기존(전체 읽기+클라이언트 정렬) 순서와 같다", async () => {
  const docs = makeDocs(308);
  for (const q of [{ sort: "deadline" }, { sort: "latest" }, { status: "open" }]) {
    const out = await drain(docs, q);
    const ref = reference(docs, Object.assign({ sort: "deadline" }, q));
    assert.equal(new Set(out.ids).size, out.ids.length, "중복");
    assert.deepEqual(out.ids, ref, JSON.stringify(q));
    out.log.forEach((e) => { assert.equal(e.collection, "supportPrograms"); assert.ok(e.limit <= 50 && e.limit >= 1); assert.ok(e.rows <= e.limit); });
  }
});

test("10,000건: 첫 요청은 50건만 읽고, 이후 페이지도 limit을 넘겨 읽지 않으며, 전체 조회 질의가 없다", async () => {
  const docs = makeDocs(10000, 99);
  const fs = fakeFirestore(docs);
  const first = await lib.listSupportPrograms(lib.parseParams({}).params, { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.equal(first.items.length, 50);
  assert.equal(first.stats.reads, 50);
  assert.ok(first.stats.queries <= 3);
  assert.equal(fs.log.every((e) => typeof e.limit === "number" && e.limit <= 50), true);
  // 다음 페이지 1회당 읽기 ≤ 50
  const second = await lib.listSupportPrograms(Object.assign({}, lib.parseParams({}).params, { cursor: first.nextCursor }), { fetchImpl: fs.fetchImpl, now: TODAY_NOW });
  assert.ok(second.stats.reads <= 50);
  assert.equal(new Set(first.items.concat(second.items).map((i) => i.id)).size, 100);
  // 조건을 주면 필요한 결과만: 카테고리+지역
  const filtered = await drain(docs, { category: "주거·자립", region: "경기도" });
  assert.deepEqual(filtered.ids, reference(docs, { sort: "deadline", category: "주거·자립", region: "경기도" }));
  assert.ok(filtered.ids.length < 10000 / 8);                                    // 8개 카테고리 × 지역 필터로 줄어든다
  // 전체를 읽는 질의(필터·limit 없는 질의)가 없다
  assert.equal(filtered.log.every((e) => e.limit <= 50 && e.collection === "supportPrograms"), true);
  // 한 사용자의 초기 접속(첫 요청 + 자동 이어읽기 최대 3페이지) 읽기 ≤ 200
  let cursor = ""; let reads = 0;
  for (let i = 0; i < 4; i++) { const r = await lib.listSupportPrograms(Object.assign({}, lib.parseParams({}).params, { cursor }), { fetchImpl: fs.fetchImpl, now: TODAY_NOW }); reads += r.stats.reads; cursor = r.nextCursor || ""; }
  assert.ok(reads <= 200);
});

test("복합 인덱스가 없으면 문서ID순으로 안전하게 대체하고, 그 cursor로 끝까지 이어 읽는다", async () => {
  const docs = makeDocs(400, 5);
  const out = await drain(docs, { category: "보건·의료" }, { requireCompositeIndex: true });
  assert.equal(out.degraded, true);
  const ref = docs.filter((d) => d.data.category === "보건·의료").map((d) => d.id).sort();
  assert.deepEqual(out.ids, ref);                                                // 정렬은 문서ID순, 누락·중복 없음
  out.log.filter((e) => e.rows >= 0).forEach((e) => assert.ok(e.limit <= 50));
  // 필터가 없으면 단일 필드 인덱스만으로 정상 동작(대체 없음)
  const plain = await drain(docs, {}, { requireCompositeIndex: true });
  assert.equal(plain.degraded, false);
  assert.deepEqual(plain.ids, reference(docs, { sort: "deadline" }));
  // 정상 모드 cursor를 가진 채 인덱스 오류가 나면 503(조용히 다른 순서로 바꾸지 않는다)
  const fsOk = fakeFirestore(docs);
  const p = lib.parseParams({}).params;
  const r1 = await lib.listSupportPrograms(p, { fetchImpl: fsOk.fetchImpl, now: TODAY_NOW });
  const failing = { fetchImpl: async () => ({ ok: false, status: 400, json: async () => ({ error: { status: "FAILED_PRECONDITION" } }) }) };
  const r2 = await lib.listSupportPrograms(Object.assign({}, p, { cursor: r1.nextCursor }), Object.assign({ now: TODAY_NOW }, failing));
  assert.equal(r2.error, "index_unavailable");
  assert.equal(r2.status, 503);
});

test("업스트림 오류·시간 초과는 502로 처리되고 내부 메시지를 노출하지 않는다", async () => {
  const p = lib.parseParams({}).params;
  const r = await lib.listSupportPrograms(p, { fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ error: { message: "secret-detail" } }) }), now: TODAY_NOW });
  assert.equal(r.error, "upstream_error");
  assert.equal(r.status, 502);
  assert.equal(JSON.stringify(r).includes("secret-detail"), false);
  const r2 = await lib.listSupportPrograms(p, { fetchImpl: async () => { throw new Error("network down"); }, now: TODAY_NOW });
  assert.equal(r2.error, "upstream_error");
});

test("읽기 전용: Firestore로 보내는 요청은 runQuery(POST) 한 종류뿐이다", async () => {
  const seen = new Set();
  const docs = makeDocs(80);
  const fs = fakeFirestore(docs);
  const spy = async (url, init) => { seen.add(init.method + " " + String(url).split(":").pop()); return fs.fetchImpl(url, init); };
  await lib.listSupportPrograms(lib.parseParams({ category: "생활안정" }).params, { fetchImpl: spy, now: TODAY_NOW });
  assert.deepEqual([...seen], ["POST runQuery"]);
});
