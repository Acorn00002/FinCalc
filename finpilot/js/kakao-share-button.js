/*
 * KakaoShareButton — "친구에게 내 계산 결과 공유하고 비교하기"
 * 카카오 디벨로퍼스 앱 키가 이 프로젝트에 등록되어 있지 않아 카카오링크 SDK를 직접 붙이는 대신,
 * 모바일 브라우저의 OS 공유시트(navigator.share — 카카오톡이 공유 대상으로 자동 노출됨)를 우선 쓰고,
 * 지원하지 않는 환경(대부분의 데스크톱 브라우저)에서는 링크를 클립보드에 복사한 뒤 토스트로 안내한다.
 * 기존 결과 패널 헤더의 작은 "URL 복사" 아이콘 버튼(generateShareURL)과는 별개로, 하단에
 * 더 눈에 띄는 전용 버튼을 추가하는 독립 컴포넌트다.
 */
(function () {
  "use strict";

  var PANEL_IDS = [
    "simple-result-panel", "periodic-result-panel", "goal-result-panel", "avg-result-panel",
    "loan-result-panel", "deposit-result-panel", "savings-result-panel", "inflation-result-panel",
    "early-term-result-panel", "retirement-result-panel", "dividend-result-panel", "salary-result-panel",
    "gains-tax-result-panel", "gift-tax-result-panel", "inheritance-tax-result-panel", "severance-result-panel",
    "loan-limit-result-panel", "apt-buy-result-panel", "apt-tax-result-panel", "brokerage-result-panel",
    "pyeong-result-panel", "deposit-calc-result-panel", "subscription-result-panel", "home-budget-result-panel",
    "global-stock-tax-result-panel", "global-net-result-panel", "fin-func-result-panel",
  ];
  var INNER_IDS = ["kelly-result", "roi-result-pct", "exchange-result"];

  function injectStyle() {
    var style = document.createElement("style");
    style.textContent =
      ".ksb-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:14px;" +
      "padding:12px 16px;background:#FEE500;color:#3C1E1E;border:none;border-radius:12px;" +
      "font-size:13.5px;font-weight:700;font-family:inherit;letter-spacing:-0.02em;cursor:pointer;" +
      "transition:filter .15s ease;}" +
      ".ksb-btn:hover{filter:brightness(0.96);}" +
      ".ksb-btn:active{filter:brightness(0.92);}" +
      ".ksb-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%) translateY(12px);" +
      "background:var(--text-primary);color:var(--panel-bg);font-size:13px;font-weight:600;" +
      "padding:11px 18px;border-radius:999px;box-shadow:var(--shadow-hover);opacity:0;" +
      "transition:opacity .2s ease,transform .2s ease;z-index:9999;pointer-events:none;white-space:nowrap;}" +
      ".ksb-toast.is-visible{opacity:1;transform:translateX(-50%) translateY(0);}";
    document.head.appendChild(style);
  }

  var toastEl = null;
  var toastTimer = null;
  function showToast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "ksb-toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    clearTimeout(toastTimer);
    requestAnimationFrame(function () {
      toastEl.classList.add("is-visible");
    });
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("is-visible");
    }, 2400);
  }

  function readHeadline(panel) {
    var el = panel.querySelector(".main-result, .result-hero-value, [id$='-result']");
    var text = el ? el.textContent.trim() : "";
    return text || "내 계산 결과";
  }

  function buildShareUrl(panel) {
    var section = panel.closest(".calc-section");
    var params = new URLSearchParams();
    if (section) {
      params.set("tab", section.id);
      section.querySelectorAll("input, select").forEach(function (input) {
        if (input.id && input.value && input.value !== "0" && input.value !== "") {
          params.set(input.id, input.value.replace(/,/g, ""));
        }
      });
    }
    var qs = params.toString();
    return window.location.origin + window.location.pathname + (qs ? "?" + qs : "");
  }

  function handleShare(panel) {
    var headline = readHeadline(panel);
    var url = buildShareUrl(panel);
    var message = "제 계산 결과: " + headline + " — 자산 파일럿에서 직접 계산해보세요!";

    if (navigator.share) {
      navigator.share({ title: "자산 파일럿", text: message, url: url }).catch(function () {});
      return;
    }

    var payload = message + "\n" + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(payload)
        .then(function () {
          showToast("결과가 복사됐어요! 카카오톡에 붙여넣기 해보세요.");
        })
        .catch(function () {
          showToast("복사에 실패했어요. 잠시 후 다시 시도해주세요.");
        });
    }
  }

  function buildButton(panel) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ksb-btn";
    btn.innerHTML = "💬 친구에게 내 계산 결과 공유하고 비교하기";
    btn.addEventListener("click", function () {
      handleShare(panel);
    });
    return btn;
  }

  function attachAll() {
    var seen = new Set();
    PANEL_IDS.forEach(function (id) {
      var panel = document.getElementById(id);
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildButton(panel));
      seen.add(panel);
    });
    INNER_IDS.forEach(function (innerId) {
      var inner = document.getElementById(innerId);
      var panel = inner && inner.closest(".result-panel");
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildButton(panel));
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
