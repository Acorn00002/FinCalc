// Firestore 에뮬레이터가 필요하다: npx firebase emulators:exec --only firestore "node --test test/loungeModeration.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const admin = require("firebase-admin");
const { moderate } = require("../helpers/loungeModeration");

admin.initializeApp({ projectId: "demo-lounge-test" });
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function reset() {
  for (const col of ["posts", "comments", "bannedUsers", "moderationLogs"]) {
    const snap = await db.collection(col).get();
    await Promise.all(snap.docs.map((d) => d.ref.delete()));
  }
}

test("list: 신고된 글·댓글만 신고 많은 순으로", async () => {
  await reset();
  await db.collection("posts").doc("p1").set({ uid: "u1", title: "t1", content: "c1", reportCount: 3, blinded: false });
  await db.collection("posts").doc("p2").set({ uid: "u2", title: "t2", content: "c2", reportCount: 0 });
  await db.collection("comments").doc("c1").set({ uid: "u3", postId: "p1", content: "cc", reportCount: 5, blinded: true });
  const out = await moderate(db, FieldValue, { action: "list" });
  assert.equal(out.status, 200);
  assert.deepEqual(out.json.items.map((i) => i.id), ["c1", "p1"]);
  assert.equal(out.json.items[0].blinded, true);
});

test("delete post: 글과 딸린 댓글이 함께 삭제되고 로그가 남는다", async () => {
  await reset();
  await db.collection("posts").doc("p1").set({ uid: "u1", title: "t", content: "c", commentsCount: 2 });
  await db.collection("comments").doc("c1").set({ uid: "u2", postId: "p1", content: "a" });
  await db.collection("comments").doc("c2").set({ uid: "u3", postId: "p1", content: "b" });
  await db.collection("comments").doc("other").set({ uid: "u3", postId: "p9", content: "keep" });
  const out = await moderate(db, FieldValue, { action: "delete", type: "post", id: "p1", reason: "spam" });
  assert.equal(out.status, 200);
  assert.equal(out.json.deletedComments, 2);
  assert.equal((await db.collection("posts").doc("p1").get()).exists, false);
  assert.equal((await db.collection("comments").doc("c1").get()).exists, false);
  assert.equal((await db.collection("comments").doc("other").get()).exists, true);
  const logs = await db.collection("moderationLogs").get();
  assert.equal(logs.size, 1);
  assert.equal(logs.docs[0].data().action, "delete");
});

test("delete comment: 원글 commentsCount 감소", async () => {
  await reset();
  await db.collection("posts").doc("p1").set({ uid: "u1", commentsCount: 2 });
  await db.collection("comments").doc("c1").set({ uid: "u2", postId: "p1", content: "a" });
  const out = await moderate(db, FieldValue, { action: "delete", type: "comment", id: "c1" });
  assert.equal(out.status, 200);
  assert.equal((await db.collection("posts").doc("p1").get()).data().commentsCount, 1);
});

test("dismiss: 신고·블라인드 초기화", async () => {
  await reset();
  await db.collection("posts").doc("p1").set({ uid: "u1", reportCount: 5, reportedBy: ["a", "b"], blinded: true });
  const out = await moderate(db, FieldValue, { action: "dismiss", type: "post", id: "p1" });
  assert.equal(out.status, 200);
  const d = (await db.collection("posts").doc("p1").get()).data();
  assert.deepEqual([d.reportCount, d.reportedBy, d.blinded], [0, [], false]);
});

test("ban / unban: bannedUsers 문서 생성·삭제, deleteContent 옵션", async () => {
  await reset();
  await db.collection("posts").doc("p1").set({ uid: "bad", title: "x" });
  await db.collection("posts").doc("p2").set({ uid: "good", title: "y" });
  await db.collection("comments").doc("c1").set({ uid: "bad", postId: "p2", content: "z" });
  const out = await moderate(db, FieldValue, { action: "ban", uid: "bad", reason: "광고", deleteContent: true });
  assert.equal(out.status, 200);
  assert.deepEqual([out.json.deletedPosts, out.json.deletedComments], [1, 1]);
  assert.equal((await db.collection("bannedUsers").doc("bad").get()).exists, true);
  assert.equal((await db.collection("posts").doc("p2").get()).exists, true);
  const un = await moderate(db, FieldValue, { action: "unban", uid: "bad" });
  assert.equal(un.status, 200);
  assert.equal((await db.collection("bannedUsers").doc("bad").get()).exists, false);
});

test("입력 검증: 잘못된 action·type·id는 400/404, 경로 주입 차단", async () => {
  await reset();
  assert.equal((await moderate(db, FieldValue, { action: "nuke" })).status, 400);
  assert.equal((await moderate(db, FieldValue, { action: "delete", type: "user", id: "x" })).status, 400);
  assert.equal((await moderate(db, FieldValue, { action: "delete", type: "post", id: "../users/abc" })).status, 400);
  assert.equal((await moderate(db, FieldValue, { action: "delete", type: "post", id: "missing" })).status, 404);
  assert.equal((await moderate(db, FieldValue, { action: "ban", uid: "a/b" })).status, 400);
  assert.equal((await moderate(db, FieldValue, null)).status, 400);
  assert.equal((await db.collection("moderationLogs").get()).size, 0);
});
