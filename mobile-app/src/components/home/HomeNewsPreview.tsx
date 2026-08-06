import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useAppTheme } from '../../context/ThemeContext';
import { fetchNewsItems, NewsItem } from '../../lib/newsFeed';
import type { ThemeColors } from '../../constants/theme';
import type { RootStackParamList } from '../../navigation/types';

const PREVIEW_COUNT = 4;

// index.html의 "3. 실시간 경제 뉴스" 홈 위젯을 그대로 이식 — 뉴스 전체 화면(NewsScreen)이 이미 쓰는
// fetchNewsItems()를 그대로 재사용해 상위 4건만 미리보기로 보여준다.
export default function HomeNewsPreview() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchNewsItems()
      .then((result) => {
        if (!cancelled) setItems(result.slice(0, PREVIEW_COUNT));
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.headRow}>
        <Text style={styles.heading}>실시간 경제 뉴스</Text>
        <Pressable style={styles.moreBtn} onPress={() => navigation.navigate('News')}>
          <Text style={styles.moreBtnText}>더보기</Text>
          <Ionicons name="chevron-forward-outline" size={13} color={colors.ink3} />
        </Pressable>
      </View>

      <View style={styles.list}>
        {items === null && !error ? (
          [0, 1, 2, 3].map((i) => <View key={i} style={styles.skeleton} />)
        ) : error || items?.length === 0 ? (
          <Text style={styles.empty}>실시간 뉴스를 불러올 수 없어요.</Text>
        ) : (
          items!.map((item, i) => (
            <Pressable
              key={`${item.link}-${i}`}
              style={[styles.item, i > 0 && styles.itemDivider]}
              onPress={() => item.link && navigation.navigate('NewsArticle', { url: item.link })}
            >
              <Text style={styles.itemTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.itemMeta}>
                {[item.source, item.time].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 8 },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    heading: { fontSize: 15, fontWeight: '700', color: colors.ink1 },
    moreBtn: { flexDirection: 'row', alignItems: 'center', gap: 1 },
    moreBtnText: { fontSize: 13, fontWeight: '600', color: colors.ink3 },
    list: { backgroundColor: colors.card, borderRadius: 16, overflow: 'hidden' },
    item: { padding: 14 },
    itemDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    itemTitle: { fontSize: 14, fontWeight: '600', color: colors.ink1, lineHeight: 20 },
    itemMeta: { fontSize: 11.5, color: colors.ink3, marginTop: 4 },
    skeleton: { height: 50, margin: 12, borderRadius: 8, backgroundColor: colors.cardSoft },
    empty: { fontSize: 13, color: colors.ink3, textAlign: 'center', paddingVertical: 30 },
  });
}