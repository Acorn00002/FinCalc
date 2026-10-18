#!/usr/bin/env node
"use strict";
// 로컬 전용: Firebase 계정에 관리자 custom claim(admin:true)을 부여/회수/조회한다.
// - 서비스 계정 키나 UID를 코드에 넣지 않는다. 자격 증명은 환경에서 가져온다:
//     GOOGLE_APPLICATION_CREDENTIALS=<서비스계정 JSON 경로>  또는  gcloud auth application-default login
//   (Auth 에뮬레이터를 쓰려면 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 와 GCLOUD_PROJECT 를 지정)
// - UID는 반드시 사람이 확인한 값을 --uid 로 직접 넘긴다. 이메일 조회(lookup)는 마스킹된 UID만 출력한다.
// 사용:
//   node scripts/admin-claim.js lookup --email you@example.com
//   node scripts/admin-claim.js grant  --uid <UID> --yes
//   node scripts/admin-claim.js revoke --uid <UID> --yes
//   node scripts/admin-claim.js list
const admin = require("firebase-admin");

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) out[k] = true; else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}
function mask(uid) {
  return uid.length <= 8 ? uid[0] + "***" : uid.slice(0, 4) + "…" + uid.slice(-3);
}
function maskEmail(e) {
  if (!e) return "(이메일 없음)";
  const [u, d] = e.split("@");
  return u.slice(0, 2) + "***@" + d;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || "asset-filot" });
  const auth = admin.auth();

  if (cmd === "lookup") {
    if (typeof args.email !== "string") throw new Error("--email 이 필요합니다.");
    const u = await auth.getUserByEmail(args.email);
    console.log(JSON.stringify({ uid: mask(u.uid), email: maskEmail(u.email), admin: u.customClaims && u.customClaims.admin === true, providers: u.providerData.map((p) => p.providerId) }));
    console.log("전체 UID는 Firebase 콘솔 > Authentication > 사용자 목록에서 직접 확인해 --uid 로 전달하세요.");
    return;
  }
  if (cmd === "list") {
    let token; let n = 0;
    do {
      const page = await auth.listUsers(1000, token);
      page.users.forEach((u) => { if (u.customClaims && u.customClaims.admin === true) { n++; console.log(mask(u.uid), maskEmail(u.email)); } });
      token = page.pageToken;
    } while (token);
    console.log("admin claim 보유 계정:", n);
    return;
  }
  if (cmd === "grant" || cmd === "revoke") {
    if (typeof args.uid !== "string" || !args.uid) throw new Error("--uid <UID> 가 필요합니다.");
    const u = await auth.getUser(args.uid);
    console.log("대상:", mask(u.uid), maskEmail(u.email), "(현재 admin:", !!(u.customClaims && u.customClaims.admin) + ")");
    if (args.yes !== true) { console.log("실행하려면 --yes 를 붙이세요. (변경 없음)"); return; }
    const claims = Object.assign({}, u.customClaims || {});
    if (cmd === "grant") claims.admin = true; else delete claims.admin;
    await auth.setCustomUserClaims(u.uid, Object.keys(claims).length ? claims : null);
    if (cmd === "revoke") await auth.revokeRefreshTokens(u.uid); // 이미 발급된 토큰도 무효화
    console.log(cmd === "grant" ? "부여 완료. 해당 계정은 /admin/ 에서 로그아웃 후 다시 로그인해야 토큰에 반영됩니다." : "회수 완료(기존 세션 무효화).");
    return;
  }
  throw new Error("명령: lookup | grant | revoke | list");
}

main().then(() => process.exit(0)).catch((e) => { console.error("오류:", e.message); process.exit(1); });
