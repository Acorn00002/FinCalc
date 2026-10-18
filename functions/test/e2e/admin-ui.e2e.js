"use strict";
// /admin/ 화면 UI e2e (Auth·Firestore·Functions 에뮬레이터 + 로컬 정적 서버 + Playwright)
// 실행: firebase emulators:exec --only functions,firestore,auth --project asset-filot "node functions/test/e2e/admin-ui.e2e.js"
const assert = require("node:assert/strict");
const http = require("http"); const fs = require("fs"); const path = require("path");
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
const admin = require("firebase-admin"); admin.initializeApp({ projectId: "asset-filot" });
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const ROOT = path.resolve(__dirname, "../../..");
const FN = "http://127.0.0.1:5001/asset-filot/asia-northeast3/";
const AUTH_API = "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1";
const results = []; const check = (n, c) => { results.push(!!c); console.log((c ? "PASS " : "FAIL ") + n); };

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]); if (p.endsWith("/")) p += "index.html";
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.statusCode = 404; res.end("nf"); return; }
  res.setHeader("Content-Type", types[path.extname(f)] || "application/octet-stream"); res.end(fs.readFileSync(f));
});

async function mk(email, claims) {
  const r = await (await fetch(`${AUTH_API}/accounts:signUp?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "pw-test-1234", returnSecureToken: true }) })).json();
  if (claims) await admin.auth().setCustomUserClaims(r.localId, claims);
  return r.localId;
}

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r)); const port = server.address().port;
  const adminUid = await mk("ui-admin@example.test", { admin: true }); await mk("ui-user@example.test");
  await admin.firestore().collection("calendarEvents").doc("xss1").set({ date: "2026-10-18", category: "tax", title: '<img src=x onerror="window.__xss=1">', source: '<script>window.__xss=2</script>', sourceUrl: "javascript:window.__xss=3", needsReview: true });
  await admin.firestore().collection("taxConsultLeads").doc("l1").set({ category: "<b>c</b>", contact: '<img src=x onerror="window.__xss=4">', message: '"><script>window.__xss=5</script>', createdAt: new Date() });

  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH });
  const base = `http://127.0.0.1:${port}/admin/?fn=${encodeURIComponent(FN)}&auth=127.0.0.1:9099`;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });

  // A) 비로그인: 관리자 API 요청 0건, 앱 영역 숨김
  let page = await ctx.newPage(); const fnReqs = []; const errs = [];
  page.on("request", (r) => { if (r.url().startsWith(FN)) fnReqs.push(r.url()); });
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(base); await page.waitForTimeout(1500);
  check("비로그인: 로그인 카드만 표시", (await page.isVisible("#admGate")) && !(await page.isVisible("#admApp")));
  check("비로그인: 관리자 API 요청 0건", fnReqs.length === 0);
  check("noindex 메타", (await page.getAttribute('meta[name="robots"]', "content")).includes("noindex"));
  check("광고·GA 코드 없음", !(await page.content()).match(/adsbygoogle|googletagmanager|G-HWY33CNTB1/));

  // B) 일반 사용자 로그인: 앱 숨김 + 데이터 요청 0건
  await page.evaluate(() => firebase.auth().signInWithEmailAndPassword("ui-user@example.test", "pw-test-1234")); await page.waitForTimeout(1500);
  check("일반 사용자: 앱 영역 숨김 + 권한 없음 안내", !(await page.isVisible("#admApp")) && (await page.textContent("#admGateMsg")).includes("권한이 없습니다"));
  check("일반 사용자: 관리자 API 요청 0건", fnReqs.length === 0);
  await page.evaluate(() => firebase.auth().signOut());

  // C) 관리자 로그인: 목록 표시, XSS 미실행
  await page.evaluate(() => firebase.auth().signInWithEmailAndPassword("ui-admin@example.test", "pw-test-1234")); await page.waitForTimeout(2500);
  check("관리자: 앱 영역 표시", await page.isVisible("#admApp"));
  check("관리자: Authorization 헤더 요청 발생", fnReqs.length > 0);
  check("일정 목록에 XSS 문자열이 텍스트로 표시", (await page.textContent("#calList")).includes("onerror"));
  await page.click('[data-tab="system"]'); await page.waitForFunction(() => document.querySelector('#reviewList').textContent.length > 0, null, { timeout: 20000 });
  check("검수 목록에 텍스트로 표시", (await page.textContent("#reviewList")).includes("<script>") || (await page.textContent("#reviewList")).includes("xss"));
  const hrefs = await page.$$eval("#reviewList a", (as) => as.map((a) => a.href));
  check("javascript: 링크는 렌더링되지 않음", hrefs.every((h) => !h.startsWith("javascript:")));
  await page.click('[data-tab="tax"]'); await page.click("#taxLoad"); await page.waitForFunction(() => document.querySelector('#taxResult').textContent !== '불러오는 중...', null, { timeout: 20000 });
  check("상담 목록: 마크업이 텍스트로 표시", (await page.textContent("#taxList")).includes("<img"));
  check("상담 목록: 주입된 요소 없음", (await page.$$("#taxList img, #taxList script, #calList img, #calList script")).length === 0);
  check("XSS 미실행(window.__xss 미설정)", (await page.evaluate(() => window.__xss)) === undefined);
  check("페이지 오류 없음", errs.length === 0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  check("모바일 390px 가로 넘침 없음", !overflow);
  await page.screenshot({ path: process.env.SHOT || "admin-ui.png" });

  // D) 공개 홈페이지에 관리자 문자열 0건
  const idx = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  for (const s of ["SEND_PUSH_SECRET", "adminPushSecret", "adminCalSecret", "adminTaxSecret", "view-admin", "send-push", "upsert-calendar-event", "tax-consult-leads", "secret="]) check(`index.html 에 '${s}' 없음`, !idx.includes(s));

  await browser.close(); server.close();
  const failed = results.filter((x) => !x).length; console.log(`\n총 ${results.length}건, 실패 ${failed}건`); process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("UI E2E 오류:", e); process.exit(2); });
