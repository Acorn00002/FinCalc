// Vercel 서버리스 함수 — /api/ipo-schedules
// Firebase Functions(functions/index.js)의 ipoSchedulesLive와 동일한 DART 공모주 조회 로직을
// 그대로 포팅했다 — gofincalc.com(Vercel 배포본)과 asset-filot.web.app(Firebase 배포본) 중
// 어느 쪽으로 접속해도 같은 응답을 받도록 한다.
//
// DART에는 "이번 주 공모주 목록"을 바로 주는 API가 없어서, 두 단계로 조합한다.
//   1) list.json에서 corp_code 없이 "증권신고서(지분증권)"(pblntf_ty=C, pblntf_detail_ty=C001) 공시를
//      최근 60일 범위로 검색한다. 이 상세유형은 지분증권 관련 공시를 폭넓게 묶어서, 실제로는
//      상장사의 유상증자·일괄신고(회사채/ELS) 실적보고서 등이 훨씬 더 많이 섞여 나온다(실측 확인:
//      45일 검색에 3800여 건). report_nm에 "증권신고서(지분증권)"이 포함된 것만 남긴다([기재정정]/
//      [발행조건확정] 접두어 포함) — stock_code 유무로는 더 이상 걸러내지 않는다(2단계에서 판단).
//   2) 회사마다 정정 공시가 여러 번 올라오므로 접수일(rcept_dt) 기준 최신 1건만 남긴 뒤,
//      각 회사의 corp_code로 estkRs.json(지분증권 증권신고서 상세)을 조회해 청약기일(sbd)·납입기일(pymd)·
//      모집방법(slmthn) 등을 가져온다. 실제 키로 slmthn 값을 확인해보니, 이미 상장된 회사의 유상증자는
//      "실권주 일반공모"라는 명시적 문구가 있는 것만 일반 투자자가 청약 가능한 물량이고 — 그 외
//      (주주배정/제3자배정 등)는 청약 불가능한 사모성 공시라 stock_code가 있으면서 slmthn에
//      "실권주"가 없는 건 제외한다. 스팩/리츠는 회사명 패턴("기업인수목적"/"리츠")으로 분류한다
//      (국내에서 이 명명 규칙은 사실상 강제 사항이라 신뢰도가 높음).
// 실제 발급받은 키로 라이브 검증까지 마쳤다(2026-08 기준). estkRs 응답은 data.list가 아니라
// data.group[].list(그룹별 배열)로 내려온다는 것과, sbd 형식이 "2026년 09월 16일 ~ 2026년 09월 17일"인
// 것도 실측으로 확인했다.

export const config = { maxDuration: 60 };

const DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json";
const DART_ESTKRS_URL = "https://opendart.fss.or.kr/api/estkRs.json";

function pad2(n) { return String(n).padStart(2, "0"); }

function dartDateCompact(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
}

function extractDartDates(str) {
  if (!str) return [];
  const re = /(\d{4})[.\-년]\s*(\d{1,2})[.\-월]\s*(\d{1,2})/g;
  const out = [];
  let m;
  while ((m = re.exec(str)) !== null) {
    out.push(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  return out;
}

function parseDartDateRange(str) {
  const dates = extractDartDates(str);
  if (!dates.length) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

async function fetchDartIpoFilingList(apiKey) {
  const bgnDe = dartDateCompact(-60);
  const endDe = dartDateCompact(0);
  const pageCount = 100;
  let pageNo = 1;
  const filings = [];

  for (;;) {
    const url = DART_LIST_URL +
      "?crtfc_key=" + encodeURIComponent(apiKey) +
      "&pblntf_ty=C" +
      "&pblntf_detail_ty=C001" +
      "&bgn_de=" + bgnDe +
      "&end_de=" + endDe +
      "&page_no=" + pageNo +
      "&page_count=" + pageCount;

    const res = await fetch(url);
    if (!res.ok) break;
    const data = await res.json();
    if (data.status === "013") break;
    if (data.status !== "000") break;

    filings.push(...(data.list || []));
    if ((data.list || []).length < pageCount) break;
    pageNo += 1;
    if (pageNo > 10) break;
  }

  // 증권신고서(지분증권) 본문/정정/발행조건확정만 남긴다. stock_code 유무로는 걸러내지 않는다
  // (실권주 일반공모인지는 2단계 상세 조회에서 slmthn으로 판단).
  return filings.filter((f) => f.report_nm && f.report_nm.includes("증권신고서(지분증권)"));
}

function dedupeLatestByCorp(filings) {
  const latest = {};
  filings.forEach((f) => {
    const prev = latest[f.corp_code];
    if (!prev || f.rcept_dt > prev.rcept_dt) latest[f.corp_code] = f;
  });
  return Object.values(latest);
}

// 회사명 패턴으로 스팩/리츠를 가려낸다 — 국내 스팩은 반드시 회사명에 "기업인수목적"이 들어가고
// (예: "엔에이치기업인수목적34호"), 리츠는 "리츠" 또는 "위탁관리부동산투자회사"가 들어가는 게
// 사실상 강제되는 명명 규칙이라 신뢰도가 높다.
function classifyIpoCategory(corpName, slmthn) {
  if (slmthn && slmthn.includes("실권주")) return "rights";
  if (corpName.includes("기업인수목적")) return "spac";
  if (corpName.includes("리츠") || corpName.includes("위탁관리부동산투자회사")) return "reit";
  return "general";
}

async function fetchDartIpoDetail(apiKey, filing) {
  const bgnDe = dartDateCompact(-60);
  const endDe = dartDateCompact(60);
  const url = DART_ESTKRS_URL +
    "?crtfc_key=" + encodeURIComponent(apiKey) +
    "&corp_code=" + filing.corp_code +
    "&bgn_de=" + bgnDe +
    "&end_de=" + endDe;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "000" || !data.group || !data.group.length) return null;

    // estkRs 응답은 그룹(일반사항/증권의종류/인수인정보/...)별로 나뉜 배열이라 하나로 펼쳐서 찾는다.
    const rows = data.group.reduce((acc, g) => acc.concat(g.list || []), []);
    const generalRow = rows.find((r) => r.sbd) || rows[0];
    const priceRow = rows.find((r) => r.slprc);
    const underwriterRow = rows.find((r) => r.actnmn);
    const methodRow = rows.find((r) => r.slmthn);
    const slmthn = methodRow ? methodRow.slmthn : "";

    // 이미 상장된 회사의 지분증권 신고서는 대부분 주주배정(제3자배정 등) 사모 성격이라 일반 투자자가
    // 청약할 수 없다 — "실권주 일반공모"라고 명시된 것만 실제 청약 가능한 물량이라 통과시킨다.
    if (filing.stock_code && !slmthn.includes("실권주")) return null;

    const subRange = parseDartDateRange(generalRow && generalRow.sbd);
    if (!subRange) return null;

    const paymentDates = extractDartDates(generalRow && generalRow.pymd);
    const priceRaw = priceRow && priceRow.slprc ? String(priceRow.slprc).replace(/[^0-9]/g, "") : "";
    const price = priceRaw ? parseInt(priceRaw, 10) : null;
    const category = classifyIpoCategory(filing.corp_name, slmthn);

    // 공모금액(slta)·공모주식수(stkcnt) — 시가총액은 상장 전 회사의 "총발행주식수"를 이 API로
    // 얻을 수 없어(공모 대상 수량만 나옴) 계산하지 않는다(추측 수치 제공 금지, 프론트에서 "미정" 처리).
    const amountRaw = priceRow && priceRow.slta ? String(priceRow.slta).replace(/[^0-9]/g, "") : "";
    const sharesRaw = priceRow && priceRow.stkcnt ? String(priceRow.stkcnt).replace(/[^0-9]/g, "") : "";

    return {
      id: filing.corp_code,
      name: filing.corp_name,
      stockCode: filing.stock_code || null,
      market: filing.stock_code ? (filing.corp_cls === "Y" ? "코스피" : "코스닥") : "신규상장",
      category: category,
      underwriter: underwriterRow ? underwriterRow.actnmn : "",
      priceMin: price,
      priceMax: price,
      offeringAmount: amountRaw ? parseInt(amountRaw, 10) : null,
      offeringShares: sharesRaw ? parseInt(sharesRaw, 10) : null,
      subStart: subRange.start.toISOString(),
      subEnd: subRange.end.toISOString(),
      refundDate: paymentDates.length ? paymentDates[paymentDates.length - 1].toISOString() : null,
      sourceUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + filing.rcept_no
    };
  } catch (error) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const apiKey = process.env.DART_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DART_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const filings = dedupeLatestByCorp(await fetchDartIpoFilingList(apiKey));
    const details = await Promise.all(filings.map((f) => fetchDartIpoDetail(apiKey, f)));
    const schedules = details.filter(Boolean);

    res.setHeader("Cache-Control", "public, max-age=1800");
    return res.status(200).json({ schedules: schedules });
  } catch (error) {
    console.error("ipo-schedules 실패:", error);
    return res.status(502).json({ error: "실시간 공모주 일정을 불러오지 못했습니다." });
  }
}
