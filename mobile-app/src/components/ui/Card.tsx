import React, { useMemo } from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors, SHADOW, RADIUS } from '../../constants/theme';

type Props = ViewProps & {
  soft?: boolean;
};

// css/styles.css의 --shadow-card / --radius-lg(24px) 카드 스타일 이식.
export default function Card({ style, soft, ...rest }: Props) {
  const { colors, radius, shadow } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);
  return <View style={[styles.base, soft && styles.soft, style]} {...rest} />;
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, shadow: typeof SHADOW.light) {
  return StyleSheet.create({
    base: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      padding: 16,
      ...shadow,
    },
    soft: {
      backgroundColor: colors.cardSoft,
      shadowOpacity: 0,
      elevation: 0,
    },
  });
}
