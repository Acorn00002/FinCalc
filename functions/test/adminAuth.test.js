"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createAdminGuard, isAllowedOrigin, ADMIN_CORS } = require("../helpers/adminAuth");

const GOOD_TOKEN = "good.token.value-ABC123";
const USER_TOKEN = "user.token.value-XYZ789";
const OLD_SECRET = "legacy-shared-secret-DO-NOT-LEAK";

function makeEnv(extra) {
  const logs = [];
  const logger = { info: (m, d) => logs.push([m, d]), warn: (m, d) => logs.push([m, d]) };
  const verifyIdToken = async (t) => {
    if (t === GOOD_TOKEN) return { uid: "admin-uid-1", admin: true };
    if (t === USER_TOKEN) return { uid: "user-uid-2" };
    throw new Error("auth/argument-error: invalid " + t);
  };
  const clock = { t: 1000000 };
  const guard = createAdminGuard(Object.assign({ verifyIdToken, logger, now: () => clock.t }, extra || {}));
  return { logs, guard, clock };
}
function mockReq(o) {
  o = o || {};
  const headers = Object.assign({}, o.headers || {});
  return { method: o.method || "POST", headers, query: o.query || {}, body: o.body, ip: o.ip || "1.2.3.4", get: (k) => headers[k.toLowerCase()] };
}
function mockRes() {
  const r = { statusCode: null, body: null, headers: {} };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.set = (k, v) => { r.headers[k] = v; return r; };
  return r;
}
const CFG = { endpoint: "sendPushNotification", methods: ["POST"] };

test("토큰 없음 → 401", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  assert.equal(await guard(mockReq(), res, CFG), null);
  assert.equal(res.statusCode, 401);
});
test("Bearer 형식이 아닌 헤더 → 401", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  await guard(mockReq({ headers: { authorization: "Basic abc" } }), res, CFG);
  assert.equal(res.statusCode, 401);
});
test("위조·만료·잘못된 토큰 → 401", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  await guard(mockReq({ headers: { authorization: "Bearer forged.jwt.token" } }), res, CFG);
  assert.equal(res.statusCode, 401);
  assert.ok(!JSON.stringify(res.body).includes("forged"));
});
test("일반 로그인 사용자(admin claim 없음) → 403", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  assert.equal(await guard(mockReq({ headers: { authorization: "Bearer " + USER_TOKEN } }), res, CFG), null);
  assert.equal(res.statusCode, 403);
});
test("admin:true 사용자 → 통과", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  const who = await guard(mockReq({ headers: { authorization: "Bearer " + GOOD_TOKEN } }), res, CFG);
  assert.deepEqual(who, { uid: "admin-uid-1" });
  assert.equal(res.statusCode, null);
});
test("admin claim이 true가 아닌 값(문자열 'true', 1)은 거부", async () => {
  for (const v of ["true", 1, "admin"]) {
    const g = createAdminGuard({ verifyIdToken: async () => ({ uid: "u", admin: v }), logger: { info() {}, warn() {} } });
    const res = mockRes();
    assert.equal(await g(mockReq({ headers: { authorization: "Bearer t" } }), res, CFG), null);
    assert.equal(res.statusCode, 403);
  }
});
test("잘못된 HTTP method → 405 (토큰 검증 전에 거부, Allow 헤더 포함)", async () => {
  let verified = false;
  const g = createAdminGuard({ verifyIdToken: async () => { verified = true; return { uid: "a", admin: true }; }, logger: { info() {}, warn() {} } });
  const res = mockRes();
  await g(mockReq({ method: "GET", headers: { authorization: "Bearer " + GOOD_TOKEN } }), res, CFG);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST");
  assert.equal(verified, false);
});
test("허용되지 않은 Origin → 403, 허용 Origin(정식 도메인·Preview)은 통과", async () => {
  const { guard } = makeEnv();
  let res = mockRes();
  await guard(mockReq({ headers: { origin: "https://evil.example.com", authorization: "Bearer " + GOOD_TOKEN } }), res, CFG);
  assert.equal(res.statusCode, 403);
  for (const o of ["https://www.gofincalc.com", "https://gofincalc.com", "https://fin-calc-abc123xyz-wnstjd20620-2295s-projects.vercel.app"]) {
    res = mockRes();
    const who = await guard(mockReq({ headers: { origin: o, authorization: "Bearer " + GOOD_TOKEN } }), res, CFG);
    assert.ok(who, o);
  }
  assert.equal(isAllowedOrigin("https://fin-calc-x-someoneelse-projects.vercel.app"), false);
  assert.equal(isAllowedOrigin("https://www.gofincalc.com.evil.com"), false);
  assert.ok(ADMIN_CORS.some((x) => x instanceof RegExp));
});
test("쿼리스트링 ?secret= 은 가드에서 무시된다(토큰이 없으므로 401)", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  await guard(mockReq({ query: { secret: OLD_SECRET } }), res, CFG);
  assert.equal(res.statusCode, 401);
});
test("x-admin-secret 헤더도 가드에서는 무시된다", async () => {
  const { guard } = makeEnv(); const res = mockRes();
  await guard(mockReq({ headers: { "x-admin-secret": OLD_SECRET } }), res, CFG);
  assert.equal(res.statusCode, 401);
});
test("과도한 실패 요청 → 429 (인증 안 된 요청만 차단, 유효한 관리자 토큰은 통과), 시간이 지나면 해제", async () => {
  const { guard, clock } = makeEnv({ failMax: 5, failWindowMs: 60000 });
  for (let i = 0; i < 5; i++) { const r = mockRes(); await guard(mockReq({ headers: { authorization: "Bearer bad" + i } }), r, CFG); assert.equal(r.statusCode, 401); }
  let res = mockRes();
  await guard(mockReq({ headers: { authorization: "Bearer bad-again" } }), res, CFG);
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers["Retry-After"]);
  res = mockRes();
  await guard(mockReq({ headers: { authorization: "Bearer " + USER_TOKEN } }), res, CFG);
  assert.equal(res.statusCode, 429, "차단 중인 IP 의 비관리자는 403 대신 429");
  res = mockRes();
  assert.ok(await guard(mockReq({ headers: { authorization: "Bearer " + GOOD_TOKEN } }), res, CFG), "유효한 관리자는 같은 IP 에서도 통과");
  clock.t += 61000;
  res = mockRes();
  await guard(mockReq({ headers: { authorization: "Bearer bad-later" } }), res, CFG);
  assert.equal(res.statusCode, 401, "시간이 지나면 다시 401");
});
test("X-Forwarded-For 는 마지막 값(플랫폼이 덧붙인 값)으로 제한 키를 만든다 — 앞쪽 위조 값을 바꿔도 우회되지 않음", async () => {
  const { guard } = makeEnv({ failMax: 2, failWindowMs: 60000 });
  for (let i = 0; i < 2; i++) await guard(mockReq({ headers: { authorization: "Bearer x" + i, "x-forwarded-for": "9.9.9." + i + ", 8.8.8.8" } }), mockRes(), CFG);
  const res = mockRes();
  await guard(mockReq({ headers: { authorization: "Bearer y", "x-forwarded-for": "7.7.7.7, 8.8.8.8" } }), res, CFG);
  assert.equal(res.statusCode, 429);
});
test("UID 요청 제한 초과 → 429", async () => {
  const { guard } = makeEnv({ uidMax: 3, uidWindowMs: 60000 });
  for (let i = 0; i < 3; i++) assert.ok(await guard(mockReq({ headers: { authorization: "Bearer " + GOOD_TOKEN } }), mockRes(), CFG));
  const res = mockRes();
  assert.equal(await guard(mockReq({ headers: { authorization: "Bearer " + GOOD_TOKEN } }), res, CFG), null);
  assert.equal(res.statusCode, 429);
});
test("감사 로그에는 토큰·Authorization·비밀값·원본 UID/IP·본문이 없다", async () => {
  const { guard, logs } = makeEnv();
  const body = { contact: "010-1234-5678", message: "상담 내용 PII" };
  await guard(mockReq({ headers: { authorization: "Bearer " + GOOD_TOKEN }, body, query: { secret: OLD_SECRET } }), mockRes(), CFG);
  await guard(mockReq({ headers: { authorization: "Bearer " + USER_TOKEN }, body }), mockRes(), CFG);
  await guard(mockReq({ headers: { authorization: "Bearer forged" }, body }), mockRes(), CFG);
  await guard(mockReq({ body }), mockRes(), CFG);
  const dump = JSON.stringify(logs);
  for (const bad of [GOOD_TOKEN, USER_TOKEN, "forged", "Bearer", OLD_SECRET, "admin-uid-1", "user-uid-2", "1.2.3.4", "010-1234", "PII"]) {
    assert.ok(!dump.includes(bad), "로그에 노출: " + bad);
  }
  assert.ok(logs.length >= 4);
  for (const [, d] of logs) assert.deepEqual(Object.keys(d).sort(), ["actor", "endpoint", "status", "ts"]);
  assert.match(logs[0][1].actor, /^(uid|ip):[0-9a-f]{12}$/);
});

test("과거 공유 비밀값이 서버 환경에 남아 있어도 가드는 사용하지 않는다(쿼리·헤더 모두 401)", async () => {
  process.env.SEND_PUSH_SECRET = OLD_SECRET; process.env.CALENDAR_SYNC_SECRET = OLD_SECRET;
  const { guard } = makeEnv();
  for (const req of [mockReq({ query: { secret: OLD_SECRET } }), mockReq({ headers: { "x-admin-secret": OLD_SECRET } })]) {
    const res = mockRes();
    assert.equal(await guard(req, res, CFG), null);
    assert.equal(res.statusCode, 401);
  }
  delete process.env.SEND_PUSH_SECRET; delete process.env.CALENDAR_SYNC_SECRET;
});
