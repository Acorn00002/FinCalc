/*
 * SubsidyScannerCard — "숨은 정부지원금 & 비과세 혜택 스캐너"
 * guide-accordion.js와 마찬가지로 이미 DOM에 정적으로 존재하는 .result-panel 끝에
 * 새 접이식 블록만 append하는 독립 컴포넌트. 기존 계산 로직/마크업은 건드리지 않는다.
 * (같은 패널에 이미 붙어있는 "상세 산출 근거 및 가이드" 아코디언과는 별개의, 새로운 토글이다)
 */
(function () {
  "use strict";

  // 카테고리별 공통 콘텐츠 — 계산기마다 처음부터 다 새로 쓰지 않고, 성격이 같은 계산기끼리 묶어
  // 재사용한다(중복 텍스트를 줄이면서도 계산기별로 무관한 내용이 뜨지 않게).
  var CATEGORY = {
    SAVINGS: {
      policies: "비과세종합저축(만 65세 이상·장애인 등 대상, 5천만원까지 이자소득세 전액 면제), ISA(개인종합자산관리계좌 — 서민형은 400만원, 일반형은 200만원까지 비과세 + 초과분 9.9% 분리과세)",
      gain: "이자소득세 15.4% 상당 절감 가능",
    },
    YOUNG_SAVINGS: {
      policies: "청년도약계좌(만 19~34세, 정부기여금 + 이자소득 비과세), 청년우대형 주택청약종합저축(이자소득 500만원까지 비과세 + 우대금리)",
      gain: "정부기여금 + 이자소득세 비과세분",
    },
    LOAN: {
      policies: "디딤돌대출·보금자리론(무주택 서민 대상 정책 모기지, 시중 금리 대비 낮은 고정금리), 버팀목전세자금대출(전월세보증금)",
      gain: "시중 금리 대비 연 0.5~1.5%p 절감 가능",
    },
    TAX_ESTATE: {
      policies: "1세대 1주택 비과세·장기보유특별공제(양도세), 배우자 6억·성인자녀 5천만원 공제 및 혼인·출산 증여재산공제 1억 추가(증여세), 배우자상속공제(최대 30억)·일괄공제 5억(상속세)",
      gain: "공제 요건 충족 시 세액 수백만~수천만원 절감",
    },
    RETIREMENT: {
      policies: "연금저축·IRP 세액공제(연 900만원 한도, 총급여에 따라 12~15%), 퇴직금 IRP 이체 시 퇴직소득세 이연",
      gain: "연 최대 148.5만원(900만원×16.5%) 세액공제",
    },
    SUBSCRIPTION: {
      policies: "청년/신혼부부/생애최초 특별공급, 청약통장 납입액 소득공제(무주택 세대주, 연 300만원 한도의 40%)",
      gain: "일반공급 대비 당첨 확률 대폭 상승 + 연 최대 96만원 소득공제",
    },
    HOME_BUDGET: {
      policies: "청년월세지원(무주택 청년, 월세 일부 최대 12개월 지원), 청년도약계좌",
      gain: "월세 부담 경감 + 비과세 저축",
    },
    GLOBAL_STOCK: {
      policies: "해외주식 양도소득 기본공제(연 250만원까지 비과세), 같은 해 손실 종목과의 손익통산",
      gain: "기본공제만으로 최대 약 55만원(250만원×22%) 세금 절감",
    },
    FIRST_HOME: {
      policies: "생애최초 주택구입 취득세 감면(최대 200만원), 디딤돌대출",
      gain: "취득세 최대 200만원 절감",
    },
    GENERIC: {
      policies: "ISA(개인종합자산관리계좌) 비과세·분리과세 혜택, 연금저축·IRP 세액공제",
      gain: "가입 여부에 따라 세금 부담이 크게 달라질 수 있음",
    },
  };

  var PANEL_CATEGORY = {
    "simple-result-panel": "SAVINGS",
    "periodic-result-panel": "YOUNG_SAVINGS",
    "goal-result-panel": "GENERIC",
    "avg-result-panel": "GENERIC",
    "loan-result-panel": "LOAN",
    "deposit-result-panel": "SAVINGS",
    "savings-result-panel": "YOUNG_SAVINGS",
    "inflation-result-panel": "GENERIC",
    "early-term-result-panel": "SAVINGS",
    "retirement-result-panel": "RETIREMENT",
    "dividend-result-panel": "SAVINGS",
    "salary-result-panel": "RETIREMENT",
    "gains-tax-result-panel": "TAX_ESTATE",
    "gift-tax-result-panel": "TAX_ESTATE",
    "inheritance-tax-result-panel": "TAX_ESTATE",
    "severance-result-panel": "RETIREMENT",
    "loan-limit-result-panel": "LOAN",
    "apt-buy-result-panel": "FIRST_HOME",
    "apt-tax-result-panel": "TAX_ESTATE",
    "brokerage-result-panel": "GENERIC",
    "pyeong-result-panel": "GENERIC",
    "deposit-calc-result-panel": "YOUNG_SAVINGS",
    "subscription-result-panel": "SUBSCRIPTION",
    "home-budget-result-panel": "HOME_BUDGET",
    "global-stock-tax-result-panel": "GLOBAL_STOCK",
    "global-net-result-panel": "GLOBAL_STOCK",
    "fin-func-result-panel": "GENERIC",
  };

  var INNER_ID_CATEGORY = {
    "kelly-result": "GENERIC",
    "roi-result-pct": "GENERIC",
    "exchange-result": "GENERIC",
  };

  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      ".ssc-accordion{margin-top:10px;padding-top:10px;border-top:1px dashed var(--panel-border);}" +
      ".ssc-toggle{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;cursor:pointer;" +
      "font-size:12.5px;font-weight:600;color:var(--text-muted);padding:4px 2px;font-family:inherit;letter-spacing:-0.02em;}" +
      ".ssc-toggle:hover{color:var(--profit-color);}" +
      ".ssc-accordion.is-open .ssc-toggle{color:var(--profit-color);}" +
      ".ssc-arrow{display:inline-block;font-size:10px;transition:transform .25s ease;}" +
      ".ssc-accordion.is-open .ssc-arrow{transform:rotate(180deg);}" +
      ".ssc-body{max-height:0;overflow:hidden;transition:max-height .3s ease;}" +
      ".ssc-body-inner{padding-top:10px;}" +
      ".ssc-policies{margin:0 0 8px;font-size:12.5px;line-height:1.65;color:var(--text-secondary);}" +
      ".ssc-gain{display:inline-flex;align-items:center;gap:6px;background:rgba(5,150,105,0.10);color:var(--profit-color);" +
      "font-size:12px;font-weight:700;padding:6px 10px;border-radius:8px;margin-bottom:6px;}" +
      ".ssc-note{margin:6px 0 0;font-size:11px;color:var(--text-muted);line-height:1.5;}";
    document.head.appendChild(style);
  }

  function buildAccordion(cat) {
    var wrap = document.createElement("div");
    wrap.className = "ssc-accordion";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ssc-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="ssc-arrow">▼</span> 숨은 정부지원금 & 비과세 혜택 스캔 결과';

    var body = document.createElement("div");
    body.className = "ssc-body";
    body.innerHTML =
      '<div class="ssc-body-inner">' +
      '<div class="ssc-gain">💰 ' +
      cat.gain +
      "</div>" +
      '<p class="ssc-policies"><strong>추천 정책 · 제도:</strong> ' +
      cat.policies +
      "</p>" +
      '<p class="ssc-note">입력하신 조건(연령·소득 등)에 따라 실제 자격 여부와 혜택 규모가 달라질 수 있어요. 정확한 대상 요건은 정부24·서민금융진흥원·국세청 등 공식 채널에서 확인해주세요.</p>' +
      "</div>";

    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      if (open) {
        body.style.maxHeight = "0px";
        btn.setAttribute("aria-expanded", "false");
        wrap.classList.remove("is-open");
      } else {
        wrap.classList.add("is-open");
        btn.setAttribute("aria-expanded", "true");
        body.style.maxHeight = body.scrollHeight + "px";
      }
    });

    wrap.appendChild(btn);
    wrap.appendChild(body);
    return wrap;
  }

  function attachAll() {
    var seen = new Set();

    Object.keys(PANEL_CATEGORY).forEach(function (id) {
      var panel = document.getElementById(id);
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildAccordion(CATEGORY[PANEL_CATEGORY[id]]));
      seen.add(panel);
    });

    Object.keys(INNER_ID_CATEGORY).forEach(function (innerId) {
      var inner = document.getElementById(innerId);
      var panel = inner && inner.closest(".result-panel");
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildAccordion(CATEGORY[INNER_ID_CATEGORY[innerId]]));
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
