/*
 * QuickChipSelector — "3초 퀵 원터치 칩"
 * 금액/연봉/대출금 등 큰 단위 입력 필드 위에 [1,000만][3,000만][5,000만][1억] 절대값
 * 프리셋 칩을 추가한다. 기존 .quick-chip(증분 +add)/.rate-chip(금리 절대세팅) 마크업/로직은
 * 전혀 건드리지 않고, 대상 인풋 앞에 새 행을 DOM으로만 삽입하는 완전히 독립된 컴포넌트다.
 * 클릭 시 기존 calculators.js 컨벤션과 동일하게 formatResult()로 값을 넣고
 * 'input' 이벤트를 그대로 dispatch해서 기존 실시간 계산/힌트 갱신 로직이 그대로 반응하게 한다.
 */
(function () {
  "use strict";

  var PRESETS = [
    { label: "1,000만", value: 10000000 },
    { label: "3,000만", value: 30000000 },
    { label: "5,000만", value: 50000000 },
    { label: "1억", value: 100000000 },
  ];

  // "금액/연봉/대출금" 성격의 핵심 인풋만 대상으로 한다 (전 필드 적용 시 기존 +chip과 중복돼 난잡해짐)
  var TARGET_IDS = [
    "simple-principal",
    "periodic-principal",
    "goal-target",
    "goal-current",
    "loan-amount",
    "deposit-amount",
    "earlyTermPrincipal",
    "inflationAmount",
    "salaryAmount",
    "gainsTransferValue",
    "giftAmount",
    "inhTotalEstate",
    "loanLimitHomePrice",
    "aptBuyPrice",
    "aptTaxPrice",
    "brokerageAmount",
    "depositCalcDeposit",
    "homeBudgetIncome",
    "finFuncPrincipal",
  ];

  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      ".qcs-row{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px;}" +
      ".qcs-chip{background:var(--accent-light);color:var(--accent-color);border:none;border-radius:999px;" +
      "padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;letter-spacing:-0.02em;" +
      "transition:background-color .15s ease,transform .1s ease;}" +
      ".qcs-chip:hover{background:var(--accent-color);color:#fff;}" +
      ".qcs-chip:active{transform:scale(0.96);}";
    document.head.appendChild(style);
  }

  function makeRow(input) {
    var row = document.createElement("div");
    row.className = "qcs-row";
    PRESETS.forEach(function (p) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "qcs-chip";
      btn.textContent = p.label;
      btn.addEventListener("click", function () {
        input.value =
          typeof formatResult === "function" ? formatResult(p.value) : String(p.value);
        input.dispatchEvent(new Event("input"));
        input.focus();
      });
      row.appendChild(btn);
    });
    return row;
  }

  function attachAll() {
    TARGET_IDS.forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      var anchor = input.closest(".input-wrapper, .underline-input") || input;
      anchor.parentNode.insertBefore(makeRow(input), anchor.nextSibling);
    });
  }

  injectStyle();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAll);
  } else {
    attachAll();
  }
})();
