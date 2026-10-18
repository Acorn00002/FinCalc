"use strict";
// Firebase Emulator(Auth + Firestore + Functions) 위에서 실제 HTTP 로 관리자 엔드포인트 인증·권한을 검증한다.
// 실행: firebase emulators:exec --only functions,firestore,auth --project asset-filot "node functions/test/e2e/admin-emulator.e2e.js"
const assert = require("node:assert/strict");
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "asset-filot" });

const PROJECT = "asset-filot";
const FN = (n) => `http://127.0.0.1:5001/${PROJECT}/asia-northeast3/${n}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const LEGACY = process.env.E2E_LEGACY_SECRET || ""; // 과거 공유 비밀값(에뮬레이터용 더미 값)
const EXPECT_LEGACY_REJECTED = process.env.E2E_EXPECT_LEGACY_REJECTED === "1";

async function signUp(email) {
  const r = await fetch(`${AUTH}/accounts:signUp?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "pw-test-1234", returnSecureToken: true }) });
  const j = await r.json(); assert.ok(j.localId, "signUp 실패");
  return j;
}
async function signIn(email) {
  const r = await fetch(`${AUTH}/accounts:signInWithPassword?key=fake`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: "pw-test-1234", returnSecureToken: true }) });
  return (await r.json()).idToken;
}
async function call(fn, o) {
  o = o || {};
  const url = FN(fn) + (o.query ? "?" + new URLSearchParams(o.query) : "");
  const headers = Object.assign({}, o.headers || {});
  headers["X-Forwarded-For"] = o.ip || ("10." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250));
  if (o.token) headers.Authorization = "Bearer " + o.token;
  if (o.body !== undefined) headers["Content-Type"] = "application/json";
  const r = await fetch(url, { method: o.method || "GET", headers, body: o.body !== undefined ? JSON.stringify(o.body) : undefined });
  let data = null; try { data = await r.json(); } catch (e) { /* 빈 응답 */ }
  return { status: r.status, data };
}
const results = [];
function check(name, cond) { results.push([name, !!cond]); console.log((cond ? "PASS " : "FAIL ") + name); }

(async () => {
  const adm = await signUp("admin@example.test"); const usr = await signUp("user@example.test");
  await admin.auth().setCustomUserClaims(adm.localId, { admin: true });
  const adminToken = await signIn("admin@example.test"); // 새 claim 이 담긴 토큰
  const userToken = await signIn("user@example.test");

  const ENDPOINTS = [
    ["sendPushNotification", "POST", { title: "t", body: "b" }],
    ["upsertCalendarEvent", "POST", { date: "2026-10-18", category: "tax", title: "x" }],
    ["deleteCalendarEvent", "DELETE", null, { id: "abc" }],
    ["getTaxConsultLeads", "GET"],
    ["syncFinancialCalendarManual", "POST", {}],
    ["syncEconomicIndicatorsManual", "POST", {}],
    ["syncGov24Subsidies", "POST", {}],
    ["syncGov24SubsidiesStaging", "POST", {}],
    ["moderateLounge", "POST", { action: "list" }],
    ["adminData", "GET", null, { kind: "calendar" }]
  ];

  // 1) 토큰 없음 / 위조 / 일반 사용자
  for (const [fn, method, body, query] of ENDPOINTS) {
    const r1 = await call(fn, { method, body: body || undefined, query });
    check(`${fn}: 토큰 없음 → 401`, r1.status === 401);
    const r2 = await call(fn, { method, body: body || undefined, query, token: "eyJhbGciOiJub25lIn0.eyJ1aWQiOiJ4In0." });
    check(`${fn}: 위조 토큰 → 401`, r2.status === 401);
    const r3 = await call(fn, { method, body: body || undefined, query, token: userToken });
    check(`${fn}: 일반 로그인 사용자 → 403`, r3.status === 403);
  }
  // 2) 쿼리 secret 및 헤더 secret 은 인증 수단이 아니다
  for (const [fn, method, body, query] of ENDPOINTS) {
    const q = Object.assign({}, query || {}, { secret: "any-secret-value" });
    const r = await call(fn, { method, body: body || undefined, query: q, headers: { "x-admin-secret": "any-secret-value" } });
    check(`${fn}: ?secret= / x-admin-secret → 401`, r.status === 401);
  }
  if (EXPECT_LEGACY_REJECTED && LEGACY) {
    for (const [fn, method, body, query] of ENDPOINTS) {
      const q = Object.assign({}, query || {}, { secret: LEGACY });
      const r = await call(fn, { method, body: body || undefined, query: q, headers: { "x-admin-secret": LEGACY } });
      check(`${fn}: 올바른 과거 secret 도 거부 → 401`, r.status === 401);
    }
  }
  // 3) 잘못된 method → 405 (admin 토큰이 있어도)
  check("sendPushNotification GET → 405", (await call("sendPushNotification", { method: "GET", token: adminToken })).status === 405);
  check("getTaxConsultLeads POST → 405", (await call("getTaxConsultLeads", { method: "POST", token: adminToken, body: {} })).status === 405);
  check("deleteCalendarEvent POST → 405", (await call("deleteCalendarEvent", { method: "POST", token: adminToken, body: { id: "a" } })).status === 405);
  check("syncFinancialCalendarManual GET → 405", (await call("syncFinancialCalendarManual", { method: "GET", token: adminToken })).status === 405);

  // 4) admin 정상 동작
  const ev = await call("upsertCalendarEvent", { method: "POST", token: adminToken, body: { date: "2026-10-18", category: "tax", title: "<img src=x onerror=alert(1)>", link: "https://example.com/x" } });
  check("upsert POST (admin) → 200 + id", ev.status === 200 && ev.data && ev.data.id);
  const id = ev.data && ev.data.id;
  check("upsert POST 에 id 포함 → 400", (await call("upsertCalendarEvent", { method: "POST", token: adminToken, body: { id: "x", date: "2026-10-18", category: "tax", title: "t" } })).status === 400);
  check("upsert 잘못된 link(javascript:) → 400", (await call("upsertCalendarEvent", { method: "POST", token: adminToken, body: { date: "2026-10-18", category: "tax", title: "t", link: "javascript:alert(1)" } })).status === 400);
  check("upsert PUT (admin) → 200", (await call("upsertCalendarEvent", { method: "PUT", token: adminToken, body: { id, date: "2026-10-19", category: "tax", title: "수정됨" } })).status === 200);
  check("upsert PUT id 경로 주입 → 400", (await call("upsertCalendarEvent", { method: "PUT", token: adminToken, body: { id: "a/b", date: "2026-10-19", category: "tax", title: "x" } })).status === 400);
  const list = await call("adminData", { token: adminToken, query: { kind: "calendar" } });
  check("adminData calendar (admin) → 200 + 항목", list.status === 200 && Array.isArray(list.data.items) && list.data.items.some((i) => i.id === id));
  check("adminData 잘못된 kind → 400", (await call("adminData", { token: adminToken, query: { kind: "../x" } })).status === 400);
  for (const kind of ["needsReview", "syncLogs", "indicators"]) check(`adminData ${kind} → 200`, (await call("adminData", { token: adminToken, query: { kind } })).status === 200);
  check("getTaxConsultLeads (admin) → 200", (await call("getTaxConsultLeads", { token: adminToken })).status === 200);
  check("moderateLounge list (admin) → 200", (await call("moderateLounge", { method: "POST", token: adminToken, body: { action: "list" } })).status === 200);
  check("sendPush 입력 길이 초과 → 400", (await call("sendPushNotification", { method: "POST", token: adminToken, body: { title: "x".repeat(61), body: "b" } })).status === 400);
  check("sendPush (admin, 예약) → 200", (await call("sendPushNotification", { method: "POST", token: adminToken, body: { title: "예약", body: "내용", scheduledFor: new Date(Date.now() + 86400000).toISOString() } })).status === 200);
  check("delete (admin) → 200", (await call("deleteCalendarEvent", { method: "DELETE", token: adminToken, query: { id } })).status === 200);
  check("delete 잘못된 id → 400", (await call("deleteCalendarEvent", { method: "DELETE", token: adminToken, query: { id: "a/b" } })).status === 400);

  // 5) 허용되지 않은 Origin
  check("허용되지 않은 Origin → 403", (await call("adminData", { token: adminToken, query: { kind: "calendar" }, headers: { Origin: "https://evil.example.com" } })).status === 403);
  check("허용된 Origin(www) → 200", (await call("adminData", { token: adminToken, query: { kind: "calendar" }, headers: { Origin: "https://www.gofincalc.com" } })).status === 200);

  // 6) 요청 제한(429): 연속 실패
  let got429 = false;
  for (let i = 0; i < 30 && !got429; i++) { const r = await call("getTaxConsultLeads", { token: "bad" + i, ip: "10.250.250.250" }); if (r.status === 429) got429 = true; }
  check("연속 실패 → 429", got429);
  check("차단 중인 IP 의 인증 안 된 요청 → 429", (await call("getTaxConsultLeads", { token: "bad-x", ip: "10.250.250.250" })).status === 429);
  check("차단 중인 IP 의 일반 사용자 → 429", (await call("getTaxConsultLeads", { token: userToken, ip: "10.250.250.250" })).status === 429);
  check("차단 중인 IP 라도 유효한 관리자는 통과", (await call("getTaxConsultLeads", { token: adminToken, ip: "10.250.250.250" })).status === 200);

  const failed = results.filter((r) => !r[1]);
  console.log(`\n총 ${results.length}건, 실패 ${failed.length}건`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error("E2E 오류:", e.message); process.exit(2); });
