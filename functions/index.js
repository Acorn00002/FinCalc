const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ---------- /api/news ----------
// 구글 뉴스 "경제(Business)" 카테고리 RSS — topic ID는 opaque 값이라 임의로 만들 수 없으므로
// 실제 요청이 200/XML로 응답하는 것을 확인한 ID만 사용한다.
const GOOGLE_NEWS_RSS_URL =
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko";

// 홈 화면(index.html)이 /api/news로 호출하면 Firebase Hosting rewrite를 통해 이 함수로 들어온다.
// 서버 대 서버로 구글 뉴스를 대신 가져오기 때문에 브라우저 쪽 CORS 문제가 발생하지 않는다.
exports.newsProxy = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  try {
    const upstream = await fetch(GOOGLE_NEWS_RSS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AssetPilotNewsProxy/1.0)" }
    });

    if (!upstream.ok) {
      res.status(502).send("뉴스 응답 오류: " + upstream.status);
      return;
    }

    const xml = await upstream.text();
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
    res.status(200).send(xml);
  } catch (error) {
    console.error("newsProxy 실패:", error);
    res.status(502).send("실시간 뉴스를 불러오지 못했습니다.");
  }
});

// ---------- /api/ai ----------
// AI 1회 호출 비용(포인트) — 프론트엔드 안내 문구용 상수(index.html의 AI_CALL_COST)와 반드시 같은 값으로 맞출 것.
const AI_CALL_COST = 50;
// 2026-07 기준 gemini-1.5-flash는 완전히 셧다운되어 요청 시 항상 404를 반환한다(구글 공식 지원 종료).
// 현재 시점 최저비용 flash-lite 라인업 중 신규 모델(gemini-3.1-flash-lite)로 대체 —
// 2.5-flash-lite는 2026-10-16 종료 예정이라 곧 재교체가 필요했을 것이라 더 최근 모델을 선택함.
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_PROMPT_LENGTH = 4000;

class InsufficientPointsError extends Error {
  constructor(currentPoints) {
    super("포인트가 부족합니다.");
    this.currentPoints = currentPoints;
  }
}

function todayYMD() {
  const d = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

const GEMINI_SYSTEM_INSTRUCTION =
  "당신은 '자산파일럿'의 전문적이고 신뢰감 있는 AI 금융 서포터입니다. " +
  "이모티콘 사용을 엄격히 제한하세요 — 문단 시작이나 문장 끝마다 이모티콘을 붙이지 말고, " +
  "전체 답변에서 강조가 꼭 필요한 예외적인 경우에만 최대 1~2개까지만 사용하세요. " +
  "대신 마크다운 문법(제목, 굵은 글씨, 불렛포인트, 표 등)을 적극 활용해 " +
  "이모티콘 없이도 정돈되고 가독성 높은 전문적인 답변을 만드세요.";

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + apiKey;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] },
      // 구글 검색 그라운딩 — 모델 학습 시점 이후의 최신 시사/정치/경제 정보를 반영해 답변하도록 함
      tools: [{ google_search: {} }],
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Gemini API 오류: " + response.status + " " + errText);
  }

  const data = await response.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts
    : null;
  const text = parts && parts[0] ? parts[0].text : "";
  if (!text) throw new Error("Gemini 응답에 텍스트가 없습니다.");
  return text;
}

// 홈 화면 등에서 로그인한 사용자가 AI 기능을 요청할 때 호출하는 엔드포인트.
// 포인트 조회/차감은 반드시 이 서버 쪽에서만 수행하고, 프론트엔드는 결과만 받는다.
exports.aiAsk = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }

  const prompt = req.body && typeof req.body.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "prompt가 필요합니다." });
    return;
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: "요청이 너무 깁니다. " + MAX_PROMPT_LENGTH + "자 이내로 입력해주세요." });
    return;
  }

  // 1. Authorization 헤더의 Firebase ID 토큰을 검증해 uid를 서버에서 직접 확보한다 (클라이언트가 보낸 uid는 신뢰하지 않음)
  const authHeader = req.get("Authorization") || "";
  const idToken = authHeader.indexOf("Bearer ") === 0 ? authHeader.slice(7) : "";
  if (!idToken) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return;
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (error) {
    res.status(401).json({ error: "인증 정보가 유효하지 않습니다." });
    return;
  }

  // TODO: 개발 완료 후 포인트 차감 로직 재활성화 — 지금은 개발 단계라 아래 플래그로
  // 포인트 조회/차감/부족 가드를 통째로 우회한다. 정식 출시 전 반드시 false로 되돌릴 것.
  const DEV_BYPASS_POINT_CHECK = true;

  // 2. 포인트 조회 + 차감을 하나의 Firestore 트랜잭션으로 원자 처리.
  //    포인트가 부족하면 여기서 즉시 중단되고, Gemini API는 호출조차 되지 않는다(불필요한 비용 방지).
  const userRef = db.collection("users").doc(uid);
  let remainingPoints = null;

  if (!DEV_BYPASS_POINT_CHECK) {
    try {
      remainingPoints = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists ? snap.data() : null;
        const current = data && typeof data.totalPoints === "number" ? data.totalPoints : 0;
        if (current < AI_CALL_COST) {
          throw new InsufficientPointsError(current);
        }
        const next = current - AI_CALL_COST;
        const historyEntry = { date: todayYMD(), reason: "AI 어시스턴트 호출", amount: -AI_CALL_COST };
        tx.update(userRef, {
          totalPoints: next,
          pointHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });
        return next;
      });
    } catch (error) {
      if (error instanceof InsufficientPointsError) {
        res.status(402).json({
          error: "포인트가 부족합니다.",
          requiredPoints: AI_CALL_COST,
          currentPoints: error.currentPoints
        });
        return;
      }
      console.error("포인트 차감 트랜잭션 실패:", error);
      res.status(500).json({ error: "포인트 처리 중 오류가 발생했습니다." });
      return;
    }
  }

  // 3. 포인트 차감에 성공한 뒤에만 Gemini를 호출한다. Gemini 호출이 실패하면 방금 차감한 포인트를 그대로 환불한다.
  //    (Firestore 트랜잭션 안에서 외부 API를 직접 호출하지 않는 이유: 트랜잭션은 경합 시 재시도될 수 있어
  //    그 안에서 외부 호출을 하면 같은 요청이 중복 실행될 위험이 있다 — 그래서 "차감 → 호출 → 실패 시 환불" 순서로 분리했다.)
  try {
    const reply = await callGemini(prompt);
    res.status(200).json({ reply: reply, remainingPoints: remainingPoints });
  } catch (error) {
    console.error("Gemini 호출 실패, 포인트 환불 처리:", error);
    // TODO: 개발 완료 후 포인트 차감 로직 재활성화 — DEV_BYPASS_POINT_CHECK가 꺼지면 이 환불도 다시 의미를 갖는다
    if (!DEV_BYPASS_POINT_CHECK) {
      try {
        const refundEntry = { date: todayYMD(), reason: "AI 호출 실패 환불", amount: AI_CALL_COST };
        await userRef.update({
          totalPoints: admin.firestore.FieldValue.increment(AI_CALL_COST),
          pointHistory: admin.firestore.FieldValue.arrayUnion(refundEntry)
        });
      } catch (refundError) {
        console.error("포인트 환불 실패 — 수동 확인 필요:", uid, refundError);
      }
    }
    res.status(502).json({ error: "AI 응답 생성에 실패했습니다. 포인트는 차감되지 않았습니다." });
  }
});
