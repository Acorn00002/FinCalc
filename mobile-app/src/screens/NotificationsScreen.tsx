import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/AppScreen';
import ScreenTitleBar from '../components/ui/ScreenTitleBar';
import Card from '../components/ui/Card';
import { useAppTheme } from '../context/ThemeContext';
import { getReminderEnabled, setReminderEnabled } from '../lib/notifications';
import type { ThemeColors } from '../constants/theme';

// 헤더 우측 아이콘(원래 마이페이지 바로가기)이 알림 서비스로 바뀌면서 생긴 화면 — 지금은
// 자산 출석 챌린지의 저녁 8시 리마인더 하나뿐이라 목록형 알림함 대신 간단한 토글 화면으로 시작한다.
export default function NotificationsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReminderEnabled().then((v) => {
      setEnabled(v);
      setLoading(false);
    });
  }, []);

  const handleToggle = async (next: boolean) => {
    setEnabled(next);
    const applied = await setReminderEnabled(next);
    setEnabled(applied);
  };

  return (
    <AppScreen>
      <ScreenTitleBar title="알림" />
      <View style={styles.content}>
        <Card style={styles.row}>
          <View style={styles.rowIconWrap}>
            <Ionicons name="notifications-outline" size={20} color={colors.brand} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>자산 출석 리마인더</Text>
            <Text style={styles.rowDesc}>매일 저녁 8시, 오늘의 자산 체크를 안 했으면 알려드려요.</Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={loading}
            trackColor={{ true: colors.brand }}
          />
        </Card>
        <Text style={styles.hint}>알림을 켜면 기기 알림 권한을 요청해요. 권한을 거부하면 꺼진 상태로 유지돼요.</Text>
      </View>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { flex: 1, padding: 16 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink1, marginBottom: 4 },
    rowDesc: { fontSize: 12, color: colors.ink3, lineHeight: 17 },
    hint: { fontSize: 11.5, color: colors.ink3, marginTop: 12, paddingHorizontal: 4, lineHeight: 16 },
  });
}
