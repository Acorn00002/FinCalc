import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors, RADIUS, SHADOW } from '../constants/theme';
import { getBankHomepage } from '../data/bankHomepages';
import { loadLiveFinanceProducts, LiveFinanceProduct } from '../lib/financeProductsApi';
import { cardModel, defaultSort, detailHead, detailRows, isCat, meta, sortProducts, spotlight } from '../lib/financeProductsLogic';
import type { FinanceCategory } from '../lib/financeProductsLogic';
import type { RootStackParamList } from '../navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'FinanceProducts'>;
type LoadState = 'loading' | 'ok' | 'empty' | 'error';

// index.html의 #view-finance(정기예금/정기적금/주택담보대출/전월세보증금대출/개인신용대출 실제 상품 금리 비교)를 이식한 화면.
// 유형별 제목·정렬·대표 금리·카드/상세 필드·문구는 lib/financeProductsLogic.ts(웹 js/finance-products.js와 같은 규칙)가 정하고,
// 금융감독원 "금융상품 한눈에" Open API는 서버(/api/finance-products?type=<유형>)를 거쳐 받는다. 카드를 탭하면 상세 모달이 뜨고,
// 모달 하단의 "공식 은행 사이트로 이동" 버튼으로 해당 은행 홈페이지로 연결된다.
export default function FinanceProductsScreen() {
  const route = useRoute<RouteProps>();
  const category: FinanceCategory = isCat(route.params.category) ? route.params.category : 'deposit';
  const copy = meta(category);
  const [sort, setSort] = useState<string>(defaultSort(category));

  const [products, setProducts] = useState<LiveFinanceProduct[]>([]);
  const [asOf, setAsOf] = useState('');
  const [state, setState] = useState<LoadState>('loading');
  const [retryNonce, setRetryNonce] = useState(0);
  const [selected, setSelected] = useState<LiveFinanceProduct | null>(null);

  const { colors, radius, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, radius, shadow, insets.bottom), [colors, radius, shadow, insets.bottom]);

  // 유형을 바꾸면 이전 유형의 목록·정렬·상태를 모두 비우고 그 유형의 데이터만 새로 불러온다.
  // 그 사이 다른 유형으로 바뀌면(cancelled) 이전 요청의 늦은 응답은 버린다.
  useEffect(() => {
    let cancelled = false;
    setProducts([]);
    setAsOf('');
    setSort(defaultSort(category));
    setState('loading');
    loadLiveFinanceProducts(category, retryNonce > 0).then((r) => {
      if (cancelled) return;
      if (r.status === 'error') {
        setState('error');
        return;
      }
      setProducts(r.products);
      setAsOf(r.asOf);
      setState(r.status);
    });
    return () => {
      cancelled = true;
    };
  }, [category, retryNonce]);

  const retry = useCallback(() => setRetryNonce((n) => n + 1), []);

  const sorted = useMemo(() => sortProducts(category, products, sort), [category, products, sort]);
  const best = useMemo(() => spotlight(category, sorted), [category, sorted]);
  const sorts = copy.sorts;

  const openBankSite = (bank: string) => {
    const url = getBankHomepage(bank);
    if (url) Linking.openURL(url);
  };

  return (
    <AppScreen>
      {state === 'loading' ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : state === 'error' ? (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.ink3} />
          <Text style={styles.errorText}>{copy.errorText}</Text>
          <Pressable style={styles.retryBtn} onPress={retry} accessibilityRole="button" accessibilityLabel="다시 시도">
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item, i) => `${item.bank}-${item.name}-${i}`}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <Text style={styles.title}>{copy.title}</Text>
              <Text style={styles.subtitle}>{copy.subtitle}</Text>

              {best ? (
                <View style={styles.adCard}>
                  <View style={styles.adBadge}>
                    <Text style={styles.adBadgeText}>LIVE</Text>
                  </View>
                  <Ionicons name="business-outline" size={22} color={colors.brand} style={styles.adIcon} />
                  <View style={styles.adBody}>
                    <Text style={styles.adBank}>{best.bank}</Text>
                    <Text style={styles.adTitle} numberOfLines={1}>
                      {best.name}
                    </Text>
                    <Text style={styles.adDesc}>{best.desc}</Text>
                  </View>
                  <View style={styles.adRateWrap}>
                    <Text style={styles.adRateNum}>{best.value}</Text>
                    <Text style={styles.adRateLabel}>{best.label}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.filterRow}>
                <View style={styles.pillsRow}>
                  {sorts.map((s) => {
                    const active = s.key === sort;
                    return (
                      <Pressable key={s.key} style={[styles.pill, active && styles.pillActive]} onPress={() => setSort(s.key)}>
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>{s.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.count}>{sorted.length}개 상품</Text>
              </View>
            </>
          }
          renderItem={({ item, index }) => {
            const card = cardModel(category, item);
            return (
              <Pressable style={styles.rankItem} onPress={() => setSelected(item)}>
                <Text style={styles.rankNum}>{index + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankBank}>{card.bank}</Text>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {card.name}
                  </Text>
                  {card.tags.length ? (
                    <View style={styles.tagRow}>
                      {card.tags.map((t) => (
                        <View key={t} style={styles.tag}>
                          <Text style={styles.tagText}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {card.meta ? (
                    <Text style={styles.rankMeta} numberOfLines={1}>
                      {card.meta}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rankRates}>
                  <Text style={styles.rankRatePrimary}>
                    {card.primaryLabel ? <Text style={styles.rankRateLabel}>{card.primaryLabel} </Text> : null}
                    {card.primaryValue}
                  </Text>
                  {card.secondary ? <Text style={styles.rankRateSecondary}>{card.secondary}</Text> : null}
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={colors.ink3} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>{copy.emptyText}</Text>}
          ListFooterComponent={
            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={16} color={colors.ink3} />
              <View style={styles.disclaimerBody}>
                <Text style={styles.disclaimerAsOf}>
                  금융감독원 「금융상품 한눈에」 Open API{asOf ? ` · ${asOf} 공시` : ''}
                </Text>
                <Text style={styles.disclaimerText}>{copy.disclaimer}</Text>
              </View>
            </View>
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            {selected ? (
              <>
                <ScrollView contentContainerStyle={styles.modalScroll}>
                  <Text style={styles.modalBank}>{selected.bank}</Text>
                  <Text style={styles.modalTitle}>{selected.name}</Text>
                  <View style={styles.modalRateRow}>
                    <Text style={styles.modalRateNum}>{detailHead(category, selected).value}</Text>
                    <Text style={styles.modalRateLabel}>{detailHead(category, selected).label}</Text>
                  </View>

                  {detailRows(category, selected).map(([label, value]) => (
                    <View key={label} style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>{label}</Text>
                      <Text style={styles.modalSectionBody}>{value}</Text>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.modalFooter}>
                  {getBankHomepage(selected.bank) ? (
                    <Pressable style={styles.modalSiteBtn} onPress={() => openBankSite(selected.bank)}>
                      <Text style={styles.modalSiteBtnText}>공식 은행 사이트로 이동</Text>
                      <Ionicons name="open-outline" size={16} color="#fff" />
                    </Pressable>
                  ) : null}
                  <Pressable style={styles.modalCloseBtn} onPress={() => setSelected(null)}>
                    <Text style={styles.modalCloseBtnText}>닫기</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, shadow: typeof SHADOW.light, bottomInset: number) {
  return StyleSheet.create({
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
    errorText: { fontSize: 13.5, color: colors.ink3, textAlign: 'center' },
    content: { padding: 16 },
    title: { fontSize: 20, fontWeight: '800', color: colors.ink1, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.ink3, marginBottom: 16, lineHeight: 19 },
    adCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.brandSoft,
      borderRadius: radius.lg - 4,
      padding: 16,
      marginBottom: 16,
      gap: 10,
    },
    adBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: colors.profit, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    adBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#fff' },
    adIcon: { marginTop: 8 },
    adBody: { flex: 1, marginTop: 8 },
    adBank: { fontSize: 12, fontWeight: '700', color: colors.ink2 },
    adTitle: { fontSize: 14.5, fontWeight: '800', color: colors.ink1, marginTop: 2 },
    adDesc: { fontSize: 11.5, color: colors.ink3, marginTop: 4, lineHeight: 16 },
    adRateWrap: { alignItems: 'flex-end' },
    adRateNum: { fontSize: 18, fontWeight: '800', color: colors.brand },
    adRateLabel: { fontSize: 10.5, color: colors.ink3, marginTop: 2 },
    filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    pillsRow: { flexDirection: 'row', gap: 8 },
    pill: { height: 32, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
    pillActive: { backgroundColor: colors.brand, shadowOpacity: 0 },
    pillText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
    pillTextActive: { color: '#fff' },
    count: { fontSize: 12, color: colors.ink3 },
    rankItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.lg - 4,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      marginBottom: 10,
      gap: 10,
    },
    rankNum: { fontSize: 14, fontWeight: '800', color: colors.ink3, width: 18, textAlign: 'center' },
    rankInfo: { flex: 1 },
    rankBank: { fontSize: 12, color: colors.ink3, marginBottom: 2 },
    rankName: { fontSize: 14.5, fontWeight: '700', color: colors.ink1 },
    rankRates: { alignItems: 'flex-end' },
    rankRatePrimary: { fontSize: 16, fontWeight: '800', color: colors.brand },
    rankRateSecondary: { fontSize: 11, color: colors.ink3, marginTop: 2, textAlign: 'right' },
    retryBtn: { marginTop: 4, backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 },
    retryBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    tag: { backgroundColor: colors.card, borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 3 },
    tagText: { fontSize: 10.5, fontWeight: '700', color: colors.ink3 },
    rankMeta: { fontSize: 11.5, color: colors.ink3, marginTop: 6 },
    rankRateLabel: { fontSize: 11, fontWeight: '700', color: colors.ink3 },
    emptyText: { fontSize: 13, color: colors.ink3, textAlign: 'center', paddingVertical: 40 },
    disclaimer: { flexDirection: 'row', gap: 8, marginTop: 8, padding: 4 },
    disclaimerBody: { flex: 1 },
    disclaimerAsOf: { fontSize: 11.5, fontWeight: '700', color: colors.ink2, marginBottom: 4 },
    disclaimerText: { fontSize: 11, color: colors.ink3, lineHeight: 16 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingTop: 10 },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 8 },
    modalScroll: { paddingHorizontal: 20, paddingBottom: 12 },
    modalBank: { fontSize: 12.5, fontWeight: '700', color: colors.ink3 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: colors.ink1, marginTop: 4, marginBottom: 14 },
    modalRateRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 18 },
    modalRateNum: { fontSize: 26, fontWeight: '800', color: colors.brand },
    modalRateLabel: { fontSize: 12.5, color: colors.ink3 },
    modalSection: { marginBottom: 16 },
    modalSectionTitle: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, marginBottom: 6 },
    modalSectionBody: { fontSize: 13.5, color: colors.ink1, lineHeight: 20 },
    // Modal은 react-native의 최상위 네이티브 오버레이라 화면의 제스처/버튼 내비게이션 바 안전영역을
    // 자동으로 피해가지 않는다 — 바닥에 붙는 버튼 영역엔 반드시 insets.bottom을 더해줘야 겹치지 않는다.
    modalFooter: { padding: 20, paddingTop: 8, paddingBottom: Math.max(20, bottomInset + 12), gap: 10, borderTopWidth: 1, borderTopColor: colors.line },
    modalSiteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingVertical: 15,
    },
    modalSiteBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
    modalCloseBtn: { alignItems: 'center', paddingVertical: 8 },
    modalCloseBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink3 },
  });
}
