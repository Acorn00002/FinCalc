import { SITE_ORIGIN } from '../constants/theme';
import { cacheKey, requestPath, validate } from './financeProductsLogic';
import type { FinanceCategory, FinanceResult, LiveFinanceProduct } from './financeProductsLogic';

export type { LiveFinanceProduct, FinanceResult, FinanceCategory };

// SITE_ORIGIN(gofincalc.com)은 www.gofincalc.com으로 308 이동되어 Vercel의 /api/finance-products(api/finance-products.js)로 간다.
// 금융감독원 API 키는 서버 환경변수에만 있고 앱에는 내려오지 않는다.
// 유형(type)마다 따로 요청·캐시하며, 응답의 type이 요청한 유형과 다르면 오류로 처리한다(다른 유형 데이터로 대체하지 않는다).
const TTL_MS = 5 * 60 * 1000;
const cache: Record<string, { at: number; result: FinanceResult } | undefined> = {};
const inflight: Record<string, Promise<FinanceResult> | undefined> = {};

function fetchType(category: FinanceCategory): Promise<FinanceResult> {
  const key = cacheKey(category);
  const pending = inflight[key];
  if (pending) return pending;
  const p = fetch(`${SITE_ORIGIN}${requestPath(category)}`)
    .then((res) =>
      res.json().then(
        (data: unknown) => validate(category, res.ok, data),
        () => validate(category, false, { error: 'invalid_json' })
      )
    )
    .catch((e: unknown) => validate(category, false, { error: e instanceof Error ? e.message : 'network_error' }))
    .then((result) => {
      delete inflight[key];
      if (result.status === 'ok' || result.status === 'empty') cache[key] = { at: Date.now(), result };
      return result;
    });
  inflight[key] = p;
  return p;
}

// 항상 resolve한다(실패는 status === 'error'). force=true이면 캐시를 건너뛴다(다시 시도 버튼).
export function loadLiveFinanceProducts(category: FinanceCategory, force?: boolean): Promise<FinanceResult> {
  const key = cacheKey(category);
  const hit = cache[key];
  if (!force && hit && hit.result.cat === category && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.result);
  if (force) delete cache[key];
  return fetchType(category);
}
