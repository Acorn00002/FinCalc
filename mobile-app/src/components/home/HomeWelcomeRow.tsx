import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getFirestoreDocument } from '../../lib/firestoreRest';
import type { ThemeColors } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';

// index.html의 "1. 웰컴 & 포인트 배지" 한 줄을 그대로 이식 — 포인트 조회는 읽기 전용으로만 하고
// (최초 로그인 보너스 지급/초기화 같은 쓰기 로직은 MypageScreen이 이미 담당하고 있어 여기서
// 중복하지 않는다), 로그인 전이면 "로그인하고 포인트 받기"로 마이페이지 로그인 유도만 한다.
export default function HomeWelcomeRow() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { user, getFreshIdToken } = useAuth();
  const [points, setPoints] = useState<number | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setPoints(null);
      setNickname(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const idToken = await getFreshIdToken();
        const doc = await getFirestoreDocument(`users/${user.uid}`, idToken ?? undefined);
        if (cancelled || !doc) return;
        setPoints(typeof doc.totalPoints === 'number' ? doc.totalPoints : 0);
        if (typeof doc.nickname === 'string' && doc.nickname.trim()) setNickname(doc.nickname.trim());
      } catch {
        // 조회 실패해도 화면은 계속 쓸 수 있게 기본 문구를 유지한다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, getFreshIdToken]);

  return (
    <View style={styles.row}>
      <Text style={styles.name} numberOfLines={1}>
        {user ? `${nickname || user.displayName || '파일럿'}님, 안녕하세요` : '안녕하세요, 파일럿 형님'}
      </Text>
      <Pressable style={styles.badge} onPress={() => navigation.navigate('Mypage')}>
        <Text style={styles.badgeText}>
          {user ? `포인트 ${(points ?? 0).toLocaleString('ko-KR')} P` : '로그인하고 포인트 받기'}
        </Text>
        <Ionicons name="chevron-forward-outline" size={13} color={colors.brand} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
    name: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink1, letterSpacing: -0.3 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
      backgroundColor: colors.brandSoft,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
    },
    badgeText: { fontSize: 13, fontWeight: '700', color: colors.brand },
  });
}