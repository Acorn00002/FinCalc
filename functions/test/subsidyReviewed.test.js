"use strict";
// 사람이 검토한 핵심 사업(reviewed) 우선 구조 테스트 — data/subsidy-eligibility-reviewed.json + js/subsidy-match.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");
const RAW = fs.readFileSync(path.join(ROOT, "data", "subsidy-eligibility-reviewed.json"), "utf8");
const PAYLOAD = JSON.parse(RAW);
function engine() {
  const sb = { self: {} };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "js", "subsidy-match.js"), "utf8"), sb);
  return sb.self.SubsidyMatch;
}
const TODAY = "2026-10-03";
const U = (o) => Object.assign({ age: 27, region: "서울특별시", employment: "재직자", student: "", income: "", household: "", housing: "", special: null, applyStatus: "", childAges: [] }, o || {});
// API(supportPrograms) 형태의 최소 문서
const doc = (id, title, o) => Object.assign({ id, title, summary: title, category: "생활안정", benefits: "", deadlineText: "상시신청", endDate: null, checklist: [], targetAge: { min: 0, max: 99 }, targetRegions: ["전국"], targetEmployment: [] }, o || {});
const entry = (id, o) => Object.assign({
  programId: id, reviewStatus: "reviewed", schemaVersion: 1, title: "t", sourceUrl: "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/" + id,
  sourceModifiedAt: "2026-09-01", reviewedAt: "2026-10-03", reviewer: "test", conditionsComplete: true, applicationStatus: { state: "always" },
  audience: "individual", age: null, regions: null, employment: null, studentStatus: null, income: null, household: null, childAgeBands: null,
  housing: null, specialQualifications: null, businessStatus: null, requiredUnknowns: [], exclusions: [], notes: ""
}, o || {});

test("reviewed 파일: 스키마 검증 통과, 중복 ID 없음, 출처·기준일·검토일 모두 존재, 50건", () => {
  const SM = engine();
  const v = SM.validateReviewed(PAYLOAD);
  assert.equal(v.errors.length, 0, String(v.errors));
  assert.equal(v.count, PAYLOAD.programs.length);
  assert.equal(v.count, 50);
  const ids = PAYLOAD.programs.map((p) => p.programId);
  assert.equal(new Set(ids).size, ids.length);
  PAYLOAD.programs.forEach((p) => {
    assert.match(p.sourceUrl, /^https:\/\/www\.gov\.kr\//);
    assert.match(p.sourceModifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(p.programId, /^[0-9A-Z]{9,12}$/);
  });
});

test("개인정보·자유 입력값 없음 (이메일·전화번호·주민번호 형태, 사용자 입력 필드 없음)", () => {
  assert.ok(!/[\w.+-]+@[\w-]+\.[\w.-]+/.test(RAW));
  assert.ok(!/\b0\d{1,2}[-)\s]?\d{3,4}-\d{4}\b/.test(RAW));
  assert.ok(!/\b\d{6}-?[1-4]\d{6}\b/.test(RAW));
  assert.ok(!/"(?:userInput|memo|comment|email|phone)"/.test(RAW));
});

test("잘못된 항목은 거부된다: 출처 없음·기준일 형식 오류·중복 ID·잘못된 상태", () => {
  const SM = engine();
  const bad = { programs: [entry("A1"), entry("A1"), entry("A2", { sourceUrl: "" }), entry("A3", { sourceModifiedAt: "2026/09/01" }), entry("A4", { applicationStatus: { state: "maybe" } }), entry("A5", { schemaVersion: 9 })] };
  const v = SM.validateReviewed(bad);
  assert.equal(v.count, 1);
  assert.equal(v.errors.length, 5);
  assert.equal(SM.validateReviewed({}).map, null);
});

test("reviewed 사업만 높은 적합도 가능 — 조건이 모두 확인되는 항목은 높음, 자녀 없음 응답은 불일치", () => {
  const SM = engine();
  SM.setReviewed({ programs: [entry("H1", { age: { subject: "child", min: 0, max: 7, exceptions: [], bands: ["0-2", "3-5", "elem"] }, household: { required: ["kids", "singleParent"] } })] });
  const p = doc("H1", "자녀 수당");
  const hi = SM.classify(p, U({ household: "kids", childAges: ["0-2"] }), TODAY);
  assert.equal(hi.grade, "high");
  assert.ok(hi.reviewed && hi.reviewed.sourceModifiedAt);
  assert.equal(SM.classify(p, U({ household: "couple" }), TODAY).grade, "mismatch");
  assert.equal(SM.classify(p, U({ household: "" }), TODAY).grade, "check");
});

test("아동수당: 자녀 연령대가 맞아도 국적·주민등록번호 요건이 입력으로 확인되지 않아 높음 불가", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const r = SM.classify(doc("135200000120", "아동수당"), U({ household: "kids", childAges: ["0-2"] }), TODAY);
  assert.equal(r.grade, "check");
  assert.ok(r.reasons.some((x) => x.kind === "match" && /자녀 연령대 일치/.test(x.text)));
  assert.ok(r.reasons.some((x) => x.kind === "unknown" && /국적/.test(x.text)));
  assert.equal(SM.classify(doc("135200000120", "아동수당"), U({ household: "couple" }), TODAY).grade, "mismatch");
});

test("unreviewed 사업은 높은 적합도 불가 — 자동 판정이 높음이어도 확인 필요로 낮춘다", () => {
  const SM = engine();
  const p = doc("ZZ0000000001", "대학생 아침밥 지원", { checklist: ["전국 대학교에 재학 중인 학생"] });
  const u = U({ employment: "대학생", student: "enrolled", age: 22 });
  SM.setReviewed(null);
  const auto = SM.classify(p, u, TODAY).grade;
  SM.setReviewed(PAYLOAD);
  const r = SM.classify(p, u, TODAY);
  assert.equal(r.reviewed, null);
  assert.notEqual(r.grade, "high");
  assert.ok(r.reasons.some((x) => /공고 확인 필요 \(자동 판정/.test(x.text)));
  assert.ok(["high", "check"].indexOf(auto) !== -1);
});

test("unreviewed 사업은 자동 판정만으로 지역·연령·신분 불일치 처리하지 않고(정렬에서 뒤로), 신청 종료는 불일치 유지", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const seoul = doc("ZZ0000000002", "서울 청년 지원", { targetRegions: ["서울특별시"], checklist: ["서울 거주 만 19~34세 청년"], targetAge: { min: 19, max: 34 } });
  const r = SM.classify(seoul, U({ region: "부산광역시", age: 40 }), TODAY);
  assert.equal(r.grade, "check");
  assert.equal(r.rank.auto, 1);
  assert.ok(r.reasons.some((x) => /^자동 판정: /.test(x.text)));
  const closed = doc("ZZ0000000003", "청년 통장", { deadlineText: "2025.06.09~2025.06.20" });
  assert.equal(SM.classify(closed, U(), TODAY).grade, "mismatch");
});

test("reviewed 필수 미확인 조건이 있으면 확인 필요 — K-디지털(내일배움카드), 유아학비(유치원 재원)", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const k = SM.classify(doc("149200005032", "K-디지털 트레이닝"), U({ employment: "취준생" }), TODAY);
  assert.equal(k.grade, "check");
  assert.ok(k.reasons.some((x) => /국민내일배움카드/.test(x.text)));
  const nuri = SM.classify(doc("000000465790", "유아학비"), U({ household: "kids", childAges: ["3-5"] }), TODAY);
  assert.equal(nuri.grade, "check");
  assert.ok(nuri.reasons.some((x) => x.kind === "match" && /자녀 연령대 일치/.test(x.text)));
  assert.ok(nuri.reasons.some((x) => x.kind === "unknown" && /유치원 재원/.test(x.text)));
  assert.equal(SM.classify(doc("000000465790", "유아학비"), U({ household: "kids", childAges: ["elem"] }), TODAY).grade, "mismatch");
});

test("conditionsComplete:false 이면 모든 조건이 맞아도 높음 불가", () => {
  const SM = engine();
  SM.setReviewed({ programs: [entry("T1", { age: { subject: "applicant", min: 19, max: 34, exceptions: [] } }), entry("T2", { conditionsComplete: false, age: { subject: "applicant", min: 19, max: 34, exceptions: [] } })] });
  assert.equal(SM.classify(doc("T1", "a"), U({ age: 25 }), TODAY).grade, "high");
  assert.equal(SM.classify(doc("T2", "b"), U({ age: 25 }), TODAY).grade, "check");
});

test("부산 청년 신용회복형: 나이·지역이 맞아도 입력받지 않는 채무 조건이 있으면 높음 불가, 공식 거주 요건 불일치는 제외", () => {
  const SM = engine();
  SM.setReviewed({ programs: [entry("T3", {
    age: { subject: "applicant", min: 18, max: 39, exceptions: [] },
    regions: { subject: "applicant", names: ["부산광역시"], level: "sido", hard: true },
    requiredUnknowns: ["채무·신용회복 상담 필요 여부"] })] });
  assert.equal(SM.classify(doc("T3", "청년 신용회복"), U({ age: 23, region: "부산광역시" }), TODAY).grade, "check");
  assert.equal(SM.classify(doc("T3", "청년 신용회복"), U({ age: 23, region: "서울특별시" }), TODAY).grade, "mismatch");
});

test("기관 소재지만 지역인 reviewed 사업은 지역 불일치로 제외하지 않는다 (정렬에서만 뒤로)", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const r = SM.classify(doc("305000000140", "저소득층 주거급여 지원", { targetRegions: ["서울특별시"] }), U({ region: "부산광역시" }), TODAY);
  assert.notEqual(r.grade, "mismatch");
  assert.equal(r.rank.region, 1);
  assert.ok(r.reasons.some((x) => /공식 거주요건 확인 필요/.test(x.text)));
});

test("여성 전용 reviewed: 선택하면 일치·순위 상승, 해당 없음이면 불일치, 높음은 다른 필수조건이 남아 불가", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const p = doc("138300000055", "경력보유여성 등 취업지원");
  const sel = SM.classify(p, U({ employment: "취준생", special: ["female"] }), TODAY);
  assert.equal(sel.grade, "check");
  assert.equal(sel.rank.special, 0);
  assert.equal(SM.classify(p, U({ special: [] }), TODAY).grade, "mismatch");
  assert.equal(SM.classify(p, U({ special: null }), TODAY).rank.special, 1);
});

test("안전 fallback: 검토 파일 없음(404)·파싱 실패·스키마 불일치여도 모든 사업은 unreviewed 안전 모드 — 높음 없음, 신청 종료 외 불일치 없음, 공격적 legacy 복귀 없음", () => {
  const SM = engine();
  const aggressive = doc("ZZ0000000010", "서울 청년 지원", { targetRegions: ["서울특별시"], checklist: ["서울 거주 만 19~34세 청년"], targetAge: { min: 19, max: 34 } });
  const strong = doc("ZZ0000000011", "대학생 아침밥", { checklist: ["전국 대학교에 재학 중인 학생"] });
  const u = U({ region: "부산광역시", age: 40, employment: "대학생", student: "enrolled" });
  const cases = { 로드전: () => SM.setReviewed(null), 스키마불일치: () => SM.setReviewed({ nope: 1 }), 빈배열: () => SM.setReviewed({ programs: [] }), 전부오류: () => SM.setReviewed({ programs: [{ programId: "X" }] }) };
  Object.keys(cases).forEach((name) => {
    cases[name]();
    const a = SM.classify(aggressive, u, TODAY), b = SM.classify(strong, U({ employment: "대학생", student: "enrolled", age: 22 }), TODAY);
    assert.notEqual(a.grade, "mismatch", name);        // 자동 추출 지역·연령만으로 제외하지 않는다
    assert.notEqual(b.grade, "high", name);
    assert.ok(a.reasons.some((x) => /공고 확인 필요/.test(x.text)), name);
    assert.equal(a.reviewed, null);
  });
  const closed = doc("ZZ0000000012", "청년 통장", { deadlineText: "2025.06.09~2025.06.20" });
  SM.setReviewed(null);
  assert.equal(SM.classify(closed, U(), TODAY).grade, "mismatch");
  assert.equal(SM.reviewedCount(), 0);
});

test("일부 항목만 잘못된 파일: 정상 항목은 reviewed로 쓰고 잘못된 항목만 unreviewed로 둔다 (중복 ID는 첫 항목만)", () => {
  const SM = engine();
  const v = SM.setReviewed({ programs: [entry("G1", { age: { subject: "applicant", min: 19, max: 34, exceptions: [] } }), entry("B1", { sourceUrl: "" }), entry("G1", { conditionsComplete: false })] });
  assert.equal(v.count, 1);
  assert.equal(v.errors.length, 2);
  assert.ok(SM.classify(doc("G1", "a"), U({ age: 25 }), TODAY).reviewed);
  const bad = SM.classify(doc("B1", "b", { checklist: ["만 19~34세"], targetAge: { min: 19, max: 34 } }), U({ age: 25 }), TODAY);
  assert.equal(bad.reviewed, null);
  assert.notEqual(bad.grade, "high");
});

test("index.html: 검토 파일·ids 요청이 실패해도 예외 없이 setReviewed(null)로 안전 모드를 유지한다 (소스 점검)", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const a = html.indexOf("function loadSubsidyReviewed()");
  const body = html.slice(a, html.indexOf("function subsidyTrustDateText"));
  assert.ok(/catch\(function\(\)\{\s*SM\.setReviewed\(null\)/.test(body), "파일 로드 실패 시 setReviewed(null)");
  assert.ok(/reviewed items[\s\S]*catch\(function\(\)\{\s*\/\*/.test(body), "ids 요청 실패는 무시");
  assert.ok(!/ids=.*(region|age|household|special|childAges|income)/.test(body), "ids 요청에 사용자 조건 없음");
});

test("정렬: 미선택 특수 자격 < 자동 불일치 < 다른 지역 기관 < reviewed 우선 < 일치 수", () => {
  const SM = engine();
  const r = (o) => ({ rank: Object.assign({ tier: 0, auto: 0, region: 0, matched: 1, special: 0, unknown: 1 }, o) });
  assert.ok(SM.compareFit(r({}), r({ special: 1 })) < 0);
  assert.ok(SM.compareFit(r({ tier: 1 }), r({ auto: 1, tier: 1 })) < 0);
  assert.ok(SM.compareFit(r({ tier: 1 }), r({ tier: 0, region: 1 })) < 0);
  assert.ok(SM.compareFit(r({ tier: 0, matched: 0 }), r({ tier: 1, matched: 3 })) < 0);
  assert.ok(SM.compareFit(r({ matched: 2 }), r({ matched: 1 })) < 0);
});

test("스포츠강좌형(수급·차상위·법정 한부모 필수): 신분을 답하지 않았으면 확인 필요, 해당 없음+자녀 가구는 불일치, 한부모 가구·수급 선택은 일치", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const p = doc("137100000006", "스포츠 강좌 이용권");
  const kids = { household: "kids", childAges: ["elem"] };
  assert.equal(SM.classify(p, U(Object.assign({ special: null }, kids)), TODAY).grade, "check");        // 신분 미응답
  assert.equal(SM.classify(p, U(Object.assign({ special: [] }, kids)), TODAY).grade, "mismatch");       // 해당 없음 + 자녀 가구(한부모 아님)
  assert.notEqual(SM.classify(p, U({ special: [], household: "singleParent", childAges: ["elem"] }), TODAY).grade, "mismatch");
  assert.notEqual(SM.classify(p, U({ special: ["lowIncome"], household: "kids", childAges: ["teen"] }), TODAY).grade, "mismatch");
  assert.equal(SM.classify(p, U({ special: ["lowIncome"], household: "kids", childAges: ["0-2"] }), TODAY).grade, "mismatch");   // 자녀 연령 불일치
  assert.notEqual(SM.classify(p, U({ special: [], household: "pregnant" }), TODAY).grade, "mismatch");
});

test("임산부 포함 사업은 1인 가구라는 이유만으로 제외하지 않고, 필요한 가구가 아니면 관련도 뒤로(gap)", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const mom = SM.classify(doc("138300000052", "청소년 미혼 한부모 자립지원"), U({ age: 22, household: "single" }), TODAY);
  assert.notEqual(mom.grade, "mismatch");
  assert.equal(mom.rank.gap, 1);
  const nut = SM.classify(doc("135200000005", "영양플러스"), U({ household: "couple" }), TODAY);
  assert.notEqual(nut.grade, "mismatch");
  assert.equal(SM.classify(doc("138300000052", "x"), U({ age: 22, household: "pregnant" }), TODAY).rank.gap, 0);
});

test("대상 직업군·상황이 다른 사업은 후순위(gap) — 사업명 하드코딩 없이 구조 필드로만 판단", () => {
  const SM = engine();
  SM.setReviewed(PAYLOAD);
  const worker = U({ employment: "재직자", age: 28 });
  const jobSeek = SM.classify(doc("174100000087", "청년성장프로젝트"), worker, TODAY);
  const goodFit = SM.classify(doc("161300000088", "청년주택드림 청약통장"), worker, TODAY);
  assert.equal(jobSeek.rank.gap, 1);
  assert.notEqual(jobSeek.grade, "mismatch");                      // 숨기지 않는다
  assert.ok(SM.compareFit(goodFit, jobSeek) < 0);
  const exam = SM.classify(doc("134200000014", "대학입학전형료"), U({ special: ["lowIncome"], employment: "취준생" }), TODAY);
  assert.equal(exam.rank.gap, 1);
  assert.notEqual(exam.grade, "mismatch");
  // 희망사다리Ⅱ(고졸 재직자): 서울 대학생에게는 숨기지 않되 후순위
  const ladder = SM.classify(doc("134200005001", "희망사다리Ⅱ"), U({ employment: "대학생", student: "enrolled" }), TODAY);
  assert.notEqual(ladder.grade, "mismatch");
  assert.equal(ladder.rank.gap, 1);
});

test("표시 문구: 검토 필드·화면에 '사람이 검토/검증 완료/공식 인증' 같은 오해 표현이 없다", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const trust = html.slice(html.indexOf("function subsidyTrustHtml"), html.indexOf("function subsidyTrustHtml") + 700);
  assert.match(trust, /공식 공고 기반 정리 · 기준일/);
  assert.match(trust, /공고 확인 필요 · 자동 판정/);
  assert.match(html, /공식 공고 내용을 바탕으로 조건을 정리한 참고 결과입니다\. 최종 자격은 신청 기관에서 확인해 주세요\./);
  [html, fs.readFileSync(path.join(ROOT, "js", "subsidy-match.js"), "utf8")].forEach((src) => {
    const m = src.match(/["'`][^"'`\n]*(사람이 검토|검증 완료|공식 인증|공식 조건 검토)[^"'`\n]*["'`]/g) || [];
    assert.deepEqual(m.filter((x) => !/^\s*["'`]\s*\/\//.test(x)), [], "오해 표현");
  });
});
