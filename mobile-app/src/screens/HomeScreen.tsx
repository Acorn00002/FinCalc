import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text } from 'react-native';
import AppScreen from '../components/AppScreen';
import HomeWelcomeRow from '../components/home/HomeWelcomeRow';
import HomeAiCard from '../components/home/HomeAiCard';
import HomeNewsPreview from '../components/home/HomeNewsPreview';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/theme';

// index.html의 #view-home(웰컴 & 포인트 배지 → AI 자산파일럿 서포터 → 실시간 경제뉴스)을 그대로
// 네이티브로 이식한 화면 — 예전엔 이 화면 전체가 WebView였는데, 스토어 심사(최소 기능 정책) 리스크를
// 없애기 위해 앱의 첫 화면부터 완전히 네이티브로 옮겼다.
export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    // 자식 컴포넌트들이 key 변경으로 다시 마운트되며 각자 알아서 새로 fetch하므로,
    // 여기서는 짧게 스피너만 보여주고 내린다(개별 컴포넌트의 실제 로딩 상태와는 별개).
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <HomeWelcomeRow key={`welcome-${refreshKey}`} />
        <HomeAiCard key={`ai-${refreshKey}`} />
        <HomeNewsPreview key={`news-${refreshKey}`} />
        <Text style={styles.footer}>
          자산 파일럿은 투자 자문업이 아닌 정보 제공 및 계산 시뮬레이션 서비스입니다. 실제 투자·세무 의사결정 전 반드시
          전문가와 상담해 주세요.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16, paddingTop: 12 },
    footer: { fontSize: 10.5, color: colors.ink3, lineHeight: 15, marginTop: 20, textAlign: 'center' },
  });
}