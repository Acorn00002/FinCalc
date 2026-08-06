// index.html의 requestAiAssist()와 동일한 계약(POST /api/ask-ai, Authorization: Bearer <idToken>,
// { reply, remainingPoints })을 그대로 따른다. gofincalc.com(www 없음)은 308로 리다이렉트되는데
// RN fetch 폴리필이 이를 불안정하게 따라가는 경우가 있어(lib/newsFeed.ts와 동일한 이유) 처음부터
// canonical(www) URL을 직접 호출한다.
const AI_API_URL = 'https://www.gofincalc.com/api/ask-ai';
export const AI_CALL_COST = 50;

export type AiAssistResult =
  | { ok: true; reply: string; remainingPoints: number | null }
  | { ok: false; code: 'unauthenticated' | 'insufficient-points' | 'unknown'; message: string };

export async function requestAiAssist(prompt: string, idToken: string | null): Promise<AiAssistResult> {
  if (!idToken) {
    return { ok: false, code: 'unauthenticated', message: '로그인 후 이용할 수 있어요' };
  }
  try {
    const res = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 402) {
        return { ok: false, code: 'insufficient-points', message: data.error || '포인트가 부족합니다' };
      }
      return { ok: false, code: 'unknown', message: data.error || 'AI 응답 생성에 실패했어요. 다시 시도해주세요.' };
    }
    return {
      ok: true,
      reply: typeof data.reply === 'string' ? data.reply : '',
      remainingPoints: typeof data.remainingPoints === 'number' ? data.remainingPoints : null,
    };
  } catch (error) {
    return { ok: false, code: 'unknown', message: error instanceof Error ? error.message : String(error) };
  }
}