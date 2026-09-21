// 자산 라운지 관리자 조치 — Admin SDK로만 실행되므로 Firestore 보안규칙과 무관하게 동작한다.
// 호출 인증(관리자 비밀값 검증)은 index.js의 moderateLounge 함수가 맡고, 여기서는 입력 검증과 조치만 한다.
const POSTS = "posts";
const COMMENTS = "comments";
const BANNED = "bannedUsers";
const LOGS = "moderationLogs";
const LIST_LIMIT = 50;
const BATCH_LIMIT = 400;

function isSafeId(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value);
}

function collectionFor(type) {
  return type === "post" ? POSTS : type === "comment" ? COMMENTS : null;
}

function snippet(value, max) {
  return String(value || "").replace(/\s+/g, " ").slice(0, max);
}

async function deleteQueryInBatches(db, query) {
  let total = 0;
  for (;;) {
    const snap = await query.limit(BATCH_LIMIT).get();
    if (snap.empty) return total;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    total += snap.size;
    if (snap.size < BATCH_LIMIT) return total;
  }
}

async function listReported(db, type) {
  const types = type ? [type] : ["post", "comment"];
  const items = [];
  for (const t of types) {
    const collection = collectionFor(t);
    if (!collection) return { status: 400, json: { error: "type은 post 또는 comment여야 합니다." } };
    const snap = await db.collection(collection).where("reportCount", ">", 0).orderBy("reportCount", "desc").limit(LIST_LIMIT).get();
    snap.forEach((doc) => {
      const d = doc.data();
      items.push({
        type: t,
        id: doc.id,
        uid: d.uid || "",
        title: snippet(d.title, 80),
        content: snippet(d.content, 160),
        reportCount: d.reportCount || 0,
        blinded: d.blinded === true,
        postId: d.postId || ""
      });
    });
  }
  items.sort((a, b) => b.reportCount - a.reportCount);
  return { status: 200, json: { ok: true, items } };
}

async function deleteItem(db, FieldValue, type, id) {
  const collection = collectionFor(type);
  if (!collection || !isSafeId(id)) return { status: 400, json: { error: "type과 id가 올바르지 않습니다." } };
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { error: "대상을 찾을 수 없습니다." } };
  let deletedComments = 0;
  if (type === "post") {
    deletedComments = await deleteQueryInBatches(db, db.collection(COMMENTS).where("postId", "==", id));
  } else {
    const postId = snap.data().postId;
    if (isSafeId(postId)) {
      const postRef = db.collection(POSTS).doc(postId);
      const postSnap = await postRef.get();
      if (postSnap.exists && (postSnap.data().commentsCount || 0) > 0) {
        await postRef.update({ commentsCount: FieldValue.increment(-1) });
      }
    }
  }
  await ref.delete();
  return { status: 200, json: { ok: true, deleted: 1, deletedComments } };
}

async function dismissReports(db, type, id) {
  const collection = collectionFor(type);
  if (!collection || !isSafeId(id)) return { status: 400, json: { error: "type과 id가 올바르지 않습니다." } };
  const ref = db.collection(collection).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { status: 404, json: { error: "대상을 찾을 수 없습니다." } };
  await ref.update({ reportCount: 0, reportedBy: [], blinded: false });
  return { status: 200, json: { ok: true } };
}

async function banUser(db, FieldValue, uid, reason, deleteContent) {
  if (!isSafeId(uid)) return { status: 400, json: { error: "uid가 올바르지 않습니다." } };
  await db.collection(BANNED).doc(uid).set({ bannedAt: FieldValue.serverTimestamp(), reason: snippet(reason, 200) });
  let deletedPosts = 0;
  let deletedComments = 0;
  if (deleteContent === true) {
    deletedPosts = await deleteQueryInBatches(db, db.collection(POSTS).where("uid", "==", uid));
    deletedComments = await deleteQueryInBatches(db, db.collection(COMMENTS).where("uid", "==", uid));
  }
  return { status: 200, json: { ok: true, deletedPosts, deletedComments } };
}

async function unbanUser(db, uid) {
  if (!isSafeId(uid)) return { status: 400, json: { error: "uid가 올바르지 않습니다." } };
  await db.collection(BANNED).doc(uid).delete();
  return { status: 200, json: { ok: true } };
}

async function moderate(db, FieldValue, input) {
  const body = input && typeof input === "object" ? input : {};
  const action = body.action;
  let result;
  switch (action) {
    case "list":
      return listReported(db, body.type);
    case "delete":
      result = await deleteItem(db, FieldValue, body.type, body.id);
      break;
    case "dismiss":
      result = await dismissReports(db, body.type, body.id);
      break;
    case "ban":
      result = await banUser(db, FieldValue, body.uid, body.reason, body.deleteContent);
      break;
    case "unban":
      result = await unbanUser(db, body.uid);
      break;
    default:
      return { status: 400, json: { error: "알 수 없는 action입니다." } };
  }
  if (result.status === 200) {
    await db.collection(LOGS).add({
      action,
      type: body.type || null,
      targetId: body.id || body.uid || null,
      reason: snippet(body.reason, 200),
      at: FieldValue.serverTimestamp()
    });
  }
  return result;
}

module.exports = { moderate, isSafeId };
