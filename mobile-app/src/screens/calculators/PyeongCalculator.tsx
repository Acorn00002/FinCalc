import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import NumberField from '../../components/calc/NumberField';
import InputPanel from '../../components/calc/InputPanel';
import ResultCard from '../../components/calc/ResultCard';
import { formatResult } from '../../lib/calc/format';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

const SQM_TO_PYEONG = 0.3025;
const PRESETS = [59, 74, 84, 101, 115];

// finpilot/js/calculators.js의 평수 변환기(24. 1㎡ = 0.3025평)를 그대로 이식.
export default function PyeongCalculator() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sqm, setSqm] = useState(84);

  const pyeong = Math.round(sqm * SQM_TO_PYEONG * 100) / 100;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <InputPanel>
        <NumberField label="제곱미터 (㎡)" value={sqm} onChange={setSqm} suffix="㎡" allowDecimal />
        <Text style={styles.presetTitle}>자주 찾는 평형</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetRow}>
          {PRESETS.map((p) => (
            <Pressable key={p} style={styles.presetChip} onPress={() => setSqm(p)}>
              <Text style={styles.presetChipText}>{p}㎡ (약 {(p * SQM_TO_PYEONG).toFixed(1)}평)</Text>
            </Pressable>
          ))}
        </ScrollView>
      </InputPanel>

      <ResultCard title="변환 결과" mainValue={`${formatResult(sqm)}㎡ = ${formatResult(pyeong)}평`} />
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 32 },
    presetTitle: { fontSize: 13, fontWeight: '700', color: colors.ink3, marginTop: 8, marginBottom: 10 },
    presetRow: { gap: 8 },
    presetChip: { backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
    presetChipText: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
  });
}
