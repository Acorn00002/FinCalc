// 금융캘린더 기업 로고(Brandfetch Logo API)용 공개 설정 — Client ID는 Brandfetch 공식 문서에 따르면
// <img> URL에 그대로 노출되는 publishable 식별자라(비밀값 아님) 클라이언트에 내려줘도 안전하다.
// 이 값 하나만 반환하고, 다른 환경변수나 서버 비밀값(DART_API_KEY 등)은 절대 여기서 다루지 않는다.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 값 자체가 바뀔 일이 거의 없는 정적 공개 설정이지만, 브라우저 캐시를 너무 길게 잡으면
  // 값이 없던 시점에 한 번이라도 요청한 사용자가 환경변수를 나중에 채워도 캐시가 만료될 때까지
  // 계속 null을 보게 되는 사고로 이어질 수 있어(실제로 겪음) 브라우저는 10분으로만 캐싱한다.
  // 반복 호출 방지는 CDN 엣지 캐시(1일)가 대신 맡는다.
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800");

  return res.status(200).json({
    clientId: process.env.BRANDFETCH_CLIENT_ID || null
  });
}
