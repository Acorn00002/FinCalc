"use strict";
// v2(eligibility) 전용 규칙: 대상 문장(targetClauses)에 근거한 재학생 판정, 신청자·부모 지역 조건(regionRequirement).
// 원문 → 정규화(gov24Normalize) → 엔진(js/subsidy-match.js) 순서로 실제 경로를 그대로 탄다.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const N = require("../helpers/gov24Normalize");

const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "subsidy-match.js"), "utf8"), sandbox);
const SM = sandbox.self.SubsidyMatch;
const TODAY = "2026-10-03";

let seq = 0;
// 공식 원문(대상·선정기준)에서 v2 문서를 만든다.
function doc(title, o) {
  seq += 1;
  const targetText = o.target || "", selectionText = o.selection || "";
  const regionName = o.regionName || "전국";
  const names = N.regionMatchNames(regionName);
  const derived = N.deriveEligibilityFields({ targetText, selectionText, deadlineList: o.deadline || "상시신청", deadlineDetail: "", applyMethod: "" }, TODAY);
  return {
    id: "W" + seq, title, summary: o.summary || title, category: "고용·창업", benefits: "", deadlineText: o.deadline || "상시신청", endDate: null,
    checklist: [], targetAge: o.age || { min: 0, max: 99 }, targetRegions: [regionName], targetEmployment: [],
    eligibility: {
      schemaVersion: 2, audienceType: "individual", coreText: derived.coreText, coreStats: derived.coreStats, exclusions: derived.exclusions, preferences: derived.preferences,
      income: derived.income, ageInfo: derived.age, applicationStatus: derived.applicationStatus,
      regionName, regionNames: names, orgName: o.orgName || regionName,
      targetClauses: o.noClauses ? undefined : N.extractTargetClauses(targetText, selectionText),
      regionRequirement: o.noRegionReq ? undefined : N.extractRegionRequirement(targetText, selectionText, regionName, names)
    }
  };
}
const U = (o) => Object.assign({ age: 24, region: "서울특별시", employment: "취준생", student: "", income: "", household: "", housing: "", special: null, applyStatus: "" }, o || {});
const grade = (p, u) => SM.classifyAuto(p, u, TODAY).grade;
const has = (p, u, kind, re) => SM.classifyAuto(p, u, TODAY).reasons.some((r) => r.kind === kind && re.test(r.text));

const LOAN = () => doc("일반 상환 학자금 특별상환유예대출", {
  summary: "경제적 곤란 사유가 발생한 일반 상환 학자금대출자의 원리금 상환을 일정기간 유예",
  target: "○ 지원대상\n - 기본 자격요건을 모두 충족하고, 추가 자격요건을 1개 이상 충족한 자\n\n○ 기본 자격요건\n 1. 신청일 기준 만 35세 이하\n 2. 학부 또는 대학원 졸업생\n ※ 단, 학부를 졸업한 대학원생은 신청 가능\n 3. 일반 상환 학자금대출 잔액 보유자\n ※ 학점은행제 학습자 학자금대출자는 제외"
});
const BUILDER = () => doc("건설노동자 대부금 지원", {
  summary: "건설노동자의 생활안정 대부금 지원",
  target: "퇴직공제 적립일수 252일 이상인 건설노동자가 공제회가 정한 대부금 신청사유(7가지)*에 해당하는 경우\n * 본인 또는 자녀 결혼자금, 대학생 자녀 학자금, 본인 또는 가족의 입원·수술비"
});
const SCHOLAR = () => doc("천원의 아침밥", { summary: "대학생에게 천원 아침식사 지원", target: "전국 대학교에 재학 중인 학생" });

test("학자금대출·건설노동자 사업은 '재학 중 아님'만으로 불일치가 되지 않는다", () => {
  const u = U({ student: "notEnrolled", employment: "취준생", age: 29 });
  assert.notEqual(grade(LOAN(), u), "mismatch");
  assert.notEqual(grade(BUILDER(), u), "mismatch");
  assert.ok(!has(LOAN(), u, "mismatch", /재학생/));
  assert.ok(!has(BUILDER(), u, "mismatch", /재학생/));
  assert.equal(grade(LOAN(), U({ age: 40 })), "mismatch");                       // 숫자 연령(만 35세 이하)은 그대로 적용
});

test("명백한 재학생 전용 사업은 '재학 중 아님'이면 불일치, 재학이라고 답하면 일치", () => {
  const u = U({ student: "notEnrolled", employment: "취준생" });
  assert.equal(grade(SCHOLAR(), u), "mismatch");
  assert.equal(grade(SCHOLAR(), U({ student: "enrolled", employment: "대학생" })), "high");
});

test("대학생 자녀 학비 지원은 신청자 본인의 재학 조건으로 읽지 않는다", () => {
  const p = doc("자녀 학비 지원", { summary: "대학생 자녀의 등록금을 지원", target: "대학생 자녀를 둔 근로자 가구" });
  assert.notEqual(grade(p, U({ student: "notEnrolled" })), "mismatch");
});

test("targetClauses가 없는 v2 문서는 본문 전체를 대상 문장으로 읽지 않는다 (보수적 fallback)", () => {
  const p = doc("건설노동자 대부금 지원", { summary: "건설노동자 대부금", target: "건설노동자가 대학생 자녀 학자금 사유에 해당하는 경우", noClauses: true });
  assert.notEqual(grade(p, U({ student: "notEnrolled" })), "mismatch");
});

const GANGWON = "강원특별자치도";
const OR_TEXT = "○ 지원대상\n - 본인 또는 부모 중 1명이, 사업공고일 기준 주민등록상 강원특별자치도에 1년 이상 계속 거주\n - 재(휴)학생 및 수료·졸업 후 10년 이내 미취업자";
const AND_TEXT = "○ 지원대상\n - 본인과 부모 모두 사업공고일 기준 강원특별자치도에 1년 이상 거주하는 자";
const SELF_TEXT = "○ 지원대상\n - 신청일 현재 본인이 강원특별자치도에 6개월 이상 거주하는 청년";
const SCHOOL_TEXT = "○ 지원대상\n - 소재지가 강원특별자치도인 대학에 재학 중인 학생(학교 소재지 기준)";

test("본인 또는 부모 거주 조건: 본인 지역 일치=지역 일치, 타 지역=확인 필요(불일치 아님)", () => {
  const p = doc("강원 학자금 이자지원", { regionName: GANGWON, target: OR_TEXT });
  assert.equal(p.eligibility.regionRequirement.subject, "applicant_or_parent");
  assert.ok(p.eligibility.regionRequirement.raw.indexOf("본인 또는 부모") !== -1);          // 원문 보존
  assert.notEqual(grade(p, U({ region: "서울특별시" })), "mismatch");
  assert.ok(has(p, U({ region: "서울특별시" }), "unknown", /부모 거주지 확인 필요/));
  assert.ok(has(p, U({ region: GANGWON }), "match", /거주 지역 일치/));
  assert.notEqual(grade(p, U({ region: GANGWON })), "high");                                    // 학적·미취업 등 미확인
});

test("본인과 부모 모두 거주 조건: 타 지역=불일치, 본인 일치+부모 미확인=확인 필요", () => {
  const p = doc("강원 가족 거주 지원", { regionName: GANGWON, target: AND_TEXT });
  assert.equal(p.eligibility.regionRequirement.subject, "applicant_and_parent");
  assert.equal(grade(p, U({ region: "서울특별시" })), "mismatch");
  const r = SM.classifyAuto(p, U({ region: GANGWON }), TODAY);
  assert.equal(r.grade, "check");
  assert.ok(r.reasons.some((x) => x.kind === "unknown" && /부모의 거주지/.test(x.text)));
});

test("본인 거주가 명시된 사업은 기존처럼 본인 지역 불일치", () => {
  const p = doc("강원 청년 지원", { regionName: GANGWON, target: SELF_TEXT });
  assert.equal(p.eligibility.regionRequirement.subject, "applicant");
  assert.equal(grade(p, U({ region: "서울특별시" })), "mismatch");
  assert.notEqual(grade(p, U({ region: GANGWON })), "mismatch");
});

test("학교 소재지 문구는 사용자 거주지 조건으로 오인하지 않는다", () => {
  const p = doc("강원 대학 재학생 지원", { regionName: GANGWON, target: SCHOOL_TEXT });
  assert.equal(p.eligibility.regionRequirement.subject, "school");
  assert.notEqual(grade(p, U({ region: "서울특별시" })), "mismatch");
  assert.ok(has(p, U({ region: "서울특별시" }), "unknown", /학교·기관 소재지/));
});

test("regionRequirement가 없는 v2 문서는 기존 지역 판정(본인 지역)을 유지하고 충남/충북·통합특별시 별칭도 그대로다", () => {
  const p = doc("강원 청년 지원", { regionName: GANGWON, target: "강원도 청년", noRegionReq: true });
  assert.equal(grade(p, U({ region: "서울특별시" })), "mismatch");
  const cn = doc("충남 청년", { regionName: "충청남도", target: "충남 거주 청년" });
  assert.equal(grade(cn, U({ region: "충청북도" })), "mismatch");
  assert.notEqual(grade(cn, U({ region: "충청남도" })), "mismatch");
  const gj = doc("광주전남 청년", { regionName: "전남광주통합특별시", target: "광주·전남 거주 청년" });
  ["광주광역시", "전라남도", "전남광주통합특별시"].forEach((r) => assert.notEqual(grade(gj, U({ region: r })), "mismatch", r));
});

test("정규화 필드: targetClauses는 주석·제외·머리말을 빼고, 원문은 보존된다", () => {
  const clauses = N.extractTargetClauses(LOAN().eligibility.coreText ? "○ 지원대상\n - 한 줄 대상 자격\n ※ 단, 예외 사항 안내\n - 제외 대상은 신청 불가" : "", "");
  assert.deepEqual(clauses, ["한 줄 대상 자격"]);
  assert.deepEqual(N.extractRegionRequirement("서울 청년", "", "서울특별시", ["서울특별시"]), { subject: "unknown", regions: ["서울특별시"], raw: "" });
});
