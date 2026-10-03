"use strict";
// 보조금24 원문(지원대상·선정기준·신청기한·신청방법)을 "판정에 쓸 수 있는 구조"로 나누는 순수 함수 모음.
// 원문은 항상 그대로 보존하고(targetText/selectionText), 여기서 만든 값은 추가 필드로만 저장한다.
// 모든 함수는 모르는 것을 "모른다"고 돌려준다 — 추정해서 채우지 않는다.

const REGION_ALIASES = { "전남광주통합특별시": ["광주광역시", "전라남도"] };

// ---------- 신청기간 ----------
function pad2(n) { return ("0" + Number(n)).slice(-2); }
function validYmd(y, m, d) {
  if (!(y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function ymd(y, m, d) { return y + "-" + pad2(m) + "-" + pad2(d); }

// 날짜 토큰: ①2026.05.04 / 2026-5-4 / 2026년 5월 4일  ②(연도 없이) 6월 22일  ③"~" 바로 뒤의 5.20
const DATE_TOKEN = /(\d{4})\s*(?:년\s*|[.\-\/]\s*)(\d{1,2})\s*(?:월\s*|[.\-\/]\s*)(\d{1,2})\s*일?|(\d{1,2})\s*월\s*(\d{1,2})\s*일?|(?<=~\s*)(\d{1,2})\s*\.\s*(\d{1,2})(?![\d])/g;

// 신청기한 문자열 → 기간 목록. 기간은 {start, end}(알 수 없는 쪽은 null). 해석하지 못하면 빈 배열.
function parseApplicationPeriods(text) {
  const s = String(text == null ? "" : text).replace(/[∼～〜–—]/g, "~");
  const tokens = [];
  let m;
  DATE_TOKEN.lastIndex = 0;
  while ((m = DATE_TOKEN.exec(s)) !== null) {
    if (m[1]) tokens.push({ i: m.index, e: DATE_TOKEN.lastIndex, y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) });
    else if (m[4]) tokens.push({ i: m.index, e: DATE_TOKEN.lastIndex, y: null, m: Number(m[4]), d: Number(m[5]) });
    else tokens.push({ i: m.index, e: DATE_TOKEN.lastIndex, y: null, m: Number(m[6]), d: Number(m[7]) });
  }
  // 연도 상속: 직전 토큰의 연도를 이어받고, 월이 줄어들면 다음 해로 본다.
  let prev = null;
  tokens.forEach(function (t) {
    if (t.y === null && prev) { t.y = prev.y + (t.m < prev.m ? 1 : 0); }
    if (t.y !== null) prev = t;
  });
  const toks = tokens.filter(function (t) { return t.y !== null && validYmd(t.y, t.m, t.d); });
  const periods = [];
  const used = new Set();
  for (let k = 0; k < toks.length; k++) {
    const a = toks[k];
    const b = toks[k + 1];
    const between = b ? s.slice(a.e, b.i) : "";
    if (b && /^\s*\.?[\s)\]]*~\s*$/.test(between)) {         // A ~ B
      periods.push({ start: ymd(a.y, a.m, a.d), end: ymd(b.y, b.m, b.d) });
      used.add(k); used.add(k + 1); k += 1;
      continue;
    }
    if (used.has(k)) continue;
    const before = s.slice(Math.max(0, a.i - 6), a.i);
    const after = s.slice(a.e, a.e + 8);
    if (/~\s*$/.test(before)) { periods.push({ start: null, end: ymd(a.y, a.m, a.d) }); continue; }          // ~ B
    if (/^\s*\.?\s*[)\]]*\s*~/.test(after) && !(b && b.i - a.e < 3)) { periods.push({ start: ymd(a.y, a.m, a.d), end: null }); continue; } // A ~
    if (/^\s*[)\]]*\s*(?:까지|마감)/.test(after)) periods.push({ start: null, end: ymd(a.y, a.m, a.d) });   // B까지
  }
  return periods;
}

// 신규지원 중단·사업 종료를 뜻하는 구체적 표현만 인정한다(지원내용의 일반적인 "종료" 문구는 보지 않는다).
const STOP_RE = /신규\s*(?:지원|접수|신청|모집|가입)\s*(?:을\s*|이\s*|은\s*)?(?:중단|종료|폐지|마감|불가)|사업\s*(?:이\s*)?(?:종료|중단|폐지)(?!\s*(?:후|시|되|이후|일|기간|예정))|지원\s*(?:이\s*)?(?:종료|중단|폐지)(?!\s*(?:후|시|되|이후|일|기간|예정))|(?:접수|모집|신청)\s*(?:이\s*|은\s*)?(?:종료|마감)(?!\s*(?:일|예정|시))|(?:더\s*이상|추후)\s*(?:접수|모집|신청)\s*(?:하지\s*않|불가)/;
const ROUND_CLOSED_RE = /모집\s*완료|접수\s*완료|마감\s*(?:되었|됨|완료)|조기\s*마감|예산\s*소진/;
const ALWAYS_OPEN_RE = /상시|연중|수시|항시|365/;
const RECURRING_RE = /매년|연\s*\d+\s*회|매월|분기|반기|정기|해마다|공고\s*(?:문\s*)?참고|공고\s*시|별도\s*공고|기관\s*별|접수기관|지자체\s*별/;

function firstMatch(re, texts) {
  for (let i = 0; i < texts.length; i++) {
    const t = String(texts[i] || "");
    const m = t.match(re);
    if (m) return t.slice(Math.max(0, m.index - 10), Math.min(t.length, m.index + m[0].length + 20)).replace(/\s+/g, " ").trim();
  }
  return null;
}

// 신청 상태. today: "YYYY-MM-DD".
//  state: open(상시/현재 접수 기간) | upcoming(예정) | closed(모든 기간이 지남) | discontinued(신규지원 중단·종료 문구) | unknown
function deriveApplicationStatus(deadlineTexts, extraStopTexts, today) {
  const dl = (Array.isArray(deadlineTexts) ? deadlineTexts : [deadlineTexts]).map(function (t) { return String(t == null ? "" : t); }).filter(function (t) { return t && t !== "-"; });
  const stopSources = dl.concat((extraStopTexts || []).map(String));
  const joined = dl.join(" / ");
  const periods = dl.map(parseApplicationPeriods).reduce(function (a, b) { return a.concat(b); }, [])
    .filter(function (p, i, arr) { return arr.findIndex(function (q) { return q.start === p.start && q.end === p.end; }) === i; });
  const ends = periods.map(function (p) { return p.end; }).filter(Boolean).sort();
  const result = { state: "unknown", endDate: ends.length ? ends[ends.length - 1] : null, periods: periods.slice(0, 6), reason: "no-info", evidence: "" };

  const stop = firstMatch(STOP_RE, stopSources);
  if (stop) { result.state = "discontinued"; result.reason = "stop-phrase"; result.evidence = stop; return result; }
  const always = ALWAYS_OPEN_RE.test(joined);
  const recurring = RECURRING_RE.test(joined);
  if (periods.length) {
    const complete = periods.every(function (p) { return p.end; });
    const allPast = complete && periods.every(function (p) { return p.end < today; });
    const current = periods.some(function (p) { return (!p.start || p.start <= today) && (!p.end || p.end >= today); });
    const future = periods.some(function (p) { return p.start && p.start > today; });
    if (current) { result.state = "open"; result.reason = "in-period"; }
    else if (future) { result.state = "upcoming"; result.reason = "future-period"; }
    else if (allPast && !always && !recurring) { result.state = "closed"; result.reason = "all-periods-ended"; result.evidence = joined.slice(0, 120); }
    else { result.state = "unknown"; result.reason = allPast ? "periods-ended-but-recurring" : "periods-incomplete"; }
    if (ROUND_CLOSED_RE.test(joined) && result.state === "open") result.reason = "in-period-round-closed-hint";
    return result;
  }
  if (always) { result.state = "open"; result.reason = "always-open"; return result; }
  if (ROUND_CLOSED_RE.test(joined)) { result.reason = "round-closed-hint"; result.evidence = firstMatch(ROUND_CLOSED_RE, [joined]) || ""; return result; }
  result.reason = dl.length ? "unparsed" : "no-info";
  return result;
}

// ---------- 대상 / 제외 / 우대 분리 ----------
const EXCLUDE_RE = /제외|지원\s*불가|신청\s*불가|수혜\s*불가|가입\s*불가|불가능|지원하지\s*않|대상이\s*아니|대상\s*아님|중복\s*(?:수혜|지원|혜택|신청|가입|불가)|동시\s*(?:수혜|지원)|불인정|제한됩니다|제한된다/;
const EXCLUDE_PAREN = /\(([^()]*(?:제외|불가)[^()]*)\)/g;
// "제외 대상:" 처럼 뒤 항목을 이끄는 머리말(짧은 "수급자 제외"는 머리말이 아니라 일반 제외 문구다)
const EXCLUDE_HEADER = /(?:(?:제외|불가|제한)\s*(?:대상|사유|기준|자)?\s*[:：]|(?:제외|불가|제한)\s*(?:대상|사유|기준|자))\s*$/;
const PREF_HEADER = /^[\[(［]?\s*(?:우대|우선)[^\n]{0,10}[\])］]?\s*[:：]?$/;
const TIER_RE = /우대형|일반형|[ⅠⅡⅢⅣ]\s*유형|(?:^|[^A-Za-z])I{1,3}\s*유형|요건심사형|선발형/g;
const TARGET_HEADER = /^\s*(?:\(?지원\s*)?(?:대상|자격|요건)\s*[:：]/;
const PREFERENCE_RE = /우대|우선\s*(?:선정|지원|공급|순위|대상)|추가\s*(?:지원|혜택|환급|지급|가점)|가점|가산|환급|감면|할인/;

function splitLines(text) {
  return String(text == null ? "" : text)
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map(function (l) { return l.replace(/^[\s○●•·▶▷◦ㆍ※ㅇ*\-–]+/, "").replace(/\s+/g, " ").trim(); })
    .filter(function (l) { return l.length > 1; });
}

// 반환: { core: [...], exclusions: [...], preferences: [...] } (각 항목은 200자 이내)
function splitClauses(text) {
  const out = { core: [], exclusions: [], preferences: [], tiers: [] };
  const lines = splitLines(text);
  let inExcludeBlock = 0;
  let inPrefBlock = false;
  lines.forEach(function (line) {
    (line.match(TIER_RE) || []).forEach(function (t) { t = t.replace(/\s+/g, "").replace(/^[^가-힣ⅠⅡⅢⅣI]+/, ""); if (out.tiers.indexOf(t) === -1) out.tiers.push(t); });
    if (inExcludeBlock > 0 && !TARGET_HEADER.test(line)) { out.exclusions.push(line.slice(0, 200)); inExcludeBlock -= 1; return; }
    inExcludeBlock = 0;
    // "[우대형]" 같은 우대 머리말 아래 항목은 필수 자격이 아니라 우대 조건이다(다음 일반 조건 문장이 나올 때까지).
    if (PREF_HEADER.test(line)) { out.preferences.push(line.slice(0, 200)); inPrefBlock = true; return; }
    if (inPrefBlock) {
      if (/해당되지\s*않|^[\[(［]\s*(?:일반|기본)/.test(line)) inPrefBlock = false;
      else { out.preferences.push(line.slice(0, 200)); return; }
    }
    if (EXCLUDE_HEADER.test(line)) {                    // "제외 대상:" 머리말 다음 줄들은 제외 항목
      out.exclusions.push(line.slice(0, 200));
      inExcludeBlock = 6;
      return;
    }
    // 괄호로 붙은 제외 문구는 떼어낸다: "서울 거주 청년 (수급자 제외)" → 대상 + 제외
    let rest = line;
    let m;
    EXCLUDE_PAREN.lastIndex = 0;
    while ((m = EXCLUDE_PAREN.exec(line)) !== null) out.exclusions.push(m[1].trim().slice(0, 200));
    rest = line.replace(EXCLUDE_PAREN, " ").replace(/\s+/g, " ").trim();
    if (!rest) return;
    if (EXCLUDE_RE.test(rest)) { out.exclusions.push(rest.slice(0, 200)); return; }
    if (PREFERENCE_RE.test(rest)) { out.preferences.push(rest.slice(0, 200)); return; }
    out.core.push(rest.slice(0, 300));
  });
  const uniq = function (arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); };
  out.core = uniq(out.core).slice(0, 12);
  out.exclusions = uniq(out.exclusions).slice(0, 10);
  out.preferences = uniq(out.preferences).slice(0, 8);
  return out;
}

// ---------- 대상 문장 (재학생·재직자 같은 신청 대상 판정에 쓰는 문장만) ----------
// 주석(※·*·"단,")·제외·우대 문장과 머리말은 빼고, 지원 대상으로 읽히는 문단·목록 항목만 남긴다.
// coreText(전체 본문 한 덩어리)와 달리 항목 단위라 엔진이 "본문 어디에든 나온 단어"를 대상으로 오인하지 않는다.
const NOTE_LINE = /^\s*(?:※|＊|\*|\(?\s*단[,\s)]|\[?\s*참고|예\s*[:)]|\(예|e\.g)/;
const HEADER_ONLY = /^(?:[○●■□▶▷\-\s]*)(?:지원\s*)?(?:대상|요건|자격|조건|신청\s*자격|기본\s*자격요건|추가\s*자격요건)\s*[:：]?$/;
function extractTargetClauses(targetText, selectionText) {
  const src = String(targetText == null ? "" : targetText).trim() ? targetText : selectionText;
  const out = [];
  String(src == null ? "" : src).replace(/\r\n?/g, "\n").split(/\n+/).forEach(function (raw) {
    if (NOTE_LINE.test(raw)) return;
    let line = raw.replace(/^[\s○●•·▶▷◦ㆍㅇ\-–]+/, "").replace(/^(?:\d{1,2}[.)]|[①-⑩]|[가-힣][.)])\s*/, "");
    line = line.replace(/\s*[※＊*]\s.*$/, "").replace(/\([^()]*(?:제외|불가)[^()]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (line.length < 4 || HEADER_ONLY.test(line)) return;
    if (EXCLUDE_RE.test(line) || PREFERENCE_RE.test(line)) return;
    if (out.indexOf(line) === -1) out.push(line.slice(0, 300));
  });
  return out.slice(0, 12);
}

// ---------- 지역 조건의 주체 (신청자 / 부모 / 학교 / 기관) ----------
// "본인 또는 부모가 강원 거주"처럼 본인 외 사람의 거주지를 함께 보는 사업을 본인 지역만으로 제외하지 않도록 원문의 주체를 구조화한다.
const RESIDENCE_WORD = /거주|주민등록|주소|전입/;
const SELF = "(?:본인|신청자|신청인|학생|청년|대학생)";
const PARENT = "(?:부모|보호자|직계\\s*존속|부\\s*또는\\s*모)";
const REQ_OR = new RegExp(SELF + "\\s*(?:또는|혹은|이나|이거나|/)\\s*(?:그\\s*)?" + PARENT + "|" + PARENT + "\\s*(?:중|가운데)\\s*(?:1|한|일)\\s*(?:명|인|사람)|" + PARENT + "\\s*(?:또는|혹은)\\s*" + SELF);
const REQ_AND = new RegExp(SELF + "\\s*(?:및|과|와|,|·)\\s*(?:그\\s*)?" + PARENT + "\\s*(?:가\\s*)?(?:모두|전원)|" + PARENT + "\\s*(?:및|과|와)\\s*" + SELF + "\\s*(?:가\\s*)?(?:모두|전원)");
const REQ_SCHOOL = /(?:학교|대학|캠퍼스)[^\n.]{0,12}(?:소재|위치|소재지)/;
const REQ_SELF = new RegExp(SELF + "[^\\n]{0,24}(?:거주|주민등록|주소)|(?:관내|도내|시내|군내|지역)[^\\n]{0,12}(?:거주|주민등록|주소)|(?:거주|주민등록)[^\\n]{0,10}(?:자|인|청년)");
function extractRegionRequirement(targetText, selectionText, regionName, regionNames) {
  const lines = (String(targetText == null ? "" : targetText) + "\n" + String(selectionText == null ? "" : selectionText))
    .replace(/\r\n?/g, "\n").split(/\n+/).map(function (l) { return l.replace(/\s+/g, " ").trim(); }).filter(Boolean);
  const regions = (regionNames || []).filter(function (r) { return r && r !== "전국"; });
  const find = function (re, needResidence) {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i]) && (!needResidence || RESIDENCE_WORD.test(lines[i]))) return lines[i].slice(0, 200);
    }
    return "";
  };
  // 양쪽 모두 필요한 조건 → 대체 가능 조건 → 학교 소재지 → 본인 거주 순으로 먼저 맞는 것을 쓴다.
  let subject = "unknown";
  let raw = find(REQ_AND, true);
  if (raw) subject = "applicant_and_parent";
  else if ((raw = find(REQ_OR, true))) subject = "applicant_or_parent";
  else if ((raw = find(REQ_SCHOOL, false)) && !RESIDENCE_WORD.test(raw.replace(/소재지?/g, ""))) subject = "school";
  else if ((raw = find(REQ_SELF, true))) subject = "applicant";
  else raw = "";
  return { subject: subject, regions: regions, raw: raw };
}

// ---------- 소득 기준 ----------
const INCOME_WORD = /소득|중위|연봉|건강보험료|재산|급여/;
const TYPE_MARK = /[ⅠⅡⅢⅣ]\s*유형|[IV]{1,3}\s*유형|유형\s*\d|형\)|\(\s*[가-힣]{1,6}형|우대형|일반형|구분|청년은|청년의\s*경우|가구\s*유형|맞벌이|홑벌이|신혼|자녀\s*\d|1인\s*가구|2인\s*가구|세대원\s*수/;
const NO_INCOME_LIMIT = /소득\s*(?:무관|제한\s*(?:이\s*)?없|상관\s*없)/;

// 소득 문구를 하나의 기준으로 합치지 않는다: 퍼센트가 둘 이상이거나 금액·유형 구분이 섞이면 varies=true.
function extractIncome(clauses, tierCount) {
  const rules = clauses.filter(function (c) { return INCOME_WORD.test(c) && /\d|무관|없/.test(c); });
  const joined = rules.join(" ");
  const percents = [];
  const re = /중위\s*소득\s*(?:의\s*)?(\d{2,3})\s*%|(\d{2,3})\s*%\s*(?:이하|미만)/g;
  let m;
  while ((m = re.exec(joined)) !== null) {
    const v = Number(m[1] || m[2]);
    if (percents.indexOf(v) === -1) percents.push(v);
  }
  const amounts = /\d[\d,.]*\s*(?:천|백)?\s*(?:만|억)?\s*원\s*(?:이하|미만)/.test(joined);
  const noLimit = NO_INCOME_LIMIT.test(joined);
  const typeMarks = TYPE_MARK.test(joined);
  const varies = (tierCount > 1 && rules.length > 0) || percents.length > 1 || (percents.length >= 1 && amounts) || noLimit || (rules.length > 1 && typeMarks) || (percents.length === 1 && typeMarks);
  return { rules: rules.slice(0, 8).map(function (r) { return r.slice(0, 200); }), percents: percents.slice(0, 6), hasAmount: amounts, varies: varies };
}

// ---------- 연령 ----------
function inAge(n) { return n >= 0 && n <= 120; }
const AGE_RANGE = /(?:만\s*)?(\d{1,3})\s*세?\s*(?:이상)?\s*[~-]\s*(?:만\s*)?(\d{1,3})\s*세\s*(이하|미만)?/g;
const AGE_MIN = /만\s*(\d{1,3})\s*세\s*이상/g;
const AGE_MAX = /(\d{1,3})\s*세\s*(이하|미만)/g;
const AGE_EXC_NUM = /\d{2}\s*세|연령|나이/;
const AGE_EXC_WORD = /군\s*복무|병역|복무기간|출생|년생|연장|예외|특례|인정|확대|상향|까지\s*가능|까지\s*포함|\d{2}\s*세까지/;

// core 문구에서 "연령 범위 문구"를 읽는다. 둘 이상의 서로 다른 범위가 나오면 multiple=true.
function extractAgeInfo(coreClauses, allClauses, tierCount) {
  const ranges = [];
  const push = function (min, max, clause) {
    if ((min !== null && !inAge(min)) || (max !== null && !inAge(max))) return;
    if (min !== null && max !== null && min > max) return;
    if (!ranges.some(function (r) { return r.min === min && r.max === max; })) ranges.push({ min: min, max: max, clause: clause.slice(0, 120) });
  };
  coreClauses.forEach(function (c) {
    let m;
    const covered = [];
    AGE_RANGE.lastIndex = 0;
    while ((m = AGE_RANGE.exec(c)) !== null) {
      const hi = Number(m[2]) - (m[3] === "미만" ? 1 : 0);
      push(Number(m[1]), hi, c); covered.push([m.index, AGE_RANGE.lastIndex]);
    }
    AGE_MIN.lastIndex = 0;
    while ((m = AGE_MIN.exec(c)) !== null) {
      if (!covered.some(function (r) { return m.index >= r[0] && m.index < r[1]; })) push(Number(m[1]), null, c);
    }
    AGE_MAX.lastIndex = 0;
    while ((m = AGE_MAX.exec(c)) !== null) {
      if (!covered.some(function (r) { return m.index >= r[0] && m.index < r[1]; })) push(null, Number(m[1]) - (m[2] === "미만" ? 1 : 0), c);
    }
  });
  // 출생연도 기준 (예: 2006~2007년 출생자)
  let birth = null;
  const bre = /(\d{4})\s*(?:[~-]\s*(\d{4}))?\s*년?\s*(?:생|출생)/;
  for (let i = 0; i < allClauses.length && !birth; i++) {
    const m = allClauses[i].match(bre);
    if (m && Number(m[1]) >= 1940 && Number(m[1]) <= 2100) birth = { from: Number(m[1]), to: Number(m[2] || m[1]) };
  }
  const exceptions = allClauses.filter(function (c) { return AGE_EXC_NUM.test(c) && AGE_EXC_WORD.test(c); })
    .filter(function (c, i, arr) { return arr.indexOf(c) === i; }).slice(0, 4).map(function (c) { return c.slice(0, 200); });
  // 상·하한이 모두 있는 범위만 합집합 경계로 쓴다(한쪽만 있는 문구는 다른 조건의 일부일 수 있다).
  const finite = ranges.filter(function (r) { return r.min !== null && r.max !== null; });
  const bounds = finite.length
    ? { min: Math.min.apply(null, finite.map(function (r) { return r.min; })), max: Math.max.apply(null, finite.map(function (r) { return r.max; })) }
    : null;
  return { textRanges: ranges.slice(0, 6), multiple: ranges.length > 1, bounds: bounds, birthYears: birth, exceptions: exceptions, tiered: !!(tierCount && tierCount > 1) };
}

// ---------- 지역 ----------
function regionMatchNames(regionName) {
  if (!regionName || regionName === "unknown") return [];
  if (regionName === "전국") return ["전국"];
  return [regionName].concat(REGION_ALIASES[regionName] || []);
}

// 한 번에: 원문 → 파생 필드. 모든 입력은 개인정보가 제거된 문자열이어야 한다.
function deriveEligibilityFields(input, today) {
  const target = splitClauses(input.targetText);
  const selection = splitClauses(input.selectionText);
  const uniq = function (arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); };
  const core = uniq(target.core.concat(selection.core));
  const exclusions = uniq(target.exclusions.concat(selection.exclusions)).slice(0, 10);
  const preferences = uniq(target.preferences.concat(selection.preferences)).slice(0, 8);
  const incomeClauses = core.concat(preferences, exclusions);
  const allClauses = core.concat(preferences, exclusions);
  const tiers = target.tiers.concat(selection.tiers.filter(function (t) { return target.tiers.indexOf(t) === -1; }));
  const tierCount = Math.max(tiers.length, preferences.some(function (p) { return PREF_HEADER.test(p); }) ? 2 : 0);
  const status = deriveApplicationStatus([input.deadlineList, input.deadlineDetail], [input.applyMethod, input.selectionText], today);
  // 대상 문구가 "…한 사람 / …자 / …청년"으로 끝나는 항목을 여러 개 나열한 사업은 그중 하나에 해당해야 한다(택일 나열).
  const personClauses = core.filter(function (c) { return /(?:사람|분|자|청년|구직자|근로자|가구|세대|학생|아동|노인|어르신)\s*[)*]?\s*$/.test(c); }).length;
  return {
    coreStats: { clauses: core.length, personClauses: personClauses },
    coreText: core.join(" ").slice(0, 1200),
    exclusions: exclusions,
    preferences: preferences,
    income: extractIncome(incomeClauses, tierCount),
    age: extractAgeInfo(core, allClauses, tierCount),
    applicationStatus: status
  };
}

module.exports = {
  REGION_ALIASES, parseApplicationPeriods, deriveApplicationStatus, splitClauses, extractIncome, extractAgeInfo,
  regionMatchNames, deriveEligibilityFields, extractTargetClauses, extractRegionRequirement, STOP_RE
};
