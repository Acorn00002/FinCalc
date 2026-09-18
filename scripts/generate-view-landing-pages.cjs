// 검색 유입용 "기능" 랜딩 페이지(/financial-calendar/, /ipo-calendar/, /news/ ...)를 생성/재생성한다.
// generate-calculator-pages.cjs와 같은 원리다 — index.html(앱 셸)을 그대로 복제한 뒤 <head>의
// SEO 메타만 페이지별로 바꾸고, <body> 상단에서 window.__VIEW_DEEP_LINK__ 로 최초 진입 시
// 열릴 최상위 탭(activateView 인자)을 지정한다. 계산기와 달리 모달을 열 필요가 없는 최상위
// 탭이라 이쪽이 더 단순하다. 각 탭의 정적 안내/FAQ 본문은 index.html 안, 해당 view 컨테이너에
// 이미 들어있어 복제 시 함께 따라온다 — 이 스크립트가 따로 주입하지 않는다.
//
//   실행: node scripts/generate-view-landing-pages.cjs
//
// index.html(헤더/사이드바/각 view의 정적 안내문)을 고치면 이 스크립트를 다시 실행해야
// 아래 페이지들도 최신 상태로 재생성된다. 페이지별 title/description/JSON-LD는
// view-landing-pages-content.json 에서 관리한다.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const rootHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "view-landing-pages-content.json"), "utf8"));

for (const slug of Object.keys(manifest)) {
  const entry = manifest[slug];
  const filePath = path.join(ROOT, slug, "index.html");

  let out = rootHtml;

  out = out.replace(/<title>[^<]*<\/title>/, "<title>" + entry.title + "</title>");
  out = out.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + entry.description + '">');
  out = out.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + entry.canonical + '">');
  out = out.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + entry.ogTitle + '">');
  out = out.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + entry.ogDescription + '">');
  out = out.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + entry.canonical + '">');
  out = out.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + entry.ogTitle + '">');
  out = out.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + entry.ogDescription + '">');
  out = out.replace('<h1 class="sr-only">자산 파일럿 | 쉽게 빠르게 끝내는 자산관리 & 금융계산기</h1>', '<h1 class="sr-only">' + entry.breadcrumbName + ' | 자산 파일럿</h1>');

  const orgAnchor = '"logo": "https://www.gofincalc.com/icons/icon-512.png"\r\n}\r\n</script>';
  if (out.indexOf(orgAnchor) === -1) throw new Error("orgAnchor not found in root template");
  out = out.replace(orgAnchor, orgAnchor + "\r\n" + entry.ldJsonBlocks.join("\r\n"));

  out = out.replace("<body>", '<body>\r\n<script>window.__VIEW_DEEP_LINK__ = "' + entry.viewDeepLink + '";</script>');

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, out, "utf8");
}

console.log("generated " + Object.keys(manifest).length + " view-landing pages from index.html + view-landing-pages-content.json");
