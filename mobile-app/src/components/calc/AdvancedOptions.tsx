import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Props = { children: React.ReactNode; label?: string };

// finpilot의 .advanced-options-toggle / .advanced-options-panel(세율·물가상승률 등 선택 입력을
// 기본적으로 접어두는 영역)을 그대로 이식. compound-simple/compound-periodic 탭에만 존재.
export default function AdvancedOptions({ children, label = '고급 옵션 (세금, 물가상승률)' }: Props) {
  const [open, setOpen] = useState(false);
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Pressable style={styles.toggle} onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <Text style={styles.label}>{label} ⚙️</Text>
        <Ionicons name={open ? 'chevron-up-outline' : 'chevron-down-outline'} size={16} color={colors.ink3} />
      </Pressable>
      {open ? <View style={styles.panel}>{children}</View> : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      marginTop: 4,
    },
    label: { fontSize: 13.5, fontWeight: '700', color: colors.ink2 },
    panel: { marginTop: 4 },
  });
}
