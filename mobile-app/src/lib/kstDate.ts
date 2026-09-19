// 기기 로컬 시간대가 Asia/Seoul이 아니어도(해외 로밍 등) 캘린더는 항상 한국 기준 "오늘"로 계산돼야
// 하므로, Intl.DateTimeFormat(timeZone: 'Asia/Seoul')로 날짜 구성요소를 뽑아 쓴다.
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function getKstTodayParts(): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  return { year: Number(map.year), month: Number(map.month) - 1, day: Number(map.day) };
}

export function kstTodayStr(): string {
  const { year, month, day } = getKstTodayParts();
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

// index.html의 loadCalendarEventsFromFirestore()와 동일한 조회 범위(현재월 기준 -3개월 1일 ~
// +6개월 말일)를 그대로 이식 — 웹과 정확히 같은 유효기간의 일정을 보여주기 위함이다.
export function getCalendarQueryRange(): { startStr: string; endStr: string } {
  const { year, month } = getKstTodayParts();
  const rangeStart = new Date(year, month - 3, 1);
  const rangeEnd = new Date(year, month + 6, 0);
  const startStr = `${rangeStart.getFullYear()}-${pad2(rangeStart.getMonth() + 1)}-${pad2(rangeStart.getDate())}`;
  const endStr = `${rangeEnd.getFullYear()}-${pad2(rangeEnd.getMonth() + 1)}-${pad2(rangeEnd.getDate())}`;
  return { startStr, endStr };
}
