const test = require("node:test");
const assert = require("node:assert/strict");
const fixture = require("./fixtures/gov24Sample.json");
const H = require("../helpers/gov24Eligibility");

const NOW = new Date("2026-10-01T00:00:00.000Z");
const LEGACY_FIELDS = ["title", "category", "summary", "targetAge", "targetRegions", "targetEmployment", "benefits", "deadlineText", "endDate", "applyUrl", "checklist", "source"];

// ---------- 값 정규화 ----------
test("normalizeAudience: 사용자구분 원문을 individual/business/mixed/unknown으로 정규화하고 원문을 보존한다", () => {
  assert.deepEqual(H.normalizeAudience("개인"), { audienceType: "individual", audienceRaw: "개인" });
  assert.equal(H.normalizeAudience("가구").audienceType, "individual");
  assert.equal(H.normalizeAudience("개인||가구").audienceType, "individual");
  assert.equal(H.normalizeAudience("법인/시설/단체").audienceType, "business");
  assert.equal(H.normalizeAudience("소상공인").audienceType, "business");
  assert.equal(H.normalizeAudience("개인||법인/시설/단체").audienceType, "mixed");
  assert.equal(H.normalizeAudience("개인||소상공인||법인/시설/단체").audienceType, "mixed");
  assert.equal(H.normalizeAudience("").audienceType, "unknown");
  assert.equal(H.normalizeAudience(null).audienceType, "unknown");
});

test("normalizeYmd: 목록(14자리)·상세(YYYY-MM-DD) 형식을 기준일로 통일하고 해석 불가면 null", () => {
  assert.equal(H.normalizeYmd("20260803095440"), "2026-08-03");
  assert.equal(H.normalizeYmd("2026-08-03"), "2026-08-03");
  assert.equal(H.normalizeYmd("2026.8.3"), "2026-08-03");
  assert.equal(H.normalizeYmd(""), null);
  assert.equal(H.normalizeYmd(null), null);
  assert.equal(H.normalizeYmd("상시"), null);
  assert.equal(H.normalizeYmd("20261345"), null);
});

test("inferRegionName: 기존 함수가 틀리는 충남·경남·경기 광주시를 정확히 구분하고, 모르면 unknown(전국 폴백 금지)", () => {
  const r = (type, name) => H.inferRegionName({ "소관기관유형": type, "소관기관명": name }).regionName;
  assert.equal(r("중앙행정기관", "국토교통부"), "전국");
  assert.equal(r("공공기관", "한국장학재단"), "전국");
  assert.equal(r("시군구", "충청남도 천안시"), "충청남도");
  assert.equal(r("시군구", "충청북도 청주시"), "충청북도");
  assert.equal(r("시군구", "경상남도 창원시"), "경상남도");
  assert.equal(r("시군구", "경상북도 포항시"), "경상북도");
  assert.equal(r("시군구", "경기도 광주시"), "경기도");
  assert.equal(r("광역시도", "광주광역시"), "광주광역시");
  assert.equal(r("교육청", "서울특별시교육청"), "서울특별시");
  assert.equal(r("광역시도", "충남 천안"), "충청남도");
  assert.equal(r("지방공기업", "용산구시설관리공단"), "unknown");
  assert.equal(r("지방출자_출연기관", ""), "unknown");
  // 기존 함수의 오분류가 실제로 있었음을 함께 기록한다(수정 근거)
  assert.equal(H.legacyInferRegion({ "소관기관유형": "시군구", "소관기관명": "충청남도 천안시" }), "충청북도");
  assert.equal(H.legacyInferRegion({ "소관기관유형": "시군구", "소관기관명": "경기도 광주시" }), "광주광역시");
});

test("inferRegionName: 전남광주통합특별시·법인 표기·기관코드 복원", () => {
  const r = (type, name, code, map) => H.inferRegionName({ "소관기관유형": type, "소관기관명": name, "소관기관코드": code }, map);
  assert.equal(r("시군구", "전남광주통합특별시 광양시", "5000001").regionName, "전남광주통합특별시");
  assert.equal(r("교육청", "전남광주통합특별시교육청", "5000002").regionName, "전남광주통합특별시");
  assert.equal(r("지방출자_출연기관", "(재)전남광주통합특별시청소년미래재단", "5000003").regionName, "전남광주통합특별시");
  assert.equal(r("지방출자_출연기관", "재단법인충청북도문화재단", "4430000").regionName, "충청북도");
  assert.deepEqual(H.REGION_ALIASES["전남광주통합특별시"], ["광주광역시", "전라남도"]);
  // 이름에 시도가 없으면 unknown, 코드 대응표가 있으면 복원하고 방식을 기록한다
  assert.equal(r("지방공기업", "용산구시설관리공단", "3010000").regionName, "unknown");
  const withMap = r("지방공기업", "용산구시설관리공단", "3010000", { "301": "서울특별시" });
  assert.deepEqual(withMap, { regionName: "서울특별시", regionMethod: "orgCodePrefix" });
  assert.equal(H.stripLegalForm("(재)달성교육재단"), "달성교육재단");
});

test("buildOrgCodeRegionMap: 이름으로 확정된 행에서만 만들고, 두 시도에 걸친 접두어는 제외한다", () => {
  const rows = [
    { "소관기관유형": "시군구", "소관기관명": "서울특별시 종로구", "소관기관코드": "3000001" },
    { "소관기관유형": "시군구", "소관기관명": "서울특별시 중구", "소관기관코드": "3000002" },
    { "소관기관유형": "시군구", "소관기관명": "경기도 수원시", "소관기관코드": "4000001" },
    { "소관기관유형": "시군구", "소관기관명": "경상남도 창원시", "소관기관코드": "5000001" },
    { "소관기관유형": "시군구", "소관기관명": "경상북도 포항시", "소관기관코드": "5000009" },   // 같은 접두어 500에 서로 다른 시도 → 충돌
    { "소관기관유형": "지방공기업", "소관기관명": "용산구시설관리공단", "소관기관코드": "3000009" }, // 이름만으로는 미판정 → 대응표에 기여하지 않음
    { "소관기관유형": "중앙행정기관", "소관기관명": "국토교통부", "소관기관코드": "1000000" }
  ];
  const map = H.buildOrgCodeRegionMap(rows);
  assert.deepEqual(map, { "300": "서울특별시", "400": "경기도" });
});

test("scrubPersonalData: 이메일·전화번호·주민등록번호 형태를 제거한다", () => {
  const out = H.scrubPersonalData("문의 031-427-4415, 02-2100-6349, 1588-3249, test.user@example.com, 900101-1234567 입니다");
  assert.ok(!/@/.test(out) && !/\d{3,4}-\d{4}/.test(out) && !/900101/.test(out), out);
  assert.ok(out.includes("[이메일]") && out.includes("[전화번호]") && out.includes("[번호]"));
  assert.equal(H.scrubPersonalData("만 19세 이상 34세 이하"), "만 19세 이상 34세 이하");
});

test("assertStagingCollection: 보호 컬렉션과 규칙 밖 이름은 코드 수준에서 거부한다", () => {
  assert.equal(H.assertStagingCollection("supportProgramsStaging"), "supportProgramsStaging");
  assert.equal(H.assertStagingCollection("supportProgramsTest2"), "supportProgramsTest2");
  ["supportPrograms", "calendarEvents", "eventChangeLogs", "syncLogs", "users", "supportProgram", "supportProgramsStagingX/y"].forEach((name) => {
    assert.throws(() => H.assertStagingCollection(name), name);
  });
});

// ---------- 기존 필드 보존 ----------
test("buildLegacyFields: 실제 저장된 supportPrograms 문서와 기존 12개 필드가 동일하다(5개 실데이터)", () => {
  assert.ok(fixture.cases.length >= 5);
  fixture.cases.forEach((c) => {
    const legacy = H.buildLegacyFields(c.list, c.detail, c.conditions, "ok", NOW);
    LEGACY_FIELDS.forEach((f) => assert.deepEqual(legacy[f], c.storedLegacy[f], c.name + " / " + f));
  });
});

test("buildStagingDoc: eligibility를 붙여도 기존 필드 값은 한 글자도 바뀌지 않는다", () => {
  fixture.cases.forEach((c) => {
    const legacyOnly = H.buildLegacyFields(c.list, c.detail, c.conditions, "ok", NOW);
    const staged = H.buildStagingDoc(c.list, c.detail, c.conditions, { detail: "ok", conditions: "ok" }, NOW);
    const { eligibility, ...rest } = staged;
    assert.deepEqual(rest, legacyOnly, c.name);
    assert.ok(eligibility && typeof eligibility === "object");
  });
});

// ---------- eligibility 생성·검증 ----------
test("buildEligibility: 실데이터에서 스키마 필드·공식 URL·기준일이 정상 생성되고 검증 문제가 없다", () => {
  fixture.cases.forEach((c) => {
    const e = H.buildEligibility(c.list, c.detail, c.conditions, { detail: "ok", conditions: "ok" }, NOW);
    assert.deepEqual(H.validateEligibility(e), [], c.name);
    assert.equal(e.schemaVersion, 2);
    assert.ok(e.sourceUrl.startsWith("https://www.gov.kr/portal/rcvfvrSvc/dtlEx/" + c.list["서비스ID"]), e.sourceUrl);
    assert.match(e.sourceModifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(e.fetchedAt instanceof Date);
    assert.ok(e.conditionCodes.every((x) => /^JA\d{4}$/.test(x)) && !e.conditionCodes.includes("JA0110"));
  });
  const youthRent = fixture.cases.find((c) => c.name === "청년월세 지원");
  const e = H.buildEligibility(youthRent.list, youthRent.detail, youthRent.conditions, { detail: "ok", conditions: "ok" }, NOW);
  assert.deepEqual(e.ageRange, { min: 19, max: 34 });
  assert.equal(e.audienceType, "individual");
  assert.equal(e.regionName, "전국");
});

test("validateEligibility: 잘못된 값과 개인정보 형태를 걸러낸다", () => {
  const c = fixture.cases[0];
  const good = H.buildEligibility(c.list, c.detail, c.conditions, { detail: "ok", conditions: "ok" }, NOW);
  assert.deepEqual(H.validateEligibility(good), []);
  assert.ok(H.validateEligibility(Object.assign({}, good, { sourceUrl: "https://example.com/x" })).length > 0);
  assert.ok(H.validateEligibility(Object.assign({}, good, { targetText: "연락 a@b.co" })).length > 0);
  assert.ok(H.validateEligibility(Object.assign({}, good, { audienceType: "other" })).length > 0);
  assert.ok(H.validateEligibility(Object.assign({}, good, { conditionCodes: ["XX1"] })).length > 0);
});

test("조회 실패: 상세 실패는 목록 값으로 대체, 지원조건 실패는 연령·조건 필드를 '생략'한다(기본값으로 덮어쓰지 않음)", () => {
  const c = fixture.cases[0];
  const failedCond = H.buildStagingDoc(c.list, c.detail, null, { detail: "ok", conditions: "failed" }, NOW);
  assert.ok(!("targetAge" in failedCond), "targetAge는 생략되어야 한다");
  assert.ok(!("ageRange" in failedCond.eligibility) && !("conditionCodes" in failedCond.eligibility));
  assert.equal(failedCond.eligibility.fetchStatus.conditions, "failed");
  assert.deepEqual(H.validateEligibility(failedCond.eligibility), []);

  const failedDetail = H.buildStagingDoc(c.list, null, c.conditions, { detail: "failed", conditions: "ok" }, NOW);
  assert.ok(failedDetail.eligibility.selectionText.length > 0, "상세 실패여도 목록의 선정기준으로 채워진다");
  assert.ok(failedDetail.applyUrl.length > 0, "applyUrl은 기존처럼 목록 URL로 대체된다");
  assert.equal(failedDetail.eligibility.fetchStatus.detail, "failed");
  assert.deepEqual(failedDetail.targetAge, { min: 19, max: 34 });

  const emptyCond = H.buildStagingDoc(c.list, c.detail, null, { detail: "ok", conditions: "empty" }, NOW);
  assert.deepEqual(emptyCond.targetAge, { min: 0, max: 99 }, "조회는 성공했지만 행이 없으면 기존 동작(0~99)을 유지");
  assert.deepEqual(emptyCond.eligibility.ageRange, { min: null, max: null });
});

test("stripUndefined: undefined만 제거하고 null·Date·배열은 보존한다", () => {
  const d = new Date(0);
  const out = H.stripUndefined({ a: 1, b: undefined, c: null, d: d, e: [1, undefined, { f: undefined, g: 2 }], h: { i: undefined } });
  assert.deepEqual(Object.keys(out).sort(), ["a", "c", "d", "e", "h"]);
  assert.equal(out.d, d);
  assert.deepEqual(out.h, {});
});

// ---------- 페이지네이션 ----------
function makeRows(n, start) {
  return Array.from({ length: n }, (_, i) => ({ "서비스ID": "ID" + String((start || 0) + i).padStart(6, "0") }));
}
function pagedFetcher(rows, extra) {
  return async (page, perPage) => ({ data: rows.slice((page - 1) * perPage, page * perPage), totalCount: rows.length, matchCount: rows.length, page, perPage, ...(extra || {}) });
}

test("fetchAllListPages: 전체 건수에 도달하면 정확히 멈추고 중복·누락이 없다", async () => {
  const rows = makeRows(25);
  const r = await H.fetchAllListPages(pagedFetcher(rows), { perPage: 10 });
  assert.equal(r.rows.length, 25);
  assert.equal(r.stats.calls, 3);
  assert.equal(r.stats.complete, true);
  assert.equal(r.stats.duplicates, 0);
  assert.equal(new Set(r.rows.map((x) => x["서비스ID"])).size, 25);
});

test("fetchAllListPages: 같은 페이지를 계속 돌려줘도 무한 반복하지 않는다(no-new-rows)", async () => {
  const stuck = makeRows(10);
  let calls = 0;
  const r = await H.fetchAllListPages(async () => { calls += 1; return { data: stuck, totalCount: 500, matchCount: 500 }; }, { perPage: 10, maxPages: 30 });
  assert.equal(r.stats.stopReason, "no-new-rows");
  assert.ok(calls <= 2, "calls=" + calls);
  assert.equal(r.stats.complete, false);
  assert.equal(r.rows.length, 10);
  assert.equal(r.stats.duplicates, 10);
});

test("fetchAllListPages: 새 행이 끝없이 나와도 maxPages에서 멈춘다", async () => {
  let calls = 0;
  const r = await H.fetchAllListPages(async (page, perPage) => { calls += 1; return { data: makeRows(perPage, page * perPage), totalCount: 1e9, matchCount: 1e9 }; }, { perPage: 10, maxPages: 5 });
  assert.equal(calls, 5);
  assert.equal(r.stats.stopReason, "max-pages");
  assert.equal(r.stats.complete, false);
});

test("fetchAllListPages: 페이지 사이에 중복이 섞이면 세고 한 번만 담는다 / 형식이 틀리면 예외", async () => {
  const pages = [makeRows(10, 0), makeRows(10, 5), makeRows(5, 15)];
  const r = await H.fetchAllListPages(async (page) => ({ data: pages[page - 1] || [], totalCount: 20, matchCount: 20 }), { perPage: 10 });
  assert.equal(r.rows.length, 20);
  assert.equal(r.stats.duplicates, 5);
  assert.equal(r.stats.complete, true);
  await assert.rejects(() => H.fetchAllListPages(async () => ({ error: "x" }), { perPage: 10 }), /형식/);
});

// ---------- 샘플 선정 ----------
function syntheticList() {
  const rows = [];
  const mk = (id, name, extra) => rows.push(Object.assign({ "서비스ID": id, "서비스명": name, "서비스목적요약": name + " 지원", "지원대상": "만 19세 이상", "사용자구분": "개인", "소관기관유형": "중앙행정기관", "소관기관명": "기관", "소관기관코드": "1000000", "서비스분야": "생활안정", "수정일시": "20260801000000", "상세조회URL": "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/" + id }, extra));
  fixture.cases.forEach((c) => rows.push(c.list));
  mk("S100", "청년희망적금");
  mk("S101", "국민취업지원제도");
  mk("S102", "행복주택 공급");
  for (let i = 0; i < 70; i++) mk("T" + String(i).padStart(3, "0"), ["청년 일자리", "주거 월세", "장학금", "취업 훈련", "저축 지원"][i % 5] + " 사업" + i, { "소관기관유형": i % 3 === 0 ? "시군구" : "광역시도" });
  mk("B001", "소상공인 경영 지원", { "사용자구분": "소상공인" });
  mk("B002", "법인 지원", { "사용자구분": "법인/시설/단체" });
  mk("F001", "어업인 청년 정착 지원", { "서비스목적요약": "청년 어업인" });
  mk("U001", "분류 없는 사업", { "사용자구분": "" });
  return rows;
}

test("selectYouthSample: 20~50개로 보정, 대표 사업 포함, 사업자·1차산업 제외, 입력 순서와 무관하게 결정적", () => {
  const rows = syntheticList();
  const a = H.selectYouthSample(rows, { limit: 40 });
  const b = H.selectYouthSample(rows.slice().reverse(), { limit: 40 });
  assert.deepEqual(a.selected.map((r) => r["서비스ID"]), b.selected.map((r) => r["서비스ID"]));
  assert.equal(a.selected.length, 40);
  assert.equal(H.selectYouthSample(rows, { limit: 5 }).selected.length, 20);
  assert.equal(H.selectYouthSample(rows, { limit: 500 }).selected.length, 50);
  const names = a.selected.map((r) => r["서비스명"]);
  ["청년희망적금", "국민취업지원제도", "행복주택 공급", "청년월세 지원", "천원의 아침밥", "K-패스"].forEach((n) => assert.ok(names.includes(n), n));
  assert.ok(!a.selected.some((r) => ["B001", "B002", "F001", "U001"].includes(r["서비스ID"])));
  assert.equal(new Set(a.selected.map((r) => r["서비스ID"])).size, a.selected.length);
  assert.ok(a.meta.seedsMissing.includes("국민내일배움카드"));
});

// ---------- 실행(dry-run / write) ----------
function fakeApi(rows, hooks) {
  const calls = { list: 0, detail: 0, conditions: 0 };
  const byId = new Map(rows.map((r) => [r["서비스ID"], r]));
  const fix = new Map(fixture.cases.map((c) => [c.list["서비스ID"], c]));
  return {
    calls,
    list: async (page, perPage) => { calls.list += 1; return pagedFetcher(rows)(page, perPage); },
    detail: async (id) => { calls.detail += 1; if (hooks && hooks.detail) hooks.detail(id); const c = fix.get(id); return c ? c.detail : { "수정일시": "2026-08-01", "선정기준": (byId.get(id) || {})["지원대상"] }; },
    conditions: async (id) => { calls.conditions += 1; if (hooks && hooks.conditions) hooks.conditions(id); const c = fix.get(id); return c ? c.conditions : { JA0110: 19, JA0111: 39, JA0102: "Y" }; }
  };
}
function mergeInto(target, patch) {
  const out = Object.assign({}, target);
  Object.keys(patch).forEach((k) => {
    const v = patch[k];
    if (v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) && !(out[k] instanceof Date)) out[k] = mergeInto(out[k], v);
    else out[k] = v;
  });
  return out;
}
// Firestore set(..., {merge:true}) 의미를 흉내 내는 가짜 DB — 스테이징 이외 컬렉션에 접근하면 예외
function fakeDb(initial) {
  const store = new Map(Object.entries(initial || {}));
  const touched = new Set();
  return {
    store, touched,
    collection(name) {
      touched.add(name);
      if (name !== "supportProgramsStaging") throw new Error("금지된 컬렉션 접근: " + name);
      return { doc: (id) => ({ __key: name + "/" + id }) };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data, opts) { ops.push({ key: ref.__key, data, merge: !!(opts && opts.merge) }); },
        async commit() { ops.forEach((o) => store.set(o.key, o.merge && store.has(o.key) ? mergeInto(store.get(o.key), o.data) : o.data)); }
      };
    }
  };
}
const throwingDb = { collection() { throw new Error("dry-run에서 DB에 접근했다"); }, batch() { throw new Error("dry-run에서 DB에 접근했다"); } };

test("runStagingSync(dry-run): DB를 전혀 건드리지 않고 문서를 만든다 / 호출 수가 집계된다", async () => {
  const rows = syntheticList();
  const api = fakeApi(rows);
  const out = await H.runStagingSync({ api, db: throwingDb, write: false, limit: 30, now: NOW, perPage: 20 });
  assert.equal(out.summary.mode, "dry-run");
  assert.equal(out.summary.written, 0);
  assert.equal(out.summary.selected, 30);
  assert.equal(out.summary.duplicateIds, 0);
  assert.equal(out.summary.apiCalls.detail, 30);
  assert.equal(out.summary.apiCalls.conditions, 30);
  assert.equal(out.summary.apiCalls.list, out.summary.listStats.calls);
  assert.equal(out.summary.apiCalls.total, api.calls.list + api.calls.detail + api.calls.conditions);
  assert.ok(out.docs.every((d) => H.validateEligibility(d.doc.eligibility).length === 0));
  assert.ok(out.docs.every((d) => d.doc.eligibility.sourceUrl.startsWith("https://www.gov.kr/")));
});

test("runStagingSync: 이름에 시도가 없는 기관은 목록 전체로 만든 기관코드 대응표로 지역이 복원된다", async () => {
  const rows = syntheticList();
  rows.push({ "서비스ID": "R001", "서비스명": "청년 지역 월세 지원", "서비스목적요약": "청년 월세 지원", "지원대상": "청년", "사용자구분": "개인", "소관기관유형": "시군구", "소관기관명": "서울특별시 종로구", "소관기관코드": "3010000", "서비스분야": "주거·자립", "수정일시": "20260801000000", "상세조회URL": "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/R001" });
  rows.push({ "서비스ID": "R002", "서비스명": "청년 구민 월세 지원", "서비스목적요약": "청년 월세 지원", "지원대상": "청년", "사용자구분": "개인", "소관기관유형": "지방공기업", "소관기관명": "종로구시설관리공단", "소관기관코드": "3010009", "서비스분야": "주거·자립", "수정일시": "20260801000000", "상세조회URL": "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/R002" });
  const out = await H.runStagingSync({ api: fakeApi(rows), write: false, limit: 50, now: NOW, perPage: 30, seeds: ["청년 지역 월세 지원", "청년 구민 월세 지원"] });
  const r2 = out.docs.find((d) => d.id === "R002");
  assert.ok(r2, "시드로 지정한 사업이 선정되어야 한다");
  assert.equal(r2.doc.eligibility.regionName, "서울특별시");
  assert.equal(r2.doc.targetRegions[0], "전국", "기존 필드(targetRegions)는 기존 로직 그대로 유지된다");
});

test("runStagingSync: 보호 컬렉션 이름이면 실행 자체를 거부한다", async () => {
  const api = fakeApi(syntheticList());
  for (const name of ["supportPrograms", "calendarEvents"]) {
    await assert.rejects(() => H.runStagingSync({ api, db: fakeDb(), write: true, collectionName: name, limit: 20, now: NOW }), /보호된|규칙/);
  }
  assert.equal(api.calls.list, 0, "거부는 API 호출 전에 일어나야 한다");
});

test("runStagingSync(write): 스테이징 컬렉션에만 쓰고 supportPrograms·calendarEvents는 접근하지 않는다", async () => {
  const db = fakeDb();
  const out = await H.runStagingSync({ api: fakeApi(syntheticList()), db, write: true, limit: 25, now: NOW, perPage: 20 });
  assert.equal(out.summary.written, 25);
  assert.deepEqual([...db.touched], ["supportProgramsStaging"]);
  assert.equal(db.store.size, 25);
  assert.ok([...db.store.keys()].every((k) => k.startsWith("supportProgramsStaging/")));
});

test("runStagingSync: 일부 조회가 실패해도 이미 저장된 원본 데이터를 빈 값으로 덮어쓰지 않는다", async () => {
  const rows = syntheticList();
  const sample = rows.find((r) => r["서비스명"] === "청년월세 지원");
  const id = sample["서비스ID"];
  const secret = "SECRET-KEY-123";
  // 1차: 정상 수집
  const db = fakeDb();
  await H.runStagingSync({ api: fakeApi(rows), db, write: true, limit: 25, now: NOW, perPage: 20 });
  const key = "supportProgramsStaging/" + id;
  const before = db.store.get(key);
  assert.deepEqual(before.targetAge, { min: 19, max: 34 });
  assert.deepEqual(before.eligibility.ageRange, { min: 19, max: 34 });
  assert.ok(before.eligibility.conditionCodes.length > 0);

  // 2차: 같은 사업의 지원조건 조회가 실패(오류 메시지에 키가 섞여 있어도 로그에 남지 않아야 함)
  const failing = fakeApi(rows, { conditions: (x) => { if (x === id) throw new Error("fetch failed serviceKey=" + secret); } });
  const later = new Date("2026-10-02T00:00:00.000Z");
  const out = await H.runStagingSync({ api: failing, db, write: true, limit: 25, now: later, perPage: 20, secrets: [secret] });
  const after = db.store.get(key);
  assert.deepEqual(after.targetAge, { min: 19, max: 34 }, "연령이 0~99로 덮어써지면 안 된다");
  assert.deepEqual(after.eligibility.ageRange, { min: 19, max: 34 });
  assert.deepEqual(after.eligibility.conditionCodes, before.eligibility.conditionCodes);
  assert.equal(after.eligibility.fetchStatus.conditions, "failed", "실패 사실은 기록된다");
  assert.deepEqual(after.eligibility.fetchedAt, later);
  assert.equal(out.summary.errors.length, 1);
  assert.ok(!JSON.stringify(out.summary).includes(secret), "오류 로그에 API 키가 남으면 안 된다");
  assert.ok(JSON.stringify(out.summary.errors).includes("***"));
});

test("runStagingSync: 상세 조회가 실패해도 다른 사업은 정상 처리되고 목록 값으로 대체된다", async () => {
  const rows = syntheticList();
  const failId = rows.find((r) => r["서비스명"] === "천원의 아침밥")["서비스ID"];
  const out = await H.runStagingSync({ api: fakeApi(rows, { detail: (x) => { if (x === failId) throw new Error("timeout"); } }), write: false, limit: 25, now: NOW, perPage: 20 });
  const bad = out.docs.find((d) => d.id === failId).doc;
  assert.equal(bad.eligibility.fetchStatus.detail, "failed");
  assert.ok(bad.eligibility.selectionText.length > 0);
  assert.equal(out.docs.filter((d) => d.doc.eligibility.fetchStatus.detail === "ok").length, out.docs.length - 1);
  assert.equal(out.summary.errors.length, 1);
});
