import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useAppTheme } from '../../context/ThemeContext';

export type ChartPoint = { label: string; value: number };

type Props = {
  points: ChartPoint[];
};

// finpilot이 Chart.js로 그리던 "연차별 자산 성장 곡선"의 네이티브 대응.
export default function GrowthChart({ points }: Props) {
  const { colors } = useAppTheme();
  const data = useMemo(() => points.map((p) => ({ value: p.value, label: p.label })), [points]);

  if (points.length < 2) return null;

  return (
    <View style={styles.container}>
      <LineChart
        data={data}
        color={colors.brand}
        thickness={2.5}
        curved
        hideDataPoints
        areaChart
        startFillColor={colors.brand}
        endFillColor={colors.card}
        startOpacity={0.25}
        endOpacity={0.02}
        yAxisTextStyle={{ color: colors.ink3, fontSize: 10 }}
        xAxisLabelTextStyle={{ color: colors.ink3, fontSize: 10 }}
        rulesColor={colors.line}
        yAxisColor={colors.line}
        xAxisColor={colors.line}
        noOfSections={4}
        spacing={Math.max(28, 260 / points.length)}
        initialSpacing={12}
        height={180}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 20 },
});
