// 검색 유입용 "기능" 랜딩 페이지(/financial-calendar/, /ipo-calendar/, /news/)를 생성/재생성한다.
//
// 2026-09 AdSense 재심사 감사에서, 예전 버전은 이 페이지들도 index.html(앱 전체 셸, ~9,855줄)을
// 통째로 복제해서 만들었다는 게 드러났다. 이 버전은 그 방식을 버리고, 페이지마다 자기 기능에
// 필요한 코드만(js/news-page.js, js/ipo-calendar-page.js, js/financial-calendar-page.js) 담은
// 독립 페이지로 만든다. 각 스크립트는 index.html의 해당 기능 코드를 그대로 옮긴 것이며(사전에
// 정적 분석으로 다른 화면 DOM에 의존하지 않는 걸 확인함), 계산 로직·데이터 소스는 전혀 바뀌지
// 않았다. 홈·설정 등 무관한 화면은 이 페이지들에 전혀 포함되지 않는다 — 필요하면 실제 링크("/")로
// 이동한다.
//
//   실행: node scripts/generate-view-landing-pages.cjs
//
// 페이지별 title/description/canonical/OG/JSON-LD는 이 폴더의 view-landing-pages-content.json에
// 있다. HTML 본문 구조(어떤 화면 마크업+스크립트를 쓰는지)는 이 스크립트 안에 페이지별로 직접
// 정의되어 있다 — financial-calendar/ipo-calendar/news 셋 다 필요한 DOM/스크립트가 서로 달라서
// (계산기 페이지들처럼) 하나의 공통 템플릿으로 묶기보다 이 편이 더 명확하다.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "view-landing-pages-content.json"), "utf8"));

const FIREBASE_CONFIG_SCRIPT =
  "<script>\n" +
  "  var firebaseConfig = {\n" +
  '    apiKey: "AIzaSyCiADiWiH434SNRR85_VDNf9NnZM0Ozxww",\n' +
  '    authDomain: "asset-filot.firebaseapp.com",\n' +
  '    projectId: "asset-filot",\n' +
  '    storageBucket: "asset-filot.firebasestorage.app",\n' +
  '    messagingSenderId: "862512786797",\n' +
  '    appId: "1:862512786797:web:7ee42935258c645a2fbe64",\n' +
  '    measurementId: "G-HWY33CNTB1"\n' +
  "  };\n" +
  "  firebase.initializeApp(firebaseConfig);\n" +
  "</" + "script>";

const FIREBASE_SDK_SCRIPTS = [
  '<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js"></' + "script>",
  '<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore-compat.js"></' + "script>"
];

const FIREBASE_SDK_SCRIPTS_WITH_AUTH = FIREBASE_SDK_SCRIPTS.concat([
  '<script src="https://www.gstatic.com/firebasejs/10.13.2/firebase-auth-compat.js"></' + "script>"
]);

// fincalc 오버레이 마크업 — js/fincalc-launcher.js와 짝을 이루는 고정 마크업(index.html:2122-2135와
// 동일). /ipo-calendar/의 "청약가점 계산기" 버튼처럼, 목록 페이지 안에서 계산기를 모달로 여는
// onclick="openFinCalc('id')" 버튼이 있는 페이지에서만 포함한다.
const FINCALC_OVERLAY_HTML =
  '<div class="fincalc-overlay" id="fincalcOverlay">\n' +
  '  <div class="fincalc-modal" id="fincalcModal" role="dialog" aria-modal="true" aria-labelledby="fincalcTitle">\n' +
  '    <div class="fincalc-topbar">\n' +
  '      <div class="fincalc-title-wrap">\n' +
  '        <span class="fincalc-icon" id="fincalcIcon"><i class="ph-duotone ph-calculator"></i></span>\n' +
  '        <span class="fincalc-title" id="fincalcTitle">계산기</span>\n' +
  "      </div>\n" +
  '      <button class="fincalc-close-btn" type="button" id="fincalcCloseBtn" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>\n' +
  "    </div>\n" +
  '    <div class="fincalc-body" id="fincalcBody"></div>\n' +
  "  </div>\n" +
  "</div>";

// 토스트 알림 — showToast()가 참조하는 전역 DOM(index.html:2104-2107과 동일). 공유하기 등에서 쓴다.
const TOAST_HTML =
  '<div class="toast" id="toast">\n' +
  '  <i class="ph-duotone ph-rocket-launch"></i>\n' +
  '  <span id="toastText">준비 중인 기능이에요</span>\n' +
  "</div>";

function renderHead(entry, extraCss, extraHeadScripts) {
  const lines = [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<title>" + entry.title + "</title>",
    '<meta name="description" content="' + entry.description + '">',
    '<link rel="canonical" href="' + entry.canonical + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:title" content="' + entry.ogTitle + '">',
    '<meta property="og:description" content="' + entry.ogDescription + '">',
    '<meta property="og:url" content="' + entry.canonical + '">',
    '<meta property="og:site_name" content="자산 파일럿">',
    '<meta name="twitter:card" content="summary">',
    '<meta name="twitter:title" content="' + entry.ogTitle + '">',
    '<meta name="twitter:description" content="' + entry.ogDescription + '">',
    '<link rel="icon" href="/icons/icon-192.png" type="image/png">'
  ];
  if (!entry.adFree) {
    lines.push(
      '<meta name="google-adsense-account" content="ca-pub-7476413799189909">',
      '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7476413799189909" crossorigin="anonymous"></' + "script>"
    );
  } else {
    // 목록형 페이지(뉴스/캘린더/공모주)는 독창적 안내 콘텐츠 대비 목록 비중이 커서
    // (퍼블리셔 정책 "낮은 가치의 콘텐츠") 광고를 아예 싣지 않는다 — 2026-09 감사 결정 유지.
    lines.push('<meta name="google-adsense-account" content="ca-pub-7476413799189909">');
  }
  lines.push(
    "<script>",
    "try {",
    '  var __fpPref = localStorage.getItem("fincalc_theme_pref");',
    '  if (__fpPref === "dark" || __fpPref === "light") document.documentElement.setAttribute("data-theme", __fpPref);',
    "} catch (e) {}",
    "</" + "script>",
    '<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/style.css">',
    '<link rel="stylesheet" href="/css/content.css">',
    '<link rel="stylesheet" href="/css/calculators.css">'
  );
  (extraCss || []).forEach((href) => lines.push('<link rel="stylesheet" href="' + href + '">'));
  (extraHeadScripts || []).forEach((s) => lines.push(s));
  lines.push(entry.ldJsonBlocks.join("\n"));
  return lines.join("\n");
}

const HEADER_HTML = [
  '<header class="cp-header">',
  '  <a class="cp-logo" href="https://www.gofincalc.com/"><img class="cp-logo-mark" src="/icons/icon-192.png" alt="">자산 파일럿</a>',
  '  <nav class="cp-header-nav">',
  '    <a href="/calculators/">계산기</a>',
  '    <a href="/financial-calendar/">금융 캘린더</a>',
  '    <a href="/ipo-calendar/">청약·공모주</a>',
  '    <a href="/news/">뉴스</a>',
  "  </nav>",
  "</header>"
].join("\n");

const FOOTER_HTML = [
  '<footer class="cp-footer">',
  "  <span>© 2026 자산 파일럿(gofincalc.com)</span>",
  '  <div class="cp-footer-links">',
  '    <a href="/about/">회사소개</a>',
  '    <a href="/privacy/">개인정보처리방침</a>',
  '    <a href="/terms/">이용약관</a>',
  '    <a href="/contact/">문의하기</a>',
  '    <a href="https://www.instagram.com/gofincalc.app" target="_blank" rel="noopener noreferrer">인스타그램</a>',
  "  </div>",
  "</footer>"
].join("\n");

function wrapPage(head, body, scripts, extraBody) {
  return (
    "<!DOCTYPE html>\n<html lang=\"ko\">\n<head>\n" + head + "\n</head>\n<body>\n\n" +
    HEADER_HTML + "\n\n" + body + "\n\n" + FOOTER_HTML + "\n\n" +
    (extraBody || []).join("\n\n") + (extraBody && extraBody.length ? "\n\n" : "") +
    (scripts || []).map((s) => '<script src="' + s + '"></' + "script>").join("\n") +
    "\n\n</body>\n</html>\n"
  );
}

// ---------- /news/ ----------
// index.html:1883-1947(view-news 마크업) + js/news-page.js(원본: index.html:5205-5454, 뷰 전용
// 코드만 옮김 — 다른 화면 DOM·Firestore 의존 없음, 사전 조사로 확인함)
function renderNewsBody() {
  return [
    '<main class="cp-wrap">',
    '  <p class="cp-eyebrow">뉴스 · 금융소식</p>',
    '  <h1 class="cp-title">실시간 금융 뉴스</h1>',
    '  <p class="cp-meta"><span>헤드라인·경제·세계·시사·생활 소식을 한 곳에서 모아봤어요</span></p>',
    "",
    '  <div class="cp-card">',
    '    <div class="news-category-filter" id="newsCategoryFilter">',
    '      <button type="button" class="news-category-chip" data-category="headline">헤드라인</button>',
    '      <button type="button" class="news-category-chip is-active" data-category="economy">경제</button>',
    '      <button type="button" class="news-category-chip" data-category="world">세계</button>',
    '      <button type="button" class="news-category-chip" data-category="society">시사</button>',
    '      <button type="button" class="news-category-chip" data-category="life">생활</button>',
    "    </div>",
    "",
    '    <div class="news-category-intro" id="newsCategoryIntro">',
    '      <p data-category="headline" hidden>그날 가장 많이 읽힌 주요 뉴스만 모아 빠르게 훑어보고 싶을 때 보는 카테고리입니다.</p>',
    '      <p data-category="economy">금리·물가·환율처럼 자산관리에 직접 영향을 주는 경제 소식을 우선적으로 모았습니다.</p>',
    '      <p data-category="world" hidden>국내 자산에도 영향을 주는 미국 증시·연준 정책 등 해외 경제 이슈를 모았습니다.</p>',
    '      <p data-category="society" hidden>세금·제도 변화처럼 자산관리에 영향을 줄 수 있는 정책·시사 소식을 모았습니다.</p>',
    '      <p data-category="life" hidden>생활물가, 소비 트렌드 등 가계와 밀접한 실생활 금융 소식을 모았습니다.</p>',
    "    </div>",
    "",
    '    <div class="news-trend-row" id="newsTrendRow" hidden>',
    '      <span class="news-trend-label"><i class="ph-duotone ph-chart-line-up"></i>실시간 트렌드</span>',
    '      <div class="news-trend-chips" id="newsTrendChips"></div>',
    "    </div>",
    "",
    '    <section class="news-top-section" id="newsTopSection" hidden>',
    '      <p class="news-top-title"><i class="ph-duotone ph-fire"></i>오늘 주요뉴스</p>',
    '      <div class="news-top-grid" id="newsTopGrid"></div>',
    "    </section>",
    "",
    '    <div class="news-page-list" id="newsPageList">',
    '      <div class="news-page-skel"></div><div class="news-page-skel"></div><div class="news-page-skel"></div>',
    '      <div class="news-page-skel"></div><div class="news-page-skel"></div>',
    "    </div>",
    "  </div>",
    "",
    '  <article class="cp-card">',
    '    <div class="calc-page-guide-body">',
    "      <h2>어떤 뉴스를 모아 보여주나요</h2>",
    "      <p>헤드라인, 경제, 세계, 시사, 생활 카테고리로 나눠 실시간 금융·경제 뉴스를 모아 보여줍니다. 각 기사를 누르면 원본 언론사 페이지로 이동합니다.</p>",
    "      <h2>자주 묻는 질문</h2>",
    "      <h3>뉴스는 자산 파일럿이 직접 작성하나요?</h3>",
    "      <p>아니요. 언론사에서 보도한 기사 제목과 링크를 모아 보여드리는 뉴스 모음 서비스이며, 전문은 원본 언론사 페이지에서 확인할 수 있습니다.</p>",
    "      <h3>얼마나 자주 업데이트되나요?</h3>",
    "      <p>실시간으로 갱신되는 뉴스 피드를 기반으로 하며, 접속 시점마다 최신 기사로 반영됩니다.</p>",
    "      <h2>관련 페이지</h2>",
    '      <div class="cp-related-links cp-related-calcs">',
    '        <a href="/calculators/">전체 계산기 보기</a>',
    '        <a href="/financial-calendar/">금융 캘린더</a>',
    "      </div>",
    "    </div>",
    "  </article>",
    "</main>"
  ].join("\n");
}

// ---------- /ipo-calendar/ ----------
// index.html:1585-1654(view-ipo 마크업) + 1656-1707(아파트 상세 모달) + 2310-2402(공모주 상세 모달)
// + js/ipo-calendar-page.js(원본: index.html:4522-5202, 세무상담 IIFE 제외 — 다른 화면 DOM 의존
// 없음, Firestore(ipoScheduleCache)는 원본과 동일). "청약가점 계산기" 버튼용으로 fincalc 오버레이도
// 포함한다.
function renderIpoBody() {
  return [
    '<main class="cp-wrap">',
    '  <p class="cp-eyebrow">청약 · 공모주</p>',
    '  <h1 class="cp-title">청약·공모주 캘린더</h1>',
    '  <p class="cp-meta"><span>이번 주 공모주 청약 일정과 아파트 청약 정보를 한눈에 확인하세요</span></p>',
    "",
    '  <div class="cp-card">',
    '    <div class="ipo-segmented">',
    '      <button type="button" class="ipo-segmented-tab is-active" data-tab="ipo">이번 주 공모주</button>',
    '      <button type="button" class="ipo-segmented-tab" data-tab="apartment">아파트 청약</button>',
    "    </div>",
    "",
    '    <div id="ipoTabPanel">',
    '      <div class="ipo-hero">',
    '        <h2 class="ipo-hero-title">이번 주 용돈 벌 수 있는<br>공모주 청약 <strong id="ipoHeroCount">0</strong>건</h2>',
    '        <button type="button" class="ipo-hero-score-link" onclick="window.openFinCalc && openFinCalc(\'subscription\')">',
    '          <i class="ph-duotone ph-medal"></i>아파트 청약가점 계산기 (84점 만점)<i class="ph-duotone ph-caret-right"></i>',
    "        </button>",
    "      </div>",
    '      <div class="ipo-category-filter" id="ipoCategoryFilter">',
    '        <button type="button" class="ipo-category-chip is-active" data-category="all">전체</button>',
    '        <button type="button" class="ipo-category-chip" data-category="general">일반기업</button>',
    '        <button type="button" class="ipo-category-chip" data-category="spac-reit">스팩·리츠</button>',
    '        <button type="button" class="ipo-category-chip" data-category="rights">실권주</button>',
    "      </div>",
    '      <div class="ipo-card-list" id="ipoCardList"></div>',
    "    </div>",
    "",
    '    <div id="aptTabPanel" hidden>',
    '      <div class="ipo-hero">',
    '        <h2 class="ipo-hero-title">최근 접수한<br>아파트 분양 <strong id="aptHeroCount">0</strong>건</h2>',
    "      </div>",
    '      <div class="ipo-category-filter" id="aptCategoryFilter">',
    '        <button type="button" class="ipo-category-chip is-active" data-category="all">전체</button>',
    '        <button type="button" class="ipo-category-chip" data-category="APT">APT</button>',
    '        <button type="button" class="ipo-category-chip" data-category="민간사전청약">민간사전청약</button>',
    '        <button type="button" class="ipo-category-chip" data-category="신혼희망타운">신혼희망타운</button>',
    "      </div>",
    '      <div class="ipo-card-list" id="aptCardList"></div>',
    "    </div>",
    "  </div>",
    "",
    '  <article class="cp-card">',
    '    <div class="calc-page-guide-body">',
    "      <h2>이번 주 공모주 청약 일정</h2>",
    "      <p>수요예측부터 청약일, 환불일, 상장일까지 공모주 일정을 한눈에 확인하세요. 일반기업, 스팩·리츠, 실권주 등 카테고리별로 필터링할 수 있습니다.</p>",
    "      <h2>아파트 청약 일정</h2>",
    "      <p>APT, 민간사전청약, 신혼희망타운 등 최근 접수한 아파트 분양 정보를 확인할 수 있습니다. 청약 전에는 청약가점을 미리 계산해보는 것을 권장합니다.</p>",
    "      <h2>자주 묻는 질문</h2>",
    "      <h3>공모주 청약 정보는 어디서 가져오나요?</h3>",
    "      <p>공개된 공시·공고 자료를 기준으로 정리합니다. 정확한 청약 조건과 일정은 반드시 증권사 공지와 한국거래소 공식 자료로 재확인하세요.</p>",
    "      <h3>아파트 청약 일정은 실시간으로 반영되나요?</h3>",
    "      <p>공공데이터(청약홈 등)를 주기적으로 반영합니다. 최신 공고는 청약홈에서 직접 확인하는 것이 가장 정확합니다.</p>",
    "      <h2>관련 계산기 · 글</h2>",
    '      <div class="cp-related-links cp-related-calcs">',
    '        <a href="/calculators/subscription-score/">청약가점 계산기</a>',
    '        <a href="/blog/subscription-score-by-tier-strategy/">청약가점 구간별 전략</a>',
    '        <a href="/blog/newlywed-first-home-special-supply-guide/">신혼부부·생애최초 특별공급</a>',
    '        <a href="/blog/ipo-allocation-methods/">공모주 배정 방식</a>',
    '        <a href="/financial-calendar/">금융 캘린더 전체 보기</a>',
    "      </div>",
    "    </div>",
    "  </article>",
    "</main>",
    "",
    '<div class="calendar-detail-overlay-v2" id="aptDetailOverlay" hidden>',
    '  <div class="calendar-detail-modal-v2 ipo160-modal" role="dialog" aria-modal="true" aria-labelledby="aptDetailTitle">',
    '    <div class="ipo-detail-scroll">',
    '      <button type="button" class="ipo160-close-btn" id="aptDetailCloseBtn" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>',
    '      <div class="ipo160-profile">',
    '        <div class="ipo160-logo" id="aptDetailLogo"><i class="ph-duotone ph-buildings"></i></div>',
    '        <h3 id="aptDetailTitle"></h3>',
    '        <p class="ipo160-market-line" id="aptDetailRegionLine"></p>',
    '        <p class="ipo160-tagline" id="aptDetailAddress"></p>',
    "      </div>",
    '      <div class="ipo160-card ipo160-broker-card">',
    '        <div class="ipo160-broker-row"><span class="ipo160-broker-badge"><i class="ph-duotone ph-hard-hat"></i></span><span class="ipo160-broker-name" id="aptDetailConstructor"></span></div>',
    '        <p class="ipo160-min-unit" id="aptDetailUnits"></p>',
    "      </div>",
    '      <div class="ipo160-card"><p class="ipo160-section-title">청약 일정</p><div class="ipo160-timeline" id="aptDetailTimeline"></div></div>',
    '      <div class="ipo160-card">',
    '        <button type="button" class="ipo160-accordion-toggle" id="aptInfoAccordionToggle" aria-expanded="false"><span>분양 정보</span><span class="ipo160-accordion-arrow">▼</span></button>',
    '        <div class="ipo160-accordion-body" id="aptInfoAccordionBody"></div>',
    "      </div>",
    '      <div class="ipo160-card">',
    '        <p class="ipo160-section-title">규제 지역 여부</p>',
    '        <div class="ipo160-demand-grid" id="aptRegulationGrid"></div>',
    '        <a class="ipo-scoring-source-link" id="aptDetailSourceLink" href="#" target="_blank" rel="noopener"><i class="ph-duotone ph-file-text"></i>청약홈 원문 공고 확인하기 <i class="ph-duotone ph-arrow-square-out"></i></a>',
    "      </div>",
    "    </div>",
    '    <div class="ipo-detail-actionbar"><button type="button" class="ipo-share-btn-v2 ipo160-share-btn-full" id="aptDetailShareBtn"><i class="ph-duotone ph-share-network"></i>청약 일정 공유하기</button></div>',
    "  </div>",
    "</div>",
    "",
    '<div class="calendar-detail-overlay-v2" id="ipoDetailOverlay" hidden>',
    '  <div class="calendar-detail-modal-v2 ipo160-modal" role="dialog" aria-modal="true" aria-labelledby="ipoDetailTitle">',
    '    <div class="ipo-detail-scroll">',
    '      <button type="button" class="ipo160-close-btn" id="ipoDetailCloseBtn" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>',
    '      <div class="ipo160-profile">',
    '        <div class="ipo160-logo" id="ipoDetailLogo"></div>',
    '        <h3 id="ipoDetailTitle"></h3>',
    '        <p class="ipo160-market-line" id="ipoDetailMarketLine"></p>',
    '        <p class="ipo160-tagline" id="ipoDetailTagline"></p>',
    "      </div>",
    '      <div class="ipo160-card ipo160-broker-card">',
    '        <div class="ipo160-broker-row"><span class="ipo160-broker-badge" id="ipoDetailBrokerBadge"></span><span class="ipo160-broker-name" id="ipoDetailBrokerName"></span></div>',
    '        <p class="ipo160-min-unit" id="ipoDetailMinUnit"></p>',
    "      </div>",
    '      <div class="ipo160-card"><p class="ipo160-section-title">청약 일정</p><div class="ipo160-timeline" id="ipoDetailTimeline"></div></div>',
    '      <div class="ipo160-card">',
    '        <button type="button" class="ipo160-accordion-toggle" id="ipoInfoAccordionToggle" aria-expanded="false"><span>공모주 정보</span><span class="ipo160-accordion-arrow">▼</span></button>',
    '        <div class="ipo160-accordion-body" id="ipoInfoAccordionBody"></div>',
    "      </div>",
    '      <div class="ipo160-card">',
    '        <p class="ipo160-section-title">배정 주식수 계산기</p>',
    '        <div class="ipo-alloc-chip-row" id="ipoAllocChipRow">',
    '          <button type="button" class="ipo-alloc-chip" data-amount="3000000">300만원</button>',
    '          <button type="button" class="ipo-alloc-chip" data-amount="10000000">1,000만원</button>',
    '          <button type="button" class="ipo-alloc-chip" data-amount="50000000">5,000만원</button>',
    "        </div>",
    '        <div class="ipo-alloc-input-row">',
    '          <div class="ipo-alloc-input-group"><label for="ipoAllocFunds">보유 자금</label><input type="text" id="ipoAllocFunds" inputmode="numeric" placeholder="0"></div>',
    '          <div class="ipo-alloc-input-group"><label for="ipoAllocCompetition">예상 경쟁률 (선택, 직접 입력)</label><input type="text" id="ipoAllocCompetition" inputmode="decimal" placeholder="예: 800"></div>',
    "        </div>",
    '        <div class="ipo-alloc-result" id="ipoAllocResult"></div>',
    "      </div>",
    '      <div class="ipo160-card">',
    '        <p class="ipo160-section-title">수요예측 결과</p>',
    '        <div class="ipo160-demand-grid" id="ipoDemandGrid"></div>',
    '        <a class="ipo-scoring-source-link" id="ipoDetailSourceLink" href="#" target="_blank" rel="noopener"><i class="ph-duotone ph-file-text"></i>DART 원문 공시 확인하기 <i class="ph-duotone ph-arrow-square-out"></i></a>',
    "      </div>",
    '      <div class="ipo160-disclaimer-card">',
    '        <p class="ipo160-section-title">투자 유의사항</p>',
    '        <ul class="ipo160-disclaimer-list">',
    "          <li>공모주 투자는 원금 손실 위험이 있으며, 상장 후 주가는 공모가를 하회할 수 있어요.</li>",
    "          <li>확정 공모가와 수요예측 결과는 투자자에게 불리한 방향으로 결정될 수 있어요.</li>",
    "          <li>청약 경쟁률에 따라 실제 배정 주식수는 신청 수량보다 크게 줄어들 수 있어요.</li>",
    "          <li>일정(청약기일·환불일 등)은 회사 사정에 따라 변경될 수 있으니 반드시 최신 공시를 확인하세요.</li>",
    "          <li>본 정보는 DART 공시 기반의 참고 자료이며, 투자 판단과 그 결과에 대한 책임은 투자자 본인에게 있어요.</li>",
    "        </ul>",
    "      </div>",
    "    </div>",
    '    <div class="ipo-detail-actionbar"><button type="button" class="ipo-share-btn-v2 ipo160-share-btn-full" id="ipoDetailShareBtn"><i class="ph-duotone ph-share-network"></i>청약 일정 공유하기</button></div>',
    "  </div>",
    "</div>"
  ].join("\n");
}

// ---------- /financial-calendar/ ----------
// index.html:1372-1517(view-calendar 마크업, 단 포인트/미션/출석체크/일정추가/"내 일정" 모드는
// 로그인 기반 개인화 기능이라 제외 — 사용자 승인된 범위) + 2155-2192(일정 상세 모달)
// + js/financial-calendar-page.js(핵심 캘린더 로직 이식, 데이터 소스는 index.html과 동일).
function renderCalendarBody() {
  return [
    '<main class="cp-wrap">',
    '  <p class="cp-eyebrow">금융 캘린더</p>',
    '  <h1 class="cp-title">금융 캘린더</h1>',
    '  <p class="cp-meta"><span>배당락일·공모주·아파트 청약·정부지원금 마감일을 한 곳에서 확인하세요</span></p>',
    "",
    '  <div class="cp-card">',
    '    <div class="calendar-mode-tabs" id="calendarModeTabs" role="tablist" aria-label="캘린더 보기 모드">',
    '      <button type="button" class="calendar-mode-tab" data-mode="week" role="tab">이번 주</button>',
    '      <button type="button" class="calendar-mode-tab" data-mode="month" role="tab">월간</button>',
    "    </div>",
    "",
    '    <div class="calendar-search-row">',
    '      <div class="calendar-search-box">',
    '        <i class="ph-duotone ph-magnifying-glass"></i>',
    '        <input type="search" id="calendarSearchInput" placeholder="일정명·기업명·지역으로 검색" aria-label="금융 일정 검색">',
    "      </div>",
    '      <div class="calendar-quickjump-row" id="calendarQuickJumpRow">',
    '        <button type="button" class="calendar-quickjump-btn" data-jump="today">오늘</button>',
    '        <button type="button" class="calendar-quickjump-btn" data-jump="week">이번 주</button>',
    '        <button type="button" class="calendar-quickjump-btn" data-jump="nextmonth">다음 달</button>',
    "      </div>",
    "    </div>",
    '    <div class="calendar-search-result" id="calendarSearchResult" hidden></div>',
    "",
    '    <div class="calendar-layout">',
    '      <div class="calendar-main">',
    '        <div id="calendarMonthModeWrap" hidden>',
    '          <div class="calendar-nav">',
    '            <button type="button" class="calendar-nav-btn" id="calendarPrevBtn" aria-label="이전 달"><i class="ph-duotone ph-caret-left"></i></button>',
    '            <span class="calendar-month-label" id="calendarMonthLabel">2026년 7월</span>',
    '            <button type="button" class="calendar-nav-btn" id="calendarNextBtn" aria-label="다음 달"><i class="ph-duotone ph-caret-right"></i></button>',
    "          </div>",
    '          <div class="calendar-weekday-row">',
    '            <span class="calendar-weekday sun">일</span><span class="calendar-weekday">월</span><span class="calendar-weekday">화</span>',
    '            <span class="calendar-weekday">수</span><span class="calendar-weekday">목</span><span class="calendar-weekday">금</span>',
    '            <span class="calendar-weekday sat">토</span>',
    "          </div>",
    '          <div class="calendar-grid" id="calendarGrid"></div>',
    '          <div class="calendar-selected-day-panel" id="calendarSelectedDayPanel" hidden></div>',
    '          <div class="calendar-filter-pills" id="calendarFilterPills"></div>',
    '          <div class="calendar-timeline" id="calendarTimeline"></div>',
    "        </div>",
    '        <div id="calendarWeekModeWrap" hidden>',
    '          <div class="calendar-filter-pills" id="calendarFilterPillsWeek"></div>',
    '          <div id="calendarWeekBody"></div>',
    "        </div>",
    "      </div>",
    "    </div>",
    "  </div>",
    "",
    '  <article class="cp-card">',
    '    <div class="calc-page-guide-body">',
    "      <h2>금융 캘린더에서 확인할 수 있는 일정</h2>",
    "      <p>자산 파일럿 금융 캘린더는 <strong>배당락일</strong>(DART 공시 기준), <strong>공모주 청약 일정</strong>(수요예측·청약·환불·상장일), <strong>아파트 청약 일정</strong>(입주자모집공고 기준), <strong>정부지원금 신청 마감일</strong>을 한 화면에서 모아 보여줍니다. 이번 주·월간 두 가지 보기 모드를 제공합니다.</p>",
    "      <h2>개인 일정 추가 · 미션은 앱에서</h2>",
    "      <p>로그인 후 개인 일정 추가, 출석체크·미션 포인트는 자산 파일럿 앱(홈)에서 이용할 수 있습니다.</p>",
    "      <h2>자주 묻는 질문</h2>",
    "      <h3>배당락일 정보는 어디서 가져오나요?</h3>",
    "      <p>금융감독원 전자공시시스템(DART)에 공시된 배당 관련 자료를 기준으로 정리합니다. 실제 배당 여부와 금액은 기업의 최종 공시를 확인하세요.</p>",
    "      <h3>공모주·아파트 청약 일정은 얼마나 자주 업데이트되나요?</h3>",
    "      <p>공개된 공고 자료를 주기적으로 반영합니다. 정확한 일정과 조건은 반드시 한국거래소·청약홈 등 공식 채널에서 다시 확인하시기 바랍니다.</p>",
    "      <h2>관련 계산기 · 페이지</h2>",
    '      <div class="cp-related-links cp-related-calcs">',
    '        <a href="/calculators/subscription-score/">청약가점 계산기</a>',
    '        <a href="/blog/salary-net-pay-by-bracket/">연봉 실수령액표</a>',
    '        <a href="/ipo-calendar/">청약·공모주 일정 보기</a>',
    "      </div>",
    "    </div>",
    "  </article>",
    "</main>",
    "",
    '<div class="calendar-detail-overlay-v2" id="calDetailOverlay" hidden>',
    '  <div class="calendar-detail-modal-v2" role="dialog" aria-modal="true" aria-labelledby="calDetailTitle">',
    '    <div class="calendar-detail-top-v2">',
    '      <span class="calendar-detail-cat-v2" id="calDetailCat"></span>',
    '      <span class="calendar-detail-status-v2" id="calDetailStatus" hidden></span>',
    '      <button type="button" class="calendar-detail-close-v2" id="calDetailCloseBtn" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>',
    "    </div>",
    '    <h3 id="calDetailTitle"></h3>',
    '    <span class="calendar-detail-importance-v2" id="calDetailImportance" hidden></span>',
    '    <p class="calendar-detail-date-v2" id="calDetailDate"></p>',
    '    <p class="calendar-detail-desc-v2" id="calDetailDesc" hidden></p>',
    '    <div class="calendar-detail-impact-v2" id="calDetailImpact" hidden>',
    '      <p class="calendar-detail-block-label">나에게 미칠 수 있는 영향</p>',
    '      <p id="calDetailImpactText"></p>',
    "    </div>",
    '    <div class="calendar-detail-fields-v2" id="calDetailFields"></div>',
    '    <div class="calendar-detail-actions-v2" id="calDetailActions" hidden></div>',
    '    <div class="calendar-detail-remind-group-v2" id="calDetailRemindGroup"></div>',
    '    <a class="calendar-detail-link-v2" id="calDetailLink" target="_blank" rel="noopener noreferrer" hidden>',
    '      <span id="calDetailLinkLabel">원문 / 신청 링크 열기(외부 사이트)</span><i class="ph-duotone ph-arrow-square-out"></i>',
    "    </a>",
    '    <p class="calendar-detail-updated-v2" id="calDetailUpdatedAt" hidden></p>',
    '    <p class="calendar-detail-disclaimer-v2">이 정보는 투자·세무 자문이 아니며 참고용입니다. 실제 결정 전 공식 출처와 전문가 확인을 권장해요.</p>',
    '    <button type="button" class="calendar-detail-delete-btn-v2" id="calDetailDeleteBtn" hidden>이 개인 일정 삭제</button>',
    "  </div>",
    "</div>"
  ].join("\n");
}

const PAGES = {
  news: { extraCss: ["/css/home.css"], body: renderNewsBody, scripts: ["/js/news-page.js"] },
  "financial-calendar": {
    extraCss: ["/css/calendar.css", "/css/home.css"],
    extraHeadScripts: FIREBASE_SDK_SCRIPTS_WITH_AUTH.concat([FIREBASE_CONFIG_SCRIPT]),
    body: renderCalendarBody,
    scripts: ["/js/financial-calendar-page.js", "/js/fincalc-launcher.js"],
    extraBody: [TOAST_HTML, FINCALC_OVERLAY_HTML]
  },
  "ipo-calendar": {
    extraCss: ["/css/home.css"],
    extraHeadScripts: FIREBASE_SDK_SCRIPTS.concat([FIREBASE_CONFIG_SCRIPT]),
    body: renderIpoBody,
    scripts: ["/js/ipo-calendar-page.js", "/js/fincalc-launcher.js"],
    extraBody: [TOAST_HTML, FINCALC_OVERLAY_HTML]
  }
};

let generated = 0;
for (const slug of Object.keys(manifest)) {
  const entry = manifest[slug];
  const page = PAGES[slug];
  if (!page) { console.log("skip (아직 이 스크립트에 렌더러 없음): " + slug); continue; }

  const html = wrapPage(
    renderHead(entry, page.extraCss, page.extraHeadScripts),
    page.body(),
    page.scripts,
    page.extraBody
  );
  const filePath = path.join(ROOT, slug, "index.html");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, "utf8");
  generated++;
}

console.log("generated " + generated + " lean view-landing pages (no app-shell clone)");
