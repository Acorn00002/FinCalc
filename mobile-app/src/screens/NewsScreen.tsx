import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/theme';
import { fetchNewsItems, NewsItem } from '../lib/newsFeed';
import type { RootStackParamList } from '../navigation/types';

// index.html의 #news(뉴스 · 금융소식) 뷰를 그대로 이식 — /api/news(Google 뉴스 경제 토픽 RSS 프록시)를
// 그대로 fetch해서 목록으로 보여주고, 탭하면 앱 안(NewsArticle 화면)에서 원문을 바로 볼 수 있게 한다.
export default function NewsScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const result = await fetchNewsItems();
      setItems(result);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <AppScreen>
      <FlatList
        data={items ?? []}
        keyExtractor={(item, index) => `${item.link}-${index}`}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text style={styles.eyebrow}>뉴스 · 금융소식</Text>
            <Text style={styles.title}>실시간 경제 뉴스</Text>
            <Text style={styles.subtitle}>구글 뉴스 경제 토픽을 실시간으로 모아봤어요.</Text>
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
    subtitle: { fontSize: 13, color: colors.ink3 },
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
