// Vercel 서버리스 함수 — /api/news
// Firebase Functions(functions/index.js)의 newsProxy와 동일한 RSS 소스를 그대로 프록시한다.
// index.html의 fetchNewsXml()이 순수 XML 텍스트를 그대로 기대하므로 응답 형식을 맞춘다.

const GOOGLE_NEWS_RSS_URL =
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const upstream = await fetch(GOOGLE_NEWS_RSS_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AssetPilotNewsProxy/1.0)" }
    });

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
