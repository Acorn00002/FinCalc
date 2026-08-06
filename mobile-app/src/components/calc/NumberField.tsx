import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors, RADIUS } from '../../constants/theme';
import { formatKoreanUnit } from '../../lib/calc/format';

export type QuickAdd = { amount: number; label: string };

type Props = {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
  quickAdds?: QuickAdd[];
  showKoreanHint?: boolean;
  allowDecimal?: boolean;
};

function formatDisplay(n: number, allowDecimal?: boolean): string {
  if (!n) return '';
  return allowDecimal ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : Math.round(n).toLocaleString('en-US');
}

// 웹의 금액/퍼센트/연수 인풋(빠른 추가 칩 + 한글 단위 힌트 포함) 공용 이식.
export default function NumberField({ label, value, onChange, suffix, quickAdds, showKoreanHint, allowDecimal }: Props) {
  const { colors, radius } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, radius), [colors, radius]);
  const [text, setText] = useState(formatDisplay(value, allowDecimal));

  useEffect(() => {
    setText(formatDisplay(value, allowDecimal));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleChangeText = (raw: string) => {
    const cleaned = allowDecimal ? raw.replace(/[^0-9.]/g, '') : raw.replace(/[^0-9]/g, '');
    const n = parseFloat(cleaned) || 0;
    setText(cleaned);
    onChange(n);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
          placeholder="0"
          placeholderTextColor={colors.ink3}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {showKoreanHint && value > 0 ? <Text style={styles.hint}>{formatKoreanUnit(value)}</Text> : null}
      {quickAdds && quickAdds.length ? (
        <View style={styles.chipsRow}>
          {quickAdds.map((qa) => (
            <Pressable key={qa.label} style={styles.chip} onPress={() => onChange(value + qa.amount)}>
              <Text style={styles.chipText}>{qa.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS) {
  return StyleSheet.create({
    // finpilot/css/styles.css의 .input-group(모바일: margin-bottom 28px, label margin-bottom 10px)에 맞춤.
    container: { marginBottom: 24 },
    label: { fontSize: 13.5, fontWeight: '700', color: colors.ink2, marginBottom: 10 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.cardSoft,
      borderRadius: radius.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    // finpilot input[type=number]는 0.95rem/600 — 네이티브는 강조를 위해 한 단계만 키움.
    input: { flex: 1, fontSize: 17, fontWeight: '700', color: colors.ink1, padding: 0 },
    suffix: { fontSize: 14, fontWeight: '700', color: colors.ink3, marginLeft: 6 },
    hint: { fontSize: 12.5, color: colors.brand, marginTop: 6, fontWeight: '600' },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    chip: {
      backgroundColor: colors.brandSoft,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
    },
    chipText: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
  });
}
