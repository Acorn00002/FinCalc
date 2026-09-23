// 계산기 오버레이(모달) 런처 — index.html의 거대한 공유 스크립트(activateView 등 19개 화면 로직)를
// 통째로 복사하지 않고, openFinCalc/closeFinCalc 부분만 순수하게 뽑아낸 독립 스크립트.
// index.html:8819-8904 원본과 동일한 동작을 하되, index.html에서만 존재하는 appHeader/appMain/
// hubSearch/activateView 등에 의존하지 않도록 방어적으로 다시 작성했다 — 계산기 SEO 페이지,
// /ipo-calendar/, /financial-calendar/ 등 "전체 앱 셸 없이" 계산기 하나만 여는 가벼운 페이지에서 쓴다.
//
// 필요한 HTML: <div class="fincalc-overlay" id="fincalcOverlay"> 구조(partials/fincalc-overlay.html
// 참고)와 css/calculators.css(.fincalc-* 스타일).
//
// 페이지에 window.__CALC_DEEP_LINK__ = "slug" 가 설정돼 있으면 로드 즉시 해당 계산기를 자동으로 연다
// (계산기 SEO 페이지용). /ipo-calendar/ 등에서는 이 변수를 설정하지 않고 버튼 onclick="openFinCalc('subscription')"
// 처럼 사용자 조작으로만 연다.
(function () {
  "use strict";

  var FINCALC_MAP = {
    "compound-simple":   { title: "일반 복리 계산기",       icon: "ph-chart-line-up",       src: "/finpilot/index.html?tab=compound-simple" },
    "compound-periodic": { title: "적립식 복리 (SIP)",      icon: "ph-piggy-bank",           src: "/finpilot/index.html?tab=compound-periodic" },
    "goal-planner":      { title: "목표 자산 계산 (Goal)",  icon: "ph-target",               src: "/finpilot/index.html?tab=goal-planner" },
    "water-ratio":       { title: "평단가 / 물타기",        icon: "ph-scales",               src: "/finpilot/index.html?tab=average-price" },
    "kelly":             { title: "켈리 공식 최적화",        icon: "ph-dice-five",            src: "/finpilot/index.html?tab=kelly" },
    "roi":               { title: "수익률 / 퍼센트",         icon: "ph-percent",              src: "/finpilot/index.html?tab=roi" },
    "exchange":          { title: "실시간 환율 변환",        icon: "ph-arrows-left-right",    src: "/finpilot/index.html?tab=exchange" },
    "dividend":          { title: "배당금 계산기",           icon: "ph-money",                src: "/finpilot/index.html?tab=dividend" },
    "salary":            { title: "연봉 실수령액 계산기",    icon: "ph-identification-card",  src: "/finpilot/index.html?tab=salary" },
    "loan":              { title: "대출이자 계산기",         icon: "ph-percent",              src: "/finpilot/index.html?tab=loan-interest" },
    "deposit":           { title: "정기예금 계산기",         icon: "ph-bank",                 src: "/finpilot/index.html?tab=deposit" },
    "savings":           { title: "정기적금 계산기",         icon: "ph-vault",                src: "/finpilot/index.html?tab=savings" },
    "gift-tax":          { title: "증여세 계산기",           icon: "ph-coins",                src: "/finpilot/index.html?tab=gift-tax" },
    "inheritance-tax":   { title: "상속세 계산기",           icon: "ph-hand-heart",           src: "/finpilot/index.html?tab=inheritance-tax" },
    "gains-tax":         { title: "양도소득세 계산기",       icon: "ph-receipt",              src: "/finpilot/index.html?tab=gains-tax" },
    "inflation":         { title: "인플레이션 계산기",       icon: "ph-trend-down",           src: "/finpilot/index.html?tab=inflation" },
    "severance":         { title: "퇴직금 계산기",           icon: "ph-hand-coins",           src: "/finpilot/index.html?tab=severance" },
    "early-termination": { title: "예금중도해지 계산기",     icon: "ph-scissors",             src: "/finpilot/index.html?tab=early-termination" },
    "retirement":        { title: "은퇴자금 계산기",         icon: "ph-hourglass-high",       src: "/finpilot/index.html?tab=retirement" },
    "loan-limit":        { title: "대출한도 계산기",         icon: "ph-bank",                 src: "/finpilot/index.html?tab=loan-limit" },
    "apt-buy":           { title: "취득세 계산기",           icon: "ph-house-line",           src: "/finpilot/index.html?tab=apt-buy" },
    "apt-tax":           { title: "보유세 계산기",           icon: "ph-buildings",            src: "/finpilot/index.html?tab=apt-tax" },
    "brokerage":         { title: "중개수수료 계산기",       icon: "ph-handshake",            src: "/finpilot/index.html?tab=brokerage" },
    "pyeong":            { title: "평수 변환기",             icon: "ph-ruler",                src: "/finpilot/index.html?tab=pyeong" },
    "deposit-calc":      { title: "환산보증금 계산기",       icon: "ph-storefront",           src: "/finpilot/index.html?tab=deposit-calc" },
    "subscription":      { title: "청약가점 계산기",         icon: "ph-medal",                src: "/finpilot/index.html?tab=subscription" },
    "home-budget":       { title: "내집마련 계산기",         icon: "ph-key",                  src: "/finpilot/index.html?tab=home-budget" },
    "global-stock-tax":  { title: "해외주식 양도세 계산기",  icon: "ph-globe-hemisphere-west", src: "/finpilot/index.html?tab=global-stock-tax" },
    "global-net":        { title: "해외주식 실수령 계산기",  icon: "ph-currency-circle-dollar", src: "/finpilot/index.html?tab=global-net" },
    "fin-func":          { title: "재무함수 계산기",         icon: "ph-function",             src: "/finpilot/index.html?tab=fin-func" }
  };

  var fincalcOverlay = document.getElementById("fincalcOverlay");
  var fincalcBody = document.getElementById("fincalcBody");
  var fincalcIcon = document.getElementById("fincalcIcon");
  var fincalcTitleEl = document.getElementById("fincalcTitle");
  var fincalcCloseBtn = document.getElementById("fincalcCloseBtn");
  // 원본(index.html)과 달리 방어적으로 가드한다 — 이 스크립트를 포함한 페이지에 오버레이 마크업이
  // 없으면(설정 실수 등) 조용히 아무 것도 하지 않고 끝낸다(예외로 이후 스크립트 실행을 막지 않음).
  if (!fincalcOverlay || !fincalcBody || !fincalcIcon || !fincalcTitleEl) return;

  var fincalcCloseTimer = null;

  window.openFinCalc = function (id) {
    var config = FINCALC_MAP[id];
    if (!config) return;

    clearTimeout(fincalcCloseTimer);
    fincalcTitleEl.textContent = config.title;
    fincalcIcon.innerHTML = '<i class="ph-duotone ' + config.icon + '"></i>';

    var loadingId = "fincalcLoading-" + Date.now();
    fincalcBody.innerHTML =
      '<div class="fincalc-loading" id="' + loadingId + '"><span class="fincalc-spinner"></span></div>' +
      '<iframe src="' + config.src + '" title="' + config.title + '"></iframe>';
    var iframeEl = fincalcBody.querySelector("iframe");
    iframeEl.addEventListener("load", function () {
      var loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();
    });

    fincalcOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
  };

  window.closeFinCalc = function () {
    fincalcOverlay.classList.remove("show");
    document.body.style.overflow = "";
    clearTimeout(fincalcCloseTimer);
    fincalcCloseTimer = setTimeout(function () {
      fincalcBody.innerHTML = "";
    }, 300);
  };

  fincalcOverlay.addEventListener("click", function (e) {
    if (e.target === fincalcOverlay) closeFinCalc();
  });
  if (fincalcCloseBtn) fincalcCloseBtn.addEventListener("click", closeFinCalc);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && fincalcOverlay.classList.contains("show")) closeFinCalc();
  });

  // 계산기 SEO 페이지 전용 — window.__CALC_DEEP_LINK__가 설정된 페이지에서만 로드 즉시 자동으로 연다.
  if (window.__CALC_DEEP_LINK__ && typeof openFinCalc === "function") {
    openFinCalc(window.__CALC_DEEP_LINK__);
  }
})();
