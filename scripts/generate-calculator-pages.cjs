// 검색 유입용 계산기 페이지(/calculators/{slug}/)를 생성/재생성하는 스크립트.
//
// 2026-09 AdSense 재심사 감사에서, 예전 버전은 이 페이지들을 index.html(앱 전체 셸, ~9,855줄)을
// 통째로 복제해서 만들었다는 게 드러났다 — 계산기 20개 페이지가 홈·캘린더·뉴스·라운지·설정 등
// 무관한 화면 마크업을 전부 그대로 포함해서, 페이지 고유 콘텐츠 비율이 0.36%밖에 안 됐다
// (구글이 doorway/cookie-cutter 페이지로 볼 위험). 이 버전은 그 방식을 버리고, 블로그(45개)·
// /lounge/가 이미 쓰고 있는 가벼운 콘텐츠 템플릿(css/content.css의 cp-header/cp-wrap/cp-article)
// 위에 "이 계산기 하나"만 올린다. 실제 계산 로직·입력·다크모드는 finpilot/index.html(계산 엔진,
// 이미 "iframe(?tab=)으로만 열리도록 설계·noindex 처리됨"이라고 스스로 문서화돼 있던 파일)을
// 그대로 재사용한다 — 계산기 로직 자체는 손대지 않는다.
//
// 홈·캘린더·뉴스·설정 등 다른 화면은 이 페이지들에 전혀 포함되지 않는다("전체 앱 화면은 별도
// 진입 경로에서만 로드"). 그 화면들이 필요하면 실제 링크(예: "/", "/financial-calendar/")로
// 진짜 페이지 이동을 한다 — index.html의 client-side 탭 전환(activateView)은 쓰지 않는다.
// index.html 자체(진짜 앱)는 이 스크립트가 전혀 건드리지 않는다.
//
//   실행: node scripts/generate-calculator-pages.cjs
//
// 페이지별 title/description/canonical/OG/JSON-LD/가이드 본문은 이 폴더의
// calculator-pages-content.json 에 있다 — 이 파일의 구조(키 이름)는 이전 버전과 100% 동일하게
// 유지했으므로 그대로 잘 작동한다. 가이드 문구를 고치고 싶으면 이 JSON을 고친 뒤 스크립트를
// 다시 실행할 것 — HTML을 직접 고치면 다음 재생성 때 덮어써진다.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "calculator-pages-content.json"), "utf8"));

function renderHead(entry) {
  return [
    '<meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    "<!-- Google tag (gtag.js) -->",
    '<script async src="https://www.googletagmanager.com/gtag/js?id=G-HWY33CNTB1"></' + "script>",
    "<script>",
    "  window.dataLayer = window.dataLayer || [];",
    "  function gtag(){dataLayer.push(arguments);}",
    "  gtag('js', new Date());",
    "  gtag('config', 'G-HWY33CNTB1');",
    "</" + "script>",
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
    '<link rel="icon" href="/icons/icon-192.png" type="image/png">',
    '<meta name="google-adsense-account" content="ca-pub-7476413799189909">',
    '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7476413799189909" crossorigin="anonymous"></' + "script>",
    "<script>",
    "try {",
    '  var __fpPref = localStorage.getItem("fincalc_theme_pref");',
    '  if (__fpPref === "dark" || __fpPref === "light") document.documentElement.setAttribute("data-theme", __fpPref);',
    "} catch (e) {}",
    "</" + "script>",
    '<link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/duotone/style.css">',
    '<link rel="stylesheet" href="/css/content.css">',
    '<link rel="stylesheet" href="/css/calculators.css">',
    entry.ldJsonBlocks.join("\n")
  ].join("\n");
}

// fincalcId → finpilot/index.html의 실제 ?tab= 값. 계산기 페이지는 index.html의 FINCALC_MAP과
// 똑같은 아이디 체계를 쓰지만, 대부분은 id와 tab 값이 같고 예외만 다르다(index.html:8819-8850 기준).
const FINCALC_TAB_OVERRIDES = {
  "water-ratio": "average-price",
  "loan": "loan-interest"
};
function resolveFincalcTab(fincalcId) {
  return FINCALC_TAB_OVERRIDES[fincalcId] || fincalcId;
}

function renderBody(slug, entry) {
  const calcTitle = entry.title.split("|")[0].trim();
  const tab = resolveFincalcTab(entry.fincalcId);
  return [
    '<header class="cp-header">',
    '  <a class="cp-logo" href="https://www.gofincalc.com/"><img class="cp-logo-mark" src="/icons/icon-192.png" alt="">자산 파일럿</a>',
    '  <nav class="cp-header-nav">',
    '    <a href="/calculators/">전체 계산기</a>',
    '    <a href="/blog/">블로그</a>',
    '    <a href="/financial-calendar/">금융 캘린더</a>',
    "  </nav>",
    "</header>",
    "",
    '<main class="cp-wrap">',
    '  <a class="cp-back" href="/calculators/">← 전체 계산기</a>',
    '  <p class="cp-eyebrow">무료 금융 계산기</p>',
    "  <h1 class=\"cp-title\">" + calcTitle + "</h1>",
    '  <p class="cp-meta"><span>자산 파일럿 편집팀</span></p>',
    "",
    // 계산 엔진(finpilot/index.html)은 이미 "iframe(?tab=)으로만 열리도록 설계, noindex 처리됨"이라고
    // 스스로 문서화된 파일이다 — 새 우회가 아니라 원래 있던 설계를 실제로 연결하는 것. 입력·결과·
    // 다크모드는 전부 그 안에서 그대로 동작한다(계산 로직은 이 리팩터로 전혀 바뀌지 않았다).
    '  <div class="cp-card cp-tool-card">',
    '    <div class="cp-tool-card-head">',
    '      <div class="cp-tool-card-icon"><img src="/icons/icon-192.png" alt=""></div>',
    "      <div>",
    "        <p class=\"cp-tool-card-title\">" + calcTitle + "</p>",
    '        <p class="cp-tool-card-desc">아래에서 바로 계산해보세요</p>',
    "      </div>",
    "    </div>",
    // 절대경로 필수 — /calculators/{slug}/에서 상대경로 "./finpilot/..."을 쓰면
    // /calculators/{slug}/finpilot/index.html(존재하지 않음, 404)로 풀린다. 실제로 프로덕션에서
    // 이 버그가 있었음을 curl로 확인했다(계산기 페이지의 자동 오픈 모달이 계속 404였음).
    '    <iframe class="cp-tool-frame" src="/finpilot/index.html?tab=' + tab + '" title="' + calcTitle + '" loading="lazy"></iframe>',
    "  </div>",
    "",
    // .calc-page-guide-body(css/calculators.css)가 표를 모바일에서 카드형으로 바꾸는 반응형 규칙을
    // 포함해 가이드 전용 타이포그래피를 담당한다 — content.css의 범용 .cp-article 대신 이걸 그대로 써야
    // 기존에 확인된 "표 가로 스크롤 없음" 동작이 유지된다.
    '  <article class="cp-card">',
    '    <div class="calc-page-guide-body">',
    "      " + entry.articleInnerHtml,
    "    </div>",
    "  </article>",
    "</main>",
    "",
    '<footer class="cp-footer">',
    "  <span>© 2026 자산 파일럿(gofincalc.com)</span>",
    '  <div class="cp-footer-links">',
    '    <a href="/about/">회사소개</a>',
    '    <a href="/privacy/">개인정보처리방침</a>',
    '    <a href="/terms/">이용약관</a>',
    '    <a href="/contact/">문의하기</a>',
    '    <a href="https://www.instagram.com/gofincalc.app" target="_blank" rel="noopener noreferrer">인스타그램</a>',
    "  </div>",
    "</footer>",
    "",
    '<script src="/js/link-tracking.js" defer></script>'
  ].join("\n");
}

let generated = 0;
for (const slug of Object.keys(manifest)) {
  const entry = manifest[slug];
  const html =
    "<!DOCTYPE html>\n<html lang=\"ko\">\n<head>\n" +
    renderHead(entry) +
    "\n</head>\n<body>\n\n" +
    renderBody(slug, entry) +
    "\n\n</body>\n</html>\n";

  const filePath = path.join(ROOT, "calculators", slug, "index.html");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, "utf8");
  generated++;
}

console.log("generated " + generated + " lean calculator pages from calculator-pages-content.json (no app-shell clone)");
