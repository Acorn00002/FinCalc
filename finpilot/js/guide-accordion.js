/*
 * 계산 결과 카드 하단에 "상세 산출 근거 및 가이드" 아코디언을 덧붙이는 독립 스크립트.
 * 기존 calculators.js / main.js / index.html의 계산 로직·마크업은 전혀 건드리지 않고,
 * 페이지 로드 시 이미 DOM에 존재하는 .result-panel 요소들 끝에 새 DOM만 append한다.
 * (26개 계산기 각각의 render*Result() 함수를 개별 수정하는 대신, 결과 패널 자체가
 * 정적 HTML로 항상 DOM에 존재한다는 점을 이용해 한 곳에서 일괄 처리)
 */
(function () {
  "use strict";

  var BLOG_BASE = "https://gofincalc.com/blog/";

  // id가 있는 result-panel: id -> 가이드 콘텐츠
  var GUIDES_BY_ID = {
    "simple-result-panel": {
      formula: "최종 금액 = 원금 × (1 + 연이율 × 예치기간)",
      guide: "단리는 원금에 대해서만 이자가 붙는 방식이에요. 예치 기간이 길어질수록 복리 상품과의 차이가 커지니, 장기로 굴릴 목돈이라면 복리 방식도 함께 비교해보세요.",
      blogSlug: "compound-vs-simple-savings",
    },
    "periodic-result-panel": {
      formula: "만기 금액 = Σ (월 납입액 × (1 + 월이율)^남은개월수)",
      guide: "매달 납입한 금액마다 남은 기간만큼만 이자가 붙는 방식이라, 표면금리가 예금과 같아도 실제로 받는 이자는 예금보다 적어요. 세전·세후 실수령액을 함께 확인하세요.",
      blogSlug: "compound-vs-simple-savings",
    },
    "goal-result-panel": {
      formula: "월 필요 적립액 = 목표금액 ÷ [((1+월이율)^개월수 − 1) ÷ 월이율]",
      guide: "목표 금액을 물가상승률 없이 오늘 시점 금액으로만 잡으면 실제 필요 금액을 과소평가하기 쉬워요. 장기 목표라면 인플레이션 계산기로 실질 목표액도 함께 확인해보세요.",
      blogSlug: "compound-vs-simple-savings",
    },
    "avg-result-panel": {
      formula: "평단가 = 총 매수 금액 ÷ 총 보유 수량",
      guide: "물타기는 하락장에서 평균 매입 단가를 낮추는 전략이지만, 추가 매수를 반복할수록 투자금이 한 종목에 집중되는 리스크도 함께 커진다는 점을 기억하세요.",
      blogSlug: null,
    },
    "loan-result-panel": {
      formula: "월 상환액 = 대출원금 × [월이율 × (1+월이율)^개월수] ÷ [(1+월이율)^개월수 − 1]",
      guide: "원리금균등상환 기준 계산이에요. 총 이자를 줄이고 싶다면 원금균등상환도 비교해보고, 여윳돈이 생기면 중도상환수수료 면제 구간(통상 3년)을 확인해 조기 상환을 고려해보세요.",
      blogSlug: "loan-prepayment-fee",
    },
    "deposit-result-panel": {
      formula: "세후 이자 = 원금 × 연이율 × (예치일수 ÷ 365) × (1 − 15.4%)",
      guide: "은행이 광고하는 금리는 대부분 세전 기준이에요. 목돈이 5천만 원을 넘는다면 예금자보호 한도(금융회사별 5천만 원)를 고려해 여러 은행에 나눠 예치하는 것도 방법이에요.",
      blogSlug: "deposit-protection-limit",
    },
    "savings-result-panel": {
      formula: "적금 이자 = Σ (월 납입액 × 연이율 × 남은개월수 ÷ 12), 세후 = 이자 × (1 − 15.4%)",
      guide: "적금은 선입선출식 부분이자 방식이라 정기예금과 실제 이자 체감이 다릅니다. 우대금리 조건(급여이체·카드실적 등)을 충족했을 때의 최종 금리인지 확인하세요.",
      blogSlug: "compound-vs-simple-savings",
    },
    "inflation-result-panel": {
      formula: "미래 필요 금액 = 현재 금액 × (1 + 물가상승률)^경과연수",
      guide: "예적금 금리가 물가상승률보다 낮으면 명목 금액은 늘어도 실질 구매력은 줄어들 수 있어요. 장기 자산 계획에는 반드시 물가상승률을 함께 반영해보세요.",
      blogSlug: null,
    },
    "early-term-result-panel": {
      formula: "중도해지 수령액 = 원금 + (원금 × 중도해지금리 × 경과일수 ÷ 365)",
      guide: "만기를 채우지 못하고 중도해지하면 약정금리 대신 훨씬 낮은 중도해지 금리가 적용돼요. 해지 전 남은 기간과 실제 손실 이자를 꼭 비교해보세요.",
      blogSlug: "deposit-protection-limit",
    },
    "retirement-result-panel": {
      formula: "필요 은퇴자금 = 은퇴 후 연간 생활비 × 은퇴 기간 (물가상승률 반영)",
      guide: "국민연금·퇴직연금만으로는 부족한 경우가 많아요. 연금저축·IRP는 연간 납입액의 12~15%를 세액공제로 돌려받을 수 있어 절세와 노후 준비를 동시에 챙길 수 있습니다.",
      blogSlug: "retirement-pension-irp-dc-db",
    },
    "dividend-result-panel": {
      formula: "세후 배당금 = 배당금 × (1 − 배당소득세 15.4%)",
      guide: "배당·이자소득이 연 2천만 원을 넘으면 금융소득종합과세 대상이 될 수 있어요. 배당주 비중이 큰 경우 연간 예상 배당액을 미리 가늠해두는 것이 좋습니다.",
      blogSlug: null,
    },
    "salary-result-panel": {
      formula: "실수령액 = 연봉 − (4대보험료 + 소득세 + 지방소득세)",
      guide: "연말정산에서 신용카드 사용액, 연금저축·IRP 납입액, 월세 세액공제 등을 챙기면 실수령액 이상의 환급을 받을 수 있어요.",
      blogSlug: "yearend-tax-settlement-deduction",
    },
    "gains-tax-result-panel": {
      formula: "양도소득세 = (양도차익 − 기본공제 250만원) × 세율 − 누진공제액",
      guide: "1세대 1주택자는 보유·거주 요건을 충족하면 비과세 혜택을 받을 수 있어요. 실제 신고 전에는 반드시 최신 세율표와 공제 요건을 국세청에서 확인하세요.",
      blogSlug: null,
    },
    "gift-tax-result-panel": {
      formula: "증여세 = (증여재산가액 − 증여재산공제) × 세율 − 누진공제액",
      guide: "배우자 6억 원, 성인 자녀 5천만 원(미성년 2천만 원)까지는 10년간 공제받을 수 있어요. 여러 차례 나눠 증여하는 계획을 세울 때 이 공제 주기를 활용하면 유리합니다.",
      blogSlug: null,
    },
    "inheritance-tax-result-panel": {
      formula: "상속세 = (상속재산가액 − 상속공제) × 세율 − 누진공제액",
      guide: "일괄공제(5억 원)와 배우자공제 등 여러 공제 항목이 중복 적용될 수 있어요. 상속재산 규모가 크다면 세무 전문가와 사전 상담을 받는 것을 권장합니다.",
      blogSlug: null,
    },
    "severance-result-panel": {
      formula: "퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365)",
      guide: "퇴직금을 IRP 계좌로 수령하면 퇴직소득세를 이연하고 운용 수익까지 노릴 수 있어요. 일시금 수령과 연금 수령의 세금 차이를 비교해보세요.",
      blogSlug: "retirement-pension-irp-dc-db",
    },
    "loan-limit-result-panel": {
      formula: "DSR(%) = (모든 대출의 연간 원리금 상환액 ÷ 연 소득) × 100",
      guide: "DSR 규제 기준(통상 40%, 2금융권 50%)을 넘으면 추가 대출이 어려워져요. 만기가 짧은 신용대출을 먼저 정리하면 DSR 개선에 도움이 됩니다.",
      blogSlug: "dsr-dti-loan-limit",
    },
    "apt-buy-result-panel": {
      formula: "총 매수 비용 = 매매가 + 취득세 + 중개수수료 + 법무·등기 비용",
      guide: "생애최초 주택구입이라면 취득세 감면 혜택이 있을 수 있어요. 정책 대출(디딤돌대출 등) 자격 요건도 함께 확인하면 자금 계획에 도움이 됩니다.",
      blogSlug: "first-mortgage-checklist",
    },
    "apt-tax-result-panel": {
      formula: "보유세 = 재산세 + 종합부동산세(공시가격 기준 초과분)",
      guide: "공시가격이 오르면 보유세도 함께 늘어날 수 있어요. 1세대 1주택자는 세액공제·고령자 공제 등 추가 감면 요건을 확인해보세요.",
      blogSlug: null,
    },
    "brokerage-result-panel": {
      formula: "중개수수료 = 거래금액 × 구간별 상한요율 (지역·거래금액별 차등)",
      guide: "중개수수료 상한요율은 지방자치단체 조례에 따라 다를 수 있어요. 계약 전 실제 부과율을 중개사와 명확히 확인하세요.",
      blogSlug: null,
    },
    "pyeong-result-panel": {
      formula: "평 = ㎡ × 0.3025 (1평 ≈ 3.3058㎡)",
      guide: "부동산 매물의 '공급면적'과 실제 거주공간인 '전용면적'은 달라요. 평형 환산 시 어떤 면적 기준인지 꼭 확인하고 비교하세요.",
      blogSlug: null,
    },
    "deposit-calc-result-panel": {
      formula: "예금 환산 원금 = 적금 만기 수령액과 동일한 이자를 내는 예금 원금 역산",
      guide: "같은 목돈이라도 예금과 적금 중 어느 쪽이 더 유리한지는 목돈 보유 여부와 자금 조달 계획에 따라 달라져요. 두 계산기를 함께 비교해보는 것을 추천합니다.",
      blogSlug: "compound-vs-simple-savings",
    },
    "subscription-result-panel": {
      formula: "청약가점 = 무주택기간 점수 + 부양가족수 점수 + 청약통장 가입기간 점수",
      guide: "무주택 기간과 청약통장 가입 기간이 길수록, 부양가족 수가 많을수록 가점이 높아져요. 특별공급 등 청년·신혼부부 대상 지원 조건도 함께 확인해보세요.",
      blogSlug: "housing-subscription-score-guide",
    },
    "home-budget-result-panel": {
      formula: "저축률(%) = (월 소득 − 월 지출) ÷ 월 소득 × 100",
      guide: "고정지출(주거비·통신비 등)과 변동지출을 나눠 관리하면 저축률을 높이기 쉬워요. 비상금은 파킹통장처럼 언제든 인출 가능한 곳에 따로 모아두는 것을 추천합니다.",
      blogSlug: "parking-account-interest",
    },
    "global-stock-tax-result-panel": {
      formula: "양도소득세 = (연간 매매차익 − 기본공제 250만원) × 22%(지방소득세 포함)",
      guide: "해외주식은 국내주식과 달리 매매차익에 대해 분리과세돼요. 같은 해에 손실이 난 종목이 있다면 손익통산으로 절세할 수 있으니 연말 전에 점검해보세요.",
      blogSlug: null,
    },
    "global-net-result-panel": {
      formula: "실수령액 = 매도금액 − 환전수수료 − 양도소득세(기본공제 250만원 적용)",
      guide: "환전 타이밍과 은행별 환전 우대율에 따라 실수령액이 달라질 수 있어요. 매도와 환전 시점을 분리해서 계획하면 더 유리할 수 있습니다.",
      blogSlug: null,
    },
    "fin-func-result-panel": {
      formula: "PV(현재가치), FV(미래가치), NPV(순현재가치) 등 표준 재무함수 공식을 사용",
      guide: "할인율(요구수익률)을 어떻게 설정하느냐에 따라 결과가 크게 달라져요. 여러 시나리오의 할인율로 함께 계산해보고 보수적인 값도 참고하는 것을 추천합니다.",
      blogSlug: null,
    },
  };

  // id가 없는 result-panel: 내부의 특정 요소 id로 대신 찾는다.
  var GUIDES_BY_INNER_ID = {
    "kelly-result": {
      formula: "최적 투자비중 = 승률 − [(1 − 승률) ÷ 손익비]",
      guide: "켈리공식은 이론적인 상한선이에요. 실전에서는 변동성을 줄이기 위해 계산된 비중의 절반(하프 켈리)만 투자하는 전략이 널리 쓰입니다.",
      blogSlug: null,
    },
    "roi-result-pct": {
      formula: "수익률(%) = (수익금 ÷ 투자원금) × 100",
      guide: "수익률을 비교할 때는 세금·매매수수료를 차감한 순수익 기준으로 봐야 정확해요. 투자 기간이 다른 상품끼리는 연환산 수익률로 비교하는 것이 좋습니다.",
      blogSlug: null,
    },
    "exchange-result": {
      formula: "환전 금액 = 원화 금액 ÷ 적용환율 (또는 외화 금액 × 적용환율)",
      guide: "은행마다 환전 우대율이 달라 실제 적용 환율 차이가 꽤 커요. 여러 은행 앱의 환전 우대 이벤트를 비교한 뒤 환전하면 수수료를 아낄 수 있습니다.",
      blogSlug: null,
    },
  };

  function buildAccordion(entry) {
    var wrap = document.createElement("div");
    wrap.className = "calc-guide-accordion";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "calc-guide-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML = '<span class="calc-guide-toggle-arrow">▼</span> 상세 산출 근거 및 가이드 보기';

    var body = document.createElement("div");
    body.className = "calc-guide-body";

    var formulaHtml =
      '<h4>계산 공식</h4><p class="calc-guide-formula">' + entry.formula + "</p>";
    var guideHtml = '<h4>2026년 가이드</h4><p>' + entry.guide + "</p>";
    var linkHtml = "";
    if (entry.blogSlug) {
      linkHtml =
        '<a class="calc-guide-blog-link" href="' +
        BLOG_BASE +
        entry.blogSlug +
        '/" target="_blank" rel="noopener">관련 가이드 글 더 보기 →</a>';
    } else {
      linkHtml =
        '<a class="calc-guide-blog-link" href="' +
        BLOG_BASE +
        '" target="_blank" rel="noopener">금융 가이드 블로그 더 보기 →</a>';
    }
    body.innerHTML = formulaHtml + guideHtml + linkHtml;

    wrap.appendChild(btn);
    wrap.appendChild(body);

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

    return wrap;
  }

  function attachAll() {
    var seen = new Set();

    Object.keys(GUIDES_BY_ID).forEach(function (id) {
      var panel = document.getElementById(id);
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildAccordion(GUIDES_BY_ID[id]));
      seen.add(panel);
    });

    Object.keys(GUIDES_BY_INNER_ID).forEach(function (innerId) {
      var inner = document.getElementById(innerId);
      var panel = inner && inner.closest(".result-panel");
      if (!panel || seen.has(panel)) return;
      panel.appendChild(buildAccordion(GUIDES_BY_INNER_ID[innerId]));
      seen.add(panel);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachAll);
  } else {
    attachAll();
  }
})();