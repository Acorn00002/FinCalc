// /ipo-calendar/ 전용 독립 스크립트 — index.html의 공모주·아파트 청약 코드(원본: index.html:4522-5202,
// 관련 없는 세무상담 IIFE(initTaxConsult)는 제외)를 그대로 옮겼다. 사전 조사로 이 코드가 다른 화면
// DOM에 의존하지 않는다는 걸 확인함. Firestore(ipoScheduleCache 캐시 우선 조회)는 원본과 동일하게
// 그대로 쓴다 — 데이터 소스·계산 로직은 전혀 바뀌지 않았다.
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyCiADiWiH434SNRR85_VDNf9NnZM0Ozxww",
    authDomain: "asset-filot.firebaseapp.com",
    projectId: "asset-filot",
    storageBucket: "asset-filot.firebasestorage.app",
    messagingSenderId: "862512786797",
    appId: "1:862512786797:web:7ee42935258c645a2fbe64",
    measurementId: "G-HWY33CNTB1"
  };
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();

  function escapeMyPageHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function formatDateYMD(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  var CALENDAR_WEEKDAY_FULL_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

  var toast = document.getElementById("toast");
  var toastText = document.getElementById("toastText");
  var toastTimer = null;
  function showToast(text, icon) {
    if (!toast || !toastText) return;
    toastText.textContent = text;
    toast.querySelector("i").className = "ph-duotone " + (icon || "ph-rocket-launch");
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }

  function formatIpoDate(d) {
    if (!d) return "-";
    return pad2(d.getMonth() + 1) + "." + pad2(d.getDate()) + "(" + CALENDAR_WEEKDAY_FULL_KO[d.getDay()].charAt(0) + ")";
  }

  var IPO_SCHEDULES = [];
  var ipoSchedulesLoaded = false;
  var ipoActiveTab = "ipo";
  var ipoSchedulesLoadFailed = false;

  function applyIpoSchedules(rawSchedules) {
    IPO_SCHEDULES = rawSchedules.map(function (item) {
      return {
        id: item.id,
        name: item.name,
        market: item.market,
        category: item.category || "general",
        underwriter: item.underwriter,
        priceMin: item.priceMin,
        priceMax: item.priceMax,
        subStart: new Date(item.subStart),
        subEnd: new Date(item.subEnd),
        refundDate: item.refundDate ? new Date(item.refundDate) : null
      };
    });
    ipoSchedulesLoaded = true;
    renderIpoList();
  }

  function loadIpoSchedulesFromLiveApi() {
    return fetch("/api/ipo-schedules")
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok || result.data.error || !Array.isArray(result.data.schedules)) {
          throw new Error((result.data && result.data.error) || "조회 실패");
        }
        applyIpoSchedules(result.data.schedules);
      })
      .catch(function (error) {
        console.error("공모주 일정 조회 실패:", error);
        ipoSchedulesLoadFailed = true;
        ipoSchedulesLoaded = true;
        IPO_SCHEDULES = [];
        renderIpoList();
      });
  }

  function loadIpoSchedules() {
    ipoSchedulesLoadFailed = false;
    return db.collection("ipoScheduleCache").doc("latest").get()
      .then(function (docSnap) {
        var data = docSnap.exists ? docSnap.data() : null;
        if (data && Array.isArray(data.schedules) && data.schedules.length) {
          applyIpoSchedules(data.schedules);
          return;
        }
        return loadIpoSchedulesFromLiveApi();
      })
      .catch(function (error) {
        console.error("공모주 캐시 조회 실패, 실시간 API로 폴백:", error);
        return loadIpoSchedulesFromLiveApi();
      });
  }

  function getIpoDday(subEnd, todayStr) {
    var endStr = formatDateYMD(subEnd);
    var end = new Date(endStr + "T00:00:00");
    var today = new Date(todayStr + "T00:00:00");
    var diffDays = Math.round((end - today) / 86400000);
    if (diffDays < 0) return { label: "청약 마감", closed: true, days: diffDays };
    if (diffDays === 0) return { label: "오늘 마감 🔥", closed: false, days: 0 };
    return { label: "D-" + diffDays, closed: false, days: diffDays };
  }

  function getIpoStageLabel(item, todayStr) {
    var today = new Date(todayStr + "T00:00:00");
    var subStart = new Date(formatDateYMD(item.subStart) + "T00:00:00");
    var subEnd = new Date(formatDateYMD(item.subEnd) + "T00:00:00");
    var refund = item.refundDate ? new Date(formatDateYMD(item.refundDate) + "T00:00:00") : null;
    var twoDaysBeforeStart = new Date(subStart.getTime() - 2 * 86400000);

    if (today < twoDaysBeforeStart) return "수요예측 예정";
    if (today < subStart) return "청약 예정";
    if (today <= subEnd) return "청약 진행중";
    if (refund && today <= refund) return "상장 대기";
    return null;
  }

  var IPO_CATEGORY_LABEL = { general: "일반기업", spac: "스팩", reit: "리츠", rights: "실권주" };
  var ipoActiveCategory = "all";

  function matchesIpoCategory(item, activeCategory) {
    if (activeCategory === "all") return true;
    if (activeCategory === "spac-reit") return item.category === "spac" || item.category === "reit";
    return item.category === activeCategory;
  }

  function renderIpoList() {
    var listEl = document.getElementById("ipoCardList");
    var heroCountEl = document.getElementById("ipoHeroCount");
    if (!listEl || !heroCountEl) return;

    if (!ipoSchedulesLoaded) {
      heroCountEl.textContent = "…";
      listEl.innerHTML = '<div class="finance-loading"><div class="finance-spinner"></div><p>실시간 공모주 일정을 불러오는 중이에요...</p></div>';
      return;
    }
    if (ipoSchedulesLoadFailed) {
      heroCountEl.textContent = "0";
      listEl.innerHTML = '<div class="finance-error"><i class="ph-duotone ph-cloud-slash"></i><p>실시간 공모주 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p></div>';
      return;
    }
    if (!IPO_SCHEDULES.length) {
      heroCountEl.textContent = "0";
      listEl.innerHTML = '<div class="finance-error"><i class="ph-duotone ph-calendar-blank"></i><p>최근 60일 내 신규 접수된 공모주·실권주 청약 일정이 없어요.</p></div>';
      return;
    }

    var todayStr = formatDateYMD(new Date());
    var filtered = IPO_SCHEDULES.filter(function (item) { return matchesIpoCategory(item, ipoActiveCategory); });
    var sorted = filtered.slice().sort(function (a, b) { return a.subEnd - b.subEnd; });

    heroCountEl.textContent = sorted.filter(function (item) { return !getIpoDday(item.subEnd, todayStr).closed; }).length;

    if (!sorted.length) {
      listEl.innerHTML = '<div class="finance-error"><i class="ph-duotone ph-funnel"></i><p>이 분류에는 표시할 청약 일정이 없어요.</p></div>';
      return;
    }

    listEl.innerHTML = sorted.map(function (item) {
      var dday = getIpoDday(item.subEnd, todayStr);
      var ddayClass = dday.closed ? "is-closed" : (dday.days <= 1 ? "is-urgent" : "");
      var stageLabel = getIpoStageLabel(item, todayStr);
      var categoryLabel = IPO_CATEGORY_LABEL[item.category] || "";
      return '<div class="ipo-card" data-id="' + item.id + '">' +
        '<div class="ipo-card-top">' +
        '<span class="ipo-card-dday ' + ddayClass + '">' + dday.label + '</span>' +
        (categoryLabel ? '<span class="ipo-card-category ipo-card-category-' + item.category + '">' + categoryLabel + '</span>' : '') +
        (stageLabel ? '<span class="ipo-card-stage">' + stageLabel + '</span>' : '') +
        '<span class="ipo-card-underwriter">' + escapeMyPageHtml(item.underwriter) + '</span>' +
        '</div>' +
        '<h3 class="ipo-card-name">' + escapeMyPageHtml(item.name) + '</h3>' +
        '<p class="ipo-card-price">' + item.priceMin.toLocaleString() + '원 ~ ' + item.priceMax.toLocaleString() + '원</p>' +
        '<div class="ipo-card-meta">' +
        '<div class="ipo-card-meta-row"><span class="ipo-card-meta-label">청약 기간</span><span class="ipo-card-meta-value">' + formatIpoDate(item.subStart) + ' ~ ' + formatIpoDate(item.subEnd) + '</span></div>' +
        '<div class="ipo-card-meta-row"><span class="ipo-card-meta-label">환불일</span><span class="ipo-card-meta-value">' + formatIpoDate(item.refundDate) + '</span></div>' +
        '</div>' +
        '</div>';
    }).join("");

    listEl.querySelectorAll(".ipo-card").forEach(function (card) {
      var id = card.getAttribute("data-id");
      var item = IPO_SCHEDULES.filter(function (p) { return p.id === id; })[0];
      card.addEventListener("click", function () {
        if (item) openIpoDetail(item);
      });
    });
  }

  document.querySelectorAll("#ipoCategoryFilter .ipo-category-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      ipoActiveCategory = chip.getAttribute("data-category");
      document.querySelectorAll("#ipoCategoryFilter .ipo-category-chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      renderIpoList();
    });
  });

  var IPO_DEPOSIT_RATE = 0.5;
  var IPO_PRO_RATA_SHARE = 0.5;
  var IPO_UNIT_SHARES = 10;

  function renderIpoAllocation(item) {
    var fundsInput = document.getElementById("ipoAllocFunds");
    var competitionInput = document.getElementById("ipoAllocCompetition");
    var resultEl = document.getElementById("ipoAllocResult");

    function recalc() {
      var funds = parseInt(String(fundsInput.value || "").replace(/[^0-9]/g, ""), 10) || 0;
      var price = item.priceMax || item.priceMin || 0;
      if (!funds || !price) {
        resultEl.innerHTML = '<p class="ipo-alloc-hint">보유 자금을 입력하면 신청 가능 주식수와 필요 증거금을 계산해드려요.</p>';
        return;
      }

      var perShareCost = price * IPO_DEPOSIT_RATE;
      var maxShares = Math.floor(funds / perShareCost / IPO_UNIT_SHARES) * IPO_UNIT_SHARES;
      var requiredDeposit = maxShares * perShareCost;

      var html = '<div class="ipo-alloc-row"><span>신청 가능 주식수(최대)</span><strong>' + maxShares.toLocaleString("ko-KR") + '주</strong></div>' +
        '<div class="ipo-alloc-row"><span>필요 증거금(증거금율 50% 가정)</span><strong>' + Math.round(requiredDeposit).toLocaleString("ko-KR") + '원</strong></div>';

      var competition = parseFloat(String(competitionInput.value || "").replace(/[^0-9.]/g, ""));
      if (competition && competition > 0) {
        var proRataShares = Math.floor((maxShares * IPO_PRO_RATA_SHARE) / competition);
        html += '<div class="ipo-alloc-row"><span>비례배정 예상 주식수(입력 경쟁률 기준)</span><strong>약 ' + proRataShares.toLocaleString("ko-KR") + '주</strong></div>';
      } else {
        html += '<div class="ipo-alloc-row"><span>비례배정 예상 주식수</span><strong class="muted">경쟁률 입력 시 계산</strong></div>';
      }

      html += '<p class="ipo-alloc-hint">균등배정 주식수는 청약 마감 후 균등배정 대상 청약자 수에 따라 결정돼요(사전 계산 불가) — 최소 단위(10주)만 신청해도 균등배정 대상에는 포함됩니다. 위 수치는 증거금율 50%·비례물량 50% 가정의 참고용 추정치예요.</p>';
      resultEl.innerHTML = html;
    }

    fundsInput.value = "";
    competitionInput.value = "";
    document.querySelectorAll("#ipoAllocChipRow .ipo-alloc-chip").forEach(function (chip) {
      chip.onclick = function () {
        fundsInput.value = chip.getAttribute("data-amount");
        recalc();
      };
    });
    fundsInput.oninput = recalc;
    competitionInput.oninput = recalc;
    recalc();
  }

  var IPO_CATEGORY_TAGLINE = {
    general: "코스닥·코스피 신규상장 공모주",
    spac: "기업인수목적회사(SPAC) 공모",
    reit: "부동산투자회사(리츠) 공모",
    rights: "주주배정 후 실권주 일반공모"
  };

  function buildIpoTimeline(item, todayStr) {
    var today = new Date(todayStr + "T00:00:00");
    var subStart = new Date(formatDateYMD(item.subStart) + "T00:00:00");
    var subEnd = new Date(formatDateYMD(item.subEnd) + "T00:00:00");
    var refund = item.refundDate ? new Date(formatDateYMD(item.refundDate) + "T00:00:00") : null;
    var demandDate = new Date(subStart.getTime() - 2 * 86400000);

    var steps = [
      { label: "수요예측일 (예상)", dateText: formatIpoDate(demandDate), done: today > demandDate },
      { label: "청약일", dateText: formatIpoDate(item.subStart) + " ~ " + formatIpoDate(item.subEnd), done: today > subEnd, active: today >= subStart && today <= subEnd },
      { label: "환불일", dateText: refund ? formatIpoDate(item.refundDate) : "미정", done: refund ? today > refund : false },
      { label: "상장일", dateText: "미정", done: false }
    ];

    return steps.map(function (step) {
      var stateClass = step.done ? "is-done" : (step.active ? "is-active" : "");
      return '<div class="ipo160-timeline-step ' + stateClass + '">' +
        '<div class="ipo160-timeline-dot"></div>' +
        '<div class="ipo160-timeline-body">' +
        '<p class="ipo160-timeline-label">' + step.label + '</p>' +
        '<p class="ipo160-timeline-date">' + step.dateText + '</p>' +
        '</div>' +
        '</div>';
    }).join("");
  }

  function openIpoDetail(item) {
    var todayStr = formatDateYMD(new Date());

    document.getElementById("ipoDetailLogo").textContent = (item.name || "").charAt(0);
    document.getElementById("ipoDetailTitle").textContent = item.name;
    document.getElementById("ipoDetailMarketLine").textContent =
      item.market + " · " + (item.stockCode ? item.stockCode : "상장 후 종목코드 배정");
    document.getElementById("ipoDetailTagline").textContent = IPO_CATEGORY_TAGLINE[item.category] || IPO_CATEGORY_TAGLINE.general;

    document.getElementById("ipoDetailBrokerBadge").textContent = (item.underwriter || "").charAt(0);
    document.getElementById("ipoDetailBrokerName").textContent = item.underwriter || "주관사 정보 없음";
    document.getElementById("ipoDetailMinUnit").textContent = "최소청약 " + IPO_UNIT_SHARES + "주 · 청약증거금율 50% 가정";

    document.getElementById("ipoDetailTimeline").innerHTML = buildIpoTimeline(item, todayStr);

    var priceText = item.priceMin === item.priceMax
      ? item.priceMin.toLocaleString("ko-KR") + "원"
      : item.priceMin.toLocaleString("ko-KR") + "원 ~ " + item.priceMax.toLocaleString("ko-KR") + "원";
    document.getElementById("ipoInfoAccordionBody").innerHTML =
      '<div class="ipo160-info-row"><span>희망(확정) 공모가</span><strong>' + priceText + '</strong></div>' +
      '<div class="ipo160-info-row"><span>공모 금액</span><strong>' + (item.offeringAmount ? item.offeringAmount.toLocaleString("ko-KR") + "원" : "미정") + '</strong></div>' +
      '<div class="ipo160-info-row"><span>공모 주식수</span><strong>' + (item.offeringShares ? item.offeringShares.toLocaleString("ko-KR") + "주" : "미정") + '</strong></div>' +
      '<div class="ipo160-info-row"><span>시가총액</span><strong class="muted">미정 (총발행주식수 미공시)</strong></div>';

    renderIpoAllocation(item);

    document.getElementById("ipoDemandGrid").innerHTML =
      '<div class="ipo160-demand-item"><span>단순기관경쟁률</span><strong class="muted">미정</strong></div>' +
      '<div class="ipo160-demand-item"><span>수요예측 참여기관수</span><strong class="muted">미정</strong></div>' +
      '<div class="ipo160-demand-item"><span>공모가 상단이상 경쟁률</span><strong class="muted">미정</strong></div>' +
      '<div class="ipo160-demand-item"><span>공모가 상단이상 참여기관수</span><strong class="muted">미정</strong></div>';
    document.getElementById("ipoDetailSourceLink").href = item.sourceUrl || "https://dart.fss.or.kr";

    var accToggle = document.getElementById("ipoInfoAccordionToggle");
    var accBody = document.getElementById("ipoInfoAccordionBody");
    accBody.style.maxHeight = "0px";
    accToggle.setAttribute("aria-expanded", "false");
    accToggle.onclick = function () {
      var open = accToggle.getAttribute("aria-expanded") === "true";
      if (open) {
        accBody.style.maxHeight = "0px";
        accToggle.setAttribute("aria-expanded", "false");
      } else {
        accBody.style.maxHeight = accBody.scrollHeight + "px";
        accToggle.setAttribute("aria-expanded", "true");
      }
    };

    document.getElementById("ipoDetailShareBtn").onclick = function () {
      var text = item.name + " 공모주 청약 일정: " + formatIpoDate(item.subStart) + " ~ " + formatIpoDate(item.subEnd) + " (주관사 " + item.underwriter + ")";
      if (navigator.share) {
        navigator.share({ title: item.name + " 청약 일정", text: text, url: location.href }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + "\n" + location.href).then(function () {
          showToast("일정을 복사했어요", "ph-link");
        });
      } else {
        showToast("이 브라우저에서는 공유하기를 지원하지 않아요", "ph-warning");
      }
    };

    document.getElementById("ipoDetailOverlay").hidden = false;
  }
  function closeIpoDetail() {
    document.getElementById("ipoDetailOverlay").hidden = true;
  }

  function initIpoView() {
    if (!ipoSchedulesLoaded) loadIpoSchedules();
    else renderIpoList();
  }

  (function initIpoFeature() {
    var segTabs = document.querySelectorAll(".ipo-segmented-tab");
    var ipoPanel = document.getElementById("ipoTabPanel");
    var apartmentPanel = document.getElementById("aptTabPanel");
    var detailOverlay = document.getElementById("ipoDetailOverlay");
    var detailCloseBtn = document.getElementById("ipoDetailCloseBtn");
    if (!segTabs.length || !detailOverlay) return;

    segTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        ipoActiveTab = tab.getAttribute("data-tab");
        segTabs.forEach(function (t) { t.classList.toggle("is-active", t === tab); });
        ipoPanel.hidden = ipoActiveTab !== "ipo";
        apartmentPanel.hidden = ipoActiveTab !== "apartment";
        if (ipoActiveTab === "apartment") initAptView();
      });
    });

    detailCloseBtn.addEventListener("click", closeIpoDetail);
    detailOverlay.addEventListener("click", function (e) { if (e.target === detailOverlay) closeIpoDetail(); });
  })();

  var APT_LISTINGS = [];
  var aptListingsLoaded = false;
  var aptListingsLoadFailed = false;
  var aptActiveCategory = "all";

  function toDateOrNull(str) {
    return str ? new Date(str + "T00:00:00") : null;
  }

  function loadAptListings() {
    aptListingsLoadFailed = false;
    return fetch("/api/apartment-subscriptions")
      .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
      .then(function (result) {
        if (!result.ok || result.data.error || !Array.isArray(result.data.listings)) {
          throw new Error((result.data && result.data.error) || "조회 실패");
        }
        APT_LISTINGS = result.data.listings.map(function (item) {
          return Object.assign({}, item, {
            subStart: toDateOrNull(item.subStart),
            subEnd: toDateOrNull(item.subEnd),
            specialSupplyStart: toDateOrNull(item.specialSupplyStart),
            specialSupplyEnd: toDateOrNull(item.specialSupplyEnd),
            winnerDate: toDateOrNull(item.winnerDate),
            contractStart: toDateOrNull(item.contractStart),
            contractEnd: toDateOrNull(item.contractEnd)
          });
        });
        aptListingsLoaded = true;
        renderAptList();
      })
      .catch(function (error) {
        console.error("아파트 청약 일정 조회 실패:", error);
        aptListingsLoadFailed = true;
        aptListingsLoaded = true;
        APT_LISTINGS = [];
        renderAptList();
      });
  }

  function matchesAptCategory(item, activeCategory) {
    return activeCategory === "all" || item.houseType === activeCategory;
  }

  function renderAptList() {
    var listEl = document.getElementById("aptCardList");
    var heroCountEl = document.getElementById("aptHeroCount");
    if (!listEl || !heroCountEl) return;

    if (!aptListingsLoaded) {
      heroCountEl.textContent = "…";
      listEl.innerHTML = '<div class="finance-loading"><div class="finance-spinner"></div><p>실시간 아파트 청약 일정을 불러오는 중이에요...</p></div>';
      return;
    }
    if (aptListingsLoadFailed) {
      heroCountEl.textContent = "0";
      listEl.innerHTML = '<div class="finance-error"><i class="ph-duotone ph-cloud-slash"></i><p>실시간 아파트 청약 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p></div>';
      return;
    }
    if (!APT_LISTINGS.length) {
      heroCountEl.textContent = "0";
      listEl.innerHTML = '<div class="finance-error"><i class="ph-duotone ph-calendar-blank"></i><p>최근 45일 내 접수 공고된 아파트 분양 정보가 없어요.</p></div>';
      return;
    }

    var todayStr = formatDateYMD(new Date());
    var APT_CLOSED_VISIBLE_DAYS = 14;
    var filtered = APT_LISTINGS.filter(function (item) {
      if (!matchesAptCategory(item, aptActiveCategory)) return false;
      var dday = getIpoDday(item.subEnd, todayStr);
      return !dday.closed || dday.days >= -APT_CLOSED_VISIBLE_DAYS;
    });
    var sorted = filtered.slice().sort(function (a, b) { return a.subEnd - b.subEnd; });

    heroCountEl.textContent = sorted.filter(function (item) { return !getIpoDday(item.subEnd, todayStr).closed; }).length;

    if (!sorted.length) {
      listEl.innerHTML = '<div class="finance-error"><i class="ph-duotone ph-funnel"></i><p>이 분류에는 표시할 청약 일정이 없어요.</p></div>';
      return;
    }

    listEl.innerHTML = sorted.map(function (item) {
      var dday = getIpoDday(item.subEnd, todayStr);
      var ddayClass = dday.closed ? "is-closed" : (dday.days <= 1 ? "is-urgent" : "");
      return '<div class="ipo-card" data-id="' + item.id + '">' +
        '<div class="ipo-card-top">' +
        '<span class="ipo-card-dday ' + ddayClass + '">' + dday.label + '</span>' +
        '<span class="ipo-card-category">' + escapeMyPageHtml(item.houseType) + '</span>' +
        '<span class="ipo-card-underwriter">' + escapeMyPageHtml(item.region) + '</span>' +
        '</div>' +
        '<h3 class="ipo-card-name">' + escapeMyPageHtml(item.name) + '</h3>' +
        '<p class="ipo-card-price">' + escapeMyPageHtml(item.address) + '</p>' +
        '<div class="ipo-card-meta">' +
        '<div class="ipo-card-meta-row"><span class="ipo-card-meta-label">청약 기간</span><span class="ipo-card-meta-value">' + formatIpoDate(item.subStart) + ' ~ ' + formatIpoDate(item.subEnd) + '</span></div>' +
        '<div class="ipo-card-meta-row"><span class="ipo-card-meta-label">당첨자 발표</span><span class="ipo-card-meta-value">' + formatIpoDate(item.winnerDate) + '</span></div>' +
        '</div>' +
        '</div>';
    }).join("");

    listEl.querySelectorAll(".ipo-card").forEach(function (card) {
      var id = card.getAttribute("data-id");
      var item = APT_LISTINGS.filter(function (p) { return String(p.id) === id; })[0];
      card.addEventListener("click", function () { if (item) openAptDetail(item); });
    });
  }

  document.querySelectorAll("#aptCategoryFilter .ipo-category-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      aptActiveCategory = chip.getAttribute("data-category");
      document.querySelectorAll("#aptCategoryFilter .ipo-category-chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      renderAptList();
    });
  });

  function buildAptTimeline(item, todayStr) {
    var today = new Date(todayStr + "T00:00:00");
    var steps = [];
    if (item.specialSupplyStart) {
      steps.push({
        label: "특별공급 접수",
        dateText: formatIpoDate(item.specialSupplyStart) + (item.specialSupplyEnd ? " ~ " + formatIpoDate(item.specialSupplyEnd) : ""),
        done: item.specialSupplyEnd ? today > item.specialSupplyEnd : today > item.specialSupplyStart
      });
    }
    steps.push({
      label: "청약 접수(1·2순위)",
      dateText: formatIpoDate(item.subStart) + " ~ " + formatIpoDate(item.subEnd),
      done: today > item.subEnd,
      active: today >= item.subStart && today <= item.subEnd
    });
    steps.push({
      label: "당첨자 발표일",
      dateText: item.winnerDate ? formatIpoDate(item.winnerDate) : "미정",
      done: item.winnerDate ? today > item.winnerDate : false
    });
    steps.push({
      label: "계약 체결",
      dateText: item.contractStart ? (formatIpoDate(item.contractStart) + (item.contractEnd ? " ~ " + formatIpoDate(item.contractEnd) : "")) : "미정",
      done: item.contractEnd ? today > item.contractEnd : false
    });

    return steps.map(function (step) {
      var stateClass = step.done ? "is-done" : (step.active ? "is-active" : "");
      return '<div class="ipo160-timeline-step ' + stateClass + '">' +
        '<div class="ipo160-timeline-dot"></div>' +
        '<div class="ipo160-timeline-body">' +
        '<p class="ipo160-timeline-label">' + step.label + '</p>' +
        '<p class="ipo160-timeline-date">' + step.dateText + '</p>' +
        '</div>' +
        '</div>';
    }).join("");
  }

  function regulationBadgeHtml(label, active) {
    return '<div class="ipo160-demand-item"><span>' + label + '</span><strong class="' + (active ? "" : "muted") + '">' + (active ? "해당" : "해당 없음") + '</strong></div>';
  }

  function openAptDetail(item) {
    var todayStr = formatDateYMD(new Date());

    document.getElementById("aptDetailTitle").textContent = item.name;
    document.getElementById("aptDetailRegionLine").textContent = item.region + " · " + item.houseType + " · " + item.supplyType;
    document.getElementById("aptDetailAddress").textContent = item.address || "주소 정보 없음";

    document.getElementById("aptDetailConstructor").textContent = item.constructor || "시공사 정보 없음";
    document.getElementById("aptDetailUnits").textContent = "총 " + (item.totalUnits ? item.totalUnits.toLocaleString("ko-KR") + "세대" : "세대수 미정") + " · 시행사 " + (item.developer || "정보 없음");

    document.getElementById("aptDetailTimeline").innerHTML = buildAptTimeline(item, todayStr);

    document.getElementById("aptInfoAccordionBody").innerHTML =
      '<div class="ipo160-info-row"><span>주택 구분</span><strong>' + escapeMyPageHtml(item.houseType) + ' · ' + escapeMyPageHtml(item.supplyType) + '</strong></div>' +
      '<div class="ipo160-info-row"><span>공급 규모</span><strong>' + (item.totalUnits ? item.totalUnits.toLocaleString("ko-KR") + "세대" : "미정") + '</strong></div>' +
      '<div class="ipo160-info-row"><span>입주 예정월</span><strong>' + (item.moveInMonth ? item.moveInMonth.slice(0, 4) + "년 " + item.moveInMonth.slice(4) + "월" : "미정") + '</strong></div>' +
      '<div class="ipo160-info-row"><span>공급 위치</span><strong>' + escapeMyPageHtml(item.address || "미정") + '</strong></div>';

    document.getElementById("aptRegulationGrid").innerHTML =
      regulationBadgeHtml("투기과열지구", item.speculativeZone) +
      regulationBadgeHtml("조정대상지역", item.adjustmentZone) +
      regulationBadgeHtml("분양가상한제", item.priceCapZone);
    document.getElementById("aptDetailSourceLink").href = item.sourceUrl || "https://www.applyhome.co.kr";

    var accToggle = document.getElementById("aptInfoAccordionToggle");
    var accBody = document.getElementById("aptInfoAccordionBody");
    accBody.style.maxHeight = "0px";
    accToggle.setAttribute("aria-expanded", "false");
    accToggle.onclick = function () {
      var open = accToggle.getAttribute("aria-expanded") === "true";
      if (open) {
        accBody.style.maxHeight = "0px";
        accToggle.setAttribute("aria-expanded", "false");
      } else {
        accBody.style.maxHeight = accBody.scrollHeight + "px";
        accToggle.setAttribute("aria-expanded", "true");
      }
    };

    document.getElementById("aptDetailShareBtn").onclick = function () {
      var text = item.name + " 아파트 청약 일정: " + formatIpoDate(item.subStart) + " ~ " + formatIpoDate(item.subEnd) + " (" + item.region + ")";
      if (navigator.share) {
        navigator.share({ title: item.name + " 청약 일정", text: text, url: location.href }).catch(function () {});
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text + "\n" + location.href).then(function () {
          showToast("일정을 복사했어요", "ph-link");
        });
      } else {
        showToast("이 브라우저에서는 공유하기를 지원하지 않아요", "ph-warning");
      }
    };

    document.getElementById("aptDetailOverlay").hidden = false;
  }

  function closeAptDetail() {
    document.getElementById("aptDetailOverlay").hidden = true;
  }

  function initAptView() {
    if (!aptListingsLoaded) loadAptListings();
    else renderAptList();
  }

  (function initAptFeature() {
    var overlay = document.getElementById("aptDetailOverlay");
    var closeBtn = document.getElementById("aptDetailCloseBtn");
    if (!overlay || !closeBtn) return;
    closeBtn.addEventListener("click", closeAptDetail);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) closeAptDetail(); });
  })();

  // 최초 진입: 공모주 탭 데이터 로드 (원본의 initIpoView() 호출과 동일)
  initIpoView();
})();
