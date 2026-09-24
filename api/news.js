// Vercel 서버리스 함수 — /api/news
// 원래는 이 함수가 구글 뉴스 RSS를 직접 호출했으나, 구글이 Vercel 서버리스 IP 대역을 차단/제한하는지
// 상시 503을 반환해 뉴스 피드가 죽어 있었다(2026-09-06 확인). 반면 같은 로직을 쓰는 Firebase
// Cloud Functions(functions/index.js의 newsProxy, asia-northeast3)는 정상 응답하므로, 구글을
// 직접 부르지 않고 이미 동작 확인된 그 엔드포인트를 그대로 프록시한다 — 응답 형식(XML 그대로)은 동일하게 유지.
//
// 2026-09-24 보강: 실제 구글 요청은 이 함수가 아니라 Firebase newsProxy가 한다(functions/index.js,
// asia-northeast3) — 이 함수는 그 결과를 그대로 전달하는 프록시일 뿐이다. Firebase 로그로 확인한 결과,
// 구글이 그 Firebase 함수의 아웃바운드 IP를 "상시"가 아니라 몇 시간 단위로 간헐적으로 막았다가
// 스스로 풀어주는 패턴이었다(2026-09-23 12:00~14:33 UTC 약 2.5시간 집중 실패, 그 전후로는 정상).
// Vercel 쪽 IP가 막히는 게 아니라(이 함수는 구글을 직접 호출하지 않음), 그 몇 시간짜리 창을 만난
// 사용자만 빈 뉴스 화면을 보게 되는 구조였다 — 이 파일만으로 Firebase 쪽 차단 자체를 없앨 수는
// 없지만(functions/index.js는 이번 수정 범위 밖), 직전에 성공했던 응답을 실행 컨테이너가 살아있는
// 동안 메모리에 남겨뒀다가 그 창 동안엔 그걸 대신 돌려주면 사용자에게는 빈 화면 대신 몇 분 전
// 뉴스라도 보인다. 콜드스타트 후에는 캐시가 비어있으므로 그때는 빈(그러나 유효한) RSS를 반환한다 —
// 기사 본문은 애초에 다루지 않고(제목·링크·출처만 있는 RSS 그대로 전달) 이 점은 이번에도 그대로다.
const FIREBASE_NEWS_PROXY_URL = "https://asset-filot.web.app/api/news";

// 카테고리별 마지막 성공 응답 — Vercel 함수 컨테이너가 재사용되는 동안(콜드스타트 전까지)만 유지된다.
// 영구 저장소가 아니라 "방금 전까지 잘 되던 응답을 몇 분 더 우려먹는" 용도이므로, 기사 내용을
// 저장/가공하지 않고 업스트림이 준 XML 문자열을 그대로만 들고 있는다.
const cache = new Map(); // category -> { xml, cachedAt }
const UPSTREAM_TIMEOUT_MS = 8000;
// 이 함수 응답 자체의 신선도(클라이언트/CDN 캐시)는 기존과 동일하게 5분 유지.
const CLIENT_CACHE_CONTROL = "public, max-age=300";
// 업스트림이 죽어 있을 때 대신 내어줄 캐시의 최대 허용 나이 — 너무 오래된 뉴스를 "실시간"이라고
// 내어주지 않도록 상한을 둔다(사용자 요구사항: 실패 시엔 "적절한" 캐시만 쓰고, 없으면 빈 상태).
const MAX_STALE_CACHE_MS = 30 * 60 * 1000; // 30분

function emptyRssXml(category) {
  // 프론트엔드 계약(parseNewsPageXml)은 XML 안의 <item> 노드만 보고, 없으면 그냥 "표시할 뉴스 없음"
  // 상태로 자연스럽게 넘어간다(news-page.js, index.html 공통) — 그래서 형식은 정상 RSS와 동일하게
  // 유지하고 <item>만 0개로 둔다. 빈 배열/빈 문자열이 아니라 "유효한 빈 RSS"를 주는 이유는 프론트가
  // 이 응답을 정상 XML로 파싱할 수 있게 해서(오류 throw 없이) 빈 상태 UI로 곧장 이어지게 하기 위함.
  const safeCategory = String(category || "").replace(/[<&]/g, "");
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<rss version="2.0"><channel>' +
    "<title>자산 파일럿 뉴스" + (safeCategory ? " - " + safeCategory : "") + "</title>" +
    "<description>일시적으로 뉴스를 불러오지 못했습니다.</description>" +
    "</channel></rss>"
  );
}

async function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const category = typeof req.query.category === "string" ? req.query.category : "";
  const cacheKey = category || "__default__";

  try {
    const url = FIREBASE_NEWS_PROXY_URL + (category ? "?category=" + encodeURIComponent(category) : "");
    const upstream = await fetchWithTimeout(url, UPSTREAM_TIMEOUT_MS);

    if (!upstream.ok) {
      throw new Error("업스트림 응답 오류: " + upstream.status);
    }

    const xml = await upstream.text();
    cache.set(cacheKey, { xml, cachedAt: Date.now() });

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", CLIENT_CACHE_CONTROL);
    return res.status(200).send(xml);
  } catch (error) {
    console.error("newsProxy 실패, 캐시로 대체 시도:", error.message || error);

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt <= MAX_STALE_CACHE_MS) {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Cache-Control", CLIENT_CACHE_CONTROL);
      res.setHeader("X-News-Source", "stale-cache");
      return res.status(200).send(cached.xml);
    }

    // 쓸 만한 캐시가 없다 — 빈 화면이나 원문 텍스트 에러 대신, 프론트가 그대로 파싱할 수 있는
    // 유효한 빈 RSS를 돌려준다(응답 형식/성공 시 계약은 그대로, 항목 수만 0).
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-News-Source", "empty-fallback");
    return res.status(200).send(emptyRssXml(category));
  }
}
