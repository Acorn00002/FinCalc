import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Props = { title: string; description: string };

// finpilot의 .theory-box(계산기 하단의 짧은 이론/팁 박스)를 그대로 이식. compound-simple/kelly 탭에만 존재.
export default function TheoryBox({ title, description }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      marginTop: 16,
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.brandSoft,
    },
    title: { fontSize: 13, fontWeight: '700', color: colors.brand, marginBottom: 4 },
    desc: { fontSize: 12.5, color: colors.ink2, lineHeight: 18 },
  });
}
