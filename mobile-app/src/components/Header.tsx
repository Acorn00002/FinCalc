import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/theme';

type Props = {
  onMenuPress: () => void;
  onNotificationsPress: () => void;
};

// css/styles.css의 @media(max-width:640px) header{padding:12px 16px;gap:10px}, .icon-btn-ghost(38x38) 이식.
// 우측 아이콘은 원래 마이페이지 바로가기였는데, 마이페이지는 하단 탭에 이미 있어 알림 서비스로 바꿨다.
export default function Header({ onMenuPress, onNotificationsPress }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={onMenuPress} hitSlop={12} style={styles.iconBtn}>
        <Ionicons name="menu-outline" size={22} color={colors.ink1} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        자산 파일럿
      </Text>
      <Pressable onPress={onNotificationsPress} hitSlop={12} style={styles.iconBtn}>
        <Ionicons name="notifications-outline" size={22} color={colors.ink1} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.bg,
      paddingHorizontal: 16,
      paddingBottom: 12,
      gap: 10,
    },
    iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '800', color: colors.ink1, letterSpacing: -0.2 },
  });
}
