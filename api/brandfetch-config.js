// 금융캘린더 기업 로고(Brandfetch Logo API)용 공개 설정 — Client ID는 Brandfetch 공식 문서에 따르면
// <img> URL에 그대로 노출되는 publishable 식별자라(비밀값 아님) 클라이언트에 내려줘도 안전하다.
// 이 값 하나만 반환하고, 다른 환경변수나 서버 비밀값(DART_API_KEY 등)은 절대 여기서 다루지 않는다.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 값 자체가 바뀔 일이 거의 없는 정적 공개 설정이라 캐시를 길게 잡아, 페이지를 열 때마다
  // 이 함수가 반복 호출되지 않게 한다(브라우저 1일, CDN 엣지 7일, 이후 30일은 stale-while-revalidate).
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000");

  return res.status(200).json({
    clientId: process.env.BRANDFETCH_CLIENT_ID || null
  });
}
