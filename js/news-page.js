// /news/ 전용 독립 스크립트 — index.html의 뉴스 관련 코드(원본: index.html:5205-5454, escapeMyPageHtml:
// index.html:6103)를 그대로 옮겨왔다. index.html처럼 activateView()·다른 18개 화면·인증/포인트
// 시스템에 전혀 의존하지 않는다(사전 조사로 뉴스 코드는 view-news 자기 DOM만 건드리고 Firestore도
// 안 쓴다는 걸 확인함 — /api/news만 호출). 로직은 원본과 100% 동일하다.
(function () {
  "use strict";

  function escapeMyPageHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var newsActiveCategory = "economy";
  var newsCache = {};

  function splitNewsPageTitle(rawTitle, sourceText) {
    var title = rawTitle || "";
    var source = (sourceText || "").trim();
    if (source) {
      var suffix = " - " + source;
      if (title.length > suffix.length && title.slice(-suffix.length) === suffix) {
        title = title.slice(0, -suffix.length);
      }
      return { title: title.trim(), source: source };
    }
    var idx = title.lastIndexOf(" - ");
    if (idx > -1) return { title: title.slice(0, idx).trim(), source: title.slice(idx + 3).trim() };
    return { title: title.trim(), source: "" };
  }
  function formatNewsPageTime(pubDateStr) {
    if (!pubDateStr) return "";
    var parsed = new Date(pubDateStr);
    if (isNaN(parsed.getTime())) return "";
    var diffMin = Math.floor((Date.now() - parsed.getTime()) / 60000);
    if (diffMin < 1) return "방금 전";
    if (diffMin < 60) return diffMin + "분 전";
    var diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return diffHour + "시간 전";
    var diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return diffDay + "일 전";
    return (parsed.getMonth() + 1) + "." + parsed.getDate();
  }
  function parseNewsPageXml(xmlText) {
    var xmlDoc = new DOMParser().parseFromString(xmlText || "", "text/xml");
    if (xmlDoc.querySelector("parsererror")) throw new Error("XML 파싱 실패");
    var items = [];
    Array.prototype.forEach.call(xmlDoc.querySelectorAll("item"), function (node) {
      var titleNode = node.querySelector("title");
      var rawTitle = titleNode && titleNode.textContent ? titleNode.textContent.trim() : "";
      if (!rawTitle) return;
      var linkNode = node.querySelector("link");
      var pubDateNode = node.querySelector("pubDate");
      var sourceNode = node.querySelector("source");
      var split = splitNewsPageTitle(rawTitle, sourceNode ? sourceNode.textContent : "");
      items.push({
        title: split.title || rawTitle,
        source: split.source,
        time: formatNewsPageTime(pubDateNode ? pubDateNode.textContent : ""),
        link: linkNode && linkNode.textContent ? linkNode.textContent.trim() : ""
      });
    });
    return items;
  }

  function isInNativeApp() {
    return typeof window.ReactNativeWebView !== "undefined";
  }
  function openNewsInNativeIfPossible(e, url, openList) {
    if (!isInNativeApp()) return;
    e.preventDefault();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: openList ? "OPEN_NEWS_LIST" : "OPEN_NEWS_ARTICLE",
      url: url || ""
    }));
  }

  (function initNewsPageLinkBridge() {
    var listEl = document.getElementById("newsPageList");
    if (!listEl) return;
    listEl.addEventListener("click", function (e) {
      var link = e.target.closest ? e.target.closest("a.news-page-item") : null;
      if (!link) return;
      openNewsInNativeIfPossible(e, link.getAttribute("href"), false);
    });
  })();

  var NEWS_TREND_STOPWORDS = ["있다", "한다", "됐다", "이번", "지난", "오늘", "기자", "위해", "대한", "것으로", "라며", "이라고", "등을", "등이", "에서", "으로", "까지", "부터", "한편", "전했다", "밝혔다", "최근", "우리", "했다", "한다고", "무단", "전재", "재배포", "금지", "단독"];
  var newsActiveTrend = null;

  function extractNewsTrends(items) {
    var freq = {};
    items.forEach(function (item) {
      var words = (item.title || "").split(/[\s,.·"'“”‘’()\[\]:\-…]+/).filter(function (w) { return w.length >= 2; });
      words.forEach(function (w) {
        if (NEWS_TREND_STOPWORDS.indexOf(w) > -1) return;
        if (/^[0-9%.]+$/.test(w)) return;
        freq[w] = (freq[w] || 0) + 1;
      });
    });
    return Object.keys(freq)
      .filter(function (w) { return freq[w] >= 2; })
      .sort(function (a, b) { return freq[b] - freq[a]; })
      .slice(0, 6);
  }

  function renderNewsTop(items) {
    var section = document.getElementById("newsTopSection");
    var grid = document.getElementById("newsTopGrid");
    if (!section || !grid) return;
    var top = items.slice(0, 2);
    if (!top.length) { section.hidden = true; grid.innerHTML = ""; return; }
    section.hidden = false;
    grid.innerHTML = top.map(function (item) {
      var meta = '<span class="news-top-source">' + escapeMyPageHtml(item.source) + '</span>' +
        (item.time ? '<span>' + escapeMyPageHtml(item.time) + '</span>' : '');
      var inner = '<p class="news-top-title-text">' + escapeMyPageHtml(item.title) + '</p><div class="news-top-meta">' + meta + '</div>';
      if (item.link) {
        return '<a class="news-top-item" href="' + escapeMyPageHtml(item.link) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
      }
      return '<div class="news-top-item">' + inner + '</div>';
    }).join("");
  }

  function renderNewsTrends(items) {
    var row = document.getElementById("newsTrendRow");
    var chipsEl = document.getElementById("newsTrendChips");
    if (!row || !chipsEl) return;
    var trends = extractNewsTrends(items);
    if (!trends.length) { row.hidden = true; chipsEl.innerHTML = ""; return; }
    row.hidden = false;
    chipsEl.innerHTML = trends.map(function (word, idx) {
      return '<button type="button" class="news-trend-chip' + (word === newsActiveTrend ? ' is-active' : '') + '" data-trend="' +
        escapeMyPageHtml(word) + '">' + (idx + 1) + '&nbsp;' + escapeMyPageHtml(word) + '</button>';
    }).join("");
    chipsEl.querySelectorAll(".news-trend-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        var word = chip.getAttribute("data-trend");
        newsActiveTrend = (newsActiveTrend === word) ? null : word;
        renderNewsPage(newsCache[newsActiveCategory] || []);
      });
    });
  }

  (function initNewsTrendAutoScroll() {
    var track = document.getElementById("newsTrendChips");
    var row = document.getElementById("newsTrendRow");
    if (!track || !row) return;

    var SPEED = 0.5;
    var direction = 1;
    var paused = false;
    var resumeTimer = null;

    function pauseThenResume() {
      paused = true;
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () { paused = false; }, 2500);
    }
    track.addEventListener("touchstart", pauseThenResume, { passive: true });
    track.addEventListener("mousedown", pauseThenResume);
    track.addEventListener("wheel", pauseThenResume, { passive: true });

    function tick() {
      requestAnimationFrame(tick);
      if (paused || row.hidden) return;
      var maxScroll = track.scrollWidth - track.clientWidth;
      if (maxScroll <= 1) return;
      track.scrollLeft += SPEED * direction;
      if (track.scrollLeft >= maxScroll) direction = -1;
      else if (track.scrollLeft <= 0) direction = 1;
    }
    requestAnimationFrame(tick);
  })();

  function renderNewsPage(items) {
    var listEl = document.getElementById("newsPageList");
    if (!listEl) return;

    renderNewsTop(items);
    renderNewsTrends(items);

    var filtered = newsActiveTrend
      ? items.filter(function (item) { return (item.title || "").indexOf(newsActiveTrend) > -1; })
      : items;

    if (!filtered.length) {
      listEl.innerHTML = '<p class="news-page-empty">' +
        (newsActiveTrend ? "'" + escapeMyPageHtml(newsActiveTrend) + "' 관련 뉴스가 없어요." : "실시간 뉴스를 불러올 수 없어요. 잠시 후 다시 시도해주세요.") +
        '</p>';
      return;
    }
    listEl.innerHTML = filtered.map(function (item) {
      var meta = '<span class="news-page-source">' + escapeMyPageHtml(item.source) + '</span>' +
        (item.time ? '<span>' + escapeMyPageHtml(item.time) + '</span>' : '');
      var inner = '<p class="news-page-title">' + escapeMyPageHtml(item.title) + '</p><div class="news-page-meta">' + meta + '</div>';
      if (item.link) {
        return '<a class="news-page-item" href="' + escapeMyPageHtml(item.link) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
      }
      return '<div class="news-page-item">' + inner + '</div>';
    }).join("");
  }

  function loadNewsCategory(category) {
    if (newsCache[category]) {
      renderNewsPage(newsCache[category]);
      return;
    }
    var listEl = document.getElementById("newsPageList");
    if (listEl) {
      listEl.innerHTML = '<div class="news-page-skel"></div><div class="news-page-skel"></div>' +
        '<div class="news-page-skel"></div><div class="news-page-skel"></div><div class="news-page-skel"></div>';
    }
    fetch("/api/news?category=" + encodeURIComponent(category))
      .then(function (res) {
        if (!res.ok) throw new Error("응답 오류: " + res.status);
        return res.text();
      })
      .then(function (xmlText) {
        var items = parseNewsPageXml(xmlText);
        newsCache[category] = items;
        renderNewsPage(items);
      })
      .catch(function (error) {
        console.error("뉴스·금융소식 로드 실패:", error);
        renderNewsPage([]);
      });
  }

  document.querySelectorAll("#newsCategoryFilter .news-category-chip").forEach(function (chip) {
    chip.addEventListener("click", function () {
      var category = chip.getAttribute("data-category");
      if (category === newsActiveCategory) return;
      newsActiveCategory = category;
      newsActiveTrend = null;
      document.querySelectorAll("#newsCategoryFilter .news-category-chip").forEach(function (c) {
        c.classList.toggle("is-active", c === chip);
      });
      document.querySelectorAll("#newsCategoryIntro p").forEach(function (p) {
        p.hidden = p.getAttribute("data-category") !== category;
      });
      loadNewsCategory(category);
    });
  });

  loadNewsCategory(newsActiveCategory);
})();
