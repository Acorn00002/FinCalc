import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Props = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
};

// 웹의 .view-teaser 패턴("준비 중" 안내) 이식 — 공지사항/FAQ가 공유한다.
export default function ComingSoon({ icon, title, description }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={32} color={colors.brand} />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>준비 중</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    badge: {
      backgroundColor: colors.cardSoft,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      marginBottom: 12,
    },
    badgeText: { fontSize: 11, fontWeight: '700', color: colors.ink3 },
    title: { fontSize: 18, fontWeight: '800', color: colors.ink1, marginBottom: 8 },
    description: { fontSize: 14, color: colors.ink2, textAlign: 'center', lineHeight: 21 },
  });
}
