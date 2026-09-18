import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

// JSON import assertion 문법(assert/with { type: "json" })은 Node 버전에 따라 지원이 갈려서
// (Vercel 런타임 Node 버전을 코드에서 못 박고 싶지 않다) 대신 fs로 직접 읽어 항상 동작하게 한다.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manualEvents = JSON.parse(readFileSync(path.join(__dirname, "../data/manualCalendarEvents.json"), "utf8"));

// financial-calendar/index.html의 MANUAL_CALENDAR_EVENTS(배당락일·실적·세무 마감일 등 손으로
// 채워둔 실데이터 목록)를 그대로 노출한다. 이 배열은 index.html에 직접 하드코딩돼 있어 웹은 항상
// 최신 상태를 보지만, 네이티브 앱은 빌드에 값을 박아두면 분기마다(예: 2026-07~09) 앱을 새로
// 배포해야만 갱신되므로 대신 이 엔드포인트로 fetch한다.
// data/manualCalendarEvents.json은 index.html의 MANUAL_CALENDAR_EVENTS를 그대로 추출한 스냅샷이다 —
// 관리자가 웹의 목록을 갱신할 때 이 파일도 함께 갱신해야 두 화면이 계속 같은 데이터를 보여준다.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // 분기마다 수동으로 갱신되는 정적 데이터라 자주 바뀌지 않지만, 갱신 직후엔 최대한 빨리
  // 반영되어야 하므로 브라우저 캐시는 짧게, 반복 호출 방지는 CDN 엣지 캐시가 담당한다.
  res.setHeader("Cache-Control", "public, max-age=600, s-maxage=86400, stale-while-revalidate=604800");

  return res.status(200).json({ events: manualEvents });
}
