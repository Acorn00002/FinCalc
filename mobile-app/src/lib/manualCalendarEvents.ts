import { fetchWithCache, type CachedFetchResult } from './cachedFetch';

// index.html(financial-calendar)의 MANUAL_CALENDAR_EVENTS(배당락일·실적·세무 마감일 등 손으로
// 채워둔 실데이터)를 서버(/api/calendar-manual-events)에서 받아온다. 이 목록이 없으면 캘린더에
// 자동 수집(DART/청약홈) 데이터가 없는 날짜 구간에서 웹보다 정보량이 크게 부족해진다.
const MANUAL_EVENTS_URL = 'https://www.gofincalc.com/api/calendar-manual-events';
const CACHE_KEY = 'calendar_manual_events_cache_v1';

export type ManualCalendarEvent = {
  date: string;
  category: string;
  type?: string;
  title: string;
  meta?: string;
  status?: string | null;
  flag?: string | null;
  company?: string | null;
};

async function fetchManualEvents(): Promise<ManualCalendarEvent[]> {
  const res = await fetch(MANUAL_EVENTS_URL);
  if (!res.ok) throw new Error(`manual calendar events fetch failed: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.events)) throw new Error('unexpected manual calendar events payload');
  return json.events;
}

export function loadManualCalendarEvents(): Promise<CachedFetchResult<ManualCalendarEvent[]>> {
  return fetchWithCache(CACHE_KEY, fetchManualEvents, []);
}
