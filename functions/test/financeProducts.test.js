"use strict";
// 금융상품 메뉴 테스트 — 네트워크 없이 가짜 fetch/응답으로 검증한다.
// js/finance-products.js는 브라우저용 파일(루트 package.json이 ESM)이라 vm 샌드박스에서 불러오고,
// api/*.js는 ESM이라 동적 import로 불러온다.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "finance-products.js"), "utf8"), sandbox);
const FP = sandbox.self.FinanceProducts;

let lib, handlerMod;
test.before(async () => {
  lib = await import(pathToFileURL(path.join(__dirname, "..", "..", "api", "_lib", "financeProducts.js")).href);
  handlerMod = await import(pathToFileURL(path.join(__dirname, "..", "..", "api", "finance-products.js")).href);
});

// vm 샌드박스에서 만들어진 객체는 프로토타입이 달라 deepStrictEqual이 실패하므로 JSON으로 풀어 비교한다.
const eq = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);

const CATS = ["deposit", "savings", "mortgage", "jeonse", "credit"];

// ---------- 응답 만들기 ----------
function product(cat, i, extra) {
  const loan = FP.isLoan(cat);
  return Object.assign({ bank: cat + "은행" + i, name: cat + "-상품-" + i, joinWay: "인터넷", baseRate: loan ? 3 + i * 0.1 : 2 + i * 0.1, maxRate: loan ? 5 + i * 0.1 : 3 + i * 0.1, avgRate: null, term: loan ? "" : "12개월 기준" }, extra || {});
}
function okResponse(cat, n, extraType) {
  const products = [];
  for (let i = 0; i < n; i++) products.push(product(cat, i));
  const body = { products: products, asOf: "202609" };
  if (extraType !== null) body.type = extraType === undefined ? cat : extraType;
  return { ok: true, json: () => Promise.resolve(body) };
}
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

// 1) 메뉴별 요청 유형 ---------------------------------------------------------
test("각 메뉴가 올바른 type으로 요청하고, 알 수 없는 유형은 거부한다", () => {
  CATS.forEach((c) => assert.equal(FP.requestUrl(c), "/api/finance-products?type=" + c));
  assert.throws(() => FP.requestUrl("pension"));
  assert.throws(() => FP.requestUrl("constructor"));
  assert.equal(FP.isCat("constructor"), false);
});

test("메뉴 제목·문구·정렬이 유형별로 서로 다르고 예금 문구가 대출 화면에 남지 않는다", () => {
  const titles = CATS.map((c) => FP.meta(c).title);
  assert.equal(new Set(titles).size, 5);
  eq(titles, ["정기예금", "정기적금", "주택담보대출", "전월세보증금대출", "개인신용대출"]);
  ["mortgage", "jeonse", "credit"].forEach((c) => {
    const m = FP.meta(c);
    const all = [m.subtitle, m.emptyText, m.errorText, m.disclaimer, m.spotlight.desc, m.spotlight.label].concat(m.sorts.map((s) => s.label)).join(" ");
    assert.ok(!/정기예금|정기적금|예금|적금|우대금리/.test(all), c + " 문구에 예·적금 표현이 남음: " + all);
  });
  ["deposit", "savings"].forEach((c) => {
    const m = FP.meta(c);
    assert.ok(/금리/.test(m.spotlight.desc) && !/대출/.test([m.subtitle, m.emptyText, m.errorText, m.disclaimer].join(" ")));
  });
  assert.ok(FP.meta("savings").subtitle.includes("정기적금") && !FP.meta("savings").subtitle.includes("정기예금"));
});

// 2) 캐시 키 ------------------------------------------------------------------
test("유형마다 캐시 키가 서로 다르다", () => {
  const keys = CATS.map(FP.cacheKey);
  assert.equal(new Set(keys).size, 5);
  keys.forEach((k, i) => assert.ok(k.endsWith(CATS[i])));
});

test("같은 유형은 캐시를 재사용하지만 다른 유형의 캐시는 공유하지 않는다", async () => {
  const calls = [];
  const loader = FP.createLoader((url) => { calls.push(url); return Promise.resolve(okResponse(url.split("type=")[1], 2)); });
  const a = await loader.load("deposit");
  const b = await loader.load("deposit");
  const c = await loader.load("savings");
  eq(calls, ["/api/finance-products?type=deposit", "/api/finance-products?type=savings"]);
  assert.equal(a.fromCache, false); assert.equal(b.fromCache, true); assert.equal(c.fromCache, false);
  assert.ok(c.products.every((p) => p.name.startsWith("savings")));
  assert.ok(b.products.every((p) => p.name.startsWith("deposit")));
});

test("진행 중인 같은 유형 요청은 하나로 합치고, 다른 유형은 따로 요청한다", async () => {
  const d = deferred(); const calls = [];
  const loader = FP.createLoader((url) => { calls.push(url); return url.endsWith("deposit") ? d.promise : Promise.resolve(okResponse("savings", 1)); });
  const p1 = loader.load("deposit"); const p2 = loader.load("deposit"); const p3 = loader.load("savings");
  d.resolve(okResponse("deposit", 1));
  await Promise.all([p1, p2, p3]);
  assert.equal(calls.filter((u) => u.endsWith("deposit")).length, 1);
  assert.equal(calls.filter((u) => u.endsWith("savings")).length, 1);
});

test("캐시 시간이 지나면 다시 요청한다", async () => {
  let t = 1000; let n = 0;
  const loader = FP.createLoader(() => { n++; return Promise.resolve(okResponse("deposit", 1)); }, { ttlMs: 500, now: () => t });
  await loader.load("deposit"); t += 100; await loader.load("deposit"); assert.equal(n, 1);
  t += 600; await loader.load("deposit"); assert.equal(n, 2);
});

// 3) 유형 혼입 방지 -----------------------------------------------------------
test("정기예금 응답이 적금·대출 요청에 돌아와도 화면용 데이터로 쓰지 않는다", async () => {
  for (const cat of ["savings", "mortgage", "jeonse", "credit"]) {
    const loader = FP.createLoader(() => Promise.resolve(okResponse("deposit", 3, "deposit")));
    const r = await loader.load(cat);
    assert.equal(r.status, "error", cat);
    assert.equal(r.error, "type_mismatch");
    eq(r.products, []);
    assert.equal(loader.cacheSize(), 0, "잘못된 응답은 캐시하지 않는다");
  }
});

test("type 필드가 없는 응답(Firebase 함수 등)은 요청한 유형으로 받아들인다", async () => {
  const loader = FP.createLoader(() => Promise.resolve(okResponse("mortgage", 2, null)));
  const r = await loader.load("mortgage");
  assert.equal(r.status, "ok");
  assert.equal(r.products.length, 2);
});

// 4) 빠른 전환 · 실패 · 빈 결과 ------------------------------------------------
test("빠른 탭 전환에서 오래된 응답은 stale로 표시된다", async () => {
  const slow = deferred();
  const loader = FP.createLoader((url) => url.endsWith("deposit") ? slow.promise : Promise.resolve(okResponse("savings", 2)));
  const pDeposit = loader.load("deposit");
  const pSavings = loader.load("savings");
  const rSavings = await pSavings;
  slow.resolve(okResponse("deposit", 2));
  const rDeposit = await pDeposit;
  assert.equal(rSavings.stale, false);
  assert.equal(rDeposit.stale, true, "나중에 도착한 이전 탭 응답은 버려야 한다");
});

test("한 유형이 실패해도 다른 유형(캐시된 정기예금) 데이터로 대체하지 않는다", async () => {
  const loader = FP.createLoader((url) => url.endsWith("deposit") ? Promise.resolve(okResponse("deposit", 3)) : Promise.reject(new Error("network down")));
  const dep = await loader.load("deposit");
  assert.equal(dep.status, "ok");
  const mort = await loader.load("mortgage");
  assert.equal(mort.status, "error");
  eq(mort.products, []);
  assert.equal(mort.cat, "mortgage");
});

test("HTTP 오류·error 필드·JSON 오류는 모두 오류이고 캐시되지 않으며, 재시도(force)로 다시 요청한다", async () => {
  let mode = "http"; let n = 0;
  const loader = FP.createLoader(() => {
    n++;
    if (mode === "http") return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "x" }) });
    if (mode === "json") return Promise.resolve({ ok: true, json: () => Promise.reject(new Error("bad json")) });
    return Promise.resolve(okResponse("credit", 2));
  });
  assert.equal((await loader.load("credit")).status, "error");
  mode = "json"; assert.equal((await loader.load("credit")).status, "error");
  mode = "ok"; const r = await loader.load("credit", true);
  assert.equal(r.status, "ok"); assert.equal(n, 3);
  const again = await loader.load("credit"); assert.equal(again.fromCache, true); assert.equal(n, 3);
});

test("빈 결과(empty)와 조회 실패(error)를 구분한다", async () => {
  const empty = FP.createLoader(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ type: "jeonse", products: [], asOf: "" }) }));
  const failed = FP.createLoader(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "조회 실패" }) }));
  assert.equal((await empty.load("jeonse")).status, "empty");
  assert.equal((await failed.load("jeonse")).status, "error");
  assert.equal((await FP.createLoader(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ type: "jeonse" }) })).load("jeonse")).status, "error");
});

// 5) 해시 복원 ----------------------------------------------------------------
test("해시로 유형을 저장하고 복원한다", () => {
  CATS.forEach((c) => { assert.equal(FP.hashFor(c), "#finance/" + c); assert.equal(FP.parseHash(FP.hashFor(c)).cat, c); });
  assert.equal(FP.parseHash("#finance").cat, null);
  assert.equal(FP.parseHash("#finance/unknown").cat, null);
  assert.equal(FP.parseHash("#subsidy"), null);
  assert.equal(FP.parseHash("#financeX"), null);
  assert.equal(FP.parseHash(""), null);
});

// 6) 정렬 ---------------------------------------------------------------------
test("예·적금은 높은 금리순, 대출은 낮은 금리순이며 값이 없는 상품은 항상 뒤로 간다", () => {
  const list = [{ name: "a", baseRate: 2, maxRate: 3 }, { name: "b", baseRate: 2.5, maxRate: 4 }, { name: "n", baseRate: null, maxRate: null }, { name: "c", baseRate: 1.5, maxRate: 3.5 }];
  eq(FP.sortProducts("deposit", list, "rate-desc").map((p) => p.name), ["b", "c", "a", "n"]);
  eq(FP.sortProducts("savings", list, "preferential").map((p) => p.name), ["c", "b", "a", "n"]);
  eq(FP.sortProducts("mortgage", list, "min-asc").map((p) => p.name), ["c", "a", "b", "n"]);
  eq(FP.sortProducts("credit", list, "max-asc").map((p) => p.name), ["a", "c", "b", "n"]);
  // 잘못된 정렬 키는 유형의 기본 정렬로 되돌린다
  eq(FP.sortProducts("mortgage", list, "rate-desc").map((p) => p.name), FP.sortProducts("mortgage", list, "min-asc").map((p) => p.name));
  // 입력 배열을 바꾸지 않는다
  eq(list.map((p) => p.name), ["a", "b", "n", "c"]);
});

test("스포트라이트는 예·적금은 최고금리가 가장 높은 상품, 대출은 최저금리가 가장 낮은 상품이다", () => {
  const list = [{ bank: "A", name: "a", baseRate: 3, maxRate: 4 }, { bank: "B", name: "b", baseRate: 2, maxRate: 5 }];
  assert.equal(FP.spotlight("deposit", list).name, "b");
  assert.equal(FP.spotlight("deposit", list).value, "5.00%");
  assert.equal(FP.spotlight("mortgage", list).name, "b");
  assert.equal(FP.spotlight("mortgage", list).value, "2.00%");
  assert.equal(FP.spotlight("mortgage", list).label, "최저금리");
  assert.equal(FP.spotlight("savings", []), null);
});

// 7) 카드·상세 필드 ------------------------------------------------------------
test("정기예금 카드: 최고금리·기본금리·가입 기간·가입 대상", () => {
  const c = FP.cardModel("deposit", { bank: "우리은행", name: "WON예금", baseRate: 3.6, maxRate: 3.9, term: "12개월 기준", joinMember: "실명의 개인", joinWay: "인터넷,스마트폰", intrRateType: "단리" });
  assert.equal(c.primaryValue, "3.90%"); assert.equal(c.primaryLabel, "최고");
  assert.equal(c.secondary, "기본 3.60% · 12개월 기준");
  eq(c.tags, ["단리"]);
  assert.ok(c.meta.includes("가입 대상 실명의 개인") && c.meta.includes("가입 방법 인터넷,스마트폰"));
});

test("정기적금 카드: 적립 방식 태그가 붙는다", () => {
  const c = FP.cardModel("savings", { bank: "신한은행", name: "적금", baseRate: 2.45, maxRate: 3.85, term: "12개월 기준", rsrvType: "자유적립식", intrRateType: "단리" });
  eq(c.tags, ["자유적립식", "단리"]);
  assert.equal(c.primaryValue, "3.85%");
  const dep = FP.cardModel("deposit", { bank: "a", name: "b", baseRate: 1, maxRate: 2, rsrvType: "자유적립식" });
  eq(dep.tags, [], "예금 카드에는 적립 방식이 나오지 않는다");
});

test("대출 카드: 최저금리가 대표이고 최고·평균은 라벨로 구분하며 예금식 문구가 없다", () => {
  const m = FP.cardModel("mortgage", { bank: "우리은행", name: "우리아파트론", baseRate: 4.18, maxRate: 6.91, avgRate: 5.1, lendRateType: "변동금리", repayType: "분할상환방식", mortgageType: "아파트", loanLimit: "최대 5억" });
  assert.equal(m.primaryLabel, "최저"); assert.equal(m.primaryValue, "4.18%");
  assert.equal(m.secondary, "최고 6.91% · 평균 5.10%");
  eq(m.tags, ["변동금리", "분할상환방식", "아파트"]);
  assert.ok(m.meta.includes("한도 최대 5억"));
  assert.ok(!/기본|12개월|가입 기간/.test(m.secondary + m.meta));
  const j = FP.cardModel("jeonse", { bank: "a", name: "b", baseRate: 3.9, maxRate: 6, lendRateType: "고정금리", repayType: "만기일시상환방식", mortgageType: "아파트" });
  eq(j.tags, ["고정금리", "만기일시상환방식"], "전세 카드에는 담보 유형이 나오지 않는다");
  const c = FP.cardModel("credit", { bank: "a", name: "b", baseRate: 4.2, maxRate: 9.8, avgRate: 6.5, creditProductType: "마이너스한도대출" });
  eq(c.tags, ["마이너스한도대출"]); assert.equal(c.secondary, "최고 9.80% · 평균 6.50%");
});

test("API에 없는 값은 0·없음으로 채우지 않고 항목을 만들지 않는다", () => {
  const c = FP.cardModel("mortgage", { bank: "a", name: "b", baseRate: 4, maxRate: null, avgRate: null, joinWay: "" });
  assert.equal(c.secondary, ""); assert.equal(c.meta, ""); eq(c.tags, []);
  assert.ok(!/0\.00%|없음|undefined|null/.test(JSON.stringify(c)));
  const rows = FP.detailRows("credit", { bank: "a", name: "b", baseRate: 4, maxRate: 9, joinWay: "영업점" });
  eq(rows.map((r) => r[0]), ["최고금리", "가입 방법"]);
});

test("상세 보기 제목 라벨과 행이 유형별로 맞다", () => {
  eq(FP.detailHead("deposit", { baseRate: 3, maxRate: 4 }), { label: "최고금리", value: "4.00%" });
  eq(FP.detailHead("credit", { baseRate: 3, maxRate: 8 }), { label: "최저금리", value: "3.00%" });
  const dep = FP.detailRows("deposit", { baseRate: 3, maxRate: 4, term: "12개월 기준", specialCondition: "급여 이체", joinMember: "개인", maxLimit: "1억", maturityInterest: "만기 후 50%", etcNote: "메모" }).map((r) => r[0]);
  eq(dep, ["최고금리", "기본금리", "우대조건", "가입 대상", "최고 한도", "만기 후 이자율", "기타 유의사항"]);
  const loan = FP.detailRows("mortgage", { baseRate: 3, maxRate: 5, avgRate: 4, lendRateType: "고정금리", repayType: "분할상환방식", mortgageType: "아파트", loanLimit: "5억", earlyRepayFee: "1.4%", delayRate: "연 +3%" }).map((r) => r[0]);
  eq(loan, ["최고금리", "평균금리", "금리 방식", "상환 방식", "담보 유형", "대출 한도", "중도상환수수료", "연체이자율"]);
  assert.ok(!loan.includes("우대조건") && !loan.includes("만기 후 이자율"));
});

// 8) API 응답 변환 ------------------------------------------------------------
function opt(key, extra) { return Object.assign({ fin_co_no: "1", fin_prdt_cd: key }, extra); }

test("신용대출은 대출금리 행만 금리로 쓰고 기준금리·가감조정금리(음수 포함) 행은 섞지 않는다", () => {
  const base = [{ fin_co_no: "1", fin_prdt_cd: "C1", kor_co_nm: "은행", fin_prdt_nm: "신용", join_way: "영업점", crdt_prdt_type_nm: "일반신용대출" }];
  const options = [
    opt("C1", { crdt_lend_rate_type: "A", crdt_lend_rate_type_nm: "대출금리", crdt_grad_1: "4.5", crdt_grad_4: "5.5", crdt_grad_5: "7.0", crdt_grad_avg: "6.1" }),
    opt("C1", { crdt_lend_rate_type: "B", crdt_lend_rate_type_nm: "기준금리", crdt_grad_1: "2.9", crdt_grad_4: "2.9", crdt_grad_avg: "2.9" }),
    opt("C1", { crdt_lend_rate_type: "C", crdt_lend_rate_type_nm: "가감조정금리", crdt_grad_1: "-0.2", crdt_grad_4: "0.3", crdt_grad_avg: "0.1" })
  ];
  const p = lib.buildProducts("credit", base, options)[0];
  assert.equal(p.baseRate, 4.5); assert.equal(p.maxRate, 7); assert.equal(p.avgRate, 6.1);
  assert.equal(p.creditProductType, "일반신용대출");
});

test("신용대출 금리 구분 정보가 없으면 예전 방식으로 계산하되 음수 값은 제외한다", () => {
  const base = [{ fin_co_no: "1", fin_prdt_cd: "C2", kor_co_nm: "은행", fin_prdt_nm: "신용" }];
  const options = [opt("C2", { crdt_grad_1: "-0.2", crdt_grad_4: "4.0", crdt_grad_5: "8.0" })];
  const p = lib.buildProducts("credit", base, options)[0];
  assert.equal(p.baseRate, 4); assert.equal(p.maxRate, 8);
});

test("대출 금리 방식·상환 방식·담보 유형은 API에 있을 때만 전달된다", () => {
  const base = [{ fin_co_no: "1", fin_prdt_cd: "M1", kor_co_nm: "은행", fin_prdt_nm: "주담대", join_way: "영업점", loan_lmt: "5억 이내" }, { fin_co_no: "1", fin_prdt_cd: "M2", kor_co_nm: "은행", fin_prdt_nm: "주담대2" }];
  const options = [
    opt("M1", { lend_rate_min: "4.1", lend_rate_max: "6.0", lend_rate_avg: "5.0", rpay_type_nm: "분할상환방식", lend_rate_type_nm: "변동금리", mrtg_type_nm: "아파트" }),
    opt("M1", { lend_rate_min: "4.3", lend_rate_max: "6.4", lend_rate_avg: "5.2", rpay_type_nm: "만기일시상환방식", lend_rate_type_nm: "변동금리", mrtg_type_nm: "아파트" }),
    opt("M2", { lend_rate_min: "4.0", lend_rate_max: "5.0" })
  ];
  const [a, b] = lib.buildProducts("mortgage", base, options);
  assert.equal(a.baseRate, 4.1); assert.equal(a.maxRate, 6.4); assert.equal(a.avgRate, 5.1);
  assert.equal(a.repayType, "분할상환방식 · 만기일시상환방식"); assert.equal(a.lendRateType, "변동금리"); assert.equal(a.mortgageType, "아파트"); assert.equal(a.loanLimit, "5억 이내");
  assert.ok(!("repayType" in b) && !("lendRateType" in b) && !("loanLimit" in b), "값이 없으면 키 자체가 없다");
});

test("예금·적금은 12개월 기준 금리와 적립·이자 계산 방식을 전달한다", () => {
  const base = [{ fin_co_no: "1", fin_prdt_cd: "S1", kor_co_nm: "은행", fin_prdt_nm: "적금", join_way: "인터넷" }];
  const options = [opt("S1", { save_trm: "6", intr_rate: "2.0", intr_rate2: "3.0", intr_rate_type_nm: "단리", rsrv_type_nm: "자유적립식" }), opt("S1", { save_trm: "12", intr_rate: "2.5", intr_rate2: "3.5", intr_rate_type_nm: "단리", rsrv_type_nm: "자유적립식" })];
  const s = lib.buildProducts("savings", base, options)[0];
  assert.equal(s.baseRate, 2.5); assert.equal(s.maxRate, 3.5); assert.equal(s.term, "12개월 기준"); assert.equal(s.rsrvType, "자유적립식"); assert.equal(s.intrRateType, "단리");
  const d = lib.buildProducts("deposit", base, options)[0];
  assert.ok(!("rsrvType" in d), "예금에는 적립 방식이 없다");
});

// 9) 핸들러: type 에코 · 유형 검증 · 비밀값 비노출 -----------------------------
function makeRes() {
  const res = { statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
  return res;
}
function fssPage(result) { return { ok: true, json: () => Promise.resolve({ result: Object.assign({ err_cd: "000", max_page_no: 1 }, result) }) }; }

test("핸들러는 요청한 type을 응답에 담고 유형마다 해당 FSS endpoint만 호출한다", async () => {
  const realFetch = global.fetch; const urls = [];
  process.env.FSS_API_KEY = "SECRET-KEY-12345";
  global.fetch = async (url) => { urls.push(url); return fssPage({ baseList: [{ fin_co_no: "1", fin_prdt_cd: "X", kor_co_nm: "은행", fin_prdt_nm: "상품", dcls_month: "202609" }], optionList: [{ fin_co_no: "1", fin_prdt_cd: "X", save_trm: "12", intr_rate: "2", intr_rate2: "3", lend_rate_min: "3", lend_rate_max: "4", crdt_grad_1: "5" }] }); };
  const expected = { deposit: "depositProductsSearch", savings: "savingProductsSearch", mortgage: "mortgageLoanProductsSearch", jeonse: "rentHouseLoanProductsSearch", credit: "creditLoanProductsSearch" };
  try {
    for (const cat of CATS) {
      urls.length = 0; const res = makeRes();
      await handlerMod.default({ method: "GET", query: { type: cat } }, res);
      assert.equal(res.statusCode, 200, cat);
      assert.equal(res.body.type, cat);
      assert.ok(urls.length >= 1 && urls.every((u) => u.includes("/" + expected[cat] + ".json")), cat + " → " + urls.join(","));
      assert.ok(!JSON.stringify(res.body).includes("SECRET-KEY-12345"), "응답에 API 키가 없다");
      assert.ok(!JSON.stringify(res.headers).includes("SECRET-KEY-12345"));
    }
  } finally { global.fetch = realFetch; delete process.env.FSS_API_KEY; }
});

test("핸들러: 알 수 없는 type·prototype 키는 400, FSS 실패는 502이며 키가 로그·응답에 남지 않는다", async () => {
  const realFetch = global.fetch; const realErr = console.error; const logs = [];
  process.env.FSS_API_KEY = "SECRET-KEY-98765";
  console.error = (...a) => logs.push(a.map(String).join(" "));
  try {
    for (const bad of ["pension", "constructor", "__proto__", "", "DEPOSIT"]) {
      const res = makeRes(); await handlerMod.default({ method: "GET", query: { type: bad } }, res);
      assert.equal(res.statusCode, 400, "type=" + bad);
    }
    global.fetch = async () => ({ ok: true, json: () => Promise.resolve({ result: { err_cd: "010", err_msg: "인증 오류" } }) });
    const res = makeRes(); await handlerMod.default({ method: "GET", query: { type: "mortgage" } }, res);
    assert.equal(res.statusCode, 502);
    assert.ok(!res.body.products, "실패 시 다른 데이터로 대체하지 않는다");
    assert.ok(!res.headers["Cache-Control"], "오류 응답은 캐시하지 않는다");
    global.fetch = async () => { throw new Error("fetch failed"); };
    const res2 = makeRes(); await handlerMod.default({ method: "GET", query: { type: "deposit" } }, res2);
    assert.equal(res2.statusCode, 502);
    const all = JSON.stringify(res.body) + JSON.stringify(res2.body) + logs.join("\n");
    assert.ok(!all.includes("SECRET-KEY-98765"), "응답·콘솔에 API 키가 없다");
    delete process.env.FSS_API_KEY;
    const res3 = makeRes(); await handlerMod.default({ method: "GET", query: { type: "deposit" } }, res3);
    assert.equal(res3.statusCode, 500);
  } finally { global.fetch = realFetch; console.error = realErr; delete process.env.FSS_API_KEY; }
});

test("클라이언트 모듈과 화면 코드에 API 키·비밀값이 없다", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "..", "js", "finance-products.js"), "utf8");
  assert.ok(!/FSS_API_KEY|auth=|apiKey/i.test(src));
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  const block = html.slice(html.indexOf("// ---------- 금융: 상품 유형별 금리 비교"), html.indexOf("// ---------- 금융 캘린더"));
  assert.ok(block.length > 1000 && !/FSS_API_KEY|auth=/.test(block));
});
