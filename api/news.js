// Vercel 서버리스 함수 — /api/news
// 원래는 이 함수가 구글 뉴스 RSS를 직접 호출했으나, 구글이 Vercel 서버리스 IP 대역을 차단/제한하는지
// 상시 503을 반환해 뉴스 피드가 죽어 있었다(2026-09-06 확인). 반면 같은 로직을 쓰는 Firebase
// Cloud Functions(functions/index.js의 newsProxy, asia-northeast3)는 정상 응답하므로, 구글을
// 직접 부르지 않고 이미 동작 확인된 그 엔드포인트를 그대로 프록시한다 — 응답 형식(XML 그대로)은 동일하게 유지.
const FIREBASE_NEWS_PROXY_URL = "https://asset-filot.web.app/api/news";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const url = FIREBASE_NEWS_PROXY_URL + (category ? "?category=" + encodeURIComponent(category) : "");
    const upstream = await fetch(url);

    if (!upstream.ok) {
      return res.status(502).send("뉴스 응답 오류: " + upstream.status);
    }

    const xml = await upstream.text();
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("newsProxy 실패:", error);
    return res.status(502).send("실시간 뉴스를 불러오지 못했습니다.");
  }
}
