// 검색 유입용 계산기 페이지(/calculators/{slug}/)를 생성/재생성하는 스크립트.
//
// 이 페이지들은 별도의 미니 레이아웃이 아니라 루트 index.html(자산 파일럿 앱 셸)을 그대로
// 복제한 뒤, <head>의 SEO 메타 몇 개와 계산기 전용 안내 섹션만 교체해서 만든다. 그래서
//   1) index.html(헤더/사이드바/계산기 모달 UI/기능)을 고치면
//   2) 이 스크립트를 다시 실행해서
//   3) 20개 계산기 페이지를 전부 최신 상태로 재생성한다.
//
//   실행: node scripts/generate-calculator-pages.js
//
// 페이지별 title/description/canonical/OG/JSON-LD/가이드 본문은 이 폴더의
// calculator-pages-content.json 에 있다. 특정 계산기의 SEO 문구나 가이드 글을 고치고 싶으면
// "generate 되는 calculators/{slug}/index.html"이 아니라 이 JSON을 고친 뒤 스크립트를
// 다시 실행해야 한다 — HTML 파일을 직접 손으로 고쳐도 다음 재생성 때 덮어써진다.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const rootHtml = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "calculator-pages-content.json"), "utf8"));

const outputs = {};

for (const slug of Object.keys(manifest)) {
  const entry = manifest[slug];
  const filePath = path.join(ROOT, "calculators", slug, "index.html");

  let out = rootHtml;

  out = out.replace(/<title>[^<]*<\/title>/, "<title>" + entry.title + "</title>");
  out = out.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + entry.description + '">');
  out = out.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + entry.canonical + '">');
  out = out.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + entry.ogTitle + '">');
  out = out.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + entry.ogDescription + '">');
  out = out.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + entry.canonical + '">');
  out = out.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + entry.ogTitle + '">');
  out = out.replace(/<meta name="twitter:description" content="[^"]*">/, '<meta name="twitter:description" content="' + entry.ogDescription + '">');

  // 계산기 전용 구조화 데이터(WebApplication + BreadcrumbList 등)를 사이트 전역 JSON-LD(Organization) 뒤에 추가
  const orgAnchor = '"logo": "https://www.gofincalc.com/icons/icon-512.png"\r\n}\r\n</script>';
  if (out.indexOf(orgAnchor) === -1) throw new Error("orgAnchor not found in root template — index.html의 Organization JSON-LD 블록이 바뀌었는지 확인하세요.");
  out = out.replace(orgAnchor, orgAnchor + "\r\n" + entry.ldJsonBlocks.join("\r\n"));

  // 계산기 허브 SEO 가이드(.finpilot-seo-guide) 바로 뒤에 이 계산기 전용 안내를 접을 수 있는 섹션으로 추가
  const guideAnchor = "바랍니다.</p>\r\n  </section>\r\n  </div>\r\n";
  if (out.indexOf(guideAnchor) === -1) throw new Error("guideAnchor not found in root template — index.html의 .finpilot-seo-guide 섹션이 바뀌었는지 확인하세요.");
  const guideSection =
    '\r\n  <section class="finpilot-seo-guide calc-page-guide">\r\n' +
    '    <details class="calc-page-guide-toggle">\r\n' +
    '      <summary><span>' + entry.title.split("|")[0].trim() + ' 가이드<span class="calc-page-guide-eyebrow"> · ' + entry.eyebrowSuffix + '</span></span><i class="ph-duotone ph-caret-down"></i></summary>\r\n' +
    '      <div class="calc-page-guide-body">' + entry.articleInnerHtml + '</div>\r\n' +
    '    </details>\r\n' +
    '  </section>\r\n';
  out = out.replace(guideAnchor, "바랍니다.</p>\r\n  </section>\r\n" + guideSection + "  </div>\r\n");

  // 최초 진입(해시 없음) 시 계산기 허브로 이동한 뒤 해당 계산기를 자동으로 여는 deep-link 플래그 주입
  out = out.replace("<body>", '<body>\r\n<script>window.__CALC_DEEP_LINK__ = "' + entry.fincalcId + '";</script>');

  outputs[slug] = { filePath, out };
}

for (const slug of Object.keys(outputs)) {
  fs.writeFileSync(outputs[slug].filePath, outputs[slug].out, "utf8");
}

console.log("generated " + Object.keys(outputs).length + " calculator pages from index.html + calculator-pages-content.json");
