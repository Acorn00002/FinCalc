"use strict";
// 보조금24 지원사업의 "자격 정보(eligibility)"를 테스트 수집(스테이징)하기 위한 순수 로직 모음.
// Firebase Admin/Functions에 의존하지 않아 별도 초기화 없이 테스트할 수 있다.
//
// 안전 원칙
//  - 기존 supportPrograms/calendarEvents에는 절대 쓰지 않는다(assertStagingCollection이 코드 수준에서 막는다).
//  - 상세·지원조건 조회가 실패하면 그 단계에서 얻는 필드는 "빈 값으로 덮어쓰지 않고" 통째로 생략한다.
//  - 목록 순회는 중복 ID와 반복 페이지를 감지해 무한 반복하지 않는다.
//  - 지원대상·선정기준 원문에서 이메일·전화번호·주민등록번호 형태는 저장 전에 제거한다.

const STAGING_COLLECTION = "supportProgramsStaging";
const PROTECTED_COLLECTIONS = ["supportPrograms", "calendarEvents", "eventChangeLogs", "syncLogs"];
const SCHEMA_VERSION = 2;   // v2: 신청상태·대상/제외 분리·소득/연령 원문 구조·regionNames 추가(v1 필드는 그대로)
const OFFICIAL_DETAIL_URL_PREFIX = "https://www.gov.kr/portal/rcvfvrSvc/dtlEx/";
const TEXT_LIMITS = { targetText: 1000, selectionText: 1500 };
const N = require("./gov24Normalize");
const AUDIENCE_TYPES = ["individual", "business", "mixed", "unknown"];

const PROVINCES = [
  "전남광주통합특별시", "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
  "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도"
];
// 소비 코드(웹 지역 선택)가 아직 옛 이름만 가지고 있을 때 쓰는 대응표 — 2026년 현재 API의 광주·전남 사업은 전부 이 이름으로 올라온다.
const REGION_ALIASES = N.REGION_ALIASES;

// 줄임말은 모호하지 않은 것만 인정한다("광주"는 광주광역시와 경기도 광주시가 겹쳐 제외).
const PROVINCE_SHORT = {
  "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시", "대전": "대전광역시",
  "울산": "울산광역시", "세종": "세종특별자치시", "강원": "강원특별자치도", "제주": "제주특별자치도",
  "충북": "충청북도", "충남": "충청남도", "전북": "전북특별자치도", "전남": "전라남도", "경북": "경상북도", "경남": "경상남도"
};

// ---------- 컬렉션 보호 ----------
function assertStagingCollection(name) {
  if (PROTECTED_COLLECTIONS.indexOf(name) !== -1) {
    throw new Error("보호된 컬렉션에는 쓸 수 없습니다: " + name);
  }
  if (!/^supportPrograms(Staging|Test)[A-Za-z0-9_]*$/.test(String(name))) {
    throw new Error("스테이징 컬렉션 이름 규칙(supportProgramsStaging*/supportProgramsTest*)에 맞지 않습니다: " + name);
  }
  return name;
}

// ---------- 값 정규화 ----------
function normalizeAudience(raw) {
  const text = String(raw == null ? "" : raw);
  const parts = text.split("||").map(function (s) { return s.trim(); }).filter(Boolean);
  const individual = parts.some(function (p) { return /개인|가구/.test(p); });
  const business = parts.some(function (p) { return /소상공인|법인|시설|단체/.test(p); });
  const audienceType = individual && business ? "mixed" : individual ? "individual" : business ? "business" : "unknown";
  return { audienceType: audienceType, audienceRaw: text };
}

// "20260803095440" | "2026-08-03" | "2026.08.03" → "2026-08-03", 해석할 수 없으면 null
function normalizeYmd(value) {
  if (value == null) return null;
  const s = String(value).trim();
  let m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?$/);
  if (!m) m = s.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})/);
  if (!m) return null;
  const mm = ("0" + Number(m[2])).slice(-2);
  const dd = ("0" + Number(m[3])).slice(-2);
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  return m[1] + "-" + mm + "-" + dd;
}

// 소관기관명이 "시도명으로 시작"할 때만 지역을 확정한다. 모르면 "전국"이 아니라 "unknown"으로 둔다.
// (기존 inferGov24Region은 접두어 2글자 비교라 충남→충북, 경남→경북, 경기 광주시→광주광역시로 오분류한다.)
function stripLegalForm(name) {
  return String(name || "").trim().replace(/^(?:\([^)]*\)|재단법인|사단법인|학교법인|사회복지법인|의료법인)\s*/, "");
}

// codeRegionMap(선택): buildOrgCodeRegionMap이 만든 {기관코드 앞 3자리 → 시도}. 이름만으로 판정되지 않을 때만 쓴다.
function inferRegionName(row, codeRegionMap) {
  const orgType = String(row["소관기관유형"] || "");
  if (orgType.indexOf("중앙행정기관") !== -1 || orgType.indexOf("공공기관") !== -1) {
    return { regionName: "전국", regionMethod: "central" };
  }
  const org = stripLegalForm(row["소관기관명"]);
  for (let i = 0; i < PROVINCES.length; i++) {
    if (org.indexOf(PROVINCES[i]) === 0) return { regionName: PROVINCES[i], regionMethod: "orgNamePrefix" };
  }
  const short = org.match(/^(서울|부산|대구|인천|대전|울산|세종|강원|제주|충북|충남|전북|전남|경북|경남)(?=\s|시|도|$)/);
  if (short) return { regionName: PROVINCE_SHORT[short[1]], regionMethod: "orgNameShort" };
  const byCode = codeRegionMap && codeRegionMap[String(row["소관기관코드"] || "").slice(0, 3)];
  if (byCode) return { regionName: byCode, regionMethod: "orgCodePrefix" };
  return { regionName: "unknown", regionMethod: "unknown" };
}

// 목록 전체에서 "이름으로 시도가 확정된 행"의 기관코드 앞 3자리 → 시도 대응표를 만든다.
// 한 접두어가 두 시도에 걸리면(충돌) 그 접두어는 사용하지 않는다. (실측: 8,476건 leave-one-out 정확도 100%, 충돌 0)
function buildOrgCodeRegionMap(rows) {
  const tally = {};
  rows.forEach(function (row) {
    const r = inferRegionName(row);
    if (r.regionMethod !== "orgNamePrefix" && r.regionMethod !== "orgNameShort") return;
    const k = String(row["소관기관코드"] || "").slice(0, 3);
    if (k.length < 3) return;
    tally[k] = tally[k] || {};
    tally[k][r.regionName] = (tally[k][r.regionName] || 0) + 1;
  });
  const map = {};
  Object.keys(tally).forEach(function (k) {
    const regions = Object.keys(tally[k]);
    if (regions.length === 1) map[k] = regions[0];
  });
  return map;
}

// 연락처·주민등록번호 형태 제거(공공기관 대표번호도 저장할 이유가 없다)
function scrubPersonalData(text) {
  return String(text == null ? "" : text)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[이메일]")
    .replace(/\b\d{6}-?[1-4]\d{6}\b/g, "[번호]")
    .replace(/\b0\d{1,2}[-)\s]?\d{3,4}-\d{4}\b/g, "[전화번호]")
    .replace(/\b1[5-9]\d{2}-\d{4}\b/g, "[전화번호]");
}

function truncate(text, limit) {
  const s = String(text == null ? "" : text).replace(/\r\n/g, "\n").trim();
  return s.length > limit ? s.slice(0, limit) : s;
}

// ---------- 기존(legacy) 필드: functions/index.js의 syncGov24Subsidies가 만드는 값과 동일해야 한다 ----------
// 아래 4개 함수는 index.js:1304~1348을 그대로 옮긴 것이다(기존 함수는 수정하지 않는다).
// 같은 입력에서 같은 결과가 나오는지는 test/gov24Eligibility.test.js가 실제 저장 문서와 비교해 확인한다.
const LEGACY_REGION_PREFIXES = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
  "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도"
];
function legacyInferRegion(row) {
  const orgType = row["소관기관유형"] || "";
  if (orgType.indexOf("중앙행정기관") !== -1 || orgType.indexOf("공공기관") !== -1) return "전국";
  const orgName = row["소관기관명"] || "";
  const matched = LEGACY_REGION_PREFIXES.filter(function (p) { return orgName.indexOf(p.slice(0, 2)) !== -1; })[0];
  return matched || "전국";
}
function legacyInferEmployment(row) {
  const text = [row["서비스명"], row["지원대상"], row["서비스목적요약"]].filter(Boolean).join(" ");
  const result = [];
  if (/대학생/.test(text)) result.push("대학생");
  if (/(재직자|근로자|직장인)/.test(text)) result.push("재직자");
  if (/(자영업자|소상공인)/.test(text)) result.push("자영업자");
  if (/(프리랜서)/.test(text)) result.push("프리랜서");
  if (/(구직|취업준비|미취업)/.test(text)) result.push("취준생");
  if (/(무직|실업자)/.test(text)) result.push("무직");
  return result;
}
function legacyParseDeadline(text) {
  if (!text) return null;
  const matches = String(text).match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/g);
  if (!matches || !matches.length) return null;
  const parts = matches[matches.length - 1].split(/[.\-]/);
  const y = parts[0];
  const m = String(Number(parts[1])).padStart(2, "0");
  const d = String(Number(parts[2])).padStart(2, "0");
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return y + "-" + m + "-" + d;
}
function legacySplitChecklist(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map(function (line) { return line.replace(/^[\s○\-•*]+/, "").trim(); })
    .filter(function (line) { return line.length > 3; })
    .slice(0, 6);
}

// conditionsStatus: "ok" | "empty"(조회는 성공했지만 행이 없음) | "failed"
// failed이면 연령(targetAge)을 기본값(0~99)으로 덮어쓰지 않고 필드를 생략한다.
function buildLegacyFields(row, detail, cond, conditionsStatus, now) {
  const d = detail || {};
  const deadlineText = row["신청기한"] || "";
  const doc = {
    title: row["서비스명"] || "",
    category: row["서비스분야"] || "기타",
    summary: (row["서비스목적요약"] || row["서비스명"] || "").slice(0, 90),
    targetRegions: [legacyInferRegion(row)],
    targetEmployment: legacyInferEmployment(row),
    benefits: (row["지원내용"] || "").slice(0, 400),
    deadlineText: deadlineText,
    endDate: legacyParseDeadline(deadlineText),
    applyUrl: d["온라인신청사이트URL"] || row["상세조회URL"] || "",
    checklist: legacySplitChecklist(d["선정기준"] || row["선정기준"] || row["지원대상"]),
    source: "gov24",
    updatedAt: now
  };
  if (conditionsStatus !== "failed") {
    const c = cond || {};
    doc.targetAge = {
      min: typeof c["JA0110"] === "number" ? c["JA0110"] : 0,
      max: typeof c["JA0111"] === "number" ? c["JA0111"] : 99
    };
  }
  return doc;
}

// ---------- eligibility ----------
function conditionCodesFrom(cond) {
  if (!cond) return [];
  return Object.keys(cond)
    .filter(function (k) { return /^JA\d{4}$/.test(k) && cond[k] === "Y"; })
    .sort();
}
function numberOrNull(v) {
  return typeof v === "number" && isFinite(v) ? v : null;
}

function buildEligibility(row, detail, cond, status, now, codeRegionMap) {
  const d = detail || {};
  const id = String(row["서비스ID"] || "");
  const audience = normalizeAudience(row["사용자구분"]);
  const region = inferRegionName(row, codeRegionMap);
  const listUrl = String(row["상세조회URL"] || "");
  // 파생 필드는 잘리기 전의 전체 원문(개인정보 제거본)으로 계산한다 — 예외·제외 문구가 뒤쪽에 있을 수 있다.
  const fullTarget = scrubPersonalData(String(d["지원대상"] || row["지원대상"] || ""));
  const fullSelection = scrubPersonalData(String(d["선정기준"] || row["선정기준"] || ""));
  const today = normalizeYmd(now instanceof Date ? now.toISOString().slice(0, 10) : now) || new Date().toISOString().slice(0, 10);
  const derived = N.deriveEligibilityFields({
    targetText: fullTarget,
    selectionText: fullSelection,
    deadlineList: row["신청기한"],
    deadlineDetail: d["신청기한"],
    applyMethod: scrubPersonalData(String(d["신청방법"] || row["신청방법"] || ""))
  }, today);
  const eligibility = {
    audienceType: audience.audienceType,
    audienceRaw: audience.audienceRaw,
    targetText: truncate(fullTarget, TEXT_LIMITS.targetText),
    selectionText: truncate(fullSelection, TEXT_LIMITS.selectionText),
    coreText: derived.coreText,
    targetClauses: N.extractTargetClauses(fullTarget, fullSelection),
    regionRequirement: N.extractRegionRequirement(fullTarget, fullSelection, region.regionName, N.regionMatchNames(region.regionName)),
    coreStats: derived.coreStats,
    exclusions: derived.exclusions,
    preferences: derived.preferences,
    income: derived.income,
    ageInfo: derived.age,
    applicationStatus: Object.assign({ checkedOn: today }, derived.applicationStatus),
    applicationPeriodText: scrubPersonalData(truncate(row["신청기한"] || d["신청기한"], 300)),
    regionName: region.regionName,
    regionNames: N.regionMatchNames(region.regionName),
    orgName: String(row["소관기관명"] || ""),
    orgType: String(row["소관기관유형"] || ""),
    orgCode: String(row["소관기관코드"] || ""),
    sourceUrl: listUrl.indexOf(OFFICIAL_DETAIL_URL_PREFIX) === 0 ? listUrl : (id ? OFFICIAL_DETAIL_URL_PREFIX + id : ""),
    sourceModifiedAt: normalizeYmd(d["수정일시"]) || normalizeYmd(row["수정일시"]),
    fetchedAt: now,
    fetchStatus: { detail: status.detail, conditions: status.conditions },
    schemaVersion: SCHEMA_VERSION
  };
  // 지원조건 조회가 성공했을 때만 연령·조건코드를 채운다(실패 시 필드 자체를 생략 = 기존 값을 덮어쓰지 않음).
  if (status.conditions !== "failed") {
    eligibility.conditionCodes = conditionCodesFrom(cond);
    eligibility.ageRange = { min: numberOrNull(cond && cond["JA0110"]), max: numberOrNull(cond && cond["JA0111"]) };
  }
  return eligibility;
}

// 스키마·개인정보 점검(문제 목록을 돌려준다, 빈 배열이면 정상)
function validateEligibility(e) {
  const problems = [];
  if (!e || typeof e !== "object") return ["eligibility 객체 없음"];
  if (e.schemaVersion !== SCHEMA_VERSION) problems.push("schemaVersion");
  if (!e.applicationStatus || ["open", "upcoming", "closed", "discontinued", "unknown"].indexOf(e.applicationStatus.state) === -1) problems.push("applicationStatus");
  if (!Array.isArray(e.exclusions) || !Array.isArray(e.preferences) || typeof e.coreText !== "string") problems.push("대상/제외 분리 필드");
  if (!e.income || !Array.isArray(e.income.percents) || typeof e.income.varies !== "boolean") problems.push("income");
  if (!e.ageInfo || !Array.isArray(e.ageInfo.textRanges) || !Array.isArray(e.ageInfo.exceptions)) problems.push("ageInfo");
  if (!Array.isArray(e.regionNames)) problems.push("regionNames");
  if (e.targetClauses !== undefined && (!Array.isArray(e.targetClauses) || e.targetClauses.some(function (c) { return typeof c !== "string"; }))) problems.push("targetClauses");
  if (e.regionRequirement !== undefined && (!e.regionRequirement || ["applicant", "parent", "applicant_or_parent", "applicant_and_parent", "school", "organization", "unknown"].indexOf(e.regionRequirement.subject) === -1 || !Array.isArray(e.regionRequirement.regions) || typeof e.regionRequirement.raw !== "string")) problems.push("regionRequirement");
  if (AUDIENCE_TYPES.indexOf(e.audienceType) === -1) problems.push("audienceType");
  ["audienceRaw", "targetText", "selectionText", "regionName", "orgName", "orgType", "orgCode", "sourceUrl"].forEach(function (k) {
    if (typeof e[k] !== "string") problems.push(k + " 문자열 아님");
  });
  if (!e.sourceUrl || e.sourceUrl.indexOf(OFFICIAL_DETAIL_URL_PREFIX) !== 0) problems.push("sourceUrl 공식 상세 URL 아님");
  if (e.sourceModifiedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(e.sourceModifiedAt))) problems.push("sourceModifiedAt 형식");
  if (!(e.fetchedAt instanceof Date) && typeof e.fetchedAt !== "string") problems.push("fetchedAt");
  if (e.targetText.length > TEXT_LIMITS.targetText) problems.push("targetText 길이 초과");
  if (e.selectionText.length > TEXT_LIMITS.selectionText) problems.push("selectionText 길이 초과");
  if (e.fetchStatus.conditions !== "failed") {
    if (!Array.isArray(e.conditionCodes) || e.conditionCodes.some(function (c) { return !/^JA\d{4}$/.test(c); })) problems.push("conditionCodes");
    if (!e.ageRange || (e.ageRange.min !== null && typeof e.ageRange.min !== "number") || (e.ageRange.max !== null && typeof e.ageRange.max !== "number")) problems.push("ageRange");
  } else if ("ageRange" in e || "conditionCodes" in e) {
    problems.push("조회 실패인데 조건 필드가 채워짐");
  }
  const combined = e.targetText + " " + e.selectionText;
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(combined)) problems.push("이메일 형태 포함");
  if (/\b\d{6}-?[1-4]\d{6}\b/.test(combined)) problems.push("주민등록번호 형태 포함");
  if (/\b0\d{1,2}[-)\s]?\d{3,4}-\d{4}\b/.test(combined)) problems.push("전화번호 형태 포함");
  return problems;
}

// undefined 값을 재귀적으로 제거 — Firestore에 undefined를 보내면 오류가 나고, null로 바꾸면 기존 값을 지우게 된다.
function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    Object.keys(value).forEach(function (k) {
      if (value[k] !== undefined) out[k] = stripUndefined(value[k]);
    });
    return out;
  }
  return value;
}

function buildStagingDoc(row, detail, cond, status, now, codeRegionMap) {
  return stripUndefined(Object.assign(
    buildLegacyFields(row, detail, cond, status.conditions, now),
    { eligibility: buildEligibility(row, detail, cond, status, now, codeRegionMap) }
  ));
}

// ---------- 목록 순회 (중복·무한 반복 방지) ----------
async function fetchAllListPages(fetchPage, options) {
  const perPage = (options && options.perPage) || 1000;
  const maxPages = (options && options.maxPages) || 30;
  const seen = new Set();
  const rows = [];
  const stats = { calls: 0, pages: 0, totalCount: null, duplicates: 0, complete: false, stopReason: "" };
  for (let page = 1; page <= maxPages; page++) {
    const json = await fetchPage(page, perPage);
    stats.calls += 1;
    if (!json || !Array.isArray(json.data)) throw new Error("목록 응답 형식이 올바르지 않습니다(page " + page + ")");
    stats.pages += 1;
    const reported = typeof json.matchCount === "number" ? json.matchCount : (typeof json.totalCount === "number" ? json.totalCount : null);
    if (stats.totalCount === null && reported !== null) stats.totalCount = reported;
    let added = 0;
    json.data.forEach(function (row) {
      const id = row && row["서비스ID"];
      if (!id) return;
      if (seen.has(id)) { stats.duplicates += 1; return; }
      seen.add(id);
      rows.push(row);
      added += 1;
    });
    if (json.data.length === 0) { stats.stopReason = "empty-page"; break; }
    if (added === 0) { stats.stopReason = "no-new-rows"; break; }            // 같은 페이지가 반복되면 즉시 중단
    if (stats.totalCount !== null && rows.length >= stats.totalCount) { stats.stopReason = "reached-total"; break; }
    if (json.data.length < perPage) { stats.stopReason = "short-page"; break; }
  }
  if (!stats.stopReason) stats.stopReason = "max-pages";
  stats.complete = stats.totalCount !== null ? rows.length === stats.totalCount : stats.stopReason === "short-page";
  return { rows: rows, stats: stats };
}

// ---------- 청년·취업·주거·교육 사업 샘플 선정 ----------
const TOPIC_PATTERNS = {
  youth: /청년|대학생|사회초년|신혼/,
  employment: /취업|구직|일자리|직업훈련|내일배움|채용/,
  housing: /월세|전세|주택|임대|주거|청약|행복주택/,
  education: /장학|학자금|등록금|교육비|학비/,
  asset: /저축|적금|자산형성|근로장려|장려금|수당|바우처|생활안정|융자|대출/
};
const PRIMARY_INDUSTRY = /어업|어촌|어선|수산|양식|농업|농촌|축산|산림|임업|해양|선원/;
const DEFAULT_SEEDS = [
  // 청년 자산형성·소득지원
  "청년희망적금", "자산형성지원사업(청년내일저축계좌)", "청년주택드림 청약통장", "청년내일채움공제", "근로·자녀장려금", "K-패스",
  // 취업·훈련
  "국민취업지원제도", "국민내일배움카드", "청년도전지원사업", "구직자·기업 도약보장 패키지", "청년성장프로젝트", "K-디지털 트레이닝",
  // 주거
  "청년월세 지원", "행복주택 공급", "주택금융공사 월세자금보증", "버팀목전세자금대출", "국토교통부 전세보증금반환보증 보증료 지원",
  // 교육·장학
  "국가장학금", "천원의 아침밥", "인문100년장학금", "평생교육이용권 지원",
  // 청년 복지·문화
  "청년 마음건강 바우처", "청년 문화예술패스"
];

function topicsOf(row) {
  const text = [row["서비스명"], row["서비스목적요약"], row["지원대상"]].join(" ");
  return Object.keys(TOPIC_PATTERNS).filter(function (k) { return TOPIC_PATTERNS[k].test(text); });
}
function isNational(row) {
  return /중앙행정기관|공공기관/.test(String(row["소관기관유형"] || ""));
}

// limit은 20~50으로 보정한다. 결과는 입력 순서와 무관하게 결정적이다(점수 내림차순, 같으면 서비스ID 오름차순).
function selectYouthSample(rows, options) {
  const limit = Math.max(20, Math.min(50, (options && options.limit) || 40));
  const seeds = (options && options.seeds) || DEFAULT_SEEDS;
  const candidates = rows.filter(function (row) {
    const a = normalizeAudience(row["사용자구분"]).audienceType;
    return (a === "individual" || a === "mixed") && !PRIMARY_INDUSTRY.test(String(row["서비스명"] || ""));
  });
  const byId = function (a, b) { return String(a["서비스ID"]).localeCompare(String(b["서비스ID"])); };
  const chosen = [];
  const chosenIds = new Set();
  const seedsFound = [];
  const seedsMissing = [];
  const pick = function (row) { if (!chosenIds.has(row["서비스ID"]) && chosen.length < limit) { chosen.push(row); chosenIds.add(row["서비스ID"]); return true; } return false; };

  seeds.forEach(function (seed) {
    const exact = candidates.filter(function (r) { return r["서비스명"] === seed; });
    const partial = candidates.filter(function (r) { return String(r["서비스명"] || "").indexOf(seed) !== -1; });
    const pool = (exact.length ? exact : partial).slice().sort(function (a, b) {
      return (isNational(b) ? 1 : 0) - (isNational(a) ? 1 : 0) || byId(a, b);
    });
    if (pool.length && pick(pool[0])) seedsFound.push(seed);
    else if (!pool.length) seedsMissing.push(seed);
  });

  const score = function (row) {
    const t = topicsOf(row);
    return t.length * 2 + (isNational(row) ? 3 : 0) + (/광역시도/.test(String(row["소관기관유형"] || "")) ? 1 : 0) + (/청년/.test(String(row["서비스명"] || "")) ? 2 : 0);
  };
  const rest = candidates.filter(function (r) { return !chosenIds.has(r["서비스ID"]) && topicsOf(r).length > 0; })
    .sort(function (a, b) { return score(b) - score(a) || byId(a, b); });
  // 주제별로 고르게 채우기(라운드 로빈)
  const topicKeys = Object.keys(TOPIC_PATTERNS);
  let guard = 0;
  while (chosen.length < limit && rest.length && guard < 10000) {
    guard += 1;
    for (let i = 0; i < topicKeys.length && chosen.length < limit; i++) {
      const idx = rest.findIndex(function (r) { return topicsOf(r).indexOf(topicKeys[i]) !== -1 && !chosenIds.has(r["서비스ID"]); });
      if (idx !== -1) pick(rest.splice(idx, 1)[0]);
    }
    if (!topicKeys.some(function (k) { return rest.some(function (r) { return topicsOf(r).indexOf(k) !== -1; }); })) break;
  }
  const topicCounts = {};
  chosen.forEach(function (r) { topicsOf(r).forEach(function (t) { topicCounts[t] = (topicCounts[t] || 0) + 1; }); });
  return { selected: chosen, meta: { limit: limit, seedsFound: seedsFound, seedsMissing: seedsMissing, topicCounts: topicCounts } };
}

// ---------- 실행 ----------
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function sanitizeError(error, secrets) {
  let message = String((error && error.message) || error || "");
  (secrets || []).filter(Boolean).forEach(function (s) { message = message.split(s).join("***"); });
  return message.slice(0, 200);
}

// api: { list(page, perPage) → 응답 JSON, detail(serviceId) → 행 | null, conditions(serviceId) → 행 | null } (실패 시 throw)
// db가 있고 write가 true일 때만 스테이징 컬렉션에 merge로 쓴다. 기본은 dry-run(쓰기 없음).
async function runStagingSync(options) {
  const collectionName = assertStagingCollection(options.collectionName || STAGING_COLLECTION);
  const now = options.now || new Date();
  const secrets = options.secrets || [];
  const counts = { list: 0, detail: 0, conditions: 0 };
  const timing = { totalMs: 0 };
  const timed = async function (kind, fn) {
    const t0 = Date.now();
    counts[kind] += 1;
    try { return await fn(); } finally { timing.totalMs += Date.now() - t0; }
  };
  const startedAt = Date.now();

  const list = await fetchAllListPages(function (page, perPage) { return timed("list", function () { return options.api.list(page, perPage); }); },
    { perPage: options.perPage || 1000, maxPages: options.maxListPages || 30 });
  // onlyIds: 서비스ID를 직접 지정한 검증용 수집(목록에 없는 ID는 건너뛴다). 지정하지 않으면 기존 청년 샘플 선정.
  const selection = Array.isArray(options.onlyIds)
    ? (function () {
      const want = new Set(options.onlyIds.map(String));
      const picked = list.rows.filter(function (r) { return want.has(String(r["서비스ID"])); });
      return { selected: picked, meta: { limit: want.size, seedsFound: [], seedsMissing: [], topicCounts: {}, onlyIds: true, missingIds: Array.from(want).filter(function (id) { return !picked.some(function (r) { return String(r["서비스ID"]) === id; }); }) } };
    })()
    : selectYouthSample(list.rows, { limit: options.limit, seeds: options.seeds });
  const codeRegionMap = buildOrgCodeRegionMap(list.rows);

  const errors = [];
  const docs = await mapWithConcurrency(selection.selected, options.concurrency || 4, async function (row) {
    const id = row["서비스ID"];
    const status = { detail: "ok", conditions: "ok" };
    let detail = null;
    let cond = null;
    try {
      detail = await timed("detail", function () { return options.api.detail(id); });
      if (!detail) status.detail = "empty";
    } catch (error) {
      status.detail = "failed";
      errors.push({ id: id, step: "detail", message: sanitizeError(error, secrets) });
    }
    try {
      cond = await timed("conditions", function () { return options.api.conditions(id); });
      if (!cond) status.conditions = "empty";
    } catch (error) {
      status.conditions = "failed";
      errors.push({ id: id, step: "conditions", message: sanitizeError(error, secrets) });
    }
    return { id: id, doc: buildStagingDoc(row, detail, cond, status, now, codeRegionMap) };
  });

  const ids = docs.map(function (d) { return d.id; });
  const duplicateIds = ids.length - new Set(ids).size;
  let written = 0;
  if (options.write) {
    if (!options.db) throw new Error("write=true 인데 db가 없습니다");
    const batchSize = 400;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = options.db.batch();
      docs.slice(i, i + batchSize).forEach(function (d) {
        batch.set(options.db.collection(collectionName).doc(String(d.id)), d.doc, { merge: true });
        written += 1;
      });
      await batch.commit();
    }
  }
  return {
    summary: {
      mode: options.write ? "write" : "dry-run",
      collection: collectionName,
      listStats: list.stats,
      listRows: list.rows.length,
      selected: docs.length,
      selection: selection.meta,
      duplicateIds: duplicateIds,
      apiCalls: { list: counts.list, detail: counts.detail, conditions: counts.conditions, total: counts.list + counts.detail + counts.conditions },
      apiMsSum: timing.totalMs,
      wallMs: Date.now() - startedAt,
      written: written,
      errors: errors
    },
    docs: docs
  };
}

module.exports = {
  STAGING_COLLECTION, PROTECTED_COLLECTIONS, SCHEMA_VERSION, OFFICIAL_DETAIL_URL_PREFIX, TEXT_LIMITS, DEFAULT_SEEDS,
  REGION_ALIASES, assertStagingCollection, normalizeAudience, normalizeYmd, stripLegalForm, inferRegionName, buildOrgCodeRegionMap, scrubPersonalData,
  legacyInferRegion, legacyInferEmployment, legacyParseDeadline, legacySplitChecklist,
  buildLegacyFields, conditionCodesFrom, buildEligibility, validateEligibility, stripUndefined, buildStagingDoc,
  fetchAllListPages, topicsOf, selectYouthSample, mapWithConcurrency, sanitizeError, runStagingSync
};
