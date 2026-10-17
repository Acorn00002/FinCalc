/* 금융상품 메뉴(정기예금·정기적금·주택담보대출·전월세보증금대출·신용대출)의 순수 로직.
 * DOM에 의존하지 않아 테스트에서 그대로 불러 쓴다(index.html은 이 모듈이 돌려주는 값을 화면에 그리기만 한다).
 *
 * 원칙
 *  - 상품 유형(type)마다 요청 URL·캐시 키·제목·라벨·정렬·카드 필드가 따로 있고, 한 유형의 응답을 다른 유형 화면에 쓰지 않는다.
 *  - 응답에 type이 있으면 요청한 유형과 같은지 검증하고, 다르면 오류로 처리한다(다른 유형 데이터로 대체하지 않는다).
 *  - API에 없는 값은 0·"없음" 등으로 채우지 않고 항목 자체를 표시하지 않는다.
 *  - 빈 결과(status "empty")와 조회 실패(status "error")를 구분한다. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanceProducts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var CATS = ["deposit", "savings", "mortgage", "jeonse", "credit"];

  var DEPOSIT_DISCLAIMER = "실시간으로 조회한 공시 데이터이지만, 우대금리 조건과 한도는 은행별로 다를 수 있으니 가입 전 반드시 해당 은행에서 최신 조건을 다시 확인해 주세요.";
  var LOAN_DISCLAIMER = "실시간으로 조회한 공시 데이터입니다. 대출 금리는 신용도·담보·소득 등 심사 결과에 따라 공시된 구간 안에서 개인별로 달라지고, 한도와 조건도 은행마다 다르니 신청 전 반드시 해당 은행에서 확인해 주세요.";

  var META = {
    deposit: {
      title: "정기예금", isLoan: false,
      subtitle: "실시간으로 조회한 시중은행 정기예금 상품의 금리를 비교해보세요.",
      sorts: [{ key: "rate-desc", label: "최고금리 높은순" }, { key: "preferential", label: "우대금리순" }],
      spotlight: { label: "최고금리", desc: "실시간 조회 상품 중 가장 높은 최고금리예요. 우대조건 충족 여부에 따라 실제 적용 금리는 달라질 수 있어요." },
      emptyText: "조회된 정기예금 상품이 없어요.",
      errorText: "정기예금 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      disclaimer: DEPOSIT_DISCLAIMER
    },
    savings: {
      title: "정기적금", isLoan: false,
      subtitle: "실시간으로 조회한 정기적금 상품의 금리를 비교해보세요.",
      sorts: [{ key: "rate-desc", label: "최고금리 높은순" }, { key: "preferential", label: "우대금리순" }],
      spotlight: { label: "최고금리", desc: "실시간 조회 상품 중 가장 높은 최고금리예요. 우대조건 충족 여부에 따라 실제 적용 금리는 달라질 수 있어요." },
      emptyText: "조회된 정기적금 상품이 없어요.",
      errorText: "정기적금 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      disclaimer: DEPOSIT_DISCLAIMER
    },
    mortgage: {
      title: "주택담보대출", isLoan: true,
      subtitle: "주택 구입 자금용 대출의 실시간 금리를 비교해보세요. 정확한 한도는 은행 확인이 꼭 필요해요.",
      sorts: [{ key: "min-asc", label: "최저금리 낮은순" }, { key: "max-asc", label: "최고금리 낮은순" }],
      spotlight: { label: "최저금리", desc: "실시간 조회 상품 중 가장 낮은 최저금리예요. 실제 적용 금리는 심사 결과에 따라 달라질 수 있어요." },
      emptyText: "조회된 주택담보대출 상품이 없어요.",
      errorText: "주택담보대출 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      disclaimer: LOAN_DISCLAIMER
    },
    jeonse: {
      title: "전월세보증금대출", isLoan: true,
      subtitle: "전세·월세 보증금 조달용 대출의 실시간 금리를 비교해보세요.",
      sorts: [{ key: "min-asc", label: "최저금리 낮은순" }, { key: "max-asc", label: "최고금리 낮은순" }],
      spotlight: { label: "최저금리", desc: "실시간 조회 상품 중 가장 낮은 최저금리예요. 실제 적용 금리는 심사 결과에 따라 달라질 수 있어요." },
      emptyText: "조회된 전월세보증금대출 상품이 없어요.",
      errorText: "전월세보증금대출 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      disclaimer: LOAN_DISCLAIMER
    },
    credit: {
      title: "개인신용대출", isLoan: true,
      subtitle: "직장인 신용대출·마이너스통장의 실시간 금리를 비교해보세요. 신용평점에 따라 적용 금리가 크게 달라져요.",
      sorts: [{ key: "min-asc", label: "최저금리 낮은순" }, { key: "max-asc", label: "최고금리 낮은순" }],
      spotlight: { label: "최저금리", desc: "실시간 조회 상품 중 가장 낮은 최저금리예요. 실제 적용 금리는 신용평점과 심사 결과에 따라 달라질 수 있어요." },
      emptyText: "조회된 개인신용대출 상품이 없어요.",
      errorText: "개인신용대출 상품 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.",
      disclaimer: LOAN_DISCLAIMER
    }
  };

  function isCat(cat) { return Object.prototype.hasOwnProperty.call(META, cat); }
  function meta(cat) { return META[isCat(cat) ? cat : "deposit"]; }
  function isLoan(cat) { return isCat(cat) && META[cat].isLoan; }
  function defaultSort(cat) { return meta(cat).sorts[0].key; }
  function validSort(cat, key) { return meta(cat).sorts.some(function (s) { return s.key === key; }); }

  // ---------- 요청 URL · 캐시 키 · 해시 ----------
  function requestUrl(cat) {
    if (!isCat(cat)) throw new Error("알 수 없는 금융상품 유형: " + cat);
    return "/api/finance-products?type=" + cat;
  }
  function cacheKey(cat) {
    if (!isCat(cat)) throw new Error("알 수 없는 금융상품 유형: " + cat);
    return "finance-products:" + cat;
  }
  // "#finance" → {cat:null}, "#finance/savings" → {cat:"savings"}, 그 밖의 해시는 null
  function parseHash(hash) {
    var m = /^#?finance(?:\/([a-z]+))?$/.exec(String(hash || ""));
    if (!m) return null;
    return { cat: m[1] && isCat(m[1]) ? m[1] : null };
  }
  function hashFor(cat) { return "#finance/" + (isCat(cat) ? cat : "deposit"); }

  // ---------- 숫자·문구 ----------
  function isNum(n) { return typeof n === "number" && !isNaN(n); }
  function rate(n) { return isNum(n) ? n.toFixed(2) + "%" : null; }
  function text(v) { return v === null || v === undefined ? "" : String(v).trim(); }
  function oneLine(v, max) {
    var s = text(v).replace(/\s+/g, " ");
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  }

  // ---------- 정렬 ----------
  // 예·적금은 높을수록, 대출은 낮을수록 유리하다. 값이 없는 상품은 어느 정렬에서도 맨 뒤로 보낸다.
  function sortProducts(cat, list, sortKey) {
    var arr = (list || []).slice();
    var key = validSort(cat, sortKey) ? sortKey : defaultSort(cat);
    function val(p, field) { return isNum(p[field]) ? p[field] : null; }
    function cmp(a, b, getter, desc) {
      var x = getter(a), y = getter(b);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return desc ? y - x : x - y;
    }
    if (key === "rate-desc") arr.sort(function (a, b) { return cmp(a, b, function (p) { return val(p, "maxRate") !== null ? val(p, "maxRate") : val(p, "baseRate"); }, true); });
    else if (key === "preferential") arr.sort(function (a, b) { return cmp(a, b, function (p) { return isNum(p.maxRate) && isNum(p.baseRate) ? p.maxRate - p.baseRate : null; }, true); });
    else if (key === "min-asc") arr.sort(function (a, b) { return cmp(a, b, function (p) { return val(p, "baseRate"); }, false) || cmp(a, b, function (p) { return val(p, "maxRate"); }, false); });
    else if (key === "max-asc") arr.sort(function (a, b) { return cmp(a, b, function (p) { return val(p, "maxRate") !== null ? val(p, "maxRate") : val(p, "baseRate"); }, false); });
    return arr;
  }

  // 스포트라이트(대표 상품): 예·적금은 최고금리가 가장 높은 상품, 대출은 최저금리가 가장 낮은 상품
  function bestProduct(cat, list) {
    var best = null;
    (list || []).forEach(function (p) {
      if (isLoan(cat)) {
        if (isNum(p.baseRate) && (best === null || p.baseRate < best.baseRate)) best = p;
      } else {
        var v = isNum(p.maxRate) ? p.maxRate : p.baseRate;
        var bv = best === null ? null : (isNum(best.maxRate) ? best.maxRate : best.baseRate);
        if (isNum(v) && (best === null || v > bv)) best = p;
      }
    });
    return best;
  }
  function spotlight(cat, list) {
    var p = bestProduct(cat, list);
    if (!p) return null;
    var m = meta(cat);
    return { bank: p.bank, name: p.name, value: rate(isLoan(cat) ? p.baseRate : (isNum(p.maxRate) ? p.maxRate : p.baseRate)) || "—", label: m.spotlight.label, desc: m.spotlight.desc };
  }

  // ---------- 카드 · 상세 ----------
  function cardModel(cat, item) {
    var loan = isLoan(cat);
    var primaryValue, primaryLabel, secondary = [], tags = [], meta2 = [];
    if (!loan) {
      var top = isNum(item.maxRate) ? item.maxRate : item.baseRate;
      primaryValue = rate(top) || "—";
      primaryLabel = isNum(item.maxRate) && isNum(item.baseRate) && item.maxRate !== item.baseRate ? "최고" : "";
      if (rate(item.baseRate)) secondary.push("기본 " + rate(item.baseRate));
      if (text(item.term)) secondary.push(text(item.term));
      if (cat === "savings" && text(item.rsrvType)) tags.push(text(item.rsrvType));
      if (text(item.intrRateType)) tags.push(text(item.intrRateType));
      if (text(item.joinMember)) meta2.push("가입 대상 " + oneLine(item.joinMember, 24));
    } else {
      primaryValue = rate(item.baseRate) || rate(item.maxRate) || "—";
      primaryLabel = "최저";
      if (rate(item.maxRate) && item.maxRate !== item.baseRate) secondary.push("최고 " + rate(item.maxRate));
      if (rate(item.avgRate)) secondary.push("평균 " + rate(item.avgRate));
      if (cat === "credit") { if (text(item.creditProductType)) tags.push(text(item.creditProductType)); }
      else {
        if (text(item.lendRateType)) tags.push(text(item.lendRateType));
        if (text(item.repayType)) tags.push(text(item.repayType));
        if (cat === "mortgage" && text(item.mortgageType)) tags.push(text(item.mortgageType));
      }
      if (text(item.loanLimit)) meta2.push("한도 " + oneLine(item.loanLimit, 30));
    }
    if (text(item.joinWay)) meta2.push("가입 방법 " + oneLine(item.joinWay, 28));
    return { bank: text(item.bank) || "은행 미확인", name: text(item.name) || "상품명 미확인", primaryValue: primaryValue, primaryLabel: primaryLabel, secondary: secondary.join(" · "), tags: tags, meta: meta2.join(" · ") };
  }

  function detailRows(cat, item) {
    var rows = [];
    function add(label, v) { var t = text(v); if (t) rows.push([label, t]); }
    if (!isLoan(cat)) {
      if (rate(item.maxRate) && item.maxRate !== item.baseRate) add("최고금리", rate(item.maxRate));
      if (rate(item.baseRate)) add("기본금리", rate(item.baseRate) + (text(item.term) ? " (" + text(item.term) + ")" : ""));
      if (cat === "savings") add("적립 방식", item.rsrvType);
      add("이자 계산 방식", item.intrRateType);
      add("우대조건", item.specialCondition);
      add("가입 방법", item.joinWay);
      add("가입 대상", item.joinMember);
      add("최고 한도", item.maxLimit);
      add("만기 후 이자율", item.maturityInterest);
      add("기타 유의사항", item.etcNote);
    } else {
      if (rate(item.maxRate) && item.maxRate !== item.baseRate) add("최고금리", rate(item.maxRate));
      if (rate(item.avgRate)) add("평균금리", rate(item.avgRate));
      if (cat === "credit") add("대출 종류", item.creditProductType);
      else { add("금리 방식", item.lendRateType); add("상환 방식", item.repayType); if (cat === "mortgage") add("담보 유형", item.mortgageType); }
      add("대출 한도", item.loanLimit || item.maxLimit);
      add("가입 방법", item.joinWay);
      add("중도상환수수료", item.earlyRepayFee);
      add("연체이자율", item.delayRate);
      add("대출 부대비용", item.loanExpense);
      add("우대조건", item.specialCondition);
      add("기타 유의사항", item.etcNote);
    }
    return rows;
  }
  function detailHead(cat, item) {
    var loan = isLoan(cat);
    return { label: loan ? "최저금리" : "최고금리", value: rate(loan ? item.baseRate : (isNum(item.maxRate) ? item.maxRate : item.baseRate)) || "—" };
  }

  // ---------- 응답 검증 ----------
  function normalize(cat, status, data, extra) {
    var out = { cat: cat, status: status, products: [], asOf: "", error: "" };
    if (data) { out.products = data.products || []; out.asOf = text(data.asOf); }
    if (extra) out.error = extra;
    return out;
  }
  function validate(cat, httpOk, data) {
    if (!data || typeof data !== "object") return normalize(cat, "error", null, "invalid_payload");
    if (!httpOk || data.error) return normalize(cat, "error", null, String(data.error || "http_error"));
    if (data.type !== undefined && data.type !== cat) return normalize(cat, "error", null, "type_mismatch");
    if (!Array.isArray(data.products)) return normalize(cat, "error", null, "invalid_products");
    return normalize(cat, data.products.length ? "ok" : "empty", data, "");
  }

  // ---------- 로더: 유형별 캐시 · 진행 중 요청 공유 · 오래된 응답 구분 ----------
  // fetchImpl(url) → Promise<{ ok, json() }>. 반환 결과의 stale이 true이면 그 사이 다른 요청이 시작된 것이므로 화면에 쓰지 않는다.
  function createLoader(fetchImpl, opts) {
    opts = opts || {};
    var ttl = typeof opts.ttlMs === "number" ? opts.ttlMs : 5 * 60 * 1000;
    var now = opts.now || Date.now;
    var cache = {};
    var inflight = {};
    var seq = 0;

    function fetchType(cat) {
      var key = cacheKey(cat);
      if (inflight[key]) return inflight[key];
      var p = Promise.resolve()
        .then(function () { return fetchImpl(requestUrl(cat)); })
        .then(function (res) { return res.json().then(function (data) { return validate(cat, !!res.ok, data); }, function () { return normalize(cat, "error", null, "invalid_json"); }); })
        .catch(function (err) { return normalize(cat, "error", null, err && err.message ? err.message : "network_error"); })
        .then(function (result) {
          delete inflight[key];
          if (result.status === "ok" || result.status === "empty") cache[key] = { cat: cat, at: now(), result: result };
          return result;
        });
      inflight[key] = p;
      return p;
    }

    return {
      cacheKey: cacheKey,
      // force=true이면 캐시를 쓰지 않는다(재시도 버튼)
      load: function (cat, force) {
        var mySeq = ++seq;
        var key = isCat(cat) ? cacheKey(cat) : null;
        var hit = key && !force ? cache[key] : null;
        var p;
        if (hit && hit.cat === cat && now() - hit.at < ttl && hit.result.cat === cat) {
          p = Promise.resolve(Object.assign({}, hit.result, { fromCache: true }));
        } else if (!isCat(cat)) {
          p = Promise.resolve(normalize(cat, "error", null, "unknown_type"));
        } else {
          if (force) delete cache[key];
          p = fetchType(cat).then(function (r) { return Object.assign({}, r, { fromCache: false }); });
        }
        return p.then(function (r) { return Object.assign({}, r, { stale: mySeq !== seq }); });
      },
      cacheSize: function () { return Object.keys(cache).length; }
    };
  }

  return {
    CATS: CATS, META: META, isCat: isCat, meta: meta, isLoan: isLoan, defaultSort: defaultSort, validSort: validSort,
    requestUrl: requestUrl, cacheKey: cacheKey, parseHash: parseHash, hashFor: hashFor,
    formatRate: rate, sortProducts: sortProducts, bestProduct: bestProduct, spotlight: spotlight,
    cardModel: cardModel, detailRows: detailRows, detailHead: detailHead, validate: validate, createLoader: createLoader
  };
});
