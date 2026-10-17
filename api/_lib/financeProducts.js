// 금융감독원 "금융상품 한눈에" Open API 응답(baseList/optionList)을 화면용 상품 목록으로 바꾸는 순수 함수.
// 네트워크·환경변수에 의존하지 않아 테스트에서 그대로 불러 쓴다.

export const FSS_ENDPOINT_BY_TYPE = {
  deposit: "depositProductsSearch",
  savings: "savingProductsSearch",
  mortgage: "mortgageLoanProductsSearch",
  jeonse: "rentHouseLoanProductsSearch",
  credit: "creditLoanProductsSearch"
};
export const FSS_LOAN_TYPES = ["mortgage", "jeonse", "credit"];

export function fssProductKey(item) { return item.fin_co_no + "_" + item.fin_prdt_cd; }

function text(v) { return v === null || v === undefined ? "" : String(v).trim(); }

// 옵션 행들에서 같은 항목의 서로 다른 값을 순서대로 모아 "A · B"로 합친다(빈 값 제외).
function uniqueJoin(options, key) {
  const seen = [];
  options.forEach((o) => {
    const v = text(o[key]);
    if (v && seen.indexOf(v) === -1) seen.push(v);
  });
  return seen.join(" · ");
}

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// 신용대출 옵션은 금리 구분(crdt_lend_rate_type)별로 행이 나뉜다. 기준금리·가감조정금리 행의 값(가감조정은
// 음수일 수 있다)을 대출금리와 섞으면 "최저금리 -0.2%" 같은 값이 나오므로, 구분 정보가 있으면 "대출금리" 행만 쓴다.
function creditRateRows(options) {
  const typed = options.filter((o) => text(o.crdt_lend_rate_type) || text(o.crdt_lend_rate_type_nm));
  if (!typed.length) return { rows: options, typed: false };
  const loanRows = typed.filter((o) => text(o.crdt_lend_rate_type_nm) === "대출금리" || (!text(o.crdt_lend_rate_type_nm) && text(o.crdt_lend_rate_type) === "A"));
  if (loanRows.length) return { rows: loanRows, typed: true };
  // "대출금리" 행을 못 찾으면 기준금리·가감조정 성격으로 읽히는 행만 걷어내고, 그래도 없으면 전체를 쓴다(상품이 통째로 사라지지 않게).
  const rest = typed.filter((o) => !/기준|가감|가산/.test(text(o.crdt_lend_rate_type_nm)));
  return { rows: rest.length ? rest : options, typed: true };
}

export function buildProducts(type, baseList, optionList) {
  const isLoan = FSS_LOAN_TYPES.indexOf(type) !== -1;
  const optionsByKey = {};
  (optionList || []).forEach((opt) => {
    const key = fssProductKey(opt);
    if (!optionsByKey[key]) optionsByKey[key] = [];
    optionsByKey[key].push(opt);
  });

  return (baseList || []).map((base) => {
    const options = optionsByKey[fssProductKey(base)] || [];
    let baseRate = null;
    let maxRate = null;
    let avgRate = null;
    let term = "";
    let rateRows = options;

    if (type === "credit") {
      // 신용대출은 lend_rate_min/max가 아니라 신용등급별 금리(crdt_grad_1~13, crdt_grad_avg)로 내려온다.
      rateRows = creditRateRows(options).rows;
      const avgs = [];
      rateRows.forEach((o) => {
        Object.keys(o).forEach((key) => {
          if (key.indexOf("crdt_grad_") !== 0) return;
          const rate = num(o[key]);
          if (rate === null || rate < 0) return;
          if (key === "crdt_grad_avg") avgs.push(rate);
          if (baseRate === null || rate < baseRate) baseRate = rate;
          if (maxRate === null || rate > maxRate) maxRate = rate;
        });
      });
      if (avgs.length) avgRate = Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 100) / 100;
    } else if (isLoan) {
      const avgs = [];
      options.forEach((o) => {
        const min = num(o.lend_rate_min);
        const max = num(o.lend_rate_max);
        const avg = num(o.lend_rate_avg);
        const rep = min !== null ? min : avg;
        if (rep !== null && rep >= 0 && (baseRate === null || rep < baseRate)) baseRate = rep;
        if (max !== null && max >= 0 && (maxRate === null || max > maxRate)) maxRate = max;
        if (avg !== null && avg >= 0) avgs.push(avg);
      });
      if (maxRate === null) maxRate = baseRate;
      if (avgs.length) avgRate = Math.round(avgs.reduce((a, b) => a + b, 0) / avgs.length * 100) / 100;
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

    const product = {
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
      avgRate: avgRate,
      term: term,
      disclosedMonth: base.dcls_month || ""
    };

    // 상품 유형별로 API가 실제로 내려주는 항목만 덧붙인다(값이 없으면 키 자체를 만들지 않아 화면에 빈 항목이 생기지 않는다).
    const extra = {};
    if (type === "deposit" || type === "savings") {
      extra.intrRateType = uniqueJoin(options, "intr_rate_type_nm");
      if (type === "savings") extra.rsrvType = uniqueJoin(options, "rsrv_type_nm");
    } else if (type === "mortgage" || type === "jeonse") {
      extra.repayType = uniqueJoin(options, "rpay_type_nm");
      extra.lendRateType = uniqueJoin(options, "lend_rate_type_nm");
      if (type === "mortgage") extra.mortgageType = uniqueJoin(options, "mrtg_type_nm");
    } else if (type === "credit") {
      extra.creditProductType = text(base.crdt_prdt_type_nm);
      extra.rateKind = uniqueJoin(rateRows, "crdt_lend_rate_type_nm");
    }
    if (isLoan) {
      extra.loanLimit = text(base.loan_lmt);
      extra.earlyRepayFee = text(base.erly_rpay_fee);
      extra.delayRate = text(base.dly_rate);
      extra.loanExpense = text(base.loan_inci_expn);
    }
    Object.keys(extra).forEach((k) => { if (extra[k]) product[k] = extra[k]; });
    return product;
  }).filter((p) => p.baseRate !== null || p.maxRate !== null);
}
