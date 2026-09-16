// Vercel 서버리스 함수 — /api/ask-ai
// Firebase Functions(functions/index.js)의 aiAsk와 동일한 모델·시스템 프롬프트를 써서,
// asset-filot.web.app(Firebase)과 Vercel 배포 중 어느 쪽으로 접속해도 AI 응답이 일관되게 만든다.
// 새 SDK 의존성(@google/generative-ai 등)을 추가하지 않고, Firebase 쪽에서 이미 검증된
// raw fetch 방식을 그대로 포팅했다 — 의존성이 없어야 두 배포본이 어긋날 여지가 줄어든다.
// (참고: @google/generative-ai는 구글이 이미 폐기(deprecated)한 SDK라 신규로 추가하지 않았다.
//  현재 권장 SDK는 @google/genai지만, 그마저도 안 쓰고 REST를 직접 호출하는 쪽을 택했다.)
//
// 응답 형식은 index.html의 requestAiAssist()가 그대로 기대하는 { reply, remainingPoints }를 따른다
// (Vercel 예시 코드에 흔한 { answer } 형태가 아님 — 프론트가 reply 필드를 읽기 때문).
//
// 보안: 예전엔 이 엔드포인트에 로그인 검증이 전혀 없어서, 로그인하지 않은 누구나(브라우저 없이도)
// 이 URL에 직접 요청을 보내 무제한으로 Gemini API를 호출할 수 있었다 — 실제 서비스 도메인
// (gofincalc.com)이 이 함수로 서빙되기 때문에 봇이 이 엔드포인트를 긁어가면 그대로 과금으로
// 이어진다. Firebase Functions 쪽(functions/index.js의 aiAsk)은 이미 Admin SDK로 ID 토큰을
// 검증하고 있었는데, Vercel엔 서비스 계정 credential이 없어 Admin SDK를 못 썼던 게 원인이었다 —
// 대신 verifyFirebaseIdToken.js가 구글 공개 JWKS로 서명만 검증해서 서비스 계정 없이도 동일한
// 신뢰 수준(로그인된 진짜 Firebase 사용자)을 확인한다.
import { verifyFirebaseIdToken } from "./_lib/verifyFirebaseIdToken.js";

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_PROMPT_LENGTH = 4000;

// 서버리스 인스턴스가 재사용되는 동안만 유지되는 최소한의 사용자별 속도 제한(콜드 스타트 시 초기화됨 —
// 완벽한 방어는 아니지만, 로그인 요구와 합쳐 악성 스크립트가 한 계정으로 반복 호출하는 걸 늦춘다).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 8;
const recentCallsByUid = new Map();

function isRateLimited(uid) {
  const now = Date.now();
  const calls = (recentCallsByUid.get(uid) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (calls.length >= RATE_LIMIT_MAX_CALLS) {
    recentCallsByUid.set(uid, calls);
    return true;
  }
  calls.push(now);
  recentCallsByUid.set(uid, calls);
  return false;
}

const GEMINI_SYSTEM_INSTRUCTION =
  "당신은 '자산파일럿'의 전문적이고 신뢰감 있는 AI 금융 서포터입니다. " +
  "이모티콘 사용을 엄격히 제한하세요 — 문단 시작이나 문장 끝마다 이모티콘을 붙이지 말고, " +
  "전체 답변에서 강조가 꼭 필요한 예외적인 경우에만 최대 1~2개까지만 사용하세요. " +
  "대신 마크다운 문법(제목, 굵은 글씨, 불렛포인트, 표 등)을 적극 활용해 " +
  "이모티콘 없이도 정돈되고 가독성 높은 전문적인 답변을 만드세요. " +
  "사용자가 보유 종목과 비중(예: '삼성전자: 40%')을 알려주며 포트폴리오 분석을 요청하면, " +
  "반드시 다음 3개의 마크다운 ## 섹션으로만 구성해 답변하고 그 외의 섹션은 추가하지 마세요 " +
  "(제목 문구와 순서를 정확히 그대로 쓰세요): " +
  "'## 📊 포트폴리오 진단 요약'(자산 배분과 전반적인 상태를 2~3문장으로 요약), " +
  "'## ⚠️ 리스크 및 취약점'(종목·자산군 쏠림, 변동성 등 구체적 위험 요인을 불렛포인트로), " +
  "'## 💡 개선 제안'(실행 가능한 조정 방향을 불렛포인트로). " +
  "포트폴리오 분석 요청이 아닌 질문(시장 브리핑, 뉴스 요약, 절세 팁 등)에는 이 3단계 형식을 쓰지 말고 평소처럼 자유롭게 답변하세요.";

// 자산 현황(마이페이지) 업데이트 제안 — 실제 저장은 절대 여기서 하지 않는다. Gemini가 이 함수를
// "호출"하면 그건 그냥 { cash, stock, realestate } 제안값일 뿐이고, 사용자가 화면에서 확인 버튼을
// 눌러야만 Firestore에 써진다(기존 마이페이지 저장 로직 그대로 재사용).
const PROPOSE_ASSET_UPDATE_FUNCTION = {
  name: "propose_asset_update",
  description:
    "사용자가 채팅에서 현금·주식·부동산 등 자산이 얼마로 바뀌었다고 말하면 호출해서 새 절대 금액을 제안한다. " +
    "값이 바뀐 항목만 포함하고 언급되지 않은 항목은 절대 넣지 마라. " +
    "'늘었다/줄었다'처럼 상대적으로 말한 경우, 함께 전달된 현재 자산 현황을 기준으로 새 절대값을 계산해서 넣어라.",
  parameters: {
    type: "object",
    properties: {
      cash: { type: "number", description: "새 현금성 자산 절대 금액(원). 변경 없으면 생략." },
      stock: { type: "number", description: "새 주식·투자 자산 절대 금액(원). 변경 없으면 생략." },
      realestate: { type: "number", description: "새 부동산 자산 절대 금액(원). 변경 없으면 생략." },
      summary: { type: "string", description: "사용자에게 보여줄 한 줄 확인 문구. 예: '현금을 500만원 → 800만원으로 변경할까요?'" }
    }
  }
};

// 자산 언급 + 변경 표현이 같이 있어 보이면 이번 요청만 검색 그라운딩 대신 함수 호출 전용으로 처리한다.
// (2026-09 기준 google_search 내장 도구와 커스텀 functionDeclarations를 같은 요청에 안정적으로
// 섞어 쓰는 건 Gemini 3 프리뷰 기능이라 별도 응답 형식이 필요해서, 지금은 둘을 요청 단위로 분리한다.)
// 오탐이어도 안전하다 — mode:"AUTO"라 Gemini가 자산 변경 의도가 아니라고 판단하면 그냥 평소처럼 텍스트로 답한다.
const ASSET_SUBJECT_WORDS = ["자산", "현금", "예금", "적금", "주식", "부동산", "잔고", "보유액", "재산"];
const ASSET_ACTION_WORDS = ["저장", "업데이트", "반영", "기록", "바꿔", "바뀌", "변경", "늘었", "줄었", "늘어", "줄어", "됐어", "채워", "입력"];
function looksLikeAssetUpdateRequest(prompt) {
  const hasSubject = ASSET_SUBJECT_WORDS.some((w) => prompt.includes(w));
  const hasAction = ASSET_ACTION_WORDS.some((w) => prompt.includes(w));
  return hasSubject && hasAction;
}

async function callGemini(prompt, currentAssets) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const useAssetTool = looksLikeAssetUpdateRequest(prompt);
  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + apiKey;

  let promptText = prompt;
  const body = { systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] } };

  if (useAssetTool) {
    if (currentAssets) {
      promptText += "\n\n(참고: 사용자의 현재 자산 현황 — 현금 " + (currentAssets.cash || 0) + "원, " +
        "주식 " + (currentAssets.stock || 0) + "원, 부동산 " + (currentAssets.realestate || 0) + "원)";
    }
    body.tools = [{ functionDeclarations: [PROPOSE_ASSET_UPDATE_FUNCTION] }];
    body.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  } else {
    body.tools = [{ google_search: {} }];
  }
  body.contents = [{ parts: [{ text: promptText }] }];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Gemini API 오류: " + response.status + " " + errText);
  }

  const data = await response.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts
    : null;
  if (!parts) throw new Error("Gemini 응답에 콘텐츠가 없습니다.");

  const functionCallPart = parts.find((p) => p.functionCall && p.functionCall.name === "propose_asset_update");
  if (functionCallPart) {
    const args = functionCallPart.functionCall.args || {};
    const proposal = {};
    if (typeof args.cash === "number") proposal.cash = Math.max(0, Math.round(args.cash));
    if (typeof args.stock === "number") proposal.stock = Math.max(0, Math.round(args.stock));
    if (typeof args.realestate === "number") proposal.realestate = Math.max(0, Math.round(args.realestate));
    const summaryText = typeof args.summary === "string" && args.summary
      ? args.summary
      : "자산 현황 변경을 제안했어요. 아래에서 확인해주세요.";
    return { text: summaryText, assetUpdateProposal: Object.keys(proposal).length ? proposal : null };
  }

  const textPart = parts.find((p) => typeof p.text === "string" && p.text);
  if (!textPart) throw new Error("Gemini 응답에 텍스트가 없습니다.");
  return { text: textPart.text, assetUpdateProposal: null };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  let prompt = "";
  let currentAssets = null;
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    prompt = String(body.prompt || body.message || "").trim();
    // 자산 업데이트 제안 계산에만 쓰는 참고값이라(Firestore에 직접 쓰지 않음) 숫자만 뽑아 신뢰 범위를 좁힌다.
    if (body.currentAssets && typeof body.currentAssets === "object") {
      const ca = body.currentAssets;
      currentAssets = {
        cash: typeof ca.cash === "number" ? ca.cash : 0,
        stock: typeof ca.stock === "number" ? ca.stock : 0,
        realestate: typeof ca.realestate === "number" ? ca.realestate : 0
      };
    }
  } else if (req.method === "GET") {
    const query = req.query || {};
    prompt = String(query.prompt || query.message || "").trim();
  } else {
    return res.status(405).json({ error: "GET, POST, OPTIONS 요청만 지원합니다." });
  }

  if (!prompt) {
    return res.status(400).json({ error: "prompt가 필요합니다." });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: "요청이 너무 깁니다. " + MAX_PROMPT_LENGTH + "자 이내로 입력해주세요." });
  }

  // 로그인 검증 — index.html/모바일 앱 둘 다 이미 Authorization: Bearer <Firebase idToken>을
  // 실어 보내고 있었는데(요청은 하면서) 서버가 그동안 확인을 안 하고 있었다. Firebase Functions
  // 쪽(functions/index.js의 aiAsk)과 동일한 기준으로 여기서도 반드시 검증한다.
  const authHeader = req.headers.authorization || req.headers.Authorization || "";
  const idToken = authHeader.indexOf("Bearer ") === 0 ? authHeader.slice(7) : "";
  if (!idToken) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }

  let uid;
  try {
    uid = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    console.error("ID 토큰 검증 실패:", error.message);
    return res.status(401).json({ error: "인증 정보가 유효하지 않습니다." });
  }

  if (isRateLimited(uid)) {
    return res.status(429).json({ error: "요청이 너무 잦아요. 잠시 후 다시 시도해주세요." });
  }

  // TODO: 개발 완료 후 포인트 차감 로직 추가 — Firebase Functions 쪽(functions/index.js)의
  // DEV_BYPASS_POINT_CHECK와 마찬가지로, 이 배포본도 지금은 포인트 체크 없이 무제한 응답한다.
  // Vercel에서 실제로 Firestore 포인트를 검증/차감하려면 Firebase 서비스 계정 키를
  // Vercel 프로젝트 환경변수에 별도로 등록하는 작업이 추가로 필요하다.
  try {
    const reply = await callGemini(prompt, currentAssets);
    return res.status(200).json({ reply: reply.text, assetUpdateProposal: reply.assetUpdateProposal, remainingPoints: null });
  } catch (error) {
    console.error("Gemini 호출 실패:", error);
    return res.status(502).json({ error: "AI 응답 생성에 실패했습니다." });
  }
}
