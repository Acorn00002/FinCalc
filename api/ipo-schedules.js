// Vercel 서버리스 함수 — /api/ipo-schedules
// Firebase Functions(functions/index.js)의 ipoSchedulesLive와 동일한 DART 공모주 조회 로직을
// 그대로 포팅했다 — gofincalc.com(Vercel 배포본)과 asset-filot.web.app(Firebase 배포본) 중
// 어느 쪽으로 접속해도 같은 응답을 받도록 한다.
//
// DART에는 "이번 주 공모주 목록"을 바로 주는 API가 없어서, 두 단계로 조합한다.
//   1) list.json에서 corp_code 없이 "증권신고서(지분증권)"(pblntf_ty=C, pblntf_detail_ty=C001) 공시를
//      최근 45일 범위로 검색해 회사 목록을 얻는다.
//   2) 정정신고서가 여러 번 올라올 수 있어 corp_code당 접수일(rcept_dt) 최신 1건만 남긴 뒤,
//      각 회사의 corp_code로 estkRs.json(지분증권 증권신고서 상세)을 조회해 청약기일(sbd)·납입기일(pymd)을 가져온다.
// opendart 가이드 문서 기준으로 구현했고 실제 발급 키로 라이브 응답을 검증하지 못한 상태라,
// sbd/pymd의 정확한 날짜 표기 형식은 실사용 중 조정이 필요할 수 있다.

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
  const bgnDe = dartDateCompact(-45);
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

  return filings;
}

function dedupeLatestByCorp(filings) {
  const latest = {};
  filings.forEach((f) => {
    const prev = latest[f.corp_code];
    if (!prev || f.rcept_dt > prev.rcept_dt) latest[f.corp_code] = f;
  });
  return Object.values(latest);
}

async function fetchDartIpoDetail(apiKey, filing) {
  const bgnDe = dartDateCompact(-60);
  const endDe = dartDateCompact(30);
  const url = DART_ESTKRS_URL +
    "?crtfc_key=" + encodeURIComponent(apiKey) +
    "&corp_code=" + filing.corp_code +
    "&bgn_de=" + bgnDe +
    "&end_de=" + endDe;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "000" || !data.list || !data.list.length) return null;

    const rows = data.list;
    const generalRow = rows.find((r) => r.sbd) || rows[0];
    const priceRow = rows.find((r) => r.slprc);
    const underwriterRow = rows.find((r) => r.actnmn);

    const subRange = parseDartDateRange(generalRow && generalRow.sbd);
    if (!subRange) return null;

    const paymentDates = extractDartDates(generalRow && generalRow.pymd);
    const priceRaw = priceRow && priceRow.slprc ? String(priceRow.slprc).replace(/[^0-9]/g, "") : "";
    const price = priceRaw ? parseInt(priceRaw, 10) : null;

    return {
      id: filing.corp_code,
      name: filing.corp_name,
      market: filing.corp_cls === "Y" ? "코스피" : (filing.corp_cls === "K" ? "코스닥" : "기타"),
      underwriter: underwriterRow ? underwriterRow.actnmn : "",
      priceMin: price,
      priceMax: price,
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
