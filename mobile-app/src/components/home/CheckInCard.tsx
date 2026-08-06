import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../ui/Card';
import { useAppTheme } from '../../context/ThemeContext';
import { getCheckInState, isCheckedInToday, performCheckIn } from '../../lib/checkIn';
import { scheduleDailyCheckInReminder } from '../../lib/notifications';
import type { ThemeColors } from '../../constants/theme';

// 마이페이지 "자산 출석 챌린지" — 매일 접속 시 도장을 찍어 체류를 유도하는 토스 스타일 카드.
// 첫 체크인 시점에 알림 권한을 요청/예약해, 인위적으로 앱을 열게 만들기보다 실제로 카드를
// 사용해본 유저에게만 리마인더 알림 수락을 권하도록 했다.
export default function CheckInCard() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [streak, setStreak] = useState(0);
  const [checkedToday, setCheckedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCheckInState().then((state) => {
      setStreak(state.streak);
      setCheckedToday(isCheckedInToday(state));
      setLoading(false);
    });
  }, []);

  const handleCheckIn = async () => {
    if (checkedToday) return;
    const next = await performCheckIn();
    setStreak(next.streak);
    setCheckedToday(true);
    scheduleDailyCheckInReminder().catch(() => {});
  };

  if (loading) return null;

  return (
    <Card style={styles.card}>
      <View style={styles.headRow}>
        <Text style={styles.title}>자산 출석 챌린지</Text>
        <View style={styles.streakPill}>
          <Ionicons name="flame" size={13} color={colors.brand} />
          <Text style={styles.streakText}>{streak}일 연속</Text>
        </View>
      </View>

      <Pressable
        style={[styles.stamp, checkedToday && styles.stampDone]}
        onPress={handleCheckIn}
        disabled={checkedToday}
      >
        <Ionicons
          name={checkedToday ? 'checkmark-circle' : 'finger-print-outline'}
          size={22}
          color={checkedToday ? '#fff' : colors.brand}
        />
        <Text style={[styles.stampText, checkedToday && styles.stampTextDone]}>
          {checkedToday ? '오늘의 자산 체크 완성!' : '오늘의 자산 체크하기'}
        </Text>
      </Pressable>
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { marginBottom: 14, paddingVertical: 16 },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontSize: 14.5, fontWeight: '800', color: colors.ink1 },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    streakText: { fontSize: 12, fontWeight: '700', color: colors.brand },
    stamp: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.cardSoft,
      borderRadius: 14,
      paddingVertical: 14,
    },
    stampDone: { backgroundColor: colors.brand },
    stampText: { fontSize: 14, fontWeight: '700', color: colors.ink1 },
    stampTextDone: { color: '#fff' },
  });
}
