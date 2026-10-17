// Vercel 서버리스 함수 — /api/finance-products
// Firebase Functions(functions/index.js)의 financeProductsLive와 동일한 금융감독원
// "금융상품 한눈에" Open API 호출 로직을 그대로 포팅했다 — gofincalc.com(Vercel 배포본)과
// asset-filot.web.app(Firebase 배포본) 중 어느 쪽으로 접속해도 같은 응답을 받도록 한다.

import { FSS_ENDPOINT_BY_TYPE, buildProducts } from "./_lib/financeProducts.js";

const FSS_BASE_URL = "https://finlife.fss.or.kr/finlifeapi";
const FSS_TOP_FIN_GRP_NO = "020000"; // 은행권(시중은행)
async function fetchFssAllPages(endpoint, apiKey) {
  let pageNo = 1;
  let baseList = [];
  let optionList = [];
  for (;;) {
    const url = FSS_BASE_URL + "/" + endpoint + ".json" +
      "?auth=" + encodeURIComponent(apiKey) +
      "&topFinGrpNo=" + FSS_TOP_FIN_GRP_NO +
      "&pageNo=" + pageNo;
    const r = await fetch(url);
    if (!r.ok) throw new Error("FSS API 응답 오류: " + r.status);
    const data = await r.json();
    const result = data.result;
    if (!result || result.err_cd !== "000") {
      throw new Error("FSS API 오류: " + (result ? result.err_cd + " " + result.err_msg : "응답 없음"));
    }
    baseList = baseList.concat(result.baseList || []);
    optionList = optionList.concat(result.optionList || []);
    if (!result.max_page_no || pageNo >= result.max_page_no) break;
    pageNo++;
  }
  return { baseList: baseList, optionList: optionList };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const type = String((req.query && req.query.type) || "");
  const endpoint = Object.prototype.hasOwnProperty.call(FSS_ENDPOINT_BY_TYPE, type) ? FSS_ENDPOINT_BY_TYPE[type] : "";
  if (!endpoint) {
    return res.status(400).json({ error: "type은 deposit/savings/mortgage/jeonse/credit 중 하나여야 합니다." });
  }

  const apiKey = process.env.FSS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FSS_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const { baseList, optionList } = await fetchFssAllPages(endpoint, apiKey);
    const products = buildProducts(type, baseList, optionList);

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200");
    // type을 함께 내려 클라이언트가 "요청한 상품 유형의 응답인지" 검증할 수 있게 한다.
    return res.status(200).json({ type: type, products: products, asOf: baseList[0] ? baseList[0].dcls_month : "" });
  } catch (error) {
    console.error("finance-products 실패:", error);
    return res.status(502).json({ error: "실시간 금융상품 정보를 불러오지 못했습니다." });
  }
}
