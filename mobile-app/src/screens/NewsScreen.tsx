import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/theme';
import { fetchNewsItems, NewsItem, NewsCategory, NEWS_CATEGORIES } from '../lib/newsFeed';
import type { RootStackParamList } from '../navigation/types';

const DEFAULT_CATEGORY: NewsCategory = 'economy';

// index.html #view-news의 "실시간 트렌드"와 동일한 로직 — 새 API 없이 지금 불러온 제목들에서
// 2번 이상 등장하는 단어를 뽑는다.
const NEWS_TREND_STOPWORDS = [
  '있다', '한다', '됐다', '이번', '지난', '오늘', '기자', '위해', '대한', '것으로', '라며', '이라고',
  '등을', '등이', '에서', '으로', '까지', '부터', '한편', '전했다', '밝혔다', '최근', '우리', '했다',
  '한다고', '무단', '전재', '재배포', '금지', '단독',
];

function extractNewsTrends(items: NewsItem[]): string[] {
  const freq = new Map<string, number>();
  items.forEach((item) => {
    const words = (item.title || '').split(/[\s,.·"'"'“”‘’()[\]:\-…]+/).filter((w) => w.length >= 2);
    words.forEach((w) => {
      if (NEWS_TREND_STOPWORDS.includes(w)) return;
      if (/^[0-9%.]+$/.test(w)) return;
      freq.set(w, (freq.get(w) || 0) + 1);
    });
  });
  return Array.from(freq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([word]) => word);
}

// index.html의 #view-news(카테고리 칩 + /api/news) 뷰를 그대로 이식 — 카테고리별로 한 번 받아온 목록은
// 캐시해두고(newsCache) 탭을 오갈 때 다시 fetch하지 않는다. 당겨서 새로고침은 현재 탭만 다시 받아온다.
export default function NewsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [category, setCategory] = useState<NewsCategory>(DEFAULT_CATEGORY);
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [trend, setTrend] = useState<string | null>(null);
  const cache = useRef<Partial<Record<NewsCategory, NewsItem[]>>>({});

  const trends = useMemo(() => extractNewsTrends(items ?? []), [items]);
  const topItems = useMemo(() => (items ?? []).slice(0, 2), [items]);
  const filteredItems = useMemo(() => {
    if (!trend || !items) return items ?? [];
    return items.filter((item) => (item.title || '').includes(trend));
  }, [items, trend]);

  const load = useCallback(async (targetCategory: NewsCategory, forceRefresh?: boolean) => {
    if (!forceRefresh && cache.current[targetCategory]) {
      setItems(cache.current[targetCategory]!);
      setError(false);
      return;
    }
    setError(false);
    try {
      const result = await fetchNewsItems(targetCategory);
      cache.current[targetCategory] = result;
      setItems(result);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    setItems(cache.current[category] ?? null);
    load(category);
  }, [category, load]);

  const onSelectCategory = useCallback((next: NewsCategory) => {
    if (next === category) return;
    setCategory(next);
    setTrend(null);
  }, [category]);

  const onSelectTrend = useCallback((word: string) => {
    setTrend((prev) => (prev === word ? null : word));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(category, true);
    setRefreshing(false);
  }, [category, load]);

  return (
    <AppScreen>
      <FlatList
        data={filteredItems}
        keyExtractor={(item, index) => `${item.link}-${index}`}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.eyebrow}>뉴스 · 금융소식</Text>
            <Text style={styles.title}>실시간 뉴스</Text>
            <Text style={styles.subtitle}>헤드라인·경제·세계·시사·생활 소식을 한 곳에서 모아봤어요.</Text>
            <View style={styles.chipRow}>
              {NEWS_CATEGORIES.map((c) => {
                const active = c.key === category;
                return (
                  <Pressable
                    key={c.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onSelectCategory(c.key)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {trends.length ? (
              <View style={styles.trendRow}>
                <Text style={styles.trendLabel}>📈 실시간 트렌드</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendScroll}>
                  {trends.map((word, idx) => {
                    const active = word === trend;
                    return (
                      <Pressable
                        key={word}
                        style={[styles.trendChip, active && styles.trendChipActive]}
                        onPress={() => onSelectTrend(word)}
                      >
                        <Text style={[styles.trendChipText, active && styles.trendChipTextActive]}>
                          {idx + 1} {word}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {topItems.length ? (
              <View style={styles.topSection}>
                <Text style={styles.topTitle}>🔥 오늘 주요뉴스</Text>
                <View style={styles.topGrid}>
                  {topItems.map((item, index) => (
                    <Pressable
                      key={`${item.link}-top-${index}`}
                      style={styles.topItem}
                      onPress={() => item.link && navigation.navigate('NewsArticle', { url: item.link })}
                    >
                      <Text style={styles.topItemTitle} numberOfLines={3}>
                        {item.title}
                      </Text>
                      <View style={styles.metaRow}>
                        {item.source ? <Text style={styles.source}>{item.source}</Text> : null}
                        <Text style={styles.time}>{item.time}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          items === null && !error ? (
            <View style={styles.skelWrap}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.skelItem} />
              ))}
            </View>
          ) : error ? (
            <Text style={styles.empty}>실시간 뉴스를 불러올 수 없어요. 잠시 후 다시 시도해주세요.</Text>
          ) : trend ? (
            <Text style={styles.empty}>{`'${trend}' 관련 뉴스가 없어요.`}</Text>
          ) : (
            <Text style={styles.empty}>표시할 뉴스가 없어요.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.item}
            onPress={() => item.link && navigation.navigate('NewsArticle', { url: item.link })}
          >
            <Text style={styles.itemTitle} numberOfLines={3}>
              {item.title}
            </Text>
            <View style={styles.metaRow}>
              {item.source ? <Text style={styles.source}>{item.source}</Text> : null}
              <Text style={styles.time}>{item.time}</Text>
            </View>
          </Pressable>
        )}
      />
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: { padding: 16 },
    head: { marginBottom: 16 },
    eyebrow: { fontSize: 12.5, fontWeight: '700', color: colors.brand, marginBottom: 4 },
    title: { fontSize: 20, fontWeight: '800', color: colors.ink1, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.ink3, marginBottom: 14 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { backgroundColor: colors.cardSoft, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999 },
    chipActive: { backgroundColor: colors.brand },
    chipText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, letterSpacing: -0.2 },
    chipTextActive: { color: '#fff' },
    trendRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
    trendLabel: { flexShrink: 0, fontSize: 13, fontWeight: '800', color: colors.ink2 },
    trendScroll: { flex: 1 },
    trendChip: {
      backgroundColor: colors.cardSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      marginRight: 6,
    },
    trendChipActive: { backgroundColor: colors.brand },
    trendChipText: { fontSize: 12, fontWeight: '700', color: colors.ink2 },
    trendChipTextActive: { color: '#fff' },
    topSection: { marginTop: 16 },
    topTitle: { fontSize: 14.5, fontWeight: '800', color: colors.ink1, marginBottom: 10 },
    topGrid: { flexDirection: 'row', gap: 10 },
    topItem: {
      flex: 1,
      backgroundColor: colors.brandSoft,
      borderRadius: 14,
      padding: 14,
    },
    topItemTitle: { fontSize: 13, fontWeight: '700', color: colors.ink1, lineHeight: 18, marginBottom: 8 },
    item: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      marginBottom: 10,
    },
    itemTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink1, lineHeight: 20, marginBottom: 8 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    source: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
    time: { fontSize: 12.5, color: colors.ink3 },
    skelWrap: { gap: 10 },
    skelItem: { height: 70, borderRadius: 16, backgroundColor: colors.cardSoft },
    empty: { textAlign: 'center', color: colors.ink3, fontSize: 13.5, marginTop: 40 },
  });
}