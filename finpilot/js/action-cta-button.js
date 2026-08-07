/*
 * ActionCtaButton — "1-Click 즉시 실행" 고대비 CTA 버튼
 * 계산기 카테고리에 맞는, 실제 접속 가능한 공식 기관/포털 페이지로 바로 연결한다
 * (은행연합회 소비자포털, 국세청 홈택스, 위택스, 청약홈, 통합연금포털, 서민금융진흥원, 금감원 파인).
 * 모든 링크는 배포 전 curl로 응답 상태를 직접 확인했다. 결과 패널 맨 끝에 추가되는 독립 컴포넌트.
 */
(function () {
  "use strict";

  var DEST = {
    DEPOSIT: { label: "예금·적금 우대금리 비교하기", href: "https://portal.kfb.or.kr/compare/receiving_disclosure10.php" },
    LOAN: { label: "대출 금리 비교하고 신청하기", href: "https://portal.kfb.or.kr/compare/loan_household.php" },
    TAX: { label: "국세청 홈택스에서 신고하기", href: "https://www.hometax.go.kr" },
    PROPERTY_TAX: { label: "위택스에서 재산세 확인하기", href: "https://www.wetax.go.kr" },
    SUBSCRIPTION: { label: "청약홈에서 청약 신청하기", href: "https://www.applyhome.co.kr" },
    PENSION: { label: "통합연금포털에서 내 연금 조회하기", href: "https://100lifeplan.fss.or.kr" },
    SUBSIDY: { label: "서민금융진흥원 지원상품 확인하기", href: "https://www.kinfa.or.kr" },
    GENERIC: { label: "금융감독원 파인에서 더 알아보기", href: "https://fine.fss.or.kr" },
  };

  var PANEL_DEST = {
    "simple-result-panel": "DEPOSIT",
    "periodic-result-panel": "DEPOSIT",
    "goal-result-panel": "PENSION",
    "avg-result-panel": "GENERIC",
    "loan-result-panel": "LOAN",
    "deposit-result-panel": "DEPOSIT",
    "savings-result-panel": "DEPOSIT",
    "inflation-result-panel": "GENERIC",
    "early-term-result-panel": "DEPOSIT",
    "retirement-result-panel": "PENSION",
    "dividend-result-panel": "GENERIC",
    "salary-result-panel": "TAX",
    "gains-tax-result-panel": "TAX",
    "gift-tax-result-panel": "TAX",
    "inheritance-tax-result-panel": "TAX",
    "severance-result-panel": "PENSION",
    "loan-limit-result-panel": "LOAN",
    "apt-buy-result-panel": "SUBSIDY",
    "apt-tax-result-panel": "PROPERTY_TAX",
    "brokerage-result-panel": "GENERIC",
    "pyeong-result-panel": "GENERIC",
    "deposit-calc-result-panel": "DEPOSIT",
    "subscription-result-panel": "SUBSCRIPTION",
    "home-budget-result-panel": "SUBSIDY",
    "global-stock-tax-result-panel": "TAX",
    "global-net-result-panel": "TAX",
    "fin-func-result-panel": "GENERIC",
  };

  var INNER_DEST = {
    "kelly-result": "GENERIC",
    "roi-result-pct": "GENERIC",
    "exchange-result": "GENERIC",
  };

  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      ".acb-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;" +
      "padding:13px 16px;background:var(--accent-color);color:#fff;border:none;border-radius:12px;" +
      "font-size:13.5px;font-weight:800;font-family:inherit;letter-spacing:-0.02em;cursor:pointer;" +
      "text-decoration:none;box-shadow:0 6px 16px -4px var(--accent-color);" +
      "transition:filter .15s ease,transform .1s ease;}" +
      ".acb-btn:hover{filter:brightness(1.06);}" +
      ".acb-btn:active{transform:scale(0.985);}" +
      ".acb-arrow{font-size:15px;line-height:1;}";
    document.head.appendChild(style);
  }

  function buildButton(dest) {
    var a = document.createElement("a");
    a.className = "acb-btn";
    a.href = dest.href;
    a.target = "_blank";
    a.rel = "noopener";
    a.innerHTML = dest.label + ' <span class="acb-arrow">➔</span>';
    return a;
  }

  function attachAll() {
    var seen = new Set();
    Object.keys(PANEL_DEST).forEach(function (id) {
      var panel = document.getElementById(id);
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildButton(DEST[PANEL_DEST[id]]));
      seen.add(panel);
    });
    Object.keys(INNER_DEST).forEach(function (innerId) {
      var inner = document.getElementById(innerId);
      var panel = inner && inner.closest(".result-panel");
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildButton(DEST[INNER_DEST[innerId]]));
      seen.add(panel);
    });
  }

  injectStyle();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAll);
  } else {
    attachAll();
  }
})();
