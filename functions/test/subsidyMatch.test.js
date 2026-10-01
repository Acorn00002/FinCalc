"use strict";
// 정부지원금 적합도 엔진(js/subsidy-match.js, 안전 모드) 규칙 테스트. 네트워크·DB 없음.
// 문서는 보조금24 원문 발췌를 흉내 낸 객체를 직접 만든다(eligibility v2 / 기존 필드만 있는 legacy 두 가지).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// js/subsidy-match.js는 브라우저용 파일(루트 package.json이 ESM)이라 vm 샌드박스에서 불러온다.
const sandbox = { self: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "..", "js", "subsidy-match.js"), "utf8"), sandbox);
const SM = sandbox.self.SubsidyMatch;
const TODAY = "2026-10-01";

let seq = 0;
// eligibility v2 문서
function v2(title, o) {
  o = o || {};
  seq += 1;
  const regionName = o.regionName || "전국";
  return {
    id: "V" + seq, title: title, summary: o.summary || title, category: "고용·창업", benefits: o.benefits || "",
    deadlineText: o.deadline || "상시신청", endDate: null, checklist: [], targetAge: o.age || { min: 0, max: 99 },
    targetRegions: [regionName], targetEmployment: [],
    eligibility: {
      schemaVersion: 2, audienceType: o.audience || "individual", coreText: o.core || "", exclusions: o.excl || [], preferences: o.pref || [],
      income: o.income || { rules: [], percents: [], varies: false, hasAmount: false },
      ageInfo: o.ageInfo || { textRanges: [], exceptions: [], tiered: false, birthYears: null },
      applicationStatus: o.status || { state: "open", reason: "always-open", periods: [] },
      regionName: regionName, regionNames: regionName === "전국" ? ["전국"] : (o.regionNames || [regionName]), orgName: o.orgName || regionName,
      coreStats: { clauses: 1, personClauses: o.personClauses || 0 }
    }
  };
}
// 기존 필드만 있는 문서(현재 Production supportPrograms와 같은 모양)
function legacy(title, o) {
  o = o || {};
  seq += 1;
  return {
    id: "L" + seq, title: title, summary: o.summary || title, category: "고용·창업", benefits: o.benefits || "", deadlineText: o.deadline || "상시신청",
    endDate: null, checklist: o.checklist || [], targetAge: o.age || { min: 0, max: 99 }, targetRegions: o.regions || ["전국"], targetEmployment: [], source: "gov24"
  };
}
const grade = (p, u) => SM.classify(p, u, TODAY).grade;
const texts = (p, u) => SM.classify(p, u, TODAY).reasons.map((r) => r.kind + ":" + r.text);
const U = (o) => Object.assign({ age: 24, region: "서울특별시", employment: "취준생", student: "", income: "", household: "", housing: "", special: null, applyStatus: "" }, o || {});
const RANGE = (min, max) => ({ textRanges: [{ min: min, max: max }], exceptions: [], tiered: false, birthYears: null });

test("소득·주거·학적·직업 조건이 미확인이면 높은 적합도로 올리지 않는다", () => {
  const p = v2("청년 취업 지원", { age: { min: 19, max: 34 }, core: "만 19~34세 구직 청년 기준 중위소득 100% 이하", ageInfo: RANGE(19, 34), income: { rules: ["기준 중위소득 100% 이하"], percents: [100], varies: false } });
  assert.equal(grade(p, U({ income: "" })), "check");
  assert.equal(grade(p, U({ income: "150" })), "check");                     // 입력 구간이 기준을 넘어도 제외하지 않고 확인 필요
  assert.equal(grade(p, U({ income: "50" })), "high");                       // 모두 확인되면 높음
  const noReq = v2("청년 마음건강 상담", { age: { min: 19, max: 34 }, core: "만 19~34세 청년", ageInfo: RANGE(19, 34) });
  assert.equal(grade(noReq, U()), "high");                                   // 요구 조건이 연령뿐이면 확인된 것
});

test("재학생 대상 사업: 재학이라고 답하면 일치, '재학 중 아님'일 때만 충돌, 그 외는 확인 필요", () => {
  const p = v2("천원의 아침밥", { core: "전국 대학교에 재학 중인 학생" });
  assert.equal(grade(p, U({ employment: "대학생" })), "high");
  assert.equal(grade(p, U({ employment: "재직자", student: "enrolled" })), "high");        // 일하는 대학(원)생
  assert.equal(grade(p, U({ employment: "재직자", student: "notEnrolled" })), "mismatch");
  assert.equal(grade(p, U({ employment: "취준생", student: "notEnrolled" })), "mismatch");
  assert.equal(grade(p, U({ employment: "재직자" })), "check");              // 답하지 않은 조건은 불일치가 아니다
  assert.equal(grade(p, U({ employment: "" })), "check");
  assert.ok(texts(p, U({ employment: "재직자" })).some((t) => /재학 여부 확인 필요/.test(t)));
});

test("'학자금' 같은 단어만으로 재학생 전용으로 단정하지 않는다 (학자금대출 연체자 사업)", () => {
  const p = v2("청년 학자금대출 장기연체자 신용회복 지원", { core: "1년 이상 거주한 만 19~39세 청년으로 학자금대출 장기연체자", age: { min: 19, max: 39 }, ageInfo: RANGE(19, 39), regionName: "경기도", orgName: "경기도 군포시" });
  ["취준생", "재직자", "무직", "자영업자"].forEach((e) => assert.notEqual(grade(p, U({ employment: e, region: "경기도" })), "mismatch", e));
  assert.notEqual(grade(p, U({ employment: "취준생", region: "경기도" })), "high");
});

test("제목의 전세·월세 단어만으로 현재 거주 상태를 단정해 제외하지 않는다", () => {
  const p = v2("버팀목 전세자금대출", { age: { min: 19, max: 99 }, core: "만 19세 이상 세대주 무주택자 부부합산 연 소득 5천만원 이하", income: { rules: ["연 소득 5천만원 이하"], percents: [], varies: true, hasAmount: true } });
  ["monthly", "family", "owner", "jeonse", ""].forEach((h) => assert.notEqual(grade(p, U({ housing: h, age: 28 })), "mismatch", h));
  assert.notEqual(grade(p, U({ housing: "jeonse", income: "50", age: 28 })), "high");
});

test("사업자 단어가 제목에 있어도 사용자구분이 개인이면 개인 사업으로 분류한다", () => {
  assert.equal(SM.classify(v2("소상공인 출신 청년 재도전 지원", { core: "만 19~39세 청년" }), U(), TODAY).audience, "personal");
  assert.equal(SM.classify(v2("소상공인 경영안정 자금", { audience: "business" }), U(), TODAY).audience, "business");
});

test("선정기준의 제외 문구는 대상 문구와 분리된다 (수급자 제외 ≠ 수급자 대상)", () => {
  const p = v2("서울 청년수당", { regionName: "서울특별시", age: { min: 19, max: 34 }, core: "서울시 거주 만 19~34세 미취업 청년", ageInfo: RANGE(19, 34), excl: ["생계, 의료, 주거, 교육급여자 및 차상위계층 제외"] });
  assert.notEqual(grade(p, U({ special: [], income: "100" })), "mismatch");
  assert.equal(texts(p, U({ special: [], income: "100" })).some((t) => /취약계층 대상 사업/.test(t)), false);
  assert.equal(grade(p, U({ special: ["lowIncome"] })), "mismatch");          // 공식 제외 대상에 명시된 신분
  // 기존 필드만 있는 문서에서도 괄호 제외 문구는 대상으로 읽히지 않는다
  const l = legacy("서울 청년 지원", { regions: ["서울특별시"], age: { min: 19, max: 34 }, checklist: ["서울 거주 만 19~34세 청년 (기초수급자 제외)"] });
  assert.notEqual(grade(l, U({ special: [] })), "mismatch");
});

test("택일로 나열한 신분은 전용 대상으로 오인하지 않는다 (청년도전지원사업형)", () => {
  const checklist = ["구직단념청년(6개월 이상 취업·교육 이력 없음, 만18~34세), 자립준비청년, 청소년복지시설 입·퇴소 청년, 북한이탈청년, 지역특화청년"];
  const l = legacy("청년도전지원사업", { age: { min: 18, max: 34 }, checklist: checklist });
  assert.notEqual(grade(l, U({ age: 25, special: [] })), "mismatch");          // "해당 없음" 응답이어도 제외하지 않는다
  assert.notEqual(grade(l, U({ age: 25, special: ["careLeaver"] })), "high");  // 나열 사업은 높은 적합도가 아니다
  const e = v2("청년도전지원사업", { age: { min: 18, max: 34 }, core: checklist[0], ageInfo: RANGE(18, 34) });
  assert.notEqual(grade(e, U({ age: 25, special: [] })), "mismatch");
  // 제목이 장애·보훈·기초수급처럼 정의가 분명한 신분을 직접 가리키면 전용 대상이다. 보호종료·피해·다문화처럼 범위가 모호한 신분은 제외하지 않고 확인 필요로 둔다.
  const titled = legacy("등록장애인 자립수당", { age: { min: 18, max: 64 }, checklist: ["등록장애인 만 18~64세"] });
  assert.equal(grade(titled, U({ age: 22, special: [] })), "mismatch");
  const careTitled = legacy("자립준비청년 자립수당", { age: { min: 18, max: 24 }, checklist: ["보호종료 5년 이내 만 18~24세"] });
  assert.equal(grade(careTitled, U({ age: 22, special: [] })), "check");
});

test("신분 일치만으로는 세부 요건(중증·전역예정 등)을 알 수 없어 높은 적합도가 되지 않는다", () => {
  const p = v2("중증장애인 자산형성지원", { age: { min: 15, max: 39 }, core: "만 15~39세 중증장애인", ageInfo: RANGE(15, 39) });
  assert.notEqual(grade(p, U({ age: 30, special: ["disability"] })), "high");
  assert.equal(grade(p, U({ age: 30, special: [] })), "mismatch");             // 장애인 전용 + "해당 없음"
  assert.equal(grade(p, U({ age: 30, special: null })), "check");              // 답하지 않으면 확인 필요
});

test("유형별 소득 기준을 하나의 기준으로 오인하지 않는다 (국민취업지원제도형)", () => {
  const p = v2("국민취업지원제도", { age: { min: 15, max: 70 }, core: "I유형 15세~69세 구직자 중 중위소득 60% 이하 II유형 중위소득 100% 이하(청년은 소득 무관)", ageInfo: RANGE(15, 69),
    income: { rules: ["중위소득 60% 이하", "중위소득 100% 이하(청년은 소득 무관)"], percents: [60, 100], varies: true } });
  ["50", "100", "150", "over"].forEach((b) => assert.notEqual(grade(p, U({ age: 28, income: b, employment: "재직자" })), "mismatch", b));
  assert.notEqual(grade(p, U({ age: 28, income: "50" })), "high");
});

test("연령: 공식 문구가 우선하고, 문구가 말하지 않은 쪽 구조화 경계는 제외 근거로 쓰지 않는다", () => {
  // 청년장병형: 공식 "34세 이하", 등록된 하한은 20 → 19세를 제외하지 않는다
  const army = v2("청년장병 취업상담", { age: { min: 20, max: 34 }, core: "34세 이하 전역예정간부", ageInfo: RANGE(null, 34) });
  assert.notEqual(grade(army, U({ age: 19 })), "mismatch");
  assert.equal(grade(army, U({ age: 40 })), "mismatch");                       // 문구가 말한 상한은 그대로 적용
  // 구조화 34 vs 본문 39: 본문 우선
  const text = v2("지역 청년 적금", { age: { min: 19, max: 34 }, core: "19세~39세 근로 청년", ageInfo: RANGE(19, 39) });
  assert.notEqual(grade(text, U({ age: 37 })), "mismatch");
  assert.equal(grade(text, U({ age: 41 })), "mismatch");
  // 기존 필드만 있는 문서도 선정기준 문구에서 연령을 읽는다
  const l = legacy("청년희망적금", { age: { min: 19, max: 34 }, checklist: ["대구시 거주 19세~39세 근로청년"], regions: ["대구광역시"] });
  assert.notEqual(grade(l, U({ age: 37, region: "대구광역시" })), "mismatch");
  // 병역 인정·군 복무 포함·출생연도
  const mil = v2("청년 주택드림 청약통장", { age: { min: 19, max: 34 }, core: "연령 : 19세이상 ~ 34세이하(단, 병역기간 최대 6년 인정)", ageInfo: { textRanges: [{ min: 19, max: 34 }], exceptions: ["단, 병역기간 최대 6년 인정"], tiered: false, birthYears: null } });
  assert.equal(grade(mil, U({ age: 36 })), "check");
  assert.equal(grade(mil, U({ age: 45 })), "mismatch");
  const plain = v2("청년 일경험", { age: { min: 15, max: 34 }, core: "만 15~34세 청년", ageInfo: RANGE(15, 34) });
  assert.equal(grade(plain, U({ age: 36 })), "mismatch");
  const birth = v2("청년 문화예술패스", { age: { min: 19, max: 20 }, core: "2006~2007년 출생자", ageInfo: { textRanges: [], exceptions: [], tiered: false, birthYears: { from: 2006, to: 2007 } } });
  assert.notEqual(grade(birth, U({ age: 19 })), "mismatch");
  assert.equal(grade(birth, U({ age: 28 })), "mismatch");
});

test("신청 상태: 종료·중단은 기본에서 불일치(높음 불가), 상시·진행·예정을 구분한다", () => {
  const mk = (deadline, extra) => legacy("청년 사업", Object.assign({ age: { min: 19, max: 34 }, deadline: deadline }, extra || {}));
  const st = (p) => SM.applicationStatusOf(p, TODAY);
  assert.equal(st(mk("2026.05.04~2026.05.20")).state, "closed");
  assert.equal(st(mk("(1차) 2026년 5월 22일~6월 22일 (2차) 2026년 8월 12일~ 9월 9일")).state, "closed");
  assert.equal(st(mk("2026.09.01~2026.10.31")).state, "open");
  assert.equal(st(mk("2026.11.01~2026.11.30")).state, "upcoming");
  assert.deepEqual([st(mk("상시신청")).state, st(mk("상시신청")).always], ["open", true]);
  assert.equal(st(mk("매년 공고문 참고")).state, "unknown");
  assert.equal(st(mk("-", { checklist: ["* '24년부터 신규지원 중단"] })).state, "discontinued");
  assert.equal(grade(mk("2026.05.04~2026.05.20"), U()), "mismatch");
  assert.equal(grade(mk("-", { checklist: ["* '24년부터 신규지원 중단"] }), U()), "mismatch");
  assert.equal(grade(mk("상시신청"), U({ age: 25 })), "high");
  assert.notEqual(grade(mk("2026.11.01~2026.11.30"), U()), "mismatch");
  assert.equal(SM.classify(mk("2026.05.04~2026.05.20"), U(), TODAY).applyState, "closed");
});

test("신청 상태 선택 필터: 선택과 명백히 다른 사업만 불일치, 상태를 알 수 없으면 확인 필요, 종료 사업은 높음 불가", () => {
  const A = "만 19~34세 청년";                 // 연령 코드가 사업 문구로 뒷받침되어야 연령이 확인된 것으로 본다
  const open = legacy("진행 사업", { age: { min: 19, max: 34 }, checklist: [A], deadline: "2026.09.01~2026.10.31" });
  const always = legacy("상시 사업", { age: { min: 19, max: 34 }, checklist: [A], deadline: "상시신청" });
  const soon = legacy("예정 사업", { age: { min: 19, max: 34 }, checklist: [A], deadline: "2026.11.01~2026.11.30" });
  const done = legacy("종료 사업", { age: { min: 19, max: 34 }, checklist: [A], deadline: "2026.05.04~2026.05.20" });
  const stopped = legacy("중단 사업", { age: { min: 19, max: 34 }, deadline: "-", checklist: [A, "신규 접수 중단"] });
  const unknown = legacy("미정 사업", { age: { min: 19, max: 34 }, checklist: [A], deadline: "매년 공고문 참고" });
  const g = (p, s) => grade(p, U({ applyStatus: s }));
  // 신청 중
  assert.equal(g(open, "open"), "high");
  assert.equal(g(always, "open"), "high");
  assert.equal(g(soon, "open"), "mismatch");
  assert.equal(g(done, "open"), "mismatch");
  assert.equal(g(unknown, "open"), "check");
  // 예정
  assert.equal(g(soon, "upcoming"), "high");
  assert.equal(g(open, "upcoming"), "mismatch");
  assert.equal(g(unknown, "upcoming"), "check");
  // 마감·중단 보기: 종료 사업을 보여주되 높은 적합도로 올리지 않는다
  assert.equal(g(done, "closed"), "check");
  assert.equal(g(stopped, "closed"), "check");
  assert.equal(g(open, "closed"), "mismatch");
  assert.equal(g(stopped, "discontinued"), "check");
  assert.equal(g(done, "discontinued"), "mismatch");
  // 선택하지 않으면 기존 동작(종료는 불일치)
  assert.equal(g(done, ""), "mismatch");
  assert.equal(g(open, ""), "high");
});

test("지역: eligibility.regionName과 통합특별시 별칭을 쓰고, 충남/충북을 혼동하지 않는다", () => {
  const dj = v2("당진시 청년 도전", { regionName: "충청남도", orgName: "충청남도 당진시", age: { min: 18, max: 34 }, core: "만 18~34세 청년", ageInfo: RANGE(18, 34) });
  assert.notEqual(grade(dj, U({ age: 25, region: "충청남도" })), "mismatch");
  assert.equal(grade(dj, U({ age: 25, region: "충청북도" })), "mismatch");
  assert.equal(grade(dj, U({ age: 25, region: "서울특별시" })), "mismatch");
  dj.targetRegions = ["충청북도"];                                              // 기존 필드가 잘못 저장돼 있어도 regionName이 우선
  assert.notEqual(grade(dj, U({ age: 25, region: "충청남도" })), "mismatch");
  const gj = v2("광양청년 이자지원", { regionName: "전남광주통합특별시", regionNames: ["전남광주통합특별시", "광주광역시", "전라남도"], orgName: "전남광주통합특별시 광양시", age: { min: 19, max: 45 }, core: "19세~45세 청년", ageInfo: RANGE(19, 45) });
  gj.targetRegions = ["광주광역시"];
  ["광주광역시", "전라남도", "전남광주통합특별시"].forEach((r) => assert.notEqual(grade(gj, U({ age: 30, region: r })), "mismatch", r));
  assert.equal(grade(gj, U({ age: 30, region: "경상남도" })), "mismatch");
  const unk = v2("미상 지역 사업", { regionName: "unknown", age: { min: 19, max: 34 }, core: "만 19~34세 청년", ageInfo: RANGE(19, 34) });
  assert.notEqual(grade(unk, U({ age: 25 })), "mismatch");
  assert.notEqual(grade(unk, U({ age: 25 })), "high");
  // 시·군·구 사업은 시·도 입력만으로 거주 조건을 확인할 수 없다
  const sigungu = v2("김포 청년 면접정장", { regionName: "경기도", orgName: "경기도 김포시", age: { min: 19, max: 39 }, core: "만 19~39세 청년", ageInfo: RANGE(19, 39) });
  assert.equal(grade(sigungu, U({ age: 25, region: "경기도" })), "check");
  const province = v2("서울 청년 상담", { regionName: "서울특별시", orgName: "서울특별시", age: { min: 19, max: 39 }, core: "만 19~39세 청년", ageInfo: RANGE(19, 39) });
  assert.equal(grade(province, U({ age: 25, region: "서울특별시" })), "high");
});

test("가구 구성: 한부모·임신·출산 사업은 가구 구성만으로 제외하지 않는다(위탁·입양·미혼부모 등 예외) — 확인 필요", () => {
  const parent = legacy("한부모가족 아동양육비 지원", { checklist: ["한부모가족 지원대상자"], age: { min: 0, max: 99 } });
  assert.equal(grade(parent, U({ household: "singleParent" })) !== "mismatch", true);
  assert.equal(grade(parent, U({ household: "kids" })), "check");               // 자녀와 함께 = 한부모일 수 있음
  assert.equal(grade(parent, U({ household: "single" })), "check");
  assert.equal(grade(parent, U({ household: "" })), "check");                    // 답하지 않으면 불일치가 아니다
  const birth = legacy("임산부 출산지원금", { checklist: ["임산부 및 출산 가구"], age: { min: 0, max: 99 } });
  assert.notEqual(grade(birth, U({ household: "pregnant" })), "mismatch");
  assert.ok(texts(birth, U({ household: "pregnant" })).some((t) => /임신 가구/.test(t)));
  assert.equal(grade(birth, U({ household: "couple" })), "check");               // 부부 = 임신·출산 예정일 수 있음
  assert.equal(grade(birth, U({ household: "single" })), "check");
  assert.equal(grade(birth, U({ household: "" })), "check");
});

test("근거가 부족하면 판정 이유에 '공식 공고문 추가 확인 필요'가 표시되고, 여러 대상 나열·공고 위임은 높음이 아니다", () => {
  const p = v2("복합 지원", { age: { min: 19, max: 34 }, core: "만 19~34세 청년", ageInfo: RANGE(19, 34), income: { rules: ["중위소득 100% 이하"], percents: [100], varies: false } });
  const r = SM.classify(p, U(), TODAY);
  assert.equal(r.grade, "check");
  assert.ok(r.reasons.some((x) => /공식 공고문 추가 확인 필요/.test(x.text)));
  const multi = v2("행복주택 공급", { core: "대학생, 청년(19~39세), (예비)신혼부부, 한부모가족, 주거급여수급자, 고령자, 산업단지 근로자" });
  assert.notEqual(grade(multi, U({ age: 25, employment: "대학생" })), "high");
  assert.notEqual(grade(multi, U({ age: 25, special: [] })), "mismatch");
  const delegated = v2("청년성장프로젝트", { age: { min: 15, max: 34 }, core: "15세 이상~34세 이하 청년으로, 구체적인 지원대상은 사업 수행 자치단체에서 자율적으로 설정", ageInfo: RANGE(15, 34) });
  assert.notEqual(grade(delegated, U({ age: 25 })), "high");
});

test("기존 필드만 있는 문서(현재 Production 형태)도 안전 모드로 동작한다", () => {
  const l = legacy("서울 청년 지원", { regions: ["서울특별시"], age: { min: 19, max: 34 }, deadline: "2026.01.01~2026.02.01", checklist: ["서울 거주 만 19~34세 청년", "수급자 제외"] });
  assert.equal(grade(l, U({ age: 25 })), "mismatch");                            // 신청 종료
  l.deadline = l.deadlineText = "상시신청";
  assert.notEqual(grade(l, U({ age: 25, special: [] })), "mismatch");
  const rent = legacy("월세 지원", { checklist: ["만 19~34세 청년 무주택자"], age: { min: 19, max: 34 } });
  assert.notEqual(grade(rent, U({ age: 25, housing: "jeonse" })), "mismatch");
  assert.notEqual(grade(rent, U({ age: 25, housing: "monthly", income: "50" })), "high");
  // 사용자가 답하지 않은 조건은 어떤 경우에도 불일치가 아니다
  const blank = { age: null, region: "", employment: "", student: "", income: "", household: "", housing: "", special: null, applyStatus: "" };
  [l, rent, legacy("장애인 연금", { checklist: ["등록장애인 중 18세 이상"] }), legacy("고령자 일자리", { summary: "노인 일자리", checklist: ["65세 이상"] })].forEach((p) => assert.notEqual(grade(p, blank), "mismatch", p.title));
});

test("질병·서비스명만으로 연령대 전용(고령자)으로 단정하지 않고, 임신 중 가구를 한부모 사업에서 제외하지 않는다", () => {
  const hotline = legacy("치매 상담콜센터 운영", { checklist: ["치매 환자와 가족들, 또한 치매 관련 내용에 관심이 있는 전 국민"], age: { min: 19, max: 120 } });
  assert.notEqual(grade(hotline, U({ age: 28 })), "mismatch");
  assert.notEqual(grade(hotline, U({ age: 28, special: [] })), "mismatch");
  const senior = legacy("어르신 일자리", { checklist: ["만 65세 이상 어르신"], age: { min: 65, max: 120 } });
  assert.equal(grade(senior, U({ age: 28 })), "mismatch");                       // 연령대를 가리키는 사업은 그대로 제외
  const parent = legacy("한부모가족 법률구조", { checklist: ["기준중위소득 125% 이하 한부모가족 또는 미혼부"], age: { min: 0, max: 120 } });
  assert.notEqual(grade(parent, U({ household: "pregnant" })), "mismatch");
  assert.equal(grade(parent, U({ household: "couple" })), "check");
});
