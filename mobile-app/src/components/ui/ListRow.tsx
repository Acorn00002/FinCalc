import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';

type Props = {
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress?: () => void;
  right?: React.ReactNode;
  showChevron?: boolean;
  last?: boolean;
};

export default function ListRow({ icon, label, onPress, right, showChevron, last }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[styles.row, !last && styles.divider]} onPress={onPress} disabled={!onPress}>
      {icon ? <Ionicons name={icon} size={19} color={colors.ink2} style={styles.icon} /> : null}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {right}
      {showChevron ? <Ionicons name="chevron-forward-outline" size={16} color={colors.ink3} /> : null}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      gap: 10,
    },
    divider: { borderBottomWidth: 1, borderBottomColor: colors.line },
    icon: { width: 20 },
    label: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.ink1 },
  });
}
