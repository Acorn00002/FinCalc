import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import Card from '../components/ui/Card';
import CheckInCard from '../components/home/CheckInCard';
import AssetDashboardCard, { AssetBreakdown } from '../components/mypage/AssetDashboardCard';
import AssetGoalCard from '../components/mypage/AssetGoalCard';
import AssetHistoryCard from '../components/mypage/AssetHistoryCard';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFirestoreDocument, setFirestoreDocument } from '../lib/firestoreRest';
import type { ThemeColors } from '../constants/theme';
import type { RootStackParamList } from '../navigation/types';

// 마이페이지에 함께 배치하는 "체류 시간" 기능 바로가기 — 홈 화면이 장황해 보인다는 피드백으로
// 아이디/포인트 카드 바로 아래로 옮겼다.
const MYPAGE_TOOL_CARDS: Array<{
  key: keyof RootStackParamList;
  icon: string;
  title: string;
  desc: string;
  tint: string;
}> = [
  {
    key: 'FutureSimulator',
    icon: 'trending-up-outline',
    title: '미래 자산 시뮬레이터',
    desc: '5년 뒤 내 자산, 슬라이더로 바로 확인',
    tint: '#eef2ff',
  },
  {
    key: 'AssetScore',
    icon: 'medal-outline',
    title: '자산 비교 & 점수',
    desc: '내 연령대 상위 몇 %인지 확인해보기',
    tint: '#fef3e8',
  },
];

const REWARD_TARGET = 4500;
const DEFAULT_POINTS = 1250;
const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='32' fill='%23e2e5ea'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23aab1bd'/%3E%3Cpath d='M32 40c-14 0-22 8-22 18v6h44v-6c0-10-8-18-22-18Z' fill='%23aab1bd'/%3E%3C/svg%3E";

type PointHistoryEntry = { date: string; reason: string; amount: number };

// index.html의 #view-mypage(내 계정)를 그대로 이식 — users/{uid} Firestore 문서에서
// totalPoints/pointHistory/nickname을 읽고, 첫 로그인이면 웹과 동일하게 구글 로그인 보너스로 초기화한다.
export default function MypageScreen() {
  const { colors, radius } = useAppTheme();
  const { user, isLoading: authLoading, signInWithGoogle, signOut, getFreshIdToken } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useMemo(() => createStyles(colors, radius), [colors, radius]);

  const [points, setPoints] = useState(DEFAULT_POINTS);
  const [history, setHistory] = useState<PointHistoryEntry[]>([]);
  const [nickname, setNickname] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // AssetDashboardCard가 저장/로드할 때 알려주는 총자산 — 목표 트래커·월별 기록 카드가 같은 값을 공유한다
  // (index.html의 assetDashLatestTotal과 동일한 역할).
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetBreakdown, setAssetBreakdown] = useState<AssetBreakdown>({ cash: 0, stock: 0, realestate: 0 });
  const handleAssetsChange = useCallback((total: number, breakdown: AssetBreakdown) => {
    setAssetTotal(total);
    setAssetBreakdown(breakdown);
  }, []);

  const loadUserDoc = useCallback(async () => {
    if (!user) return;
    setLoadingDoc(true);
    try {
      const idToken = await getFreshIdToken();
      const path = `users/${user.uid}`;
      const doc = await getFirestoreDocument(path, idToken ?? undefined);
      if (doc) {
        setPoints(typeof doc.totalPoints === 'number' ? doc.totalPoints : DEFAULT_POINTS);
        const rawHistory = Array.isArray(doc.pointHistory) ? (doc.pointHistory as PointHistoryEntry[]) : [];
        setHistory(rawHistory.slice().reverse());
        if (typeof doc.nickname === 'string' && doc.nickname.trim()) setNickname(doc.nickname.trim());
      } else if (idToken) {
        // 첫 로그인 — 웹과 동일하게 기본 포인트 + "구글 로그인 보너스" 내역 한 건으로 초기화.
        const bonusEntry: PointHistoryEntry = {
          date: new Date().toISOString().slice(0, 10),
          reason: '구글 로그인 보너스',
          amount: DEFAULT_POINTS,
        };
        await setFirestoreDocument(
          path,
          { totalPoints: DEFAULT_POINTS, pointHistory: [bonusEntry], createdAt: new Date().toISOString() },
          idToken
        );
        setPoints(DEFAULT_POINTS);
        setHistory([bonusEntry]);
      }
    } catch {
      // 네트워크 실패 시 기본값을 유지 — 화면 자체는 계속 쓸 수 있게 한다.
    } finally {
      setLoadingDoc(false);
    }
  }, [user, getFreshIdToken]);

  useEffect(() => {
    if (user) loadUserDoc();
  }, [user, loadUserDoc]);

  const onLogin = async () => {
    setLoginError(null);
    const result = await signInWithGoogle();
    if (!result.ok && result.message) setLoginError(result.message);
  };

  const pct = Math.max(0, Math.min(100, Math.round((points / REWARD_TARGET) * 100)));

  if (authLoading) {
    return (
      <AppScreen>
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </AppScreen>
    );
  }

  if (!user) {
    return (
      <AppScreen>
        <View style={styles.loggedOutWrap}>
          <View style={styles.loggedOutIconWrap}>
            <Ionicons name="person-circle-outline" size={48} color={colors.ink3} />
          </View>
          <Text style={styles.loggedOutTitle}>로그인 후 이용할 수 있어요</Text>
          <Text style={styles.loggedOutDesc}>구글 계정으로 로그인하면 내 포인트와 리워드 내역을 확인할 수 있어요.</Text>
          <Pressable style={styles.loginBtn} onPress={onLogin}>
            <Ionicons name="logo-google" size={18} color="#fff" />
            <Text style={styles.loginBtnText}>구글 아이디로 로그인</Text>
          </Pressable>
          {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>내 계정</Text>
        <Text style={styles.pageTitle}>마이페이지</Text>

        <Card style={styles.profileCard}>
          <Image source={{ uri: user.photoURL || DEFAULT_AVATAR }} style={styles.avatar} />
          <View style={styles.profileText}>
            <Text style={styles.profileName}>{nickname || user.displayName || '파일럿 형'}</Text>
            <Text style={styles.profileEmail}>{user.email || '이메일 정보 없음'}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={signOut}>
            <Text style={styles.logoutBtnText}>로그아웃</Text>
          </Pressable>
        </Card>

        <AssetDashboardCard onAssetsChange={handleAssetsChange} />
        <AssetGoalCard currentTotal={assetTotal} />
        <AssetHistoryCard currentTotal={assetTotal} currentBreakdown={assetBreakdown} />

        <Card style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>보유 포인트</Text>
          <Text style={styles.pointsValue}>
            {loadingDoc ? '-' : points.toLocaleString('ko-KR')} <Text style={styles.pointsUnit}>P</Text>
          </Text>
          <View style={styles.progressTopRow}>
            <Text style={styles.progressLabel}>스타벅스 아메리카노 교환까지</Text>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
        </Card>

        <CheckInCard />

        <View style={styles.toolRow}>
          {MYPAGE_TOOL_CARDS.map((card) => (
            <Pressable
              key={card.key}
              style={[styles.toolCard, { backgroundColor: card.tint }]}
              onPress={() => navigation.navigate(card.key as never)}
            >
              <Ionicons name={card.icon as any} size={20} color={colors.brand} />
              <Text style={styles.toolTitle}>{card.title}</Text>
              <Text style={styles.toolDesc}>{card.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionTitle}>포인트 히스토리</Text>
        {history.length === 0 ? (
          <Text style={styles.historyEmpty}>아직 포인트 내역이 없어요</Text>
        ) : (
          history.map((item, i) => {
            const isPositive = item.amount >= 0;
            return (
              <View key={`${item.date}-${i}`} style={[styles.historyItem, i > 0 && styles.historyItemDivider]}>
                <View style={styles.historyLeft}>
                  <Text style={styles.historyReason}>{item.reason}</Text>
                  <Text style={styles.historyDate}>{item.date}</Text>
                </View>
                <Text style={[styles.historyAmount, { color: isPositive ? colors.profit : colors.loss }]}>
                  {isPositive ? '+' : ''}
                  {item.amount.toLocaleString('ko-KR')}P
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: { lg: number; md: number }) {
  return StyleSheet.create({
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    loggedOutWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    loggedOutIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    loggedOutTitle: { fontSize: 16.5, fontWeight: '800', color: colors.ink1, marginBottom: 8 },
    loggedOutDesc: { fontSize: 13.5, color: colors.ink3, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    loginBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.brand,
      paddingHorizontal: 22,
      paddingVertical: 13,
      borderRadius: 999,
    },
    loginBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
    errorText: { fontSize: 12.5, color: colors.loss, marginTop: 14, textAlign: 'center' },
    content: { padding: 16 },
    eyebrow: { fontSize: 12.5, fontWeight: '700', color: colors.brand, marginBottom: 4 },
    pageTitle: { fontSize: 20, fontWeight: '800', color: colors.ink1, marginBottom: 18 },
    profileCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cardSoft },
    profileText: { flex: 1, marginLeft: 14 },
    profileName: { fontSize: 15.5, fontWeight: '800', color: colors.ink1 },
    profileEmail: { fontSize: 12.5, color: colors.ink3, marginTop: 3 },
    logoutBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardSoft },
    logoutBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
    pointsCard: { marginBottom: 14 },
    toolRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    toolCard: { flex: 1, borderRadius: 18, padding: 14, gap: 4 },
    toolTitle: { fontSize: 13, fontWeight: '800', color: colors.ink1, marginTop: 6 },
    toolDesc: { fontSize: 11, color: colors.ink3, lineHeight: 15 },
    pointsLabel: { fontSize: 13, color: colors.ink3, fontWeight: '600', marginBottom: 6 },
    pointsValue: { fontSize: 28, fontWeight: '800', color: colors.brand, marginBottom: 16 },
    pointsUnit: { fontSize: 16, fontWeight: '700' },
    progressTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 12, color: colors.ink3 },
    progressPct: { fontSize: 12, fontWeight: '700', color: colors.brand },
    progressTrack: { height: 8, borderRadius: 4, backgroundColor: colors.cardSoft, overflow: 'hidden' },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: colors.brand },
    sectionTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink2, marginBottom: 10 },
    historyEmpty: { fontSize: 13, color: colors.ink3, textAlign: 'center', paddingVertical: 20 },
    historyItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    historyItemDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    historyLeft: { flex: 1 },
    historyReason: { fontSize: 13.5, fontWeight: '600', color: colors.ink1 },
    historyDate: { fontSize: 11.5, color: colors.ink3, marginTop: 3 },
    historyAmount: { fontSize: 14, fontWeight: '800' },
  });
}
