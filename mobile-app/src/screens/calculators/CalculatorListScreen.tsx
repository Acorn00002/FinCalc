import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import AppScreen from '../../components/AppScreen';
import ScreenTitleBar from '../../components/ui/ScreenTitleBar';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors, RADIUS, SHADOW } from '../../constants/theme';
import { CALCULATORS, CALC_CATEGORIES, CalcCategory, CalcEntry } from './registry';
import type { RootStackParamList } from '../../navigation/types';

type FilterValue = 'all' | CalcCategory;

const NEW_BADGE_SOFT = { light: 'rgba(49,130,246,0.10)', dark: 'rgba(91,155,247,0.16)' };

// 카드 너비를 flex:1로 두면 마지막 줄에 2개만 남았을 때 그 2개가 남은 폭을 나눠 가져 다른 줄보다
// 커 보인다(카테고리를 눌러 개수가 3의 배수가 아닐 때 특히 두드러짐) — 화면 폭 기준 고정 너비를
// 계산해 항상 같은 크기를 쓰고, 마지막 줄이 다 안 차면 그냥 빈 공간으로 남긴다.
const SCREEN_PADDING = 16;
const CARD_GAP = 8;
const CARD_WIDTH = (Dimensions.get('window').width - SCREEN_PADDING * 2 - CARD_GAP * 2) / 3;

// index.html의 #hubPills(전체/금융/주식/세금/부동산/근로) 필터 + calc-grid(3열, New 배지)를 그대로
// 이식. 검색창은 calc-card의 data-search 키워드까지 함께 매칭한다. 웹은 세금 계산기 카드만 색을
// 다르게 강조하지만, 앱은 사용자 요청으로 모든 카드를 동일한 스타일로 통일했다.
export default function CalculatorListScreen() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors, radius, shadow, mode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);
  const [filter, setFilter] = useState<FilterValue>('all');
  const [query, setQuery] = useState('');
  const listRef = useRef<FlatList<CalcEntry>>(null);

  const filtered = useMemo(() => {
    let list = filter === 'all' ? CALCULATORS : CALCULATORS.filter((c) => c.category === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) => c.title.toLowerCase().includes(q) || (c.keywords ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [filter, query]);

  // 필터를 바꿔도 FlatList는 이전 스크롤 위치를 그대로 유지해서, 목록이 스크롤된 채로 남아있으면
  // 위쪽에 여백이 더 있는 것처럼 보인다 — 필터가 바뀔 때마다 맨 위로 되돌린다.
  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [filter, query]);

  const renderItem = ({ item }: { item: CalcEntry }) => {
    return (
      <Pressable
        style={[styles.card, !item.implemented && styles.cardDisabled]}
        onPress={() => item.implemented && navigation.navigate('Calculator', { calcId: item.id })}
        disabled={!item.implemented}
      >
        {item.isNew ? (
          <View style={[styles.newBadge, { backgroundColor: NEW_BADGE_SOFT[mode] }]}>
            <Text style={[styles.newBadgeText, { color: colors.brand2 }]}>New</Text>
          </View>
        ) : null}
        <View style={styles.iconBox}>
          <Ionicons name={item.icon} size={16} color={colors.brand} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {!item.implemented ? (
          <View style={styles.comingSoonBadge}>
            <Text style={styles.comingSoonBadgeText}>준비 중</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <AppScreen>
      <ScreenTitleBar title="전체 계산기 보기" />
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.ink3} />
        <TextInput
          style={styles.searchInput}
          placeholder="자산 기능 및 계산기를 검색해보세요"
          placeholderTextColor={colors.ink3}
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScrollView}
        contentContainerStyle={styles.pillsRow}
      >
        {[{ value: 'all' as FilterValue, label: '전체' }, ...CALC_CATEGORIES].map((opt) => {
          const active = opt.value === filter;
          return (
            <Pressable key={opt.value} style={[styles.pill, active && styles.pillActive]} onPress={() => setFilter(opt.value)}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.content}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>검색 결과가 없어요.</Text>}
      />
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, shadow: typeof SHADOW.light) {
  return StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.card,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginHorizontal: 16,
      marginBottom: 18,
      ...shadow,
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.ink1, padding: 0 },
    // 필터링 후 계산기 개수가 적어 FlatList가 화면을 다 못 채우면, 남는 세로 공간이 flexGrow:1인
    // FlatList뿐 아니라 이 가로 ScrollView에도 나눠지면서 카테고리 버튼 줄이 갑자기 몇 배로 늘어나
    // 그 아래 카드 줄과 사이에 큰 빈 공간이 생겼다 — flexGrow/flexShrink를 0으로 고정해 항상
    // 내용물 크기만큼만 차지하게 한다.
    pillsScrollView: { flexGrow: 0, flexShrink: 0 },
    // paddingBottom을 넉넉히 둔다 — pill의 그림자(elevation)가 레이아웃 높이엔 안 잡히고 아래로
    // 번지듯 그려지는데, 여백이 너무 좁으면 그 그림자가 바로 아래 카드 줄과 겹쳐 보인다.
    pillsRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 18, gap: 8 },
    // css/styles.css의 .hub-pill(padding:9px 18px, font-size:13.5px, box-shadow:var(--shadow-card))과
    // 동일 — 그림자를 active/inactive 사이에서 껐다 켜면 안드로이드에서 버튼이 "커지는" 것처럼 보이므로
    // (예전에 겪은 버그), 두 상태 모두 같은 그림자를 고정으로 깔고 배경색만 바꾼다.
    pill: {
      height: 38,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    pillActive: { backgroundColor: colors.brand, shadowOpacity: 0 },
    pillText: { fontSize: 13.5, fontWeight: '700', color: colors.ink2 },
    pillTextActive: { color: '#fff' },
    content: { padding: 16, paddingTop: 6 },
    // css/styles.css의 모바일 .calc-grid(gap:8px)에 맞춤.
    row: { gap: 8 },
    card: {
      width: CARD_WIDTH,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      // 그림자(elevation)가 레이아웃 높이엔 안 잡히고 아래로 번지듯 그려지므로, 카드 사이 간격도
      // 그림자가 다음 줄 카드와 겹쳐 보이지 않을 만큼 넉넉하게 둔다.
      marginBottom: 14,
      // 모든 계산기 카드는 정사각형 — 고정 너비를 기준으로 aspectRatio를 줘서 항상 같은 크기를 유지한다.
      aspectRatio: 1,
      justifyContent: 'space-between',
      ...shadow,
    },
    cardDisabled: { opacity: 0.55 },
    newBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    newBadgeText: { fontSize: 9, fontWeight: '800' },
    iconBox: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: colors.brandSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 12, fontWeight: '700', color: colors.ink1, lineHeight: 15.5 },
    comingSoonBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: colors.cardSoft,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
    },
    comingSoonBadgeText: { fontSize: 9, fontWeight: '700', color: colors.ink3 },
    empty: { textAlign: 'center', color: colors.ink3, fontSize: 13.5, marginTop: 40 },
  });
}
