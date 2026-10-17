"use strict";
// 모바일 앱 금융상품 로직(mobile-app/src/lib/financeProductsLogic.ts)이 웹(js/finance-products.js)과
// 같은 결과를 내는지, 그리고 앱 쪽 요청·검증·캐시가 유형별로 분리되는지 검증한다.
// .ts 파일은 Node의 타입 제거 기능으로 바로 불러오고(별도 빌드 없음), 웹 모듈은 vm 샌드박스에서 불러온다.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { pathToFileURL } = require("url");

const ROOT = path.join(__dirname, "..", "..");
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "finance-products.js"), "utf8"), sandbox);
const WEB = sandbox.self.FinanceProducts;
const j = (v) => JSON.parse(JSON.stringify(v));
const eq = (a, b, m) => assert.deepStrictEqual(j(a), j(b), m);

let APP, handlerLib;
test.before(async () => {
  APP = await import(pathToFileURL(path.join(ROOT, "mobile-app", "src", "lib", "financeProductsLogic.ts")).href);
  handlerLib = await import(pathToFileURL(path.join(ROOT, "api", "_lib", "financeProducts.js")).href);
});

const CATS = ["deposit", "savings", "mortgage", "jeonse", "credit"];

// 웹·앱이 같은 입력에서 같은 출력을 내는지 비교할 표본(결측·0·음수 없는 값·긴 문자열 포함)
const SAMPLES = [
  { bank: "우리은행", name: "A", baseRate: 3.6, maxRate: 3.9, avgRate: 4.1, term: "12개월 기준", joinWay: "인터넷,스마트폰", joinMember: "실명의 개인", intrRateType: "단리", rsrvType: "자유적립식", repayType: "분할상환방식", lendRateType: "변동금리", mortgageType: "아파트", creditProductType: "일반신용대출", loanLimit: "LTV 70%", specialCondition: "급여 이체", maxLimit: "1억", maturityInterest: "만기 후 50%", etcNote: "메모", earlyRepayFee: "1.4%", delayRate: "연 +3%", loanExpense: "인지세" },
  { bank: "신한은행", name: "B", baseRate: 2.1, maxRate: 5.5, avgRate: null, term: "", joinWay: "" },
  { bank: "", name: "", baseRate: null, maxRate: null },
  { bank: "하나은행", name: "C", baseRate: 4.2, maxRate: 4.2, avgRate: 4.2, term: "12개월 기준", joinWay: "영업점".repeat(20), joinMember: "가입 대상".repeat(10) },
  { bank: "국민은행", name: "D", baseRate: null, maxRate: 6.1 },
  { bank: "카카오뱅크", name: "E", baseRate: 0, maxRate: 3.3, avgRate: 0 }
];

test("앱과 웹의 유형별 메타(제목·정렬·문구)가 같다", () => {
  CATS.forEach((c) => {
    eq(APP.META[c], WEB.META[c], c);
    assert.equal(APP.isLoan(c), WEB.isLoan(c));
    assert.equal(APP.defaultSort(c), WEB.defaultSort(c));
    assert.equal(APP.requestPath(c), WEB.requestUrl(c));
    assert.equal(APP.cacheKey(c), WEB.cacheKey(c));
  });
  ["pension", "constructor", "__proto__", "", undefined, null].forEach((bad) => {
    assert.equal(APP.isCat(bad), false, String(bad));
    assert.equal(WEB.isCat(bad), false);
  });
  assert.throws(() => APP.requestPath("pension"));
  assert.throws(() => APP.cacheKey("constructor"));
});

test("앱과 웹의 정렬 결과가 모든 유형·정렬 키에서 같다", () => {
  CATS.forEach((c) => {
    WEB.meta(c).sorts.map((s) => s.key).concat(["nope"]).forEach((key) => {
      eq(APP.sortProducts(c, SAMPLES, key), WEB.sortProducts(c, SAMPLES, key), c + "/" + key);
    });
  });
});

test("앱과 웹의 대표 상품·카드·상세 필드가 같다", () => {
  CATS.forEach((c) => {
    eq(APP.spotlight(c, SAMPLES), WEB.spotlight(c, SAMPLES), "spotlight " + c);
    eq(APP.spotlight(c, []), WEB.spotlight(c, []), "spotlight empty " + c);
    SAMPLES.forEach((item, i) => {
      eq(APP.cardModel(c, item), WEB.cardModel(c, item), `card ${c}#${i}`);
      eq(APP.detailRows(c, item), WEB.detailRows(c, item), `detail ${c}#${i}`);
      eq(APP.detailHead(c, item), WEB.detailHead(c, item), `head ${c}#${i}`);
    });
  });
});

test("앱과 웹의 응답 검증(ok·empty·error·type 불일치)이 같다", () => {
  const cases = [
    [true, { type: "mortgage", products: [{ bank: "a" }], asOf: "202609" }],
    [true, { products: [{ bank: "a" }] }],
    [true, { type: "mortgage", products: [] }],
    [true, { type: "deposit", products: [{ bank: "a" }] }],
    [false, { error: "x" }],
    [true, { type: "mortgage" }],
    [true, null],
    [true, "text"]
  ];
  CATS.forEach((c) => cases.forEach(([ok, data], i) => eq(APP.validate(c, ok, data), WEB.validate(c, ok, data), `${c} case ${i}`)));
  assert.equal(APP.validate("savings", true, { type: "deposit", products: [{ bank: "a" }] }).status, "error");
  assert.equal(APP.validate("savings", true, { type: "deposit", products: [{ bank: "a" }] }).products.length, 0, "다른 유형 데이터는 버린다");
});

test("앱 화면에 예금 문구가 대출 유형에 남지 않고, 메뉴명이 웹과 같다", () => {
  ["mortgage", "jeonse", "credit"].forEach((c) => {
    const m = APP.META[c];
    const all = [m.subtitle, m.emptyText, m.errorText, m.disclaimer, m.spotlight.desc, m.spotlight.label].concat(m.sorts.map((s) => s.label)).join(" ");
    assert.ok(!/정기예금|정기적금|예금|적금|우대금리/.test(all), c);
  });
  const menu = fs.readFileSync(path.join(ROOT, "mobile-app", "src", "constants", "menu.ts"), "utf8");
  assert.ok(menu.includes("label: '개인신용대출'") && !menu.includes("신용담보대출"));
  ["정기예금", "정기적금", "주택담보대출", "전월세보증금대출"].forEach((l) => assert.ok(menu.includes(`label: '${l}'`), l));
  const wrongTitles = CATS.map((c) => APP.META[c].title);
  eq(wrongTitles, ["정기예금", "정기적금", "주택담보대출", "전월세보증금대출", "개인신용대출"]);
});

// ---------- 앱의 요청·캐시(financeProductsApi.ts)를 가짜 fetch로 검증 ----------
// api 모듈은 react-native 설정(theme)에 의존하므로, 같은 로직을 가진 소스를 읽어 구조(요청 경로·캐시 키·검증 사용)를 확인한다.
test("앱 API 모듈은 유형별 요청 경로·캐시 키를 쓰고 검증 결과만 캐시한다", () => {
  const src = fs.readFileSync(path.join(ROOT, "mobile-app", "src", "lib", "financeProductsApi.ts"), "utf8");
  assert.ok(src.includes("requestPath(category)") && src.includes("cacheKey(category)") && src.includes("validate(category"));
  assert.ok(/result\.status === 'ok' \|\| result\.status === 'empty'/.test(src), "오류는 캐시하지 않는다");
  assert.ok(!/FSS_API_KEY|auth=|apiKey/i.test(src), "앱 코드에 API 키가 없다");
  const screen = fs.readFileSync(path.join(ROOT, "mobile-app", "src", "screens", "FinanceProductsScreen.tsx"), "utf8");
  assert.ok(screen.includes("loadLiveFinanceProducts(category") && screen.includes("copy.errorText") && screen.includes("다시 시도"));
  assert.ok(!/FSS_API_KEY|auth=/.test(screen));
  assert.ok(!screen.includes("FINANCE_DATA"), "정적 조사 데이터를 쓰지 않는다");
  assert.ok(screen.includes("if (cancelled) return;"), "유형 전환 중 늦은 응답을 버린다");
});

// ---------- 신용대출 금리 정규화는 앱이 호출하는 서버 경로(api/_lib)에서 이미 적용된다 ----------
test("서버 변환이 가감조정금리·기준금리 행을 섞지 않아 앱에 음수 금리가 내려가지 않는다", () => {
  const base = [{ fin_co_no: "1", fin_prdt_cd: "C1", kor_co_nm: "은행", fin_prdt_nm: "신용" }];
  const opt = (x) => Object.assign({ fin_co_no: "1", fin_prdt_cd: "C1" }, x);
  const options = [
    opt({ crdt_lend_rate_type: "A", crdt_lend_rate_type_nm: "대출금리", crdt_grad_1: "4.5", crdt_grad_4: "5.5", crdt_grad_avg: "5.0" }),
    opt({ crdt_lend_rate_type: "B", crdt_lend_rate_type_nm: "기준금리", crdt_grad_1: "2.9", crdt_grad_avg: "2.9" }),
    opt({ crdt_lend_rate_type: "C", crdt_lend_rate_type_nm: "가감조정금리", crdt_grad_1: "-0.2", crdt_grad_4: "0.3", crdt_grad_avg: "0.1" })
  ];
  const [p] = handlerLib.buildProducts("credit", base, options);
  assert.equal(p.baseRate, 4.5);
  assert.equal(p.maxRate, 5.5);
  // 앱 카드는 이 값을 그대로 쓴다: 음수가 아니고, 0으로 보정한 값도 아니다.
  const card = APP.cardModel("credit", p);
  assert.equal(card.primaryValue, "4.50%");
  assert.ok(!/-/.test(card.primaryValue + card.secondary));
});
