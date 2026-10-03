"use strict";
// 정규화 모듈(gov24Normalize) + eligibility v2 필드 테스트. 네트워크·DB 없이 실제 API 문구(발췌)로 검증한다.
const test = require("node:test");
const assert = require("node:assert/strict");
const N = require("../helpers/gov24Normalize");
const H = require("../helpers/gov24Eligibility");
const T = "2026-10-01";

test("신청기간: 실제 API에서 나온 날짜 형식을 모두 정규화한다", () => {
  const cases = [
    ["2026.05.04~2026.05.20", [{ start: "2026-05-04", end: "2026-05-20" }]],
    ["2026.02.25.~2026.06.30.", [{ start: "2026-02-25", end: "2026-06-30" }]],
    ["2026-05-04 ~ 2026-05-20", [{ start: "2026-05-04", end: "2026-05-20" }]],
    ["(2026년 2학기) (1차) 2026년 5월 22일~6월 22일 (2차) 2026년 8월 12일~ 9월 9일",
      [{ start: "2026-05-22", end: "2026-06-22" }, { start: "2026-08-12", end: "2026-09-09" }]],
    ["2025.12.20.~2026.1.10", [{ start: "2025-12-20", end: "2026-01-10" }]],     // 해를 넘기는 기간
    ["2026.5.4 ~ 5.20", [{ start: "2026-05-04", end: "2026-05-20" }]],
    ["~2026.12.31.", [{ start: null, end: "2026-12-31" }]],
    ["2026.1.1.~", [{ start: "2026-01-01", end: null }]],
    ["상시신청", []], ["매년 공고문 참고", []], ["-", []], ["", []], [null, []]
  ];
  cases.forEach(([text, want]) => assert.deepEqual(N.parseApplicationPeriods(text), want, String(text)));
  assert.deepEqual(N.parseApplicationPeriods("2026.13.40~2026.02.30"), []);       // 존재하지 않는 날짜는 버린다
});

test("신청상태: 종료·예정·진행·상시·중단 문구·불명을 구분한다", () => {
  const st = (dl, extra) => N.deriveApplicationStatus(dl, extra || [], T);
  assert.equal(st(["2026.05.04~2026.05.20"]).state, "closed");
  assert.equal(st(["2026.05.04~2026.05.20"]).endDate, "2026-05-20");
  assert.equal(st(["(1차) 2026년 5월 22일~6월 22일 (2차) 2026년 8월 12일~ 9월 9일"]).state, "closed");
  assert.equal(st(["2026.09.01~2026.10.31"]).state, "open");
  assert.equal(st(["2026.11.01~2026.11.30"]).state, "upcoming");
  assert.equal(st(["상시신청"]).state, "open");
  assert.equal(st(["-"]).state, "unknown");
  assert.equal(st(["매년 공고문 참고"]).state, "unknown");
  // 매년 반복되는 사업의 지난 접수기간은 "종료"로 단정하지 않는다
  assert.equal(st(["매년 3월 접수 (2025.03.01~2025.03.31)"]).state, "unknown");
  // 신청기한이 '-'이고 신청방법에 중단 문구가 있는 경우 (청년내일채움공제 실데이터)
  const stopped = st(["-"], ["* '24년부터 신규지원 중단"]);
  assert.equal(stopped.state, "discontinued");
  assert.match(stopped.evidence, /신규지원 중단/);
  // 일반적인 "종료" 단어(사업 종료 후 정산 등)는 중단으로 보지 않는다
  assert.notEqual(st(["상시신청"], ["지원 종료 후 3개월 이내 정산"]).state, "discontinued");
  // 현재 접수 중인데 한 회차가 마감된 경우: 중단·종료가 아니다
  const rounds = st(["신규계약: (상) 1월 (하) 7월 -모집완료 / 갱신계약: 3,5,7,9,11월 1일~10일"]);
  assert.notEqual(rounds.state, "discontinued");
  assert.notEqual(rounds.state, "closed");
});

test("대상/제외/우대 분리: 괄호 제외·제외 머리말·우대 블록·유형 정의 문장", () => {
  // 서울 청년수당: 괄호로 붙은 제외 문구는 제외 항목으로 분리된다
  let r = N.splitClauses("서울시 거주 만 19~34세 미취업 청년\n(생계, 의료, 주거, 교육급여자 및 차상위계층 제외)");
  assert.deepEqual(r.core, ["서울시 거주 만 19~34세 미취업 청년"]);
  assert.equal(r.exclusions.length, 1);
  assert.match(r.exclusions[0], /차상위계층 제외/);
  // 국민내일배움카드: "지원 제외 대상" 머리말 아래 항목은 제외 — 만 75세 이상이 대상 연령으로 새지 않는다
  r = N.splitClauses("국민 누구나\n지원 제외 대상\n① 공무원, 사립학교 교직원\n⑥ 만 75세 이상자 등");
  assert.deepEqual(r.core, ["국민 누구나"]);
  assert.equal(r.exclusions.length, 3);
  assert.equal(N.extractAgeInfo(r.core, r.core.concat(r.exclusions), 0).textRanges.length, 0);
  // 일반 문장 안의 "수급자 제외"는 머리말이 아니므로 뒤 줄을 삼키지 않는다
  r = N.splitClauses("수급자 제외\n서울 거주 청년\n만 19세 이상");
  assert.equal(r.exclusions.length, 1);
  assert.equal(r.core.length, 2);
  // 우대형 블록: 필수 자격이 아니라 우대 조건
  r = N.splitClauses("월세 계약자\n[우대형]\n취업준비생(만 35세 이하)\n희망키움통장 가입자\n부부합산 연소득 5천만원 이하자 중 상기 [우대형]에 해당되지 않는 자");
  assert.deepEqual(r.core, ["월세 계약자"]);
  assert.ok(r.preferences.length >= 3);
  // 유형 정의 문장("I유형에 해당하지 않는 …")은 제외로 오분류하지 않는다
  r = N.splitClauses("II유형: 15세~69세 구직자 중 I유형에 해당하지 않는 가구단위 중위소득 100% 이하");
  assert.equal(r.exclusions.length, 0);
  assert.equal(r.core.length, 1);
  assert.equal(r.tiers.length >= 1, true);
});

test("소득 기준: 유형·금액·복수 퍼센트가 섞이면 하나의 기준으로 합치지 않는다(varies)", () => {
  const one = N.extractIncome(["기준 중위소득 50% 이하"], 0);
  assert.deepEqual(one.percents, [50]);
  assert.equal(one.varies, false);
  const multi = N.extractIncome(["I유형 중위소득 60% 이하", "II유형 가구 중위소득 100% 이하(청년은 소득 무관)"], 2);
  assert.deepEqual(multi.percents, [60, 100]);
  assert.equal(multi.varies, true);
  const mixed = N.extractIncome(["부부합산 연소득 5천만원 이하", "중위소득 150% 이하"], 0);
  assert.equal(mixed.varies, true);
  assert.equal(N.extractIncome([], 0).varies, false);
});

test("연령: 본문 연령 범위·병역/출생연도 예외·유형별 연령을 원문 그대로 보존한다", () => {
  let a = N.extractAgeInfo(["대구시 거주 19세~39세 근로청년"], ["대구시 거주 19세~39세 근로청년"], 0);
  assert.deepEqual(a.bounds, { min: 19, max: 39 });
  assert.equal(a.multiple, false);
  // 병역기간 인정
  const mil = "연령 : 19세이상 ~ 34세이하(단, 병역기간 최대 6년 인정)";
  a = N.extractAgeInfo([mil], [mil], 0);
  assert.deepEqual(a.bounds, { min: 19, max: 34 });
  assert.equal(a.exceptions.length, 1);
  // 출생연도
  const birth = "19세~20세 청년(2006~2007년 출생자)";
  a = N.extractAgeInfo([birth], [birth], 0);
  assert.deepEqual(a.birthYears, { from: 2006, to: 2007 });
  // 군 복무 포함 39세까지
  const army = "만 15~34세(군 복무기간 포함 39세까지) 정규직 신규 취업자";
  a = N.extractAgeInfo([army], [army], 0);
  assert.equal(a.exceptions.length, 1);
  // 유형별로 연령이 다르면 합집합 경계 + tiered
  a = N.extractAgeInfo(["15세~69세 구직자", "15~34세 청년은"], [], 2);
  assert.deepEqual(a.bounds, { min: 15, max: 69 });
  assert.equal(a.tiered, true);
  // 한쪽만 있는 문구(만 30세 이상)는 경계로 쓰지 않는다
  a = N.extractAgeInfo(["청년(만 19~34세)", "기혼, 만 30세 이상 등의 사유로"], [], 0);
  assert.deepEqual(a.bounds, { min: 19, max: 34 });
});

test("지역: 당진·천안은 충청남도, 제천은 충청북도, 광주·전남은 통합특별시(별칭 포함), 광주시≠광주광역시", () => {
  const r = (name, type) => H.inferRegionName({ "소관기관명": name, "소관기관유형": type || "기초자치단체" });
  assert.equal(r("충청남도 당진시").regionName, "충청남도");
  assert.equal(r("충청남도 천안시").regionName, "충청남도");
  assert.equal(r("충청북도 제천시").regionName, "충청북도");
  assert.equal(r("전남광주통합특별시 광양시").regionName, "전남광주통합특별시");
  assert.equal(r("전남광주통합특별시").regionName, "전남광주통합특별시");
  assert.equal(r("광주광역시 광산구").regionName, "광주광역시");
  assert.equal(r("전라남도 순천시").regionName, "전라남도");
  assert.equal(r("경기도 광주시").regionName, "경기도");
  assert.equal(r("한국주택금융공사", "공공기관").regionName, "전국");
  assert.deepEqual(N.regionMatchNames("충청남도"), ["충청남도"]);
  assert.deepEqual(N.regionMatchNames("전남광주통합특별시"), ["전남광주통합특별시", "광주광역시", "전라남도"]);
  assert.deepEqual(N.regionMatchNames("전국"), ["전국"]);
  assert.deepEqual(N.regionMatchNames("unknown"), []);
  const a = N.regionMatchNames("충청남도"), b = N.regionMatchNames("충청북도");
  assert.equal(a.some((x) => b.indexOf(x) !== -1), false);
});

function sampleRow(over) {
  return Object.assign({
    "서비스ID": "T1", "서비스명": "테스트 청년 지원", "사용자구분": "개인", "소관기관명": "충청남도 당진시",
    "소관기관유형": "기초자치단체", "소관기관코드": "4570000", "신청기한": "-", "수정일시": "20260501000000",
    "상세조회URL": "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/T1"
  }, over || {});
}

test("buildEligibility(v2): 파생 필드가 생기고 원문은 그대로이며 검증을 통과한다", () => {
  const row = sampleRow({ "지원대상": "만 18~34세 청년\n(수급자 제외)", "선정기준": "중위소득 100% 이하" });
  const detail = { "지원대상": "만 18~34세 청년\n(수급자 제외)", "선정기준": "중위소득 100% 이하", "신청방법": "* 2025년부터 신규접수 종료", "신청기한": "-" };
  const e = H.buildEligibility(row, detail, { JA0110: 18, JA0111: 34 }, { detail: "ok", conditions: "ok" }, new Date("2026-10-01T00:00:00Z"), {});
  assert.equal(e.schemaVersion, 2);
  assert.deepEqual(H.validateEligibility(e), []);
  assert.match(e.targetText, /수급자 제외/);                        // 원문 보존
  assert.deepEqual(e.exclusions, ["수급자 제외"]);
  assert.equal(e.applicationStatus.state, "discontinued");          // 신청방법의 종료 문구
  assert.equal(e.applicationStatus.checkedOn, "2026-10-01");
  assert.deepEqual(e.regionNames, ["충청남도"]);
  assert.deepEqual(e.income.percents, [100]);
  assert.deepEqual(e.ageInfo.bounds, { min: 18, max: 34 });
  assert.deepEqual(e.ageRange, { min: 18, max: 34 });                // v1 필드 유지
});

test("v2를 추가해도 legacy 필드(targetRegions 포함)는 기존 동작 그대로이고 새 지역 필드만 정확하다", () => {
  const row = sampleRow({ "지원대상": "청년" });
  const doc = H.buildStagingDoc(row, null, null, { detail: "empty", conditions: "empty" }, new Date("2026-10-01T00:00:00Z"), {});
  assert.deepEqual(doc.targetRegions, [H.legacyInferRegion(row)]);
  assert.equal(doc.eligibility.regionName, "충청남도");
  assert.equal(doc.source, "gov24");
});

test("runStagingSync onlyIds: 지정한 ID만 수집하고 목록에 없는 ID는 보고한다", async () => {
  const rows = [sampleRow({ "서비스ID": "A" }), sampleRow({ "서비스ID": "B" }), sampleRow({ "서비스ID": "C" })];
  const api = {
    list: async () => ({ data: rows, totalCount: 3, matchCount: 3 }),
    detail: async () => null, conditions: async () => null
  };
  const out = await H.runStagingSync({ api, write: false, onlyIds: ["B", "Z"], secrets: [] });
  assert.deepEqual(out.docs.map((d) => d.id), ["B"]);
  assert.deepEqual(out.summary.selection.missingIds, ["Z"]);
  assert.equal(out.summary.written, 0);
});
