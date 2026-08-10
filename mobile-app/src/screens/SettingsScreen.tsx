import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AppScreen from '../components/AppScreen';
import Card from '../components/ui/Card';
import Section from '../components/ui/Section';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import type { ThemeColors } from '../constants/theme';
import type { ThemePref } from '../hooks/useThemePreference';

// Admin SDK 권한이 필요한 삭제 작업이라 functions/index.js의 deleteAccount로만 처리한다(Vercel엔
// 서비스 계정이 없어 이 엔드포인트를 못 만듦) — 절대 URL로 직접 호출한다(newsFeed.ts 등과 동일 방식).
const DELETE_ACCOUNT_URL = 'https://asia-northeast3-asset-filot.cloudfunctions.net/deleteAccount';

const LEGAL_LINKS: { label: string; url: string }[] = [
  { label: '개인정보처리방침', url: 'https://gofincalc.com/privacy/' },
  { label: '이용약관', url: 'https://gofincalc.com/terms/' },
  { label: '계정·데이터 삭제 안내', url: 'https://gofincalc.com/account-deletion/' },
];

const THEME_OPTIONS: { value: ThemePref; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'system', label: '시스템', icon: 'contrast-outline' },
  { value: 'light', label: '라이트', icon: 'sunny-outline' },
  { value: 'dark', label: '다크', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, pref, setPref } = useAppTheme();
  const { user, signInWithGoogle, signOut, getFreshIdToken } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      '정말 탈퇴하시겠어요?',
      '보유 포인트, 자산 기록, 개인 일정, 자산 라운지에 작성한 글·댓글이 모두 삭제되며 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: () => {
            Alert.alert('한 번 더 확인할게요', '계정을 완전히 삭제할까요?', [
              { text: '취소', style: 'cancel' },
              { text: '삭제', style: 'destructive', onPress: runDeleteAccount },
            ]);
          },
        },
      ]
    );
  };

  const runDeleteAccount = async () => {
    setDeleting(true);
    try {
      const idToken = await getFreshIdToken();
      if (!idToken) throw new Error('로그인이 필요해요.');
      const res = await fetch(DELETE_ACCOUNT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '탈퇴 처리에 실패했습니다.');
      await signOut();
      Alert.alert('탈퇴 완료', '그동안 이용해주셔서 감사합니다.');
    } catch (e) {
      Alert.alert('탈퇴에 실패했어요', e instanceof Error ? e.message : '다시 시도해주세요.');
    } finally {
      setDeleting(false);
    }
  };

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
            {user ? (
              <Pressable style={styles.deleteAccountBtn} onPress={handleDeleteAccount} disabled={deleting}>
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteAccountBtnText}>회원 탈퇴</Text>
                )}
              </Pressable>
            ) : null}
          </Card>
        </Section>

        <Section title="약관 및 정책">
          <Card style={styles.legalCard}>
            {LEGAL_LINKS.map((link, i) => (
              <Pressable
                key={link.url}
                style={[styles.legalRow, i > 0 && styles.legalRowDivider]}
                onPress={() => Linking.openURL(link.url)}
              >
                <Text style={styles.legalLabel}>{link.label}</Text>
                <Ionicons name="open-outline" size={16} color={colors.ink3} />
              </Pressable>
            ))}
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
    deleteAccountBtn: {
      marginTop: 12,
      backgroundColor: colors.loss,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    deleteAccountBtnText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
    legalCard: { padding: 0 },
    legalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 16 },
    legalRowDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    legalLabel: { fontSize: 14, fontWeight: '600', color: colors.ink1 },
    version: { fontSize: 12, color: colors.ink3, textAlign: 'center', marginTop: 8 },
  });
}
