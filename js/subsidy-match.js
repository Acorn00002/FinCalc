/* 정부지원금 적합도 판정 엔진 (Beta · 안전 모드).
 * 입력: supportPrograms 문서(기존 필드) + 선택적으로 `eligibility`(schemaVersion 2, 보조금24 원문을 구조화한 필드).
 * eligibility가 있으면 신청상태·대상/제외 분리·유형별 소득·연령 예외·지역 별칭을 쓰고, 없으면 기존 필드(제목·요약·
 * 선정기준 줄·연령 코드)만으로 같은 규칙을 최대한 적용한다 — 구조가 없는 만큼 더 보수적으로 "추가 확인 필요"가 된다.
 *
 * 안전 모드 원칙
 *  - 조건 불일치(mismatch)는 공식 문구상 "명백한" 충돌만: 연령·지역·대상 유형(재학/재직/신분/가구) 충돌, 신청 종료·
 *    신규지원 중단, 공식 제외 문구에 명시된 신분. 소득·주거 조건은 입력 구간과 달라 보여도 제외하지 않는다.
 *  - 답하지 않은 조건은 불일치로 처리하지 않는다. 애매하거나 데이터가 부족하면 "추가 확인 필요"로 둔다.
 *  - 높은 적합도(high)는 사업이 요구하는 소득·주거·학적·직업 조건이 입력으로 모두 확인될 때만. 하나라도 미확인이면 확인 필요.
 *  - 확정적으로 신청 가능하다고 말하지 않는다. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SubsidyMatch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var GRADE = { HIGH: "high", CHECK: "check", MISMATCH: "mismatch" };
  var GRADE_RANK = { high: 0, check: 1, mismatch: 2 };
  var GRADE_LABEL = { high: "높은 적합도", check: "추가 확인 필요", mismatch: "조건 불일치" };
  var APPLY_STATE_LABEL = { open: "신청 중", always: "상시", upcoming: "신청 예정", closed: "마감", discontinued: "신규 접수 중단", unknown: "신청기간 확인" };
  var OFFICIAL_CHECK = "공식 공고문 추가 확인 필요";

  // 소득 구간(기준 중위소득 대비 %) — [하한(초과), 상한(이하)]
  var INCOME_BANDS = {
    "50": { lo: 0, hi: 50, label: "중위소득 50% 이하" },
    "100": { lo: 50, hi: 100, label: "중위소득 50~100%" },
    "150": { lo: 100, hi: 150, label: "중위소득 100~150%" },
    "over": { lo: 150, hi: Infinity, label: "중위소득 150% 초과" }
  };

  // ---------- 지역 (eligibility.regionName 우선, 통합특별시 별칭) ----------
  var UNIFIED_GJ = "전남광주통합특별시";
  var REGION_GROUPS = {};
  REGION_GROUPS[UNIFIED_GJ] = [UNIFIED_GJ, "광주광역시", "전라남도"];
  function expandRegion(name) { return REGION_GROUPS[name] || [name]; }
  function regionsIntersect(progNames, userRegion) {
    var user = expandRegion(userRegion);
    return progNames.some(function (n) { return user.indexOf(n) !== -1; });
  }

  // ---------- 텍스트 패턴 (제목+요약 = head 기준으로 "주 대상"을 판단) ----------
  var RE = {
    youth: /청년|사회초년|신혼/,
    employee: /취업|장기근속|근로자|재직|취준|장학|청년/,
    business: /소상공인|자영업|사업자|중소기업|창업|법인|업체|가맹|수출|물류센터|무역|기업\s*바우처|매출|사업화|스타트업|벤처|사업장/,
    primary: /농업인|농업경영|농가|영농|농지|농산물|축산|양봉|어업|어업인|어선|어가|어민|어촌|선원|해운|해양수산|수산|양식|염전|천일염|산림|임업|농촌|귀농|귀어|조건불리지역|유해생물/,
    senior: /노인|어르신|고령|경로|기초연금|65세\s*이상|60세\s*이상/,
    parenting: /출산|임산부|임신|양육|보육|신생아|난임|불임|학부모|자녀/,
    minor: /영유아|아동|어린이|유아|초등|중학생|고등학생|초\s*[·,]\s*중\s*[·,]\s*고|소년소녀/,
    general: /일반인|전\s*국민|누구나|모든\s*국민|성인/,
    disability: /장애인|장애아|발달장애|중증장애|시각장애|청각장애|지체장애|등록장애|장애\s*(등록|정도|인정)/,
    veteran: /보훈|국가유공|참전|독립유공|유공자|제대군인|군인|병사|예비군|전역|6·25|비정규군|군\s*복무|복무\s*중|상근예비역|장병/,
    lowIncome: /기초생활|기초수급|차상위/,
    lowIncomeSoft: /저소득|취약계층|위기가구|긴급복지|수급자|의료급여|주거급여|생계급여|교육급여/,
    singleParent: /한부모|조손/,
    multicultural: /다문화|북한이탈|새터민|결혼이민|이주민/,
    victim: /범죄피해|범죄\s*피해|가정폭력|성폭력|스토킹|전세사기|피해임차인|이재민|재난|산재|진폐|업무상\s*재해|재해보상/,
    careLeaver: /보호종료|자립준비|만기퇴소|시설\s*퇴소/,
    license: /유휴\s*간호사|(?:간호사|약사|한의사|변호사|회계사|세무사|공인중개사|조리사|교원|교사|의사)\s*(?:면허|자격)|(?:면허|자격증)(?:을|를)?\s*(?:소지|보유|취득한)|(?:간호사|약사|교원|교사|조리사)\s*(?:대상|를\s*위한|재취업|채용)/,
    rentBased: /월세|전세|임차|보증금|무주택|임대주택|공공임대|청약/,
    monthlyRent: /월세/
  };
  // 선정기준(핵심 문구)에서는 부수적으로 스치는 단어(예: "근로장려금 수급자", "병역기간")를 피하려고
  // 신분을 분명히 가리키는 표현만 인정한다.
  var STRICT = {
    disability: /장애인\s*(등록|복지)|등록장애|장애인\s*증|장애\s*정도/,
    veteran: /국가유공자|보훈대상|참전유공|독립유공|제대군인|현역\s*병|상근예비역/,
    lowIncome: /기초생활수급|차상위|의료급여\s*수급|생계급여\s*수급/,
    multicultural: /북한이탈주민|다문화가족|결혼이민자/,
    victim: /범죄피해자|가정폭력\s*피해|전세사기\s*피해|산재\s*(?:근로자|노동자|환자|피해)|진폐/,
    careLeaver: /보호종료아동|자립준비청년/,
    singleParent: /한부모가족|한부모\s*가구|조손가족/,
    parenting: /임산부|영유아|신생아|자녀\s*양육|양육\s*가구|임신\s*중/
  };
  // 공식 "제외 대상" 문구에서는 신분 표현이 더 넓게 쓰인다(생계·의료·주거·교육급여자 등).
  var EXCL_STRICT = {
    lowIncome: /기초생활|차상위|생계급여|의료급여|주거급여|교육급여|수급자|수급\s*가구/
  };
  var HARD_GROUPS = ["disability", "veteran", "lowIncome"];
  var STATUS_GROUPS = ["disability", "veteran", "lowIncome", "multicultural", "victim", "careLeaver"];
  var STATUS_LABEL = {
    disability: "장애인",
    veteran: "보훈·군 복무 관련",
    lowIncome: "기초수급·차상위 등 취약계층",
    multicultural: "다문화·북한이탈",
    victim: "범죄·재난·산재·전세사기 피해",
    careLeaver: "보호종료·아동복지 대상"
  };
  // 신분 일치만으로는 세부 요건(정도·예정 신분 등)을 알 수 없다 — 이런 한정어가 있으면 확인 필요로 남긴다.
  var QUALIFIER_RE = /중증|경증|\d\s*급|등급|예정자|전역\s*예정|퇴직\s*예정|간부|정도가\s*심한/;

  // 공식 제외 문구 / 우대 문구 / 유형 구분 / 공고 의존 문구 (보조금24 원문 패턴)
  var EXCLUDE_CLAUSE = /제외|지원\s*불가|신청\s*불가|수혜\s*불가|가입\s*불가|불가능|지원하지\s*않|대상이\s*아니|대상\s*아님|중복\s*(?:수혜|지원|혜택|신청|가입|불가)|동시\s*(?:수혜|지원)|불인정/;
  var EXCLUDE_PAREN = /\(([^()]*(?:제외|불가)[^()]*)\)/g;
  var PREFERENCE_CLAUSE = /우대|우선\s*(?:선정|지원|공급|순위|대상)|추가\s*(?:지원|혜택|환급|지급|가점)|가점|가산|환급|감면|할인/;
  var TIER_RE = /우대형|일반형|[ⅠⅡⅢⅣ]\s*유형|(?:^|[^A-Za-z])I{1,3}\s*유형|요건심사형|선발형/g;
  var DELEGATED_RE = /자율(?:적)?(?:으로)?\s*설정|지자체\s*(?:별|자율)|자치단체(?:별|가\s*자율)|별도\s*공고|공고문?\s*(?:참고|확인)|세부\s*(?:기준|요건|대상)[^.]{0,12}(?:공고|상이|별도)|모집\s*공고|공고(?:문)?\s*(?:에\s*따|확인)|채용기관|종합지침|심사를\s*거|심의회|선발|추천/;
  var INCOME_WORD = /소득|중위|연봉|건강보험료|재산/;
  // 연령 구조화 값은 사업 문구가 연령을 말하는 사업(청년·아동·노인 등)에서만 제외 근거로 쓴다.
  var AGE_ORIENTED_RE = /청년|청소년|아동|어린이|유아|영유아|노인|어르신|고령|대학생|신혼|사회초년|임산부|초등학생|중학생|고등학생|유치원|어린이집|\d+\s*세/;
  // 개인이 아니라 기관·단체·연구팀이 신청 주체인 사업 — 개인의 재학·재직 상태로 제외하지 않는다.
  var INSTITUTION_RE = /교육연구단|연구단|컨소시엄|운영\s*기관|지방자치단체|조합법인|협동조합|영농\(어\)조합/;
  var TARGET_NOISE_RE = /자녀|졸업|채무|대출|연체|유예|상환|학부모/;
  var CHILD_STUDENT_RE = /(?:대학(?:원)?생|재학생|학생)의?\s*자녀|자녀의?\s*(?:대학|학자금|등록금)/g;
  var WORKER_SOFT_RE = /근로자|취업\s*후/;
  // 특정 계층을 겨냥한 사업 표지 — 입력 칩(장애·보훈·취약계층 등)으로는 확인되지 않는 신분이 있을 수 있다.
  var RESTRICTIVE_RE = /소외계층|위기\s*(?:청소년|가구|아동|상황)|취약계층|출원생|출소|퇴소|피해|환자|질환|질병|장애|유공|수급|저소득|한부모|다문화|이주|북한|탈북|난민|병역|위탁|보호대상|학대|폭력|중독|재난|재해/;
  // 대상 문구에서 "서로 다른 대상 유형"을 세는 표지 — 둘 이상이면 택일 나열로 본다(그중 하나에 해당하면 됨).
  var POPULATION_MARKERS = [/대학생|재학생/, /청년/, /신혼|예비\s*부부/, /한부모/, /고령자|노인|어르신/, /주거급여|수급자|기초생활|차상위/, /산업단지|근로자/, /장애인/, /보훈|유공자/, /다자녀|다둥이/, /자립준비|보호종료|퇴소/, /북한이탈|다문화|결혼이민/, /피해자|피해\s*청년|피해\s*임차/, /임산부|임신부|산모/, /영유아|신생아|유아|어린이|아동/, /초등학생|중학생|고등학생|청소년/, /어르신|65세\s*이상/, /보호자|학부모/, /교사|교직원|교원/, /국가유공자|참전/];

  // 신청 주체·역할을 가리키는 표지(보호자·교사)는 "서로 다른 대상 유형"이 아니므로 택일 나열 판단에서 세지 않는다.
  var ROLE_MARKER_SRC = ["보호자|학부모", "교사|교직원|교원"];
  // 특수 자격 신호: 제목에 있으면 "그 자격 전용 사업"으로 본다(입력 칩에 없는 자격 포함).
  // 자녀 연령대 선택값 → 만 나이 범위
  var CHILD_AGE_BANDS = { "0-2": [0, 2], "3-5": [3, 5], "elem": [6, 13], "teen": [14, 19], "adult": [20, 120] };
  var FEMALE_EXCLUDE_RE = /임신|임산부|출산|산모|난임|남성|남녀|성별s*무관/;
  var FACILITY_RE = /아동복지시설|보호대상아동|양육시설|그룹홈/;
  var JUVENILE_RE = /소년원|출원생|보호관찰|소년범|출소자/;
  var SPECIAL_LABEL = { disability: "장애인", veteran: "보훈·군 복무 관련", lowIncome: "기초수급·차상위", multicultural: "다문화·북한이탈", victim: "피해자(범죄·재난·산재 등)", careLeaver: "보호종료아동" };
  // 위탁·입양·돌봄 등은 본인이 아동을 양육하지 않아도 대상일 수 있다.
  var CHILD_EXEMPT_RE = /위탁|입양|돌봄|조손|손자녀|조카|대리\s*양육/;

  function hasV2(p) {
    return !!(p && p.eligibility && typeof p.eligibility === "object" && Number(p.eligibility.schemaVersion) >= 2);
  }
  function headOf(p) {
    return [p.title, p.summary].filter(Boolean).join(" ");
  }
  function countHits(re, text) {
    var g = new RegExp(re.source, "g");
    var m = text.match(g);
    return m ? m.length : 0;
  }
  function uniq(arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); }

  // 선정기준 줄을 핵심 문구 / 제외 문구 / 우대 문구로 나눈다(eligibility가 없는 기존 문서용).
  function splitLegacyChecklist(list) {
    var core = [], excl = [], pref = [];
    var inPref = false;
    (list || []).forEach(function (line) {
      line = String(line || "");
      var m, paren = [];
      EXCLUDE_PAREN.lastIndex = 0;
      while ((m = EXCLUDE_PAREN.exec(line)) !== null) paren.push(m[1]);
      var rest = line.replace(EXCLUDE_PAREN, " ").trim();
      paren.forEach(function (x) { excl.push(x); });
      if (!rest) return;
      if (/^[\[(［]?\s*(?:우대|우선)[^\n]{0,10}[\])］]?\s*[:：]?$/.test(rest)) { pref.push(rest); inPref = true; return; }
      if (inPref) {
        if (/해당되지\s*않|^[\[(［]\s*(?:일반|기본)/.test(rest)) inPref = false;
        else { pref.push(rest); return; }
      }
      if (EXCLUDE_CLAUSE.test(rest)) excl.push(rest);
      else if (PREFERENCE_CLAUSE.test(rest)) pref.push(rest);
      else core.push(rest);
    });
    return { core: core, exclusions: excl, preferences: pref };
  }

  // 직업·학적 유형. 학생은 "재학/대학생/대학원생/휴학/입학"처럼 신분이 분명할 때만 대상 유형으로 본다.
  // 학자금·등록금·장학 같은 단어는 졸업 후 상환자·대출 연체자도 대상일 수 있어 "재학 여부 확인"으로만 쓴다.
  var EMP_TYPE_RE = {
    student: /재학|대학생|대학원생|휴학/,
    worker: /재직|근속|고용된/,
    jobSeek: /구직|미취업|취업준비|취업\s*지원|실업|무소득|일자리\s*(제공|지원)/,
    selfEmp: /자영업|소상공인|사업자/
  };
  var STUDENT_SOFT_RE = /학자금|등록금|장학/;
  function empTypesOf(text) {
    return Object.keys(EMP_TYPE_RE).filter(function (k) { return EMP_TYPE_RE[k].test(text); });
  }

  // ---------- 연령 문구 읽기 (eligibility.ageInfo가 없는 기존 문서용) ----------
  var AGE_RANGE = /(?:만\s*)?(\d{1,3})\s*세?\s*(?:이상)?\s*[~-]\s*(?:만\s*)?(\d{1,3})\s*세\s*(이하|미만)?/g;
  var AGE_MIN = /만\s*(\d{1,3})\s*세\s*이상/g;
  var AGE_MAX = /(\d{1,3})\s*세\s*(이하|미만)/g;
  function inAge(n) { return n >= 0 && n <= 120; }
  function readAgeRanges(clauses) {
    var ranges = [];
    function push(min, max) {
      if ((min !== null && !inAge(min)) || (max !== null && !inAge(max))) return;
      if (min !== null && max !== null && min > max) return;
      if (!ranges.some(function (r) { return r.min === min && r.max === max; })) ranges.push({ min: min, max: max });
    }
    clauses.forEach(function (c) {
      c = String(c).replace(/\([^()]*도\s*가능[^()]*\)/g, " ").replace(/[^,;.()]*세\s*(?:이상|이하|미만)?\s*도\s*가능[^,;.()]*/g, " ");
      var m, covered = [];
      AGE_RANGE.lastIndex = 0;
      while ((m = AGE_RANGE.exec(c)) !== null) { push(Number(m[1]), Number(m[2]) - (m[3] === "미만" ? 1 : 0)); covered.push([m.index, AGE_RANGE.lastIndex]); }
      AGE_MIN.lastIndex = 0;
      while ((m = AGE_MIN.exec(c)) !== null) { var i1 = m.index; if (!covered.some(function (r) { return i1 >= r[0] && i1 < r[1]; })) push(Number(m[1]), null); }
      AGE_MAX.lastIndex = 0;
      while ((m = AGE_MAX.exec(c)) !== null) { var i2 = m.index; if (!covered.some(function (r) { return i2 >= r[0] && i2 < r[1]; })) push(null, Number(m[1]) - (m[2] === "미만" ? 1 : 0)); }
    });
    return ranges;
  }
  function legacyAgeInfo(core, pref, excl) {
    var all = core.concat(pref, excl);
    var birth = null;
    for (var i = 0; i < all.length && !birth; i++) {
      var m = all[i].match(/(\d{4})\s*(?:[~-]\s*(\d{4}))?\s*년?\s*(?:생|출생)/);
      if (m && Number(m[1]) >= 1940 && Number(m[1]) <= 2100) birth = { from: Number(m[1]), to: Number(m[2] || m[1]) };
    }
    var exceptions = all.filter(function (c) { return /\d{2}\s*세|연령|나이/.test(c) && /군\s*복무|병역|복무기간|출생|년생|연장|예외|특례|인정|확대|상향|도\s*가능|까지\s*가능|까지\s*포함|\d{2}\s*세까지/.test(c); });
    var tm = all.join(" ").match(TIER_RE);
    return { textRanges: readAgeRanges(core), birthYears: birth, exceptions: exceptions, tiered: !!(tm && uniq(tm).length > 1) || pref.some(function (x) { return /^[\[(［]?\s*(?:우대|우선)/.test(x); }) };
  }

  // ---------- 신청 상태 ----------
  // 신청 기간 종료·신규지원 중단은 높은 적합도로 올리지 않는다. 기본(상태를 고르지 않음)에서는 "조건 불일치(신청 종료)"로 분류한다.
  var STOP_RE = /신규\s*(?:지원|접수|신청|모집|가입)\s*(?:을\s*|이\s*|은\s*)?(?:중단|종료|폐지|마감|불가)|사업\s*(?:이\s*)?(?:종료|중단|폐지)(?!\s*(?:후|시|되|이후|일|기간|예정))|지원\s*(?:이\s*)?(?:종료|중단|폐지)(?!\s*(?:후|시|되|이후|일|기간|예정))|(?:접수|모집|신청)\s*(?:이\s*|은\s*)?(?:종료|마감)(?!\s*(?:일|예정|시))|(?:더\s*이상|추후)\s*(?:접수|모집|신청)\s*(?:하지\s*않|불가)/;
  var ROUND_CLOSED_RE = /모집\s*완료|접수\s*완료|마감\s*(?:되었|됨|완료)|조기\s*마감|예산\s*소진/;
  var ALWAYS_OPEN_RE = /상시|연중|수시|항시/;
  var RECURRING_RE = /매년|연\s*\d+\s*회|매월|분기|반기|정기|해마다|공고\s*(?:문\s*)?참고|공고\s*시|별도\s*공고|기관\s*별|접수기관|지자체\s*별/;
  var DATE_TOKEN = /(\d{4})\s*(?:년\s*|[.\-\/]\s*)(\d{1,2})\s*(?:월\s*|[.\-\/]\s*)(\d{1,2})\s*일?|(\d{1,2})\s*월\s*(\d{1,2})\s*일?/g;
  function pad2(n) { return ("0" + n).slice(-2); }
  function validYmd(y, m, d) {
    if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function ymd(t) { return t.y + "-" + pad2(t.m) + "-" + pad2(t.d); }
  // "2026.05.04~2026.05.20" / "(2차) 2026년 8월 12일~ 9월 9일" → [{start,end}] (알 수 없는 쪽은 null)
  function parsePeriods(text) {
    var s = String(text == null ? "" : text).replace(/[∼～〜–—]/g, "~");
    var tokens = [], m;
    DATE_TOKEN.lastIndex = 0;
    while ((m = DATE_TOKEN.exec(s)) !== null) {
      if (m[1]) tokens.push({ i: m.index, e: DATE_TOKEN.lastIndex, y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) });
      else tokens.push({ i: m.index, e: DATE_TOKEN.lastIndex, y: null, m: Number(m[4]), d: Number(m[5]) });
    }
    var prev = null;
    tokens.forEach(function (t) {
      if (t.y === null && prev) t.y = prev.y + (t.m < prev.m ? 1 : 0);
      if (t.y !== null) prev = t;
    });
    var toks = tokens.filter(function (t) { return t.y !== null && validYmd(t.y, t.m, t.d); });
    var periods = [], used = {};
    for (var k = 0; k < toks.length; k++) {
      var a = toks[k], b = toks[k + 1];
      if (b && /^\s*\.?[\s)\]]*~\s*$/.test(s.slice(a.e, b.i))) { periods.push({ start: ymd(a), end: ymd(b) }); used[k] = used[k + 1] = true; k += 1; continue; }
      if (used[k]) continue;
      var before = s.slice(Math.max(0, a.i - 6), a.i), after = s.slice(a.e, a.e + 8);
      if (/~\s*$/.test(before)) { periods.push({ start: null, end: ymd(a) }); continue; }
      if (/^\s*\.?\s*[)\]]*\s*~/.test(after) && !(b && b.i - a.e < 3)) { periods.push({ start: ymd(a), end: null }); continue; }
      if (/^\s*[)\]]*\s*(?:까지|마감)/.test(after)) periods.push({ start: null, end: ymd(a) });
    }
    return periods;
  }
  function stateFromText(deadlineText, extraTexts, today) {
    var dl = String(deadlineText == null ? "" : deadlineText);
    if (dl === "-") dl = "";
    var stopSources = [dl].concat(extraTexts || []);
    for (var i = 0; i < stopSources.length; i++) if (STOP_RE.test(String(stopSources[i] || ""))) return { state: "discontinued", reason: "stop-phrase" };
    var periods = parsePeriods(dl);
    var always = ALWAYS_OPEN_RE.test(dl), recurring = RECURRING_RE.test(dl);
    if (periods.length) {
      var complete = periods.every(function (x) { return x.end; });
      var allPast = complete && periods.every(function (x) { return x.end < today; });
      var current = periods.some(function (x) { return (!x.start || x.start <= today) && (!x.end || x.end >= today); });
      var future = periods.some(function (x) { return x.start && x.start > today; });
      if (current) return { state: "open", reason: "in-period" };
      if (future) return { state: "upcoming", reason: "future-period" };
      if (allPast && !always && !recurring) return { state: "closed", reason: "all-periods-ended" };
      return { state: "unknown", reason: allPast ? "periods-ended-but-recurring" : "periods-incomplete" };
    }
    if (always) return { state: "open", reason: "always-open", always: true };
    if (ROUND_CLOSED_RE.test(dl)) return { state: "unknown", reason: "round-closed-hint" };
    return { state: "unknown", reason: dl ? "unparsed" : "no-info" };
  }
  // 반환: { state: open|upcoming|closed|discontinued|unknown, always?: bool, roundClosedHint?: bool }
  function applicationStatusOf(p, todayStr) {
    var today = todayStr || new Date().toISOString().slice(0, 10);
    if (hasV2(p) && p.eligibility.applicationStatus) {
      var st = p.eligibility.applicationStatus;
      if (st.state === "discontinued" || st.state === "closed") return { state: st.state };
      if (st.state === "open" && st.reason === "in-period" && st.periods && st.periods.length &&
          st.periods.every(function (x) { return x.end && x.end < today; })) return { state: "closed" };   // 저장 시점 이후 기간이 끝남
      return { state: st.state, always: st.reason === "always-open", roundClosedHint: st.reason === "round-closed-hint" || st.reason === "in-period-round-closed-hint" };
    }
    var r = stateFromText(p.deadlineText, (p.checklist || []).concat([p.summary || ""]), today);
    return { state: r.state, always: !!r.always, roundClosedHint: r.reason === "round-closed-hint" };
  }
  function isStrictlyClosed(deadlineText, todayStr) {
    var s = stateFromText(deadlineText, [], todayStr || new Date().toISOString().slice(0, 10));
    return s.state === "closed";
  }
  function applyStateKey(info) { return info.state === "open" && info.always ? "always" : info.state; }

  // ---------- 연령 사양 ----------
  function ageSpecOf(p, todayStr, lists, enumerated) {
    var s = p.targetAge || {};
    var sMin = typeof s.min === "number" && s.min >= 1 ? s.min : null;
    var sMax = typeof s.max === "number" && s.max < 99 ? s.max : null;
    var info = hasV2(p) ? (p.eligibility.ageInfo || {}) : legacyAgeInfo(lists.core, lists.pref, lists.excl);
    var ranges = info.textRanges || [];
    // 선정기준에 연령이 없어도 제목·요약에 "3~5세 아동", "만 65세 이상"처럼 명시되면 구조화 값보다 우선한다.
    if (!ranges.length && lists.head) ranges = readAgeRanges([lists.head]);
    var textMin = null, textMax = null;
    ranges.forEach(function (r) {
      if (r.min !== null && r.min !== undefined) textMin = textMin === null ? r.min : Math.min(textMin, r.min);
      if (r.max !== null && r.max !== undefined) textMax = textMax === null ? r.max : Math.max(textMax, r.max);
    });
    var spec = { min: sMin, max: sMax, minHard: true, maxHard: true, source: (sMin !== null || sMax !== null) ? "structured" : "none", soft: false, extMax: null, tiered: !!info.tiered };
    if (ranges.length) {
      // 공식 문구가 있으면 문구가 우선한다. 문구가 한쪽 경계만 말하면 다른 쪽 구조화 값은 "미확인"이라 제외 근거로 쓰지 않는다.
      spec.source = "text";
      if (textMin !== null) spec.min = textMin; else spec.minHard = false;
      if (textMax !== null) spec.max = textMax; else spec.maxHard = false;
    }
    if (!ranges.length && (sMin !== null || sMax !== null)) {
      // 등록된 연령 코드만 있고 사업 문구는 연령을 말하지 않으면(예: 장학금·복지 서비스) 코드는 제외 근거로 쓰지 않는다.
      var corroborated = AGE_ORIENTED_RE.test(headOf(p)) || /\d+\s*세|연령|나이|출생|생년/.test(lists.core.join(" "));
      if (!corroborated) { spec.minHard = false; spec.maxHard = false; }
    }
    if (enumerated) { spec.minHard = false; spec.maxHard = false; }                      // 여러 대상 중 한 유형에만 해당하는 연령일 수 있다
    var year = Number(String(todayStr || new Date().toISOString()).slice(0, 4));
    if (info.birthYears && !ranges.length) {
      spec.min = year - info.birthYears.to - 1; spec.max = year - info.birthYears.from; spec.source = "birth";   // 만 나이는 생일 전후로 ±1
    }
    var exceptions = info.exceptions && info.exceptions.length ? info.exceptions : [];
    if (exceptions.length) {
      spec.soft = true;
      spec.hasExc = true;
      var num = null;
      exceptions.forEach(function (x) { var m = String(x).match(/(\d{2})\s*세\s*까지/); if (m) num = Math.max(num || 0, Number(m[1])); });
      spec.extMax = num !== null ? num : (spec.max !== null ? spec.max + 6 : null);   // 병역 인정은 최대 6년
    }
    if (spec.tiered && spec.source !== "text") spec.soft = true;                      // 유형별 연령이 달라 하나로 못 읽은 경우
    return spec;
  }

  // ---------- 사업별 프로필 (한 번만 계산해 캐시) ----------
  var profileCache = {};
  function analyzeProgram(p, todayStr) {
    var key = p.id;
    if (key && profileCache[key] && profileCache[key].src === p && profileCache[key].today === todayStr) return profileCache[key];

    var v2 = hasV2(p);
    var e = v2 ? p.eligibility : null;
    var head = headOf(p);
    var legacySplit = splitLegacyChecklist(p.checklist);
    // 대상 문구와 제외·우대 문구를 분리: 제외·우대 문구는 대상 판단(신분·직업·연령)에 쓰지 않는다.
    var coreList = v2 ? [e.coreText || ""] : legacySplit.core;
    var exclusions = v2 ? (e.exclusions || []) : legacySplit.exclusions;
    var prefList = v2 ? (e.preferences || []) : legacySplit.preferences;
    var coreText = coreList.join(" ");
    var elig = [head, coreText].filter(Boolean).join(" ");
    var full = [head, p.benefits, coreText].filter(Boolean).join(" ");
    var prefText = prefList.join(" ");

    var primaryLike = RE.primary.test(head) || countHits(RE.primary, elig) >= 2 || countHits(RE.primary, full) >= 3;
    var businessLike = !RE.employee.test(head) && (RE.business.test(head) || countHits(RE.business, elig) >= 2);
    var audience;
    if (primaryLike) audience = "primary";
    else if (v2 && e.audienceType === "business") audience = "business";
    else if (v2 && (e.audienceType === "individual" || e.audienceType === "mixed")) audience = "personal";   // 제목의 사업자 단어만으로 단정하지 않는다
    else audience = businessLike ? "business" : "personal";

    // 여러 대상(청년·자립준비청년·북한이탈청년…)을 나열한 사업은 "그중 하나"에 해당하면 되므로
    // 본문에 스친 신분을 이 사업의 전용 대상으로 보지 않는다(제목에 있는 신분만 전용 대상).
    var personClauses = v2 ? ((e.coreStats && e.coreStats.personClauses) || 0)
      : coreList.filter(function (c) { return /(?:사람|분|자|청년|구직자|근로자|가구|세대|학생|아동|노인|어르신)\s*[)*]?\s*$/.test(c); }).length;
    // 제목·요약·선정기준에 숫자 연령이 명시된 사업은 보호자·교사 같은 역할 표지를 "다른 대상 유형"으로 세지 않는다.
    var statedAge = readAgeRanges(coreList.concat([head])).length > 0 || !!(v2 && e.ageInfo && e.ageInfo.textRanges && e.ageInfo.textRanges.length);
    var markerCount = POPULATION_MARKERS.filter(function (r) { return !(statedAge && ROLE_MARKER_SRC.indexOf(r.source) !== -1) && r.test(head + " " + coreText); }).length;
    var enumeratedPre = markerCount >= 2 || personClauses >= 3;
    var age = ageSpecOf(p, todayStr, { core: coreList, pref: prefList, excl: exclusions, head: head }, enumeratedPre);
    var headAlt = /[·,，、]|및|또는/.test(head);       // 제목이 대상을 "A·B", "A 및 B"처럼 나열하면 그중 하나에 해당하면 된다
    var groups = {};
    var softGroups = {};                                    // 본문에서만 읽힌 신분: 제외 근거가 아니라 확인 필요
    STATUS_GROUPS.forEach(function (g) {
      groups[g] = RE[g].test(head);
      softGroups[g] = !groups[g] && !enumeratedPre && !!STRICT[g] && STRICT[g].test(coreText);
      if (groups[g] && HARD_GROUPS.indexOf(g) === -1) { groups[g] = false; softGroups[g] = true; }   // 정의가 모호한 신분은 제외 근거로 쓰지 않는다
    });
    var isGeneral = RE.general.test(head) || RE.general.test(coreText.slice(0, 60));

    var seniorFlag = !isGeneral && RE.senior.test(head);
    var parentingFlag = !isGeneral && RE.parenting.test(head);
    var softParenting = !isGeneral && !parentingFlag && !enumeratedPre && STRICT.parenting.test(coreText);
    var minorFlag = !isGeneral && RE.minor.test(head);
    var singleParentFlag = RE.singleParent.test(head);
    var softSingleParent = !singleParentFlag && !enumeratedPre && STRICT.singleParent.test(coreText);

    var populationCount = STATUS_GROUPS.filter(function (g) { return groups[g]; }).length +
      (seniorFlag ? 1 : 0) + ((parentingFlag || minorFlag) ? 1 : 0) + (singleParentFlag ? 1 : 0);
    var multiGroup = populationCount >= 3;
    if (multiGroup) {
      STATUS_GROUPS.forEach(function (g) { groups[g] = false; });
      seniorFlag = parentingFlag = minorFlag = singleParentFlag = false;
    }
    var lowIncomeAlt = /저소득|일반\s*\S*가구|중위소득|소득\s*(?:기준|인정|이하)|%\s*이하/.test(coreText);
    if (lowIncomeAlt) { groups.lowIncome = groups.lowIncome && RE.lowIncome.test(headOf(p)) && !/저소득|일반\s*\S*가구/.test(head); }
    var enumerated = enumeratedPre || multiGroup;
    if (enumeratedPre && (headAlt || markerCount >= 3)) {
      // 택일로 나열된 사업은 어떤 신분·연령대도 전용 대상이 아니다 — 제외 근거로 쓰지 않는다.
      STATUS_GROUPS.forEach(function (g) { groups[g] = false; });
      seniorFlag = parentingFlag = minorFlag = singleParentFlag = false;
    }
    var qualifier = QUALIFIER_RE.test(head + " " + coreText);
    var restrictive = RESTRICTIVE_RE.test(head + " " + coreText);
    var specialQuals = [];
    var altCleared = enumeratedPre && (headAlt || markerCount >= 3);
    // 택일로 나열된 사업이면 제목에 단독으로 나온 자격만 전용으로 본다(요약의 쉼표 때문에 전용 사업을 놓치지 않도록).
    var title = p.title || "";
    var titleAlt = /[·,，、]|및|또는/.test(title);
    var srcText = altCleared ? (titleAlt ? "" : title) : head;
    function hasQual(re, g) { return altCleared ? (!!srcText && re.test(srcText)) : (g ? (groups[g] || softGroups[g]) : re.test(srcText)); }
    if (JUVENILE_RE.test(srcText)) specialQuals.push({ key: "juvenile", label: /소년원|출원생/.test(srcText) ? "소년원 출원생 등" : "보호관찰·출소자 등" });
    if (FACILITY_RE.test(srcText)) specialQuals.push({ key: "facility", label: "아동복지시설 보호 대상" });
    STATUS_GROUPS.forEach(function (g) { if (hasQual(RE[g], g)) specialQuals.push({ key: g, label: SPECIAL_LABEL[g] }); });
    if (altCleared ? RE.singleParent.test(srcText) : (singleParentFlag || softSingleParent)) specialQuals.push({ key: "singleParent", label: "한부모·조손 가구" });
    if (RE.license.test(srcText)) specialQuals.push({ key: "license", label: "특정 자격·면허 소지자" });
    // 여성 전용: 제목·요약에 여성이 대상으로 나오고 선정기준 첫 줄에도 여성이 대상으로 명시된 경우만(단어가 스친 것만으로 판단하지 않음).
    var femaleOnly = /여성/.test(head) && coreList.slice(0, 2).some(function (c) { return /여성/.test(c); }) && !FEMALE_EXCLUDE_RE.test(head + " " + coreList.slice(0, 2).join(" "));
    var femaleStrict = femaleOnly && /여성/.test(title);
    if (femaleOnly) specialQuals.push({ key: "female", label: "여성 대상" });
    var childNoun = ["아동", "어린이", "영유아", "유아", "초등학생", "중학생", "고등학생", "청소년"].filter(function (w) { return head.indexOf(w) !== -1; })[0] || "자녀";

    // 직업 유형: 제목·요약·핵심 문구 첫 줄(제외 문구 제외)에 한 가지 유형만 나올 때 대상 유형으로 본다.
    // v2: 정규화된 대상 문장(targetClauses)만 직업·학적 유형 판정에 쓴다. 대출 용도·졸업·채무·자녀 학비 같은 문장과 "대학생 자녀"는 신청자의 재학 조건이 아니다.
    // targetClauses가 없는 v2 문서는 본문 전체를 대상 문장으로 읽지 않고 제목·요약만 쓴다(보수적).
    var firstRule;
    if (v2) {
      firstRule = Array.isArray(e.targetClauses)
        ? e.targetClauses.filter(function (c) { return !TARGET_NOISE_RE.test(c); }).join(" ").replace(CHILD_STUDENT_RE, " ")
        : "";
    } else firstRule = coreList[0] || "";
    var typesAll = empTypesOf([p.title, p.summary, firstRule].filter(Boolean).join(" "));
    var typesStrong = empTypesOf((p.title || "") + " " + firstRule);
    var childLevel = /초\s*[·,]\s*중\s*[·,]\s*고|초등|중학|고등학|유치원|어린이집|영유아|아동|유아|학령/.test(head + " " + firstRule);
    var empType = typesAll.length === 1 ? typesAll[0] : null;
    if (empType === "student" && childLevel) empType = null;                        // 자녀의 재학 — 가구 구성으로 판단한다
    var etcTarget = /(?:대학생|재학생|대학원생|재직자|근로자|구직자|취업준비생|청년)\s*등/.test(head + " " + firstRule);
    var empTypeExplicit = !!empType && !etcTarget && typesStrong.length === 1 && typesStrong[0] === empType;
    var studentChild = typesAll.length === 1 && typesAll[0] === "student" && childLevel;
    var studentSoft = !empType && STUDENT_SOFT_RE.test([p.title, p.summary, firstRule].filter(Boolean).join(" "));
    var workerSoft = !empType && WORKER_SOFT_RE.test([p.title, p.summary, firstRule].filter(Boolean).join(" "));
    var institutional = INSTITUTION_RE.test(head + " " + firstRule);

    // 소득: 유형별 기준이 섞이면 하나로 합치지 않는다.
    var percents = [], varies = false, incomeReq = false;
    if (v2 && e.income) {
      percents = e.income.percents || []; varies = !!e.income.varies; incomeReq = (e.income.rules || []).length > 0;
    } else {
      var re = /중위소득\s*(\d{2,3})\s*%/g, m;
      while ((m = re.exec(full)) !== null) { var v = Number(m[1]); if (percents.indexOf(v) === -1) percents.push(v); }
      var prefIncome = INCOME_WORD.test(prefText);                       // 우대·유형별 조건에만 소득 기준이 있는 경우도 소득 요건으로 본다
      incomeReq = INCOME_WORD.test(elig) || prefIncome || RE.lowIncomeSoft.test(head);
      var tmm = elig.match(TIER_RE);
      varies = percents.length > 1 || prefIncome || (!!tmm && incomeReq);
    }
    var tiered = age.tiered || (v2 ? false : (function () { var t = elig.match(TIER_RE); return !!t && uniq(t).length > 1; })());

    // 주거: 제목/핵심 문구에 임차·무주택 요건이 있으면 주거 조건 필요 (상태 단정은 하지 않는다)
    var rentHead = RE.rentBased.test(head);
    var housingReq = rentHead || /무주택|임차|월세|전세|보증금|청약/.test(coreText);
    var monthlyOnly = RE.monthlyRent.test(head) && !/전세|전월세/.test(head);
    var jeonseOnly = /전세/.test(head) && !RE.monthlyRent.test(head);
    var noHouseReq = /무주택/.test(coreText + " " + head);

    var academicEnrolled = EMP_TYPE_RE.student.test(head + " " + firstRule);
    var academicGraduated = /졸업|최종\s*학력|학적/.test(coreText) && !academicEnrolled;

    var prof = {
      src: p, today: todayStr, v2: v2,
      head: head, elig: elig, coreText: coreText, exclusionText: exclusions.join(" "), exclusions: exclusions,
      general: isGeneral, audience: audience,
      age: age,
      hasMin: age.min !== null, hasMax: age.max !== null, min: age.min, max: age.max,
      narrowAge: age.max !== null && age.maxHard && age.max <= 45 && !(age.max <= 20 && (age.min === null || age.min <= 15)),
      schoolAge: age.max !== null && age.max <= 20 && (age.min === null || age.min <= 15),
      regionInfo: regionInfoOf(p),
      tags: p.targetEmployment || [],
      groups: groups, multiGroup: multiGroup, enumerated: enumerated, qualifier: qualifier,
      senior: seniorFlag, parenting: parentingFlag, minor: minorFlag, singleParent: singleParentFlag,
      female: /여성/.test(head), femaleOnly: femaleOnly, femaleStrict: femaleStrict, license: RE.license.test(head),
      restrictive: restrictive, specialQuals: specialQuals, childNoun: childNoun, childExempt: CHILD_EXEMPT_RE.test(head + " " + coreText), softGroups: softGroups, softSingleParent: softSingleParent, softParenting: softParenting, studentChild: studentChild,
      empType: empType, studentSoft: studentSoft, workerSoft: workerSoft, institutional: institutional, multiEmp: typesAll.length > 1, empTypeExplicit: empTypeExplicit,
      youthOriented: (age.max !== null && age.max <= 45) || /청년/.test(head),
      lowIncomeSoft: RE.lowIncomeSoft.test(head),
      needsIncome: /소득이\s*있는|소득\s*발생|월\s*\d+\s*만\s*원\s*이상\s*(근로|소득)/.test(full),
      youthText: RE.youth.test(head),
      incomeReq: incomeReq, incomeCap: (percents.length === 1 && !varies) ? percents[0] : null, incomeVaries: varies,
      tiered: tiered,
      housingReq: housingReq, rentHead: rentHead, monthlyOnly: monthlyOnly, jeonseOnly: jeonseOnly, noHouseReq: noHouseReq,
      academicEnrolled: academicEnrolled, academicGraduated: academicGraduated,
      delegated: DELEGATED_RE.test(coreText + " " + prefText + " " + (p.deadlineText || "")),
      structuredOnly: !v2
    };
    if (key) profileCache[key] = prof;
    return prof;
  }

  function regionInfoOf(p) {
    if (hasV2(p) && p.eligibility.regionName) {
      var rn = p.eligibility.regionName;
      if (rn === "전국") return { national: true, unknown: false, names: ["전국"] };
      if (rn === "unknown") return { national: false, unknown: true, names: [] };
      var names = (p.eligibility.regionNames && p.eligibility.regionNames.length) ? p.eligibility.regionNames : expandRegion(rn);
      // 소관기관이 시·도 자체가 아니라 그 아래 시·군·구면(예: 충청남도 당진시) 입력한 시·도만으로는 거주 조건을 확인할 수 없다.
      var org = String(p.eligibility.orgName || "").replace(/^(?:\([^)]*\)|재단법인|사단법인)\s*/, "").trim();
      var rr = p.eligibility.regionRequirement;
      return { national: false, unknown: false, names: names, sub: !!org && org !== rn, subject: (rr && rr.subject) || "unknown" };
    }
    var legacy = p.targetRegions || [];
    var national = legacy.indexOf("전국") !== -1;
    return { national: national, unknown: false, names: legacy.filter(function (x) { return x !== "전국"; }), sub: !national };
  }

  var EMP_USER_TYPE = { "대학생": "student", "재직자": "worker", "취준생": "jobSeek", "무직": "jobSeek", "자영업자": "selfEmp", "프리랜서": "selfEmp" };
  var EMP_TYPE_LABEL = { student: "대학생", worker: "재직자", jobSeek: "구직자", selfEmp: "자영업자" };
  // 대상 유형과 겹칠 수 있는 입력 상태: 이 조합은 제외하지 않고 직업 상태 확인으로 둔다(학생 여부는 별도 질문으로 판단).
  var EMP_COMPAT = { jobSeek: ["student", "worker"], worker: ["selfEmp", "student"], selfEmp: ["worker"] };
  var HOUSING_LABEL = { owner: "자가", jeonse: "전세", monthly: "월세", family: "부모님 집·기숙사 등" };

  // ---------- 판정 ----------
  // user: { age, region, employment, student, income, household, housing, special, applyStatus }
  //  - student: "enrolled"(재학·휴학 중)|"notEnrolled"(재학 중 아님)|""(미응답)
  //  - income: "50"|"100"|"150"|"over"|"" (모름/미응답)
  //  - household: "single"|"couple"|"pregnant"|"kids"|"singleParent"|"withFamily"|""
  //  - housing: "owner"|"jeonse"|"monthly"|"family"|""   (family = 부모님·기숙사 등 무상거주)
  //  - special: null(미응답) | string[] (빈 배열 = "해당 없음" 응답)
  //  - applyStatus: ""(기본: 종료·중단은 불일치로 숨김)|"open"|"upcoming"|"closed"|"discontinued"
  function classifyAuto(p, user, todayStr) {
    var prof = analyzeProgram(p, todayStr);
    var reasons = []; // { kind: "match"|"unknown"|"mismatch", text, strong?, blocking? }
    function add(kind, text, extra) {
      var r = { kind: kind, text: text };
      if (extra) for (var k in extra) r[k] = extra[k];
      reasons.push(r);
    }
    user = user || {};
    var age = (user.age !== null && user.age !== undefined && user.age !== "" && !isNaN(Number(user.age))) ? Number(user.age) : null;
    var hasKids = user.household === "kids" || user.household === "singleParent" || user.household === "pregnant";
    var householdKnown = !!user.household;
    var band = user.income && INCOME_BANDS[user.income];
    var neverHigh = false;
    var childDemote = false;

    // 1) 신청 상태 (기본: 종료·중단은 불일치 / 사용자가 상태를 고르면 그 선택과 비교)
    var app = applicationStatusOf(p, todayStr);
    var appKey = applyStateKey(app);
    var want = user.applyStatus || "";
    var closedNow = app.state === "closed" || app.state === "discontinued";
    var closedText = app.state === "discontinued" ? "신규 지원 중단 (공식 안내)" : "신청 기간 종료";
    if (!want) {
      if (closedNow) add("mismatch", closedText, { status: true });
      else if (app.roundClosedHint) add("unknown", "현재 접수 회차는 마감됐을 수 있음 — 신청 기간 확인 필요", { blocking: true });
    } else if (want === "closed" || want === "discontinued") {
      neverHigh = true;                                          // 종료·중단 사업은 참고용 — 높은 적합도로 올리지 않는다
      if (app.state === want || (want === "closed" && closedNow)) add("match", "선택한 신청 상태와 일치 (" + APPLY_STATE_LABEL[app.state] + ")");
      else if (app.state === "unknown") add("unknown", "신청 상태를 확인할 수 없어요 — " + OFFICIAL_CHECK, { blocking: true });
      else add("mismatch", "선택한 신청 상태(" + APPLY_STATE_LABEL[want] + ")와 다름 (현재 " + APPLY_STATE_LABEL[appKey] + ")", { status: true });
    } else if (want === "open") {
      if (closedNow) add("mismatch", closedText, { status: true });
      else if (app.state === "upcoming") add("mismatch", "아직 신청 전 (신청 예정)", { status: true });
      else if (app.state === "open") add("match", "신청 중 (" + APPLY_STATE_LABEL[appKey] + ")");
      else add("unknown", "신청 가능 시기를 확인할 수 없어요 — " + OFFICIAL_CHECK, { blocking: true });
    } else if (want === "upcoming") {
      if (closedNow) add("mismatch", closedText, { status: true });
      else if (app.state === "open") add("mismatch", "이미 신청 중 (" + APPLY_STATE_LABEL[appKey] + ")", { status: true });
      else if (app.state === "upcoming") add("match", "신청 예정");
      else add("unknown", "신청 가능 시기를 확인할 수 없어요 — " + OFFICIAL_CHECK, { blocking: true });
    }

    // 2) 개인/사업자 구분은 화면 탭에서 분리하므로, 여기서는 사업자·농어업 대상 표시만 남긴다.
    if (prof.audience === "business") add("unknown", "사업자 대상 사업 — 해당 시 확인", { blocking: true });
    if (prof.audience === "primary") add("unknown", "농어업 종사자 대상 사업 — 해당 시 확인", { blocking: true });

    // 3) 연령 (본문 연령 문구 > 구조화 값. 문구가 말하지 않은 쪽 경계, 예외·유형별 기준은 제외하지 않고 확인 필요)
    var spec = prof.age;
    var childBeneficiary = (prof.minor || prof.parenting) && prof.hasMax && prof.max <= 19;
    var hasAgeSpec = prof.hasMin || prof.hasMax;
    if (age !== null) {
      var below = prof.hasMin && age < prof.min;
      var above = prof.hasMax && age > prof.max;
      var rangeText = prof.hasMin && prof.hasMax ? "만 " + prof.min + "~" + prof.max + "세" : (prof.hasMin ? "만 " + prof.min + "세 이상" : "만 " + prof.max + "세 이하");
      var shortRange = (prof.hasMin && prof.hasMax ? prof.min + "~" + prof.max + "세" : (prof.hasMin ? prof.min + "세 이상" : prof.max + "세 이하"));
      if (childBeneficiary && (below || above)) {
        // 자녀 대상 사업: 본인이 아니라 자녀의 나이 기준이다. 자녀가 있다고 답했으면 자녀 연령 확인으로,
        // 가구를 "1인 가구"로 답했고 위탁·입양·돌봄 같은 예외 문구가 없으면 명백한 연령 불일치로 본다. 가구를 답하지 않았으면 제외하지 않고 뒤로 보낸다.
        var childHardOut = (below && spec.minHard) || (above && spec.maxHard);
        var careSel = Array.isArray(user.special) && user.special.indexOf("careLeaver") !== -1;
        var childOnlyExempt = (careSel && prof.specialQuals.some(function (q) { return q.key === "facility"; })) || prof.childExempt || prof.groups.careLeaver || prof.softGroups.careLeaver || prof.groups.disability || prof.softGroups.disability;
        var bandKeys = (user.household === "kids" || user.household === "singleParent") && Array.isArray(user.childAges) ? user.childAges.filter(function (k) { return CHILD_AGE_BANDS[k]; }) : [];
        var pMin = prof.hasMin ? prof.min : 0, pMax = prof.hasMax ? prof.max : 120;
        var bandHit = bandKeys.filter(function (k) { return CHILD_AGE_BANDS[k][0] <= pMax && CHILD_AGE_BANDS[k][1] >= pMin; });
        var bandNames = { "0-2": "만 0~2세", "3-5": "만 3~5세", "elem": "초등학생", "teen": "중·고등학생", "adult": "성인 자녀" };
        if (hasKids && bandKeys.length && bandHit.length) {
          add("match", "자녀 연령대 일치 (" + bandNames[bandHit[0]] + ")", { strong: false, sel: true });
          add("unknown", "자녀 세부 연령·이용 여부 확인 필요 (" + shortRange + " " + prof.childNoun + " 대상)", { blocking: true });
        } else if (hasKids && bandKeys.length && !childOnlyExempt && childHardOut) {
          add("mismatch", "연령 조건 불일치: " + shortRange + " " + prof.childNoun + " 대상 (선택한 자녀 연령대와 다름)");
        } else if (hasKids) { childDemote = true; add("unknown", "자녀 연령 확인 필요 (" + shortRange + " " + prof.childNoun + " 대상)", { blocking: true }); }
        else if (childHardOut && !childOnlyExempt && user.household === "single") add("mismatch", "연령 조건 불일치: " + shortRange + " " + prof.childNoun + " 대상");
        else if (childHardOut && !childOnlyExempt) { childDemote = true; add("unknown", "자녀 대상 사업 (" + shortRange + " " + prof.childNoun + ") — 자녀가 있는 경우에만 해당", { blocking: true }); }   // 가구 미응답: 제외하지 않고 뒤로 보낸다
        // 그 밖에는 아래 가구 구성 단계에서 확인 필요로 둔다.
      } else if (below || above) {
        var unverifiedSide = (below && !spec.minHard) || (above && !spec.maxHard);
        var withinException = spec.soft && ((above && (spec.tiered && spec.source !== "text" ? true : (spec.extMax !== null && age <= spec.extMax))) ||
                                            (below && ((spec.tiered && spec.source !== "text") || spec.hasExc)));
        if (unverifiedSide) add("unknown", "연령 기준이 공고문과 다를 수 있어 확인 필요", { blocking: true });
        else if (withinException) add("unknown", "연령 예외·유형별 기준 확인 필요 (" + rangeText + " 기준, 병역 인정·유형별 차이 가능)", { blocking: true });
        else add("mismatch", "연령 조건 불일치: " + rangeText + " 대상");
      } else if (hasAgeSpec) {
        add("match", "연령 조건 일치 (" + rangeText + ")", { strong: prof.narrowAge && !spec.soft });
        if (spec.soft) add("unknown", "연령 예외·유형별 기준 확인 필요", { blocking: false });
        if (prof.schoolAge) add("unknown", "학령기(초·중·고) 대상 사업 — 해당 시 확인", { blocking: true });
      }
      if (prof.senior && age < 60) add("mismatch", "연령 조건 불일치: 고령자 대상");
      if (prof.youthText && !prof.hasMax && /청년/.test(prof.head)) {
        if (age > 45) add("mismatch", "청년 대상 사업 (연령 초과)");
        else if (age > 39) add("unknown", "청년 연령 기준 확인 필요", { blocking: true });
      }
    } else if (hasAgeSpec) {
      add("unknown", "연령 확인 필요", { blocking: true });
    }

    // 4) 지역 (eligibility.regionName + 광주·전남 통합특별시 별칭 우선)
    var ri = prof.regionInfo;
    if (ri.unknown) {
      add("unknown", "지역 정보 확인 필요", { blocking: true });
    } else if (!ri.national && ri.names.length) {
      if (user.region) {
        var regionHit = regionsIntersect(ri.names, user.region);
        var rsub = ri.subject;
        if (rsub === "applicant_or_parent") {
          // 본인 또는 부모 중 한쪽만 해당해도 되는 조건: 부모 거주지는 입력받지 않으므로 본인 지역이 달라도 제외하지 않는다.
          if (regionHit) add("match", "거주 지역 일치 (" + user.region + ", 본인 또는 부모 거주 조건)");
          else add("unknown", "본인 또는 부모의 거주지 조건 (" + ri.names[0] + ") — 부모 거주지 확인 필요", { blocking: true });
          if (regionHit && ri.sub) add("unknown", "시·군·구 단위 거주 조건 확인 필요", { blocking: true });
        } else if (rsub === "school" || rsub === "organization") {
          // 학교·기관 소재지는 사용자의 거주지 조건이 아니다.
          if (regionHit) add("match", "소재지 일치 (" + user.region + ", 학교·기관 기준)");
          else add("unknown", "학교·기관 소재지(" + ri.names[0] + ") 기준 사업 — 해당 여부 확인 필요", { blocking: true });
        } else if (!regionHit) {
          add("mismatch", ri.names[0] + " 거주자 대상 (입력: " + user.region + ")");
        } else {
          add("match", "거주 지역 일치 (" + user.region + ") · 자치구 조건 확인 필요");
          if (rsub === "applicant_and_parent") add("unknown", "부모의 거주지도 조건 — 부모 거주지 확인 필요", { blocking: true });
          if (ri.sub) add("unknown", "시·군·구 단위 거주 조건 확인 필요", { blocking: true });
        }
      } else {
        add("unknown", "거주 지역 정보 부족 (" + ri.names[0] + " 한정)", { blocking: true });
      }
    }

    // 5) 학적·직업 상태 (대상 유형이 분명할 때만 충돌로 본다)
    var userType = user.employment ? EMP_USER_TYPE[user.employment] : null;
    var userStudent = user.student === "enrolled" || user.employment === "대학생";
    var userNotStudent = user.student === "notEnrolled";
    if (prof.empType === "student") {
      // 재학생 대상: 재학 중이라고 답했을 때만 일치, "재학 중 아님"이라고 답했을 때만 충돌. 그 외는 확인 필요.
      if (userStudent) add("match", "재학생 대상 사업" + (prof.empTypeExplicit ? "" : "으로 보임"), { strong: !prof.general && !prof.enumerated && prof.empTypeExplicit && !prof.institutional });
      else if (userNotStudent && !prof.institutional && prof.empTypeExplicit) add("mismatch", "재학생 대상 사업 (입력: 재학 중 아님)");
      else add("unknown", "재학 여부 확인 필요", { blocking: true });
    } else {
      if (prof.studentSoft && !userStudent) add("unknown", "재학 여부(학자금·장학 대상) 확인 필요", { blocking: true });
      if (prof.workerSoft && userType !== "worker") add("unknown", "재직 여부(근로자 대상) 확인 필요", { blocking: true });
      if (user.employment) {
        var tags = prof.tags;
        if (prof.empType) {
          var typeLabel = EMP_TYPE_LABEL[prof.empType];
          var hedge = prof.empTypeExplicit ? " 대상 사업" : " 대상으로 보임";
          if (userType === prof.empType) {
            var strongType = (prof.empType === "jobSeek" || prof.youthOriented) && prof.empTypeExplicit;
            add("match", (prof.empType === "jobSeek" ? "구직·취업 지원 사업" : typeLabel + hedge), { strong: strongType && !prof.general && !prof.enumerated && !prof.institutional });
          } else if (prof.empTypeExplicit && prof.empType === "worker" && !prof.institutional && (EMP_COMPAT.worker || []).indexOf(userType) === -1) {
            add("mismatch", typeLabel + " 대상 사업 (입력: " + user.employment + ")");
          } else if ((EMP_COMPAT[prof.empType] || []).indexOf(userType) !== -1) {
            add("unknown", typeLabel + " 대상 사업 — 직업 상태 확인 필요", { blocking: true });
          } else {
            add("unknown", typeLabel + " 대상으로 보임 — 직업 상태 확인 필요", { blocking: true });
          }
        } else if (tags.length && !prof.multiEmp) {
          if (tags.indexOf(user.employment) !== -1) add("match", user.employment + " 대상으로 보임", { strong: false });
        }
      } else if (prof.empType) {
        add("unknown", EMP_TYPE_LABEL[prof.empType] + " 대상 여부 확인 필요", { blocking: true });
      }
    }
    if (prof.institutional) add("unknown", "기관·단체(연구단 등) 대상 사업 — 개인이 신청할 수 있는지 " + OFFICIAL_CHECK, { blocking: true });
    if (prof.needsIncome && (user.employment === "대학생" || user.employment === "취준생" || user.employment === "무직")) {
      add("unknown", "소득이 있어야 하는 사업 — 소득 발생 여부 확인 필요", { blocking: true });
    }
    if (prof.academicGraduated) add("unknown", "졸업·학적 조건 확인 필요", { blocking: true });
    if (prof.femaleOnly) {
      var femSel = Array.isArray(user.special) && user.special.indexOf("female") !== -1;
      if (femSel) { add("match", "여성 대상 해당 (입력 기준)", { strong: false, sel: true }); add("unknown", "세부 요건(경력단절 등) 확인 필요", { blocking: true }); }
      else if (Array.isArray(user.special) && user.special.length === 0 && prof.femaleStrict) add("mismatch", "여성 전용 사업 (특별 자격 '해당 없음')");
      else add("unknown", "여성 대상 사업 — 해당 시 확인", { blocking: true, dup: true });
    } else if (prof.female && !FEMALE_EXCLUDE_RE.test(prof.head)) add("unknown", "여성 대상 사업 — 해당 시 확인", { blocking: true });
    if (prof.license) add("unknown", "특정 자격·면허 소지자 대상 — 해당 시 확인", { blocking: true, dup: true });
    if (age !== null && age <= 39 && prof.youthText && /청년/.test(prof.head) && !hasReason(reasons, "mismatch") && !prof.enumerated) {
      add("match", "청년 대상 사업", { strong: true });
    }

    // 6) 소득 — 입력 구간과 달라 보여도 제외하지 않는다. 확인된 경우에만 "확인됨"으로 보고, 아니면 확인 필요(차단).
    if (prof.incomeReq) {
      if (band && prof.incomeCap !== null) {
        if (band.hi <= prof.incomeCap) add("match", "소득 조건 범위 내 (중위소득 " + prof.incomeCap + "% 이하)", { strong: false });
        else add("unknown", "소득 조건 확인 필요 (중위소득 " + prof.incomeCap + "% 이하)", { blocking: true });
      } else if (prof.incomeVaries || prof.tiered) {
        add("unknown", "유형별 소득 기준이 달라 " + OFFICIAL_CHECK, { blocking: true });
      } else {
        add("unknown", "소득 조건 확인 필요", { blocking: true });
      }
    }

    // 7) 특별 자격 (장애·보훈·저소득 등) — 응답 전에는 추측하지 않고 확인 필요로 둔다. 공식 제외 문구는 별도 처리.
    STATUS_GROUPS.forEach(function (g) {
      if (!prof.groups[g]) return;
      if (user.special === null || user.special === undefined) {
        add("unknown", STATUS_LABEL[g] + " 대상 — 해당 시 확인", { blocking: true, dup: true });
      } else if (user.special.indexOf(g) !== -1) {
        add("match", STATUS_LABEL[g] + " 해당 (입력 기준)", { strong: false, sel: true });
        add("unknown", "세부 요건(신분 범위·정도 등) 확인 필요", { blocking: true });
      } else {
        add("mismatch", STATUS_LABEL[g] + " 대상 사업 (특별 자격 '해당 없음')");
      }
    });
    STATUS_GROUPS.forEach(function (g) {
      if (!prof.softGroups[g]) return;
      if (Array.isArray(user.special) && user.special.indexOf(g) !== -1) add("match", STATUS_LABEL[g] + " 해당 (입력 기준)", { strong: false, sel: true });
      add("unknown", STATUS_LABEL[g] + " 관련 요건 — 해당 시 확인", { blocking: true, dup: true });
    });
    // 공식 제외 문구에 입력한 신분이 명시되면 제외, 모호하면 확인 필요
    if (prof.exclusionText && Array.isArray(user.special)) {
      user.special.forEach(function (g) {
        if (!RE[g] || prof.groups[g]) return;
        if ((EXCL_STRICT[g] || STRICT[g]) && (EXCL_STRICT[g] || STRICT[g]).test(prof.exclusionText)) add("mismatch", "공식 제외 대상에 해당 (" + STATUS_LABEL[g] + ")");
        else if (RE[g].test(prof.exclusionText)) add("unknown", "제외 대상 해당 여부 확인 필요 (" + STATUS_LABEL[g] + ")", { blocking: true });
      });
    }

    // 8) 가구 구성 — "자녀와 함께"는 한부모일 수 있고 "부부·동거"는 임신·출산 예정일 수 있어 단정하지 않는다.
    if (prof.softSingleParent) add("unknown", "한부모·조손 가구 관련 요건 — 해당 시 확인", { blocking: true, dup: true });
    if (prof.softParenting) add("unknown", "임신·출산·양육 관련 요건 — 해당 시 확인", { blocking: true });
    if (prof.singleParent) {
      if (!householdKnown) add("unknown", "한부모·조손 가구 대상 — 해당 시 확인", { blocking: true, dup: true });
      else if (user.household === "singleParent") add("match", "한부모 가구 해당 (입력 기준)", { strong: false, sel: true });
      else if (user.household === "kids" || user.household === "pregnant") add("unknown", "한부모·조손 가구 대상 — 해당 여부 확인 필요", { blocking: true, dup: true });
      else add("unknown", "한부모·조손 가구 대상 — 입력한 가구 구성과 다를 수 있어 확인 필요", { blocking: true, dup: true });
    } else if ((prof.parenting || prof.minor) && !prof.groups.careLeaver && !prof.groups.disability) {
      var familyLabel = prof.parenting ? "임신·출산·자녀 양육 가구 대상" : "아동·청소년 대상 사업";
      if (!householdKnown) add("unknown", familyLabel + " — 해당 시 확인", { blocking: true });
      else if (hasKids) add("match", "자녀 양육·임신 가구 (입력 기준) · 세부 요건 확인 필요", { sel: true });
      else add("unknown", familyLabel + " — 자녀·임신 여부(위탁·입양·돌봄 포함)를 공식 공고문에서 확인 필요", { blocking: true });
    }

    // 9) 주거 — 제목의 전세·월세 단어로 현재 거주 상태를 단정해 제외하지 않는다(미래 계약·이전 가능).
    if (prof.housingReq && !prof.groups.victim && !prof.softGroups.victim) {
      var h = user.housing;
      var strongHousing = !(prof.minor || prof.parenting) && !prof.enumerated;
      var verified = false;
      if (h && prof.monthlyOnly && !prof.noHouseReq) { verified = h === "monthly"; }
      else if (h && prof.jeonseOnly && !prof.noHouseReq) { verified = h === "jeonse"; }
      if (verified) {
        add("match", (prof.monthlyOnly ? "월세" : "전세") + " 거주 조건 일치 (입력 기준)", { strong: false });
      } else if (h) {
        add("unknown", "주거 형태·무주택 조건 확인 필요 (입력: " + HOUSING_LABEL[h] + ")", { blocking: true });
      } else {
        add("unknown", "주거 조건 확인 필요", { blocking: true });
      }
      if (prof.noHouseReq && verified) add("unknown", "무주택 요건은 직접 확인이 필요합니다", { blocking: true });
    }

    // 유형별(우대형·일반형 등) 요건이 따로 있으면 어느 유형에 해당하는지 입력만으로는 알 수 없다.
    if (prof.tiered) add("unknown", "유형별(우대·일반 등) 요건이 달라 " + OFFICIAL_CHECK, { blocking: true });

    if (prof.restrictive) add("unknown", "특정 계층 대상 여부 확인 필요 — " + OFFICIAL_CHECK, { blocking: true, dup: true });

    // 10) 근거가 얇은 경우: 여러 대상을 나열했거나 세부 대상을 공고에 위임한 사업
    if (prof.enumerated) add("unknown", "여러 대상 유형이 나열된 사업 — " + OFFICIAL_CHECK, { blocking: true });
    if (prof.delegated) add("unknown", "세부 대상은 지자체·공고에 따라 달라 " + OFFICIAL_CHECK, { blocking: true });

    // 11) 특수 자격: 사용자가 해당 자격을 고르지 않은 전용 사업은 하나의 신호로 모아 보여주고, 높은 적합도로 올리지 않으며 정렬에서 뒤로 보낸다.
    var unmet = prof.specialQuals.filter(function (q) {
      if (STATUS_GROUPS.indexOf(q.key) !== -1) return !(Array.isArray(user.special) && user.special.indexOf(q.key) !== -1);
      if (q.key === "singleParent") return user.household !== "singleParent";
      if (q.key === "female") return !(Array.isArray(user.special) && user.special.indexOf("female") !== -1);
      if (q.key === "facility") return !(Array.isArray(user.special) && user.special.indexOf("careLeaver") !== -1);
      return true;
    });
    // 사용자가 직접 고른 자격·가구와 맞는 사업은 한 단계 더 가중한다.
    var matchedCount = reasons.reduce(function (n, r) { return n + (r.kind === "match" ? (r.sel ? 2 : 1) : 0); }, 0);
    if (unmet.length) {
      reasons = reasons.filter(function (r) { return !r.dup; });
      var labels = unmet.map(function (q) { return q.label; });
      var front = [{ kind: "unknown", text: "특정 자격 확인 필요: " + labels.slice(0, 2).join("·") + (labels.length > 2 ? " 등" : ""), blocking: true, special: true }];
      if (!hasReason(reasons, "mismatch")) {
        var ageIdx = -1;
        reasons.forEach(function (r, i) { if (r.kind === "match" && /^연령 조건 일치/.test(r.text)) ageIdx = i; });
        if (ageIdx !== -1) {
          reasons.splice(ageIdx, 1);
          front.push({ kind: "unknown", text: "연령은 일치하지만 특수 자격 확인 필요", blocking: false, special: true });
        }
      }
      reasons = front.concat(reasons);
    }
    var unknownCount = reasons.filter(function (r) { return r.kind === "unknown" && r.blocking && !r.special; }).length;

    // ---------- 등급 ----------
    var hasMismatch = hasReason(reasons, "mismatch");
    var strongMatch = reasons.some(function (r) { return r.kind === "match" && r.strong; });
    var blocking = reasons.some(function (r) { return r.kind === "unknown" && r.blocking; });
    var grade;
    if (hasMismatch) grade = GRADE.MISMATCH;
    else if (strongMatch && !blocking && !neverHigh) grade = GRADE.HIGH;
    else grade = GRADE.CHECK;

    if (grade === GRADE.CHECK && !reasons.some(function (r) { return r.kind === "unknown" && r.text.indexOf("공식 공고문") !== -1; })) {
      add("unknown", OFFICIAL_CHECK);
    }

    return {
      program: p, grade: grade, audience: prof.audience === "personal" ? "personal" : "business", reasons: reasons, applyState: appKey,
      rank: { matched: matchedCount, unknown: unknownCount, special: (unmet.length || childDemote) ? 1 : 0 }
    };
  }

  // 같은 등급 안의 관련도 비교: 사용자가 고르지 않은 특수 자격 전용 사업은 뒤로 → 일치한 조건이 많을수록 → 미확인 필수 조건이 적을수록.
  // 0이면 동률(호출 쪽에서 신청 마감 임박도 등 기존 정렬을 유지한다).
  function compareFit(a, b) {
    var ra = a.rank || { matched: 0, unknown: 0, special: 0 }, rb = b.rank || { matched: 0, unknown: 0, special: 0 };
    if (ra.special !== rb.special) return ra.special - rb.special;
    if ((ra.auto || 0) !== (rb.auto || 0)) return (ra.auto || 0) - (rb.auto || 0);             // 자동 판정에서 조건이 어긋나 보인 미검토 사업은 뒤로
    if ((ra.region || 0) !== (rb.region || 0)) return (ra.region || 0) - (rb.region || 0);      // 다른 지역 기관 사업은 같은 조건이면 뒤로
    if ((ra.gap || 0) !== (rb.gap || 0)) return (ra.gap || 0) - (rb.gap || 0);                  // 대상 직업군·상황이 사용자와 다른 사업은 뒤로
    if ((ra.tier || 0) !== (rb.tier || 0)) return (ra.tier || 0) - (rb.tier || 0);               // 공식 공고 기반으로 정리한 사업 우선
    if (ra.matched !== rb.matched) return rb.matched - ra.matched;
    return ra.unknown - rb.unknown;
  }

  // =====================================================================================
  // 공식 공고 기반으로 조건을 정리한 핵심 사업(reviewed) 우선 구조
  //  - reviewed: data/subsidy-eligibility-reviewed.json (공식 보조금24 상세를 사람이 대조해 구조화) — 높음·확인 필요·불일치 모두 가능
  //  - unreviewed: 자동 추출·기존 필드만 있는 사업 — 높음 불가, 신청 종료·중단 외에는 불일치로 제외하지 않는다(정렬 보조 신호로만 사용)
  //  - reviewed 파일이 없거나 불러오지 못해도(REVIEWED === null) 모든 사업을 unreviewed 안전 모드로 처리한다 — 공격적인 자동 판정(classifyAuto)으로 복귀하지 않는다
  //  - 일부 항목만 잘못된 파일은 정상 항목만 쓰고 나머지는 unreviewed로 둔다(validateReviewed)
  // =====================================================================================
  var REVIEWED = null;
  var REVIEWED_STATES = ["always", "open", "periodic", "agency", "closed", "discontinued", "unknown"];
  var SPECIAL_CHIPS = ["disability", "veteran", "lowIncome", "multicultural", "victim", "careLeaver", "female"];
  var REVIEWED_SPECIAL_LABEL = { disability: "장애인", veteran: "보훈·군 복무", lowIncome: "기초수급·차상위", multicultural: "다문화·북한이탈", victim: "피해자", careLeaver: "보호종료(자립준비청년)", female: "여성", juvenile: "소년원 출원생 등" };
  var HOUSEHOLD_LABEL = { single: "1인 가구", couple: "부부·동거", pregnant: "임신·출산", kids: "자녀 양육", singleParent: "한부모", withFamily: "부모님·가족과 함께" };
  // 화면의 가구 선택지 중 "(자녀 없음)"이 명시된 응답 — reviewed 사업에서는 자녀 전용 조건과 명백히 충돌한다
  var NO_KIDS_HOUSEHOLDS = ["single", "couple", "withFamily"];
  var HOUSING_REQ_LABEL = { monthly: "월세", jeonse: "전세", owner: "자가", family: "부모님 집·기숙사" };

  function isYmd(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  // reviewed 파일 검증: 출처·기준일·검토일·상태가 없는 항목, 중복 ID, 잘못된 스키마는 거부한다(해당 사업은 unreviewed로 처리).
  function validateReviewed(payload) {
    var map = {}, errors = [];
    var list = payload && Array.isArray(payload.programs) ? payload.programs : null;
    if (!list) return { map: null, errors: ["programs 배열 없음"], count: 0 };
    list.forEach(function (e, i) {
      var id = e && e.programId;
      var bad = [];
      if (!id || typeof id !== "string") bad.push("programId");
      if (e.reviewStatus !== "reviewed") bad.push("reviewStatus");
      if (e.schemaVersion !== 1) bad.push("schemaVersion");
      if (typeof e.sourceUrl !== "string" || e.sourceUrl.indexOf("https://www.gov.kr/") !== 0) bad.push("sourceUrl");
      if (!isYmd(e.sourceModifiedAt)) bad.push("sourceModifiedAt");
      if (!isYmd(e.reviewedAt)) bad.push("reviewedAt");
      if (typeof e.conditionsComplete !== "boolean") bad.push("conditionsComplete");
      if (!e.applicationStatus || REVIEWED_STATES.indexOf(e.applicationStatus.state) === -1) bad.push("applicationStatus");
      if (!Array.isArray(e.requiredUnknowns)) bad.push("requiredUnknowns");
      if (id && map[id]) bad.push("중복 ID");
      if (bad.length) { errors.push((id || "#" + i) + ": " + bad.join(",")); return; }
      map[id] = e;
    });
    return { map: map, errors: errors, count: Object.keys(map).length };
  }
  function setReviewed(payload) {
    if (payload === null) { REVIEWED = null; return { map: null, errors: [], count: 0 }; }
    var v = validateReviewed(payload);
    REVIEWED = v.map;
    return v;
  }
  function reviewedEntryOf(p) { return REVIEWED && p && p.id ? (REVIEWED[p.id] || null) : null; }

  function reviewedStatusOf(st, todayStr) {
    var today = todayStr || new Date().toISOString().slice(0, 10);
    if (st.state !== "open") return st.state;
    var ps = st.periods || [];
    if (!ps.length) return "open";
    if (ps.some(function (x) { return x.start <= today && today <= x.end; })) return "open";
    if (ps.some(function (x) { return x.start > today; })) return "upcoming";
    return "closed";
  }

  function classifyReviewed(entry, p, user, todayStr) {
    var reasons = [];
    function add(kind, text, extra) { var r = { kind: kind, text: text }; if (extra) for (var k in extra) r[k] = extra[k]; reasons.push(r); }
    user = user || {};
    var age = (user.age !== null && user.age !== undefined && user.age !== "" && !isNaN(Number(user.age))) ? Number(user.age) : null;
    var neverHigh = !entry.conditionsComplete;
    var specialUnmet = false, childDemote = false, gap = entry.situational ? 1 : 0;   // gap: 입력으로 알 수 없는 상황(입시·시험·예비창업)이나 대상 직업군이 사용자와 다른 사업

    // 1) 신청 상태
    var st = reviewedStatusOf(entry.applicationStatus, todayStr);
    var stKey = st === "always" ? "always" : (st === "open" || st === "upcoming" || st === "closed" || st === "discontinued" ? st : "unknown");
    var want = user.applyStatus || "";
    if (st === "closed" || st === "discontinued") {
      if (want === "closed" || want === "discontinued") { add("match", "선택한 신청 상태와 일치 (" + APPLY_STATE_LABEL[st] + ")"); neverHigh = true; }
      else add("mismatch", st === "closed" ? "신청 기간 종료 (공식 공고 기준)" : "신규 지원 중단 (공식 공고 기준)", { status: true });
    } else if (want === "closed" || want === "discontinued") {
      add("mismatch", "선택한 신청 상태(" + APPLY_STATE_LABEL[want] + ")와 다름", { status: true });
    } else if (st === "upcoming") {
      if (want === "open") add("mismatch", "아직 신청 전 (신청 예정)", { status: true }); else add("unknown", "신청 예정 — 신청 기간 확인 필요", { blocking: true });
    } else if (st === "always" || st === "open") {
      if (want === "upcoming") add("mismatch", "이미 신청 중", { status: true });
    } else {
      add("unknown", "신청 시기 확인 필요" + (entry.applicationStatus.note ? " (" + entry.applicationStatus.note + ")" : ""), { blocking: true });
    }

    // 2) 연령 (신청자 본인 / 자녀)
    var ag = entry.age;
    var hasKids = user.household === "kids" || user.household === "singleParent" || user.household === "pregnant";
    if (ag && ag.subject === "applicant") {
      var lo = ag.min, hi = ag.max;
      var range = (lo != null && hi != null) ? "만 " + lo + "~" + hi + "세" : (lo != null ? "만 " + lo + "세 이상" : "만 " + hi + "세 이하");
      if (age === null) add("unknown", "연령 확인 필요 (" + range + ")", { blocking: true });
      else {
        var exc = ag.exceptions && ag.exceptions.length;
        var birthBased = exc && ag.exceptions.join(" ").indexOf("출생") !== -1;
        var extHi = ag.extMax != null ? ag.extMax : (birthBased ? (hi != null ? hi + 1 : null) : (exc ? Infinity : hi));
        var extLo = birthBased ? (lo != null ? lo - 1 : null) : (exc && ag.extMax == null ? -Infinity : lo);
        var outLo = lo != null && age < lo, outHi = hi != null && age > hi;
        if (!outLo && !outHi) add("match", "연령 조건 일치 (" + range + ")");
        else if ((outHi && extHi != null && age <= extHi) || (outLo && extLo != null && age >= extLo)) add("unknown", "연령 예외 기준 확인 필요 (" + range + ", " + ag.exceptions[0] + ")", { blocking: true });
        else add("mismatch", "연령 조건 불일치: " + range + " 대상");
      }
    } else if (ag && ag.subject === "child") {
      var crange = "만 " + ag.min + "~" + ag.max + "세 자녀";
      var hh = user.household || "";
      if (NO_KIDS_HOUSEHOLDS.indexOf(hh) !== -1 && !(entry.household && (entry.household.required || []).indexOf("pregnant") !== -1)) add("mismatch", "자녀 대상 사업 (" + crange + ") — 입력: " + HOUSEHOLD_LABEL[hh] + "(자녀 없음)");
      else if (!hasKids) { childDemote = true; add("unknown", "자녀 대상 사업 (" + crange + ") — 자녀가 있는 경우에만 해당", { blocking: true }); }
      else {
        var bands = (Array.isArray(user.childAges) ? user.childAges : []).filter(function (k) { return CHILD_AGE_BANDS[k]; });
        var full = bands.filter(function (k) { return CHILD_AGE_BANDS[k][0] >= ag.min && CHILD_AGE_BANDS[k][1] <= ag.max; });
        var part = bands.filter(function (k) { return CHILD_AGE_BANDS[k][0] <= ag.max && CHILD_AGE_BANDS[k][1] >= ag.min; });
        if (full.length) add("match", "자녀 연령대 일치 (" + crange + ")", { sel: true });
        else if (part.length) add("unknown", "자녀 세부 연령 확인 필요 (" + crange + ")", { blocking: true });
        else if (bands.length) add("mismatch", "연령 조건 불일치: " + crange + " 대상 (선택한 자녀 연령대와 다름)");
        else { childDemote = true; add("unknown", "자녀 연령 확인 필요 (" + crange + ")", { blocking: true }); }
      }
    }

    // 3) 가구 (자녀 연령 사업은 위에서 판단)
    if (entry.household && !(ag && ag.subject === "child")) {
      var req = entry.household.required || [];
      var hhv = user.household || "";
      var labels = req.map(function (k) { return HOUSEHOLD_LABEL[k] || k; }).join("·");
      if (hhv && req.indexOf(hhv) !== -1) add("match", "가구 조건 일치 (" + HOUSEHOLD_LABEL[hhv] + ")", { sel: true });
      else if (NO_KIDS_HOUSEHOLDS.indexOf(hhv) !== -1 && req.indexOf("pregnant") === -1 && req.every(function (k) { return ["kids", "singleParent"].indexOf(k) !== -1; }))   // 임산부는 1인 가구일 수 있어 임신 포함 사업은 제외하지 않는다
         add("mismatch", "가구 조건 불일치: " + labels + " 대상 (입력: " + HOUSEHOLD_LABEL[hhv] + ")");
      else { add("unknown", "가구 조건 확인 필요 (" + labels + ")", { blocking: true }); if (hhv) gap = 1; }   // 가구를 답했는데 필요한 가구가 아니면 관련도 뒤로
    }

    // 4) 지역 — 공식 문구에 명시된 거주 요건만
    var regionWeakMiss = false;
    if (entry.regions && entry.regions.hard) {
      var names = entry.regions.names || [];
      var hit = !!user.region && regionsIntersect(names.reduce(function (a, n) { return a.concat(expandRegion(n)); }, []), user.region);
      if (!user.region) add("unknown", "거주 지역 확인 필요 (" + names[0] + ")", { blocking: true });
      else if (!hit) add("mismatch", names[0] + " 거주자 대상 (입력: " + user.region + ")");
      else if (entry.regions.level === "sigungu") neverHigh = true;               // 시·도만 입력받으므로 시·군·구 거주는 requiredUnknowns로 확인
      else add("match", "거주 지역 일치 (" + user.region + ")");
    } else if (entry.regions && entry.regions.names && entry.regions.names.length) {
      // 공식 대상 문구에 거주 요건은 없고 소관기관만 지자체인 사업 — 제외하지 않고 정렬에서만 뒤로
      var whit = !!user.region && regionsIntersect(entry.regions.names, user.region);
      if (user.region && !whit) { regionWeakMiss = true; add("unknown", "지역 사업으로 보이나 공식 거주요건 확인 필요 (" + entry.regions.names[0] + ")", { blocking: true }); }
    }

    // 5) 직업·학적
    var userType = user.employment ? EMP_USER_TYPE[user.employment] : null;
    if (entry.employment) {
      var allowed = entry.employment.allowed || [];
      var label = allowed.map(function (k) { return EMP_TYPE_LABEL[k] || k; }).join("·");
      if (userType && allowed.indexOf(userType) !== -1) add("match", "직업 상태 일치 (" + label + ")");
      else if (entry.employment.exclusive && userType === "jobSeek" && allowed.indexOf("jobSeek") === -1 && allowed.every(function (k) { return k === "worker" || k === "selfEmp"; }))
        add("mismatch", label + " 대상 사업 (입력: " + user.employment + ")");
      else { add("unknown", label + " 대상 여부 확인 필요", { blocking: true }); if (userType) gap = 1; }
    }
    if (entry.studentStatus === "enrolled") {
      var stud = user.student === "enrolled" || user.employment === "대학생";
      if (stud) add("match", "재학생 대상 사업 (입력: 재학 중)");
      else if (user.student === "notEnrolled") add("mismatch", "재학생 대상 사업 (입력: 재학 중 아님)");
      else add("unknown", "재학 여부 확인 필요", { blocking: true });
    }

    // 6) 소득 — 불일치로 쓰지 않는다
    if (entry.income && entry.income.required) {
      var band = user.income && INCOME_BANDS[user.income];
      if (!entry.income.varies && entry.income.maxMedianPct && band && band.hi <= entry.income.maxMedianPct) add("match", "소득 기준 범위 내 (" + entry.income.note + ")");
      else add("unknown", "소득 조건 확인 필요 (" + (entry.income.note || "공고 기준") + ")", { blocking: true });
    }

    // 7) 주거 — 불일치로 쓰지 않는다(미래 계약·이전 가능)
    if (entry.housing) {
      var hreq = entry.housing.required || [];
      if (user.housing && hreq.indexOf(user.housing) !== -1) add("match", (HOUSING_REQ_LABEL[user.housing]) + " 거주 조건 일치 (입력 기준)");
      else add("unknown", "주거 조건 확인 필요 (" + hreq.map(function (k) { return HOUSING_REQ_LABEL[k]; }).join("·") + (entry.housing.noHouse ? " · 무주택" : "") + ")", { blocking: true });
    }

    // 8) 특별 자격
    var sq = entry.specialQualifications;
    if (sq && sq.anyOf && sq.anyOf.length) {
      var slabels = sq.anyOf.map(function (k) { return REVIEWED_SPECIAL_LABEL[k] || k; }).join("·");
      var picked = Array.isArray(user.special) ? sq.anyOf.filter(function (k) { return user.special.indexOf(k) !== -1; }) : [];
      var hhAlt = (sq.householdAlternatives || []).indexOf(user.household) !== -1;
      if (picked.length) add("match", REVIEWED_SPECIAL_LABEL[picked[0]] + " 해당 (입력 기준)", { sel: true });
      else if (hhAlt) add("match", HOUSEHOLD_LABEL[user.household] + " 가구 해당 (입력 기준)", { sel: true });
      else if (sq.exclusive) {
        var allChips = sq.anyOf.every(function (k) { return SPECIAL_CHIPS.indexOf(k) !== -1; });
        // 가구를 답하지 않았거나 임신 가구일 때만 대체 가구(한부모 등)일 가능성을 열어 둔다 — 대체 가구를 직접 고른 경우는 위에서 이미 일치 처리했다.
        var altOpen = (sq.householdAlternatives || []).length && (!user.household || user.household === "pregnant");   // 임신 가구는 이미 자녀가 있을 수 있어 열어 둔다
        specialUnmet = true;
        if (Array.isArray(user.special) && allChips && !sq.openEnded && !altOpen) add("mismatch", slabels + " 대상 사업 (특별 자격 미해당)");
        else add("unknown", "특정 자격 확인 필요: " + slabels, { blocking: true, special: true });
      }
    }

    // 9) 사람이 확인했지만 입력으로 알 수 없는 필수 조건
    (entry.requiredUnknowns || []).forEach(function (t) { add("unknown", t + " — 확인 필요", { blocking: true }); });
    if (!entry.conditionsComplete) add("unknown", "공식 조건 일부를 구조화하지 못함 — 공고 확인 필요", { blocking: true });

    var hasMismatch = reasons.some(function (r) { return r.kind === "mismatch"; });
    var blocking = reasons.some(function (r) { return r.kind === "unknown" && r.blocking; });
    var matchedCount = reasons.reduce(function (n, r) { return n + (r.kind === "match" ? (r.sel ? 2 : 1) : 0); }, 0);
    var statusOk = st === "always" || st === "open";
    var grade = hasMismatch ? GRADE.MISMATCH : ((!blocking && !neverHigh && statusOk && isYmd(entry.sourceModifiedAt) && matchedCount > 0) ? GRADE.HIGH : GRADE.CHECK);
    // 특별 자격 칩은 카드 앞쪽에
    reasons.sort(function (a, b) { return (b.special ? 1 : 0) - (a.special ? 1 : 0); });
    return {
      program: p, grade: grade, audience: "personal", reasons: reasons, applyState: stKey,
      reviewed: { sourceModifiedAt: entry.sourceModifiedAt, reviewedAt: entry.reviewedAt, sourceUrl: entry.sourceUrl, conditionsComplete: entry.conditionsComplete },
      rank: { tier: 0, auto: 0, gap: gap, region: regionWeakMiss ? 1 : 0, matched: matchedCount, special: (specialUnmet || childDemote) ? 1 : 0,
        unknown: reasons.filter(function (r) { return r.kind === "unknown" && r.blocking && !r.special; }).length }
    };
  }

  // reviewed 파일이 있으면: 목록에 있는 사업은 reviewed 판정, 없는 사업은 자동 판정을 "공고 확인 필요"로 낮춘다.
  function classify(p, user, todayStr) {
    var entry = reviewedEntryOf(p);
    if (entry) return classifyReviewed(entry, p, user, todayStr);
    var r = classifyAuto(p, user, todayStr);
    var autoMis = false;
    var reasons = r.reasons.map(function (x) {
      if (x.kind === "mismatch" && !x.status) { autoMis = true; return { kind: "unknown", text: "자동 판정: " + x.text + " — 공고 확인 필요", blocking: true, auto: true }; }
      return x;
    });
    var stillMismatch = reasons.some(function (x) { return x.kind === "mismatch"; });
    reasons.push({ kind: "unknown", text: "공고 확인 필요 (자동 판정 — 공식 조건 미검토)", blocking: true });
    var rank = r.rank || {};
    return {
      program: r.program, grade: stillMismatch ? GRADE.MISMATCH : GRADE.CHECK, audience: r.audience, reasons: reasons, applyState: r.applyState, reviewed: null,
      rank: { tier: 1, auto: autoMis ? 1 : 0, region: rank.region || 0, matched: rank.matched || 0, special: rank.special || 0, unknown: rank.unknown || 0 }
    };
  }
  function reviewedCount() { return REVIEWED ? Object.keys(REVIEWED).length : 0; }

  function hasReason(reasons, kind) {
    for (var i = 0; i < reasons.length; i++) if (reasons[i].kind === kind) return true;
    return false;
  }

  // 카드에 보여줄 이유 칩(최대 n개): 불일치 > 일치 > 확인 필요 순으로 짧게
  function pickReasons(result, max) {
    max = max || 3;
    function by(kind) { return result.reasons.filter(function (r) { return r.kind === kind; }); }
    var m = by("match"), u = by("unknown"), x = by("mismatch");
    var out;
    if (result.grade === GRADE.MISMATCH) out = x.concat(u, m);
    else if (result.grade === GRADE.HIGH) {
      // 확정처럼 보이지 않도록, 확인이 필요한 항목이 있으면 일치 항목이 많아도 항상 함께 보여준다.
      out = m.slice(0, u.length ? max - 1 : max).concat(u, m.slice(max - 1));
    } else out = u.concat(m, x);
    return out.slice(0, max);
  }

  return {
    GRADE: GRADE,
    GRADE_RANK: GRADE_RANK,
    GRADE_LABEL: GRADE_LABEL,
    APPLY_STATE_LABEL: APPLY_STATE_LABEL,
    INCOME_BANDS: INCOME_BANDS,
    STATUS_LABEL: STATUS_LABEL,
    STATUS_GROUPS: STATUS_GROUPS,
    analyzeProgram: analyzeProgram,
    classify: classify,
    classifyAuto: classifyAuto,
    classifyReviewed: classifyReviewed,
    validateReviewed: validateReviewed,
    setReviewed: setReviewed,
    reviewedCount: reviewedCount,
    pickReasons: pickReasons,
    compareFit: compareFit,
    isStrictlyClosed: isStrictlyClosed,
    applicationStatusOf: applicationStatusOf,
    applyStateKey: applyStateKey
  };
});
