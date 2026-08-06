import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

const DAILY_REMINDER_ID = 'assetpilot-daily-checkin-reminder';
const ANDROID_CHANNEL_ID = 'assetpilot-reminders';
const REMINDER_ENABLED_KEY = 'assetpilot_daily_reminder_enabled';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// 실기기가 아니면(에뮬레이터) 권한 프롬프트 자체가 동작하지 않는 경우가 있어 미리 걸러낸다.
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// 매일 저녁 8시, 아직 오늘의 자산 체크를 안 했으면 다시 확인하도록 상기시키는 로컬 알림 하나만 유지한다.
// 이미 예약돼 있으면 identifier가 같아 중복 등록되지 않는다.
export async function scheduleDailyCheckInReminder(): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: '자산 체크 알림',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: '오늘의 자산 체크, 아직이시죠?',
      body: '30초면 충분해요. 자산 파일럿에서 오늘의 체크를 완료해보세요.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
      channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
    },
  });
}

export async function cancelDailyCheckInReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
}

// 알림 화면의 토글 상태 — 실제 예약 여부와 별개로, 사용자가 마지막에 고른 값을 기억해둔다.
export async function getReminderEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REMINDER_ENABLED_KEY);
  return raw === 'true';
}

export async function setReminderEnabled(enabled: boolean): Promise<boolean> {
  if (enabled) {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
      return false;
    }
    await scheduleDailyCheckInReminder();
    await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'true');
    return true;
  }
  await cancelDailyCheckInReminder();
  await AsyncStorage.setItem(REMINDER_ENABLED_KEY, 'false');
  return false;
}
