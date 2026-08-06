import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/AppScreen';
import Card from '../components/ui/Card';
import Section from '../components/ui/Section';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { ThemeColors } from '../constants/theme';
import type { ThemePref } from '../hooks/useThemePreference';

const THEME_OPTIONS: { value: ThemePref; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'system', label: '시스템', icon: 'contrast-outline' },
  { value: 'light', label: '라이트', icon: 'sunny-outline' },
  { value: 'dark', label: '다크', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, pref, setPref } = useAppTheme();
  const { user, signInWithGoogle, signOut } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="화면 테마">
          <Card style={styles.themeCard}>
            {THEME_OPTIONS.map((opt, i) => {
              const selected = pref === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.themeRow, i > 0 && styles.themeRowDivider]}
                  onPress={() => setPref(opt.value)}
                >
                  <Ionicons name={opt.icon} size={19} color={colors.ink2} style={styles.themeIcon} />
                  <Text style={styles.themeLabel}>{opt.label}</Text>
                  <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                    {selected ? <View style={styles.radioInner} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </Section>

        <Section title="계정">
          <Card>
            {user ? (
              <>
                <Text style={styles.accountEmail}>{user.email || user.displayName}</Text>
                <Pressable style={styles.logoutRow} onPress={signOut}>
                  <Text style={styles.logoutLabel}>로그아웃</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.logoutRow} onPress={signInWithGoogle}>
                <Text style={styles.logoutLabel}>구글 아이디로 로그인</Text>
              </Pressable>
            )}
          </Card>
        </Section>

        <Text style={styles.version}>자산 파일럿 · 네이티브 버전</Text>
      </ScrollView>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16 },
    themeCard: { padding: 0 },
    themeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 10 },
    themeRowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    themeIcon: { width: 20 },
    themeLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: colors.ink1 },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: { borderColor: colors.brand },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
    logoutRow: { paddingVertical: 4 },
    logoutLabel: { fontSize: 14.5, fontWeight: '700', color: colors.brand },
    accountEmail: { fontSize: 13, color: colors.ink3, marginBottom: 10 },
    version: { fontSize: 12, color: colors.ink3, textAlign: 'center', marginTop: 8 },
  });
}
