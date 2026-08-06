import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors, RADIUS } from '../../constants/theme';

type Option = { value: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
};

export default function SegmentedControl({ options, value, onChange }: Props) {
  const { colors, radius } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, radius), [colors, radius]);
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.cardSoft,
      borderRadius: radius.md,
      padding: 4,
      marginBottom: 18,
    },
    // active/inactive가 그림자(elevation) 유무로만 갈리면 안드로이드에서 버튼이 "커지는" 것처럼
    // 보이므로(그림자가 레이아웃 밖으로 번짐), 그림자는 아예 안 쓰고 배경색만 바꾼다.
    segment: { flex: 1, paddingVertical: 9, borderRadius: radius.md - 4, alignItems: 'center' },
    segmentActive: { backgroundColor: colors.card },
    label: { fontSize: 13, fontWeight: '700', color: colors.ink3 },
    labelActive: { color: colors.brand },
  });
}
