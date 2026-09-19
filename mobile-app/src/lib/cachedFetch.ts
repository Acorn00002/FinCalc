import AsyncStorage from '@react-native-async-storage/async-storage';

export type CachedFetchResult<T> = {
  data: T;
  fetchedAt: number | null;
  fromCache: boolean;
  // 신선 요청이 실패했고 대신 보여줄 캐시조차 없을 때만 true — "일정이 실제로 없음"과
  // "조회에 실패함"을 구분해야(요구사항: 빈 데이터로 오판하지 않기) 화면에서 각각 다르게 보여줄 수 있다.
  failed: boolean;
};

// 네트워크 요청이 실패해도(오프라인, API 오류) 화면이 갑자기 텅 비지 않도록, 마지막으로 성공한
// 응답을 AsyncStorage에 남겨두고 실패 시 그걸 대신 보여준다. 성공하면 캐시를 항상 최신으로 덮어쓴다.
export async function fetchWithCache<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  emptyValue: T
): Promise<CachedFetchResult<T>> {
  try {
    const data = await fetcher();
    const fetchedAt = Date.now();
    AsyncStorage.setItem(cacheKey, JSON.stringify({ data, fetchedAt })).catch(() => {});
    return { data, fetchedAt, fromCache: false, failed: false };
  } catch {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { data: T; fetchedAt: number };
        return { data: parsed.data, fetchedAt: parsed.fetchedAt, fromCache: true, failed: false };
      }
    } catch {
      // 캐시 자체가 깨졌으면 그냥 실패로 처리한다
    }
    return { data: emptyValue, fetchedAt: null, fromCache: false, failed: true };
  }
}
