// index.html의 loadBrandfetchConfig()과 동일한 계약 — /api/brandfetch-config가 publishable
// Client ID 하나만 반환한다(비밀값 아님, Brandfetch 공식 문서상 <img> URL에 그대로 노출되는 식별자).
// 앱 코드에 값을 하드코딩하지 않고 매 실행마다 이 엔드포인트에서 받아온다.
// gofincalc.com(www 없음)은 308로 리다이렉트되는데 RN fetch 폴리필이 이를 불안정하게 따라가는
// 경우가 있어(lib/aiAssist.ts, lib/newsFeed.ts와 동일한 이유) 처음부터 canonical(www) URL을 쓴다.
const CONFIG_URL = "https://www.gofincalc.com/api/brandfetch-config";

let cached: Promise<string | null> | null = null;

export function loadBrandfetchClientId(): Promise<string | null> {
  if (!cached) {
    cached = fetch(CONFIG_URL)
      .then((res) => (res.ok ? res.json() : Promise.resolve({} as { clientId?: string })))
      .then((data: { clientId?: string }) => (typeof data.clientId === "string" && data.clientId ? data.clientId : null))
      .catch(() => null);
  }
  return cached;
}
