// Vercel 서버리스 함수 — /api/apartment-subscriptions
// Firebase Functions(functions/index.js)의 apartmentSubscriptionsLive와 동일한 로직을 그대로 포팅했다.
//
// 한국부동산원_청약홈 분양정보 조회 서비스 (data.go.kr 데이터ID 15098547).
// Base URL은 apis.data.go.kr이 아니라 api.odcloud.kr이고, 인증은 "Authorization: Infuser {키}"
// 헤더 방식이다 — Swagger 문서(https://infuser.odcloud.kr/api/stages/37000/api-docs)로 실제
// 필드명을 전부 확인하고, 실제 발급 키로 라이브 테스트까지 마쳤다(대구 "달서자이 제니크" 등 실매물 확인).

export const config = { maxDuration: 60 };

const CHEONGYAKHOME_API_URL = "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";

function pad2(n) { return String(n).padStart(2, "0"); }

function dartDateCompact(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
}

async function fetchApartmentSubscriptions(apiKey) {
  const bgnDe = dartDateCompact(-45).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const pageSize = 200;
  let page = 1;
  const rows = [];

  for (;;) {
    const url = CHEONGYAKHOME_API_URL +
      "?page=" + page +
      "&perPage=" + pageSize +
      "&cond[RCRIT_PBLANC_DE::GTE]=" + bgnDe;
    const res = await fetch(url, { headers: { Authorization: "Infuser " + apiKey } });
    if (!res.ok) break;
    const data = await res.json();
    const items = data.data || [];
    rows.push(...items);
    if (items.length < pageSize) break;
    page += 1;
    if (page > 10) break;
  }

  return rows.map((item) => ({
    id: item.HOUSE_MANAGE_NO || item.PBLANC_NO,
    name: item.HOUSE_NM || "",
    houseType: item.HOUSE_SECD_NM || "",
    supplyType: item.HOUSE_DTL_SECD_NM || "",
    region: item.SUBSCRPT_AREA_CODE_NM || "",
    address: item.HSSPLY_ADRES || "",
    totalUnits: item.TOT_SUPLY_HSHLDCO ? parseInt(item.TOT_SUPLY_HSHLDCO, 10) : null,
    constructor: item.CNSTRCT_ENTRPS_NM || "",
    developer: item.BSNS_MBY_NM || "",
    specialSupplyStart: item.SPSPLY_RCEPT_BGNDE || null,
    specialSupplyEnd: item.SPSPLY_RCEPT_ENDDE || null,
    subStart: item.RCEPT_BGNDE || null,
    subEnd: item.RCEPT_ENDDE || null,
    winnerDate: item.PRZWNER_PRESNATN_DE || null,
    contractStart: item.CNTRCT_CNCLS_BGNDE || null,
    contractEnd: item.CNTRCT_CNCLS_ENDDE || null,
    moveInMonth: item.MVN_PREARNGE_YM || null,
    speculativeZone: item.SPECLT_RDN_EARTH_AT === "Y",
    adjustmentZone: item.MDAT_TRGET_AREA_SECD === "Y",
    priceCapZone: item.PARCPRC_ULS_AT === "Y",
    sourceUrl: item.PBLANC_URL || "https://www.applyhome.co.kr"
  })).filter((x) => x.id && x.name && x.subStart && x.subEnd);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const apiKey = process.env.DATA_GO_KR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "DATA_GO_KR_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const listings = await fetchApartmentSubscriptions(apiKey);
    // max-age만 있으면 Vercel Edge CDN에는 캐시되지 않고 브라우저 캐시로만 적용돼서, 방문자마다
    // 매번 청약홈 API 왕복(2초+)을 그대로 겪는다 — s-maxage/stale-while-revalidate를 추가해
    // Edge에서 30분간 모든 방문자에게 즉시 응답하고, 그 이후는 백그라운드 갱신 중에도 캐시를 계속 서빙한다.
    res.setHeader("Cache-Control", "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600");
    return res.status(200).json({ listings: listings });
  } catch (error) {
    console.error("apartment-subscriptions 실패:", error);
    return res.status(502).json({ error: "실시간 아파트 청약 일정을 불러오지 못했습니다." });
  }
}
