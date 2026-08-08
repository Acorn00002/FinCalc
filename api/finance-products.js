// Vercel 서버리스 함수 — /api/finance-products
// Firebase Functions(functions/index.js)의 financeProductsLive와 동일한 금융감독원
// "금융상품 한눈에" Open API 호출 로직을 그대로 포팅했다 — gofincalc.com(Vercel 배포본)과
// asset-filot.web.app(Firebase 배포본) 중 어느 쪽으로 접속해도 같은 응답을 받도록 한다.

const FSS_BASE_URL = "https://finlife.fss.or.kr/finlifeapi";
const FSS_TOP_FIN_GRP_NO = "020000"; // 은행권(시중은행)
const FSS_ENDPOINT_BY_TYPE = {
  deposit: "depositProductsSearch",
  savings: "savingProductsSearch",
  mortgage: "mortgageLoanProductsSearch",
  jeonse: "rentHouseLoanProductsSearch",
  credit: "creditLoanProductsSearch"
};
const FSS_LOAN_TYPES = ["mortgage", "jeonse", "credit"];

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

function fssProductKey(item) { return item.fin_co_no + "_" + item.fin_prdt_cd; }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const type = String((req.query && req.query.type) || "");
  const endpoint = FSS_ENDPOINT_BY_TYPE[type];
  if (!endpoint) {
    return res.status(400).json({ error: "type은 deposit/savings/mortgage/jeonse/credit 중 하나여야 합니다." });
  }

  const apiKey = process.env.FSS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "FSS_API_KEY가 설정되지 않았습니다." });
  }

  try {
    const { baseList, optionList } = await fetchFssAllPages(endpoint, apiKey);
    const isLoan = FSS_LOAN_TYPES.indexOf(type) !== -1;

    const optionsByKey = {};
    optionList.forEach((opt) => {
      const key = fssProductKey(opt);
      if (!optionsByKey[key]) optionsByKey[key] = [];
      optionsByKey[key].push(opt);
    });

    const products = baseList.map((base) => {
      const options = optionsByKey[fssProductKey(base)] || [];
      let baseRate = null;
      let maxRate = null;
      let term = "";

      if (type === "credit") {
        // 신용대출은 lend_rate_min/max가 아니라 신용등급별 금리(crdt_grad_1~13, crdt_grad_avg)로
        // 내려온다 — 등급별 최저~최고 금리를 그대로 대표 구간으로 쓴다.
        options.forEach((o) => {
          Object.keys(o).forEach((key) => {
            if (key.indexOf("crdt_grad_") !== 0) return;
            const rate = parseFloat(o[key]);
            if (isNaN(rate)) return;
            if (baseRate === null || rate < baseRate) baseRate = rate;
            if (maxRate === null || rate > maxRate) maxRate = rate;
          });
        });
      } else if (isLoan) {
        options.forEach((o) => {
          const min = parseFloat(o.lend_rate_min);
          const max = parseFloat(o.lend_rate_max);
          const avg = parseFloat(o.lend_rate_avg);
          const rep = !isNaN(min) ? min : avg;
          if (!isNaN(rep) && (baseRate === null || rep < baseRate)) baseRate = rep;
          if (!isNaN(max) && (maxRate === null || max > maxRate)) maxRate = max;
        });
        if (maxRate === null) maxRate = baseRate;
      } else {
        const twelveMonth = options.filter((o) => String(o.save_trm) === "12")[0] || options[0];
        if (twelveMonth) {
          baseRate = parseFloat(twelveMonth.intr_rate);
          maxRate = parseFloat(twelveMonth.intr_rate2);
          if (isNaN(baseRate)) baseRate = null;
          if (isNaN(maxRate)) maxRate = baseRate;
          term = "12개월 기준";
        }
      }

      return {
        bank: base.kor_co_nm || "",
        name: base.fin_prdt_nm || "",
        joinWay: base.join_way || "",
        maturityInterest: base.mtrt_int || "",
        specialCondition: base.spcl_cnd || "",
        joinDeny: base.join_deny || "",
        joinMember: base.join_member || "",
        etcNote: base.etc_note || "",
        maxLimit: base.max_limit || "",
        baseRate: baseRate,
        maxRate: maxRate,
        term: term,
        disclosedMonth: base.dcls_month || ""
      };
    }).filter((p) => p.baseRate !== null || p.maxRate !== null);

    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json({ products: products, asOf: baseList[0] ? baseList[0].dcls_month : "" });
  } catch (error) {
    console.error("finance-products 실패:", error);
    return res.status(502).json({ error: "실시간 금융상품 정보를 불러오지 못했습니다." });
  }
}
