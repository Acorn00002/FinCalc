import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

export type ResultRow = { label: string; value: string; tone?: 'default' | 'profit' | 'loss' };

type Props = {
  title: string;
  mainValue: string;
  subValue?: string;
  rows?: ResultRow[];
};

// 각 계산기 결과 화면 공통 카드 — 큰 결과값 + 보조 텍스트 + 세부 내역 행들.
export default function ResultCard({ title, mainValue, subValue, rows }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.mainValue}>{mainValue}</Text>
      {subValue ? <Text style={styles.subValue}>{subValue}</Text> : null}
      {rows && rows.length ? (
        <View style={styles.rows}>
          {rows.map((row, i) => (
            <View key={row.label} style={[styles.row, i > 0 && styles.rowDivider]}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text
                style={[
                  styles.rowValue,
                  row.tone === 'profit' && { color: colors.profit },
                  row.tone === 'loss' && { color: colors.loss },
                ]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    // finpilot/css/styles.css의 .glass-panel(모바일: radius 20px, padding 20px)에 맞춤 —
    // 공용 Card의 기본값(radius.lg=24, padding=16)은 계산기 결과 카드엔 살짝 안 맞아 여기서 덮어씀.
    card: { marginBottom: 16, borderRadius: 20, padding: 20 },
    title: { fontSize: 13, fontWeight: '700', color: colors.ink3, marginBottom: 8 },
    mainValue: { fontSize: 26, fontWeight: '800', color: colors.brand },
    subValue: { fontSize: 13.5, color: colors.ink2, marginTop: 6 },
    rows: { marginTop: 14 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    rowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    rowLabel: { fontSize: 13.5, color: colors.ink2 },
    rowValue: { fontSize: 13.5, fontWeight: '700', color: colors.ink1 },
  });
}
