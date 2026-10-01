// Vercel 서버리스 함수 — GET /api/support-programs
// 정부지원금 목록을 "필터 + cursor 페이지네이션"으로 돌려준다. 컬렉션 전체를 읽는 경로는 없다.
//   ?limit=50(최대 50) &cursor=<이전 응답의 nextCursor> &category=<서비스분야> &region=<시도>
//   &sort=deadline|latest &status=all|open
// 응답: { items:[...], nextCursor: string|null, hasMore: boolean, limit, degraded: boolean }
// 클라이언트는 컬렉션 이름을 바꿀 수 없다(supportProgramsStaging 등은 이 API로 읽을 수 없다).
import { parseParams, listSupportPrograms } from "./_lib/supportPrograms.js";

export const config = { maxDuration: 15 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  const parsed = parseParams(req.query);
  if (parsed.error) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(400).json({ error: parsed.error });
  }
  try {
    const out = await listSupportPrograms(parsed.params);
    if (out.error) {
      res.setHeader("Cache-Control", "no-store");
      return res.status(out.status || 500).json({ error: out.error });
    }
    // 같은 조건·같은 cursor 요청은 CDN이 짧게 재사용한다 → 사용자가 늘어도 Firestore 읽기가 비례해 늘지 않는다.
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    res.setHeader("X-SP-Reads", String(out.stats.reads));
    return res.status(200).json({
      items: out.items,
      nextCursor: out.nextCursor,
      hasMore: out.hasMore,
      limit: parsed.params.limit,
      degraded: out.degraded
    });
  } catch (error) {
    console.error("support-programs 오류:", String((error && error.message) || error).slice(0, 200));
    res.setHeader("Cache-Control", "no-store");
    return res.status(500).json({ error: "internal_error" });
  }
}
