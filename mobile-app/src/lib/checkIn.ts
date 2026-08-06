import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'assetpilot_checkin_state';

export type CheckInState = {
  lastCheckInDate: string | null;
  streak: number;
};

// 기기 로컬 날짜(YYYY-MM-DD) 기준 — UTC 변환 없이 "오늘"을 그대로 키로 쓴다.
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getCheckInState(): Promise<CheckInState> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { lastCheckInDate: null, streak: 0 };
  try {
    return JSON.parse(raw) as CheckInState;
  } catch {
    return { lastCheckInDate: null, streak: 0 };
  }
}

export function isCheckedInToday(state: CheckInState): boolean {
  return state.lastCheckInDate === todayKey();
}

// 어제 이미 체크인했다면 streak 유지+1, 그 외(첫 체크인이거나 하루 이상 건너뜀)엔 1로 리셋.
export async function performCheckIn(): Promise<CheckInState> {
  const prev = await getCheckInState();
  const today = todayKey();
  if (prev.lastCheckInDate === today) return prev;
  const continuedStreak = prev.lastCheckInDate === yesterdayKey() ? prev.streak + 1 : 1;
  const next: CheckInState = { lastCheckInDate: today, streak: continuedStreak };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
