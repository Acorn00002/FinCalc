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

const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_PROMPT_LENGTH = 4000;

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

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + apiKey;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] },
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  let prompt = "";
  if (req.method === "POST") {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    prompt = String(body.prompt || body.message || "").trim();
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

  // TODO: 개발 완료 후 포인트 차감 로직 추가 — Firebase Functions 쪽(functions/index.js)의
  // DEV_BYPASS_POINT_CHECK와 마찬가지로, 이 배포본도 지금은 포인트 체크 없이 무제한 응답한다.
  // Vercel에서 실제로 Firestore 포인트를 검증/차감하려면 Firebase 서비스 계정 키를
  // Vercel 프로젝트 환경변수에 별도로 등록하는 작업이 추가로 필요하다.
  try {
    const reply = await callGemini(prompt);
    return res.status(200).json({ reply: reply, remainingPoints: null });
  } catch (error) {
    console.error("Gemini 호출 실패:", error);
    return res.status(502).json({ error: "AI 응답 생성에 실패했습니다." });
  }
}
