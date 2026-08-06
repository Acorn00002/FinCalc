import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors, RADIUS, SHADOW } from '../constants/theme';
import { FINANCE_DATA, LOAN_FINANCE_CATEGORIES } from '../data/financeProducts';
import { getBankHomepage } from '../data/bankHomepages';
import { fetchLiveFinanceProducts, LiveFinanceProduct } from '../lib/financeProductsApi';
import type { RootStackParamList } from '../navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'FinanceProducts'>;

function formatRate(n: number | null | undefined): string {
  return typeof n === 'number' && !isNaN(n) ? `${n.toFixed(2)}%` : '정보 없음';
}

// index.html의 #view-finance(정기예금/정기적금/주택담보대출/전월세보증금대출/신용대출 실제 상품
// 금리 비교 랭킹)를 이식한 화면 — 정적 조사 데이터 대신 금융감독원 "금융상품 한눈에" Open API를
// 서버(functions/financeProductsLive) 경유로 실시간 조회하도록 교체했다. 카드를 탭하면 우대조건
// 상세 모달이 뜨고, 모달 하단의 "공식 은행 사이트로 이동" 버튼으로 해당 은행 홈페이지로 연결된다.
export default function FinanceProductsScreen() {
  const route = useRoute<RouteProps>();
  const category = route.params.category;
  const isLoan = LOAN_FINANCE_CATEGORIES.includes(category);
  const copy = FINANCE_DATA[category];
  const [sort, setSort] = useState<'rate-desc' | 'rate-asc' | 'preferential'>(isLoan ? 'rate-asc' : 'rate-desc');

  const [products, setProducts] = useState<LiveFinanceProduct[]>([]);
  const [asOf, setAsOf] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LiveFinanceProduct | null>(null);

  const { colors, radius, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, radius, shadow, insets.bottom), [colors, radius, shadow, insets.bottom]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLiveFinanceProducts(category)
      .then(({ products: list, asOf: month }) => {
        if (cancelled) return;
        setProducts(list);
        setAsOf(month);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : '실시간 상품 정보를 불러오지 못했습니다.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const sorted = useMemo(() => {
    const list = products.slice();
    const rate = (p: LiveFinanceProduct, key: 'baseRate' | 'maxRate') => (typeof p[key] === 'number' ? (p[key] as number) : isLoan ? Infinity : -Infinity);
    if (sort === 'rate-desc') list.sort((a, b) => rate(b, 'maxRate') - rate(a, 'maxRate'));
    else if (sort === 'rate-asc') list.sort((a, b) => rate(a, 'baseRate') - rate(b, 'baseRate'));
    else if (sort === 'preferential') {
      list.sort((a, b) => (rate(b, 'maxRate') - rate(b, 'baseRate')) - (rate(a, 'maxRate') - rate(a, 'baseRate')));
    }
    return list;
  }, [products, sort, isLoan]);

  const best = useMemo(() => {
    if (!sorted.length) return null;
    let candidate = sorted[0];
    sorted.forEach((p) => {
      if (isLoan) {
        if (typeof p.baseRate === 'number' && (typeof candidate.baseRate !== 'number' || p.baseRate < candidate.baseRate)) candidate = p;
      } else if (typeof p.maxRate === 'number' && (typeof candidate.maxRate !== 'number' || p.maxRate > candidate.maxRate)) {
        candidate = p;
      }
    });
    return candidate;
  }, [sorted, isLoan]);

  const sorts = isLoan ? [{ key: 'rate-asc' as const, label: '금리 낮은순' }] : [
    { key: 'rate-desc' as const, label: '금리 높은순' },
    { key: 'preferential' as const, label: '우대금리순' },
  ];

  const openBankSite = (bank: string) => {
    const url = getBankHomepage(bank);
    if (url) Linking.openURL(url);
  };

  return (
    <AppScreen>
      {loading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.centerFill}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.ink3} />
          <Text style={styles.errorText}>{error}</Text>
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
                    <Text style={styles.adDesc}>
                      실시간 조회 상품 중 {isLoan ? '가장 낮은 금리' : '가장 높은 우대금리'}예요. 우대조건 충족 여부에 따라 실제 적용 금리는 달라질 수 있어요.
                    </Text>
                  </View>
                  <View style={styles.adRateWrap}>
                    <Text style={styles.adRateNum}>{formatRate(isLoan ? best.baseRate : best.maxRate)}</Text>
                    <Text style={styles.adRateLabel}>{isLoan ? '최저금리' : '최고 우대금리'}</Text>
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
            const rank = index + 1;
            const hasBaseAndMax = typeof item.baseRate === 'number' && typeof item.maxRate === 'number';
            const primaryRate = isLoan ? formatRate(item.baseRate) : formatRate(hasBaseAndMax ? item.maxRate : item.baseRate);
            const secondaryRate = isLoan ? item.term || '가입 조건 확인 필요' : `기본 ${formatRate(item.baseRate)} · ${item.term || '가입 기간 확인 필요'}`;
            return (
              <Pressable style={styles.rankItem} onPress={() => setSelected(item)}>
                <Text style={styles.rankNum}>{rank}</Text>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankBank}>{item.bank}</Text>
                  <Text style={styles.rankName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <View style={styles.rankRates}>
                  <Text style={styles.rankRatePrimary}>{primaryRate}</Text>
                  <Text style={styles.rankRateSecondary}>{secondaryRate}</Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={16} color={colors.ink3} />
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={styles.emptyText}>조회된 상품이 없어요.</Text>}
          ListFooterComponent={
            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={16} color={colors.ink3} />
              <View style={styles.disclaimerBody}>
                <Text style={styles.disclaimerAsOf}>
                  금융감독원 「금융상품 한눈에」 Open API{asOf ? ` · ${asOf} 공시` : ''}
                </Text>
                <Text style={styles.disclaimerText}>
                  실시간으로 조회한 공시 데이터이지만, 우대금리 조건과 한도는 은행별로 다를 수 있으니 가입 전 반드시 해당 은행에서
                  최신 조건을 다시 확인해 주세요.
                </Text>
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
                    <Text style={styles.modalRateNum}>{formatRate(isLoan ? selected.baseRate : selected.maxRate)}</Text>
                    <Text style={styles.modalRateLabel}>{isLoan ? '최저금리' : '최고 우대금리'}</Text>
                  </View>

                  {selected.specialCondition ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>우대조건</Text>
                      <Text style={styles.modalSectionBody}>{selected.specialCondition}</Text>
                    </View>
                  ) : null}
                  {selected.joinWay ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>가입 방법</Text>
                      <Text style={styles.modalSectionBody}>{selected.joinWay}</Text>
                    </View>
                  ) : null}
                  {selected.joinMember ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>가입 대상</Text>
                      <Text style={styles.modalSectionBody}>{selected.joinMember}</Text>
                    </View>
                  ) : null}
                  {selected.maxLimit ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>한도</Text>
                      <Text style={styles.modalSectionBody}>{selected.maxLimit}</Text>
                    </View>
                  ) : null}
                  {selected.maturityInterest ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>만기 후 이자율</Text>
                      <Text style={styles.modalSectionBody}>{selected.maturityInterest}</Text>
                    </View>
                  ) : null}
                  {selected.etcNote ? (
                    <View style={styles.modalSection}>
                      <Text style={styles.modalSectionTitle}>기타 유의사항</Text>
                      <Text style={styles.modalSectionBody}>{selected.etcNote}</Text>
                    </View>
                  ) : null}
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
