import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

export type DataTableColumn = { key: string; label: string };
export type DataTableRow = Record<string, string>;

type Props = {
  columns: DataTableColumn[];
  rows: DataTableRow[];
  toggleLabel?: string;
};

// finpilot의 generateTableHtml() + "상세 내역 표 보기/숨기기" 토글 버튼을 그대로 이식.
// compound-simple / compound-periodic / loan(대출이자) 탭에만 존재.
export default function DataTable({ columns, rows, toggleLabel = '상세 내역 표 보기/숨기기' }: Props) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.toggleBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.toggleBtnText}>{toggleLabel}</Text>
      </Pressable>
      {open ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
          <View>
            <View style={[styles.row, styles.headerRow]}>
              {columns.map((c) => (
                <Text key={c.key} style={[styles.cell, styles.headerCell]}>
                  {c.label}
                </Text>
              ))}
            </View>
            {rows.map((row, i) => (
              <View key={i} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                {columns.map((c) => (
                  <Text key={c.key} style={styles.cell}>
                    {row[c.key]}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrapper: { marginTop: 16 },
    toggleBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.cardSoft,
    },
    toggleBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
    scroll: { marginTop: 10 },
    row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.line },
    headerRow: { borderBottomWidth: 1.5, borderBottomColor: colors.ink3 },
    rowAlt: { backgroundColor: colors.cardSoft },
    cell: { minWidth: 92, paddingVertical: 10, paddingHorizontal: 10, fontSize: 12.5, color: colors.ink2 },
    headerCell: { fontWeight: '700', color: colors.ink1 },
  });
}
