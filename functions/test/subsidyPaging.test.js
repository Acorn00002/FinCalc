"use strict";
// index.html의 정부지원금 로딩 로직(fetchSubsidyPage·상세 조건 전체 탐색·세션 캐시)을 vm으로 꺼내 모의 API로 검증한다. 네트워크·DB 없음.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const start = html.indexOf("  var SUPPORT_PROGRAMS = [];");
const end = html.indexOf("  var DEFAULT_SUBSIDY_FILTER");
const contStart = html.indexOf("  function subsidyContinueLoading");
const cont = html.slice(contStart, html.indexOf("  // js/subsidy-match.js를 불러오지 못했을 때만"));
assert.ok(start > 0 && end > start && contStart > 0 && cont.length > 50, "index.html 구조가 바뀌었어요");
const SRC = html.slice(start, end) + "\n" + cont;

const TOTAL = 308;
function makeEnv(opts) {
  opts = opts || {};
  const calls = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const ctx = {
    console: { error() {}, log() {} }, encodeURIComponent, Object, Array, Math, JSON, Number, String, Promise, setTimeout, URL,
    subsidySortMode: "deadline", subsidyActiveCategory: "all", subsidyShowMismatch: false,
    filter: { age: 26, region: "경기도", employment: "취준생" },
    extra: { special: null, household: "", childAges: [] },
    renders: 0,
    loadSubsidyFilter() { return ctx.filter; },
    loadSubsidyExtra() { return ctx.extra; },
    saveSubsidyFilter() {}, renderSubsidyFilterChips() {},
    renderSubsidyList() { ctx.renders++; ctx.subsidyContinueLoading(ctx.shown === undefined ? 20 : ctx.shown); },
    fetch(url) {
      const q = new URL(url, "http://x").searchParams;
      const offset = q.get("cursor") ? Number(q.get("cursor").replace("c", "")) : 0;
      const region = q.get("region") || "ALL";
      calls.push({ url, region, offset });
      const n = calls.length;
      return (async () => {
        if (opts.delay && opts.delay[region]) await sleep(opts.delay[region]);
        if (opts.failOn && opts.failOn(n)) return { ok: false, status: 500, json: async () => ({ error: "x" }) };
        const items = [];
        for (let i = offset; i < Math.min(offset + 50, TOTAL); i++) items.push({ id: region + "-" + i, title: "t" + i });
        if (opts.dupFirst && offset > 0) items.unshift({ id: region + "-" + (offset - 1), title: "dup" });
        const next = offset + 50 < TOTAL ? "c" + (offset + 50) : null;
        return { ok: true, status: 200, json: async () => ({ items, nextCursor: next }) };
      })();
    }
  };
  vm.createContext(ctx);
  vm.runInContext(SRC + "\nthis.subsidyContinueLoading = subsidyContinueLoading; this.fetchSubsidyPage = fetchSubsidyPage; this.get = function (k) { return eval(k); };", ctx);
  return { ctx, calls };
}
const settle = (ms) => new Promise((r) => setTimeout(r, ms || 80));

test("상세 조건이 없으면 기존 자동 이어읽기 제한을 유지한다 (첫 페이지만)", async () => {
  const { ctx, calls } = makeEnv();
  ctx.fetchSubsidyPage(true);
  await settle(150);
  assert.equal(calls.length, 1);
  assert.equal(ctx.get("SUPPORT_PROGRAMS").length, 50);
});

test("보이는 결과가 적으면 기존처럼 최대 3페이지까지만 자동으로 이어 읽는다", async () => {
  const { ctx, calls } = makeEnv();
  ctx.shown = 0;
  ctx.fetchSubsidyPage(true);
  await settle(300);
  assert.equal(calls.length, 4);                                   // 첫 페이지 + 자동 3페이지
});

test("여성 등 상세 조건을 고르면 7페이지·308건을 끝까지 읽고 중복이 없다", async () => {
  const { ctx, calls } = makeEnv({ dupFirst: true });
  ctx.extra = { special: ["female"], household: "", childAges: [] };
  ctx.fetchSubsidyPage(true);
  await settle(500);
  assert.equal(calls.length, 7);
  const ids = ctx.get("SUPPORT_PROGRAMS").map((p) => p.id);
  assert.equal(ids.length, TOTAL);
  assert.equal(new Set(ids).size, TOTAL);
  assert.equal(ctx.get("subsidyHasMore"), false);
  assert.equal(new Set(calls.map((c) => c.offset)).size, 7);       // 같은 cursor를 다시 요청하지 않는다
  for (let i = 0; i < 5; i++) ctx.renderSubsidyList();             // 재렌더링이 중복 요청을 만들지 않는다
  await settle(100);
  assert.equal(calls.length, 7);
});

test("한부모·임신·자녀 연령대 선택도 상세 조건이고, 해당 없음·연령대 없는 자녀 가구는 아니다", () => {
  for (const [extra, expected] of [
    [{ special: [], household: "", childAges: [] }, false],
    [{ special: null, household: "kids", childAges: [] }, false],
    [{ special: null, household: "kids", childAges: ["3-5"] }, true],
    [{ special: null, household: "singleParent", childAges: [] }, true],
    [{ special: null, household: "pregnant", childAges: [] }, true],
    [{ special: ["disability"], household: "", childAges: [] }, true]
  ]) {
    const { ctx } = makeEnv();
    ctx.extra = extra;
    assert.equal(ctx.get("subsidyHasDetailConditions()"), expected, JSON.stringify(extra));
  }
});

test("조건(지역)을 빠르게 바꾸면 이전 응답이 새 결과에 섞이지 않는다", async () => {
  const { ctx, calls } = makeEnv({ delay: { "경기도": 120 } });
  ctx.extra = { special: ["female"], household: "", childAges: [] };
  ctx.fetchSubsidyPage(true);                                      // 경기도 (느린 응답)
  ctx.filter = { age: 26, region: "서울특별시", employment: "취준생" };
  ctx.fetchSubsidyPage(true);                                      // 서울 (즉시)
  await settle(600);
  const ids = ctx.get("SUPPORT_PROGRAMS").map((p) => p.id);
  assert.equal(ids.length, TOTAL);
  assert.ok(ids.every((id) => id.startsWith("서울특별시-")), "다른 조건의 응답이 섞임");
  assert.ok(!calls.some((c) => c.region === "경기도" && c.offset > 0));       // 오래된 cursor를 이어 쓰지 않는다
});

test("이미 읽은 서버 조건으로 돌아오면 API를 다시 부르지 않고 복원한다", async () => {
  const { ctx, calls } = makeEnv();
  ctx.extra = { special: ["female"], household: "", childAges: [] };
  ctx.fetchSubsidyPage(true);
  await settle(400);
  assert.equal(calls.length, 7);
  ctx.filter = { age: 26, region: "서울특별시", employment: "취준생" };
  ctx.fetchSubsidyPage(true);
  await settle(400);
  assert.equal(calls.length, 14);
  ctx.filter = { age: 26, region: "경기도", employment: "취준생" };
  ctx.fetchSubsidyPage(true);
  await settle(200);
  assert.equal(calls.length, 14);                                  // 복원: 추가 요청 없음
  const items = ctx.get("SUPPORT_PROGRAMS");
  assert.equal(items.length, TOTAL);
  assert.ok(items.every((p) => p.id.startsWith("경기도-")));
});

test("중간에 실패하면 기존 결과를 유지하고 멈추며, 재시도하면 이어서 끝까지 읽는다", async () => {
  const { ctx, calls } = makeEnv({ failOn: (n) => n === 3 });
  ctx.extra = { special: ["female"], household: "", childAges: [] };
  ctx.fetchSubsidyPage(true);
  await settle(400);
  assert.equal(calls.length, 3);                                   // 3번째에서 실패, 자동 재시도 없음
  assert.equal(ctx.get("SUPPORT_PROGRAMS").length, 100);
  assert.equal(ctx.get("subsidyLoadError"), true);
  assert.equal(ctx.get("subsidyHasMore"), true);
  vm.runInContext("subsidyLoadError = false; fetchSubsidyPage(false);", ctx);   // '다시 시도' 버튼 동작
  await settle(400);
  const ids = ctx.get("SUPPORT_PROGRAMS").map((p) => p.id);
  assert.equal(ids.length, TOTAL);
  assert.equal(new Set(ids).size, TOTAL);
});

test("서버로 보내는 파라미터는 정적 필터뿐이고 상세 조건 값은 URL·GA4에 들어가지 않는다", async () => {
  const { ctx, calls } = makeEnv();
  ctx.extra = { special: ["female", "disability"], household: "kids", childAges: ["3-5", "elem"] };
  ctx.fetchSubsidyPage(true);
  await settle(400);
  const allowed = new Set(["limit", "sort", "status", "category", "region", "cursor"]);
  assert.ok(calls.length > 0);
  calls.forEach((c) => {
    new URL(c.url, "http://x").searchParams.forEach((v, k) => assert.ok(allowed.has(k), "허용되지 않은 파라미터 " + k));
    assert.ok(!/female|disability|3-5|elem|kids|childAges/.test(decodeURIComponent(c.url)));
  });
  const events = html.match(/trackSubsidyEvent\("[a-z_]+"[^)]*\)/g) || [];
  events.forEach((e) => assert.ok(!/childAges|special|household|income/.test(e), e));
});
