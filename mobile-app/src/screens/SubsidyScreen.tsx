import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors, RADIUS, SHADOW } from '../constants/theme';
import { fetchFirestoreCollection } from '../lib/firestoreRest';
import {
  SUBSIDY_CATEGORIES,
  SUBSIDY_EMPLOYMENT_OPTIONS,
  SUBSIDY_REGIONS,
  SUPPORT_CATEGORY_META,
} from '../data/subsidyCategories';

type SubsidyProgram = {
  id: string;
  title: string;
  category: string;
  summary: string;
  targetAge: { min: number; max: number };
  targetRegions: string[];
  targetEmployment: string[];
  benefits: string;
  deadlineText: string;
  endDate: string | null;
  applyUrl: string;
  checklist: string[];
};

type Dday = { label: string; closed: boolean; indefinite: boolean; days: number };

// index.html의 getSubsidyDday()를 그대로 이식.
function getSubsidyDday(endDate: string | null, deadlineText: string): Dday {
  if (!endDate) {
    const label = deadlineText && deadlineText.indexOf('상시') !== -1 ? '상시' : '문의';
    return { label, closed: false, indefinite: true, days: Infinity };
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  const end = new Date(`${endDate}T00:00:00`).getTime();
  const today = new Date(`${todayStr}T00:00:00`).getTime();
  const diffDays = Math.round((end - today) / 86400000);
  if (diffDays < 0) return { label: '마감', closed: true, indefinite: false, days: diffDays };
  if (diffDays === 0) return { label: 'D-DAY', closed: false, indefinite: false, days: 0 };
  return { label: `D-${diffDays}`, closed: false, indefinite: false, days: diffDays };
}

type PersonalFilter = { age: string; region: string; employment: string };

function isSubsidyMatch(program: SubsidyProgram, filter: PersonalFilter): boolean {
  if (filter.age && !isNaN(Number(filter.age))) {
    const age = Number(filter.age);
    if (age < program.targetAge.min || age > program.targetAge.max) return false;
  }
  if (filter.region && !program.targetRegions.includes('전국') && !program.targetRegions.includes(filter.region)) {
    return false;
  }
  if (filter.employment && program.targetEmployment.length > 0 && !program.targetEmployment.includes(filter.employment)) {
    return false;
  }
  return true;
}

// index.html의 #subsidy(정부 지원금) 뷰를 그대로 이식 — Firestore supportPrograms 컬렉션을
// (Firebase SDK 없이) REST로 통째로 읽어와 카테고리/개인조건 필터 + 마감임박순/최신순 정렬로 보여준다.
// 찜(bookmark)은 로그인 세션이 있어야 Firestore에 쓸 수 있는데 네이티브엔 아직 그 브릿지가 없어서,
// 하트 버튼은 누르면 "로그인 후 이용해주세요" 안내만 하고 실제 저장은 하지 않는다(Phase 3에서 붙일 예정).
export default function SubsidyScreen() {
  const { colors, radius, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, radius, shadow, insets.bottom), [colors, radius, shadow, insets.bottom]);

  const [programs, setPrograms] = useState<SubsidyProgram[] | null>(null);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState<string>('all');
  const [sortMode, setSortMode] = useState<'deadline' | 'latest'>('deadline');
  const [personalFilter, setPersonalFilter] = useState<PersonalFilter>({ age: '', region: '', employment: '' });
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [draftFilter, setDraftFilter] = useState<PersonalFilter>({ age: '', region: '', employment: '' });
  const [selected, setSelected] = useState<SubsidyProgram | null>(null);
  const [checkedRows, setCheckedRows] = useState<Record<number, boolean>>({});

  useEffect(() => {
    fetchFirestoreCollection('supportPrograms')
      .then((docs) => setPrograms(docs as unknown as SubsidyProgram[]))
      .catch(() => setError(true));
  }, []);

  const hasFilter = !!(personalFilter.age || personalFilter.region || personalFilter.employment);

  const filtered = useMemo(() => {
    if (!programs) return [];
    let list = programs;
    if (category !== 'all') list = list.filter((p) => p.category === category);
    if (hasFilter) list = list.filter((p) => isSubsidyMatch(p, personalFilter));
    const sorted = list.slice();
    if (sortMode === 'latest') {
      // updatedAt 정렬은 REST 타임스탬프 문자열이라 문자열 비교로도 최신순이 유지된다(ISO 8601).
      sorted.sort((a: any, b: any) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    } else {
      sorted.sort((a, b) => {
        const da = getSubsidyDday(a.endDate, a.deadlineText);
        const db = getSubsidyDday(b.endDate, b.deadlineText);
        const rank = (x: Dday) => (x.closed ? 2 : x.indefinite ? 1 : 0);
        const ra = rank(da);
        const rb = rank(db);
        if (ra !== rb) return ra - rb;
        return da.days - db.days;
      });
    }
    return sorted;
  }, [programs, category, hasFilter, personalFilter, sortMode]);

  const openFilterModal = () => {
    setDraftFilter(personalFilter);
    setFilterModalOpen(true);
  };
  const applyFilter = () => {
    setPersonalFilter(draftFilter);
    setFilterModalOpen(false);
  };
  const resetFilter = () => {
    setDraftFilter({ age: '', region: '', employment: '' });
  };

  const openDetail = (program: SubsidyProgram) => {
    setChecked({});
    setSelected(program);
  };
  const setChecked = setCheckedRows;

  const onBookmarkPress = useCallback(() => {
    Alert.alert('로그인이 필요해요', '로그인 후 찜할 수 있어요.');
  }, []);

  const onShare = useCallback((program: SubsidyProgram) => {
    Share.share({ message: `[${program.title}] ${program.applyUrl || ''}` }).catch(() => {});
  }, []);

  const summaryText = hasFilter
    ? [
        personalFilter.region,
        personalFilter.age ? `만 ${personalFilter.age}세` : '',
        personalFilter.employment,
      ]
        .filter(Boolean)
        .join(' · ')
    : '조건을 설정하면 나에게 맞는 지원금만 보여드려요';

  return (
    <AppScreen>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <Pressable style={styles.filterBar} onPress={openFilterModal}>
              <Text style={styles.filterBarText} numberOfLines={1}>
                {summaryText}
              </Text>
              <Text style={styles.filterBarBtn}>조건 변경</Text>
            </Pressable>

            <Text style={styles.hero}>지금 받을 수 있는 정부지원금 {programs ? filtered.length : 0}건</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsRow}>
              <Pressable
                style={[styles.pill, category === 'all' && styles.pillActive]}
                onPress={() => setCategory('all')}
              >
                <Text style={[styles.pillText, category === 'all' && styles.pillTextActive]}>전체</Text>
              </Pressable>
              {SUBSIDY_CATEGORIES.map((cat) => {
                const meta = SUPPORT_CATEGORY_META[cat];
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    style={[
                      styles.pill,
                      { backgroundColor: active ? meta.color : meta.bg },
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.pillText, { color: active ? '#fff' : meta.color }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.sortRow}>
              <Pressable
                style={[styles.sortTab, sortMode === 'deadline' && styles.sortTabActive]}
                onPress={() => setSortMode('deadline')}
              >
                <Text style={[styles.sortTabText, sortMode === 'deadline' && styles.sortTabTextActive]}>마감임박순</Text>
              </Pressable>
              <Pressable
                style={[styles.sortTab, sortMode === 'latest' && styles.sortTabActive]}
                onPress={() => setSortMode('latest')}
              >
                <Text style={[styles.sortTabText, sortMode === 'latest' && styles.sortTabTextActive]}>최신순</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={
          programs === null && !error ? (
            <View style={styles.skelWrap}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={styles.skelItem} />
              ))}
            </View>
          ) : error ? (
            <Text style={styles.empty}>지원금 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.</Text>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.empty}>조건에 맞는 지원금이 없어요.</Text>
              <Pressable style={styles.emptyResetBtn} onPress={() => setPersonalFilter({ age: '', region: '', employment: '' })}>
                <Text style={styles.emptyResetBtnText}>조건 변경하기</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item }) => {
          const dday = getSubsidyDday(item.endDate, item.deadlineText);
          const meta = SUPPORT_CATEGORY_META[item.category];
          return (
            <Pressable style={styles.card} onPress={() => openDetail(item)}>
              <View style={styles.cardTop}>
                <Text
                  style={[
                    styles.ddayBadge,
                    dday.closed && styles.ddayClosed,
                    !dday.indefinite && !dday.closed && dday.days <= 7 && styles.ddayUrgent,
                  ]}
                >
                  {dday.label}
                </Text>
                <Pressable onPress={onBookmarkPress} hitSlop={8}>
                  <Ionicons name="heart-outline" size={18} color={colors.ink3} />
                </Pressable>
              </View>
              {meta ? <Text style={[styles.cardCat, { color: meta.color }]}>{meta.label}</Text> : null}
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={styles.cardSummary} numberOfLines={2}>
                {item.summary}
              </Text>
              <Text style={styles.cardLink}>신청 자격 보기 →</Text>
            </Pressable>
          );
        }}
      />

      {/* 상세 바텀시트 */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {selected ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.sheetHeader}>
                  {SUPPORT_CATEGORY_META[selected.category] ? (
                    <View
                      style={[styles.sheetCatBadge, { backgroundColor: SUPPORT_CATEGORY_META[selected.category].bg }]}
                    >
                      <Text style={[styles.sheetCatBadgeText, { color: SUPPORT_CATEGORY_META[selected.category].color }]}>
                        {SUPPORT_CATEGORY_META[selected.category].label}
                      </Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                    <Ionicons name="close-outline" size={24} color={colors.ink2} />
                  </Pressable>
                </View>
                <Text style={styles.sheetTitle}>{selected.title}</Text>
                <Text style={styles.sheetPeriod}>
                  신청기한 {selected.deadlineText || (selected.endDate ? `~${selected.endDate}` : '상시/문의')}
                </Text>
                <View style={styles.benefitBox}>
                  <Text style={styles.benefitEyebrow}>지원 내용</Text>
                  <Text style={styles.benefitText}>{selected.benefits}</Text>
                </View>
                {selected.checklist && selected.checklist.length ? (
                  <View style={styles.checklist}>
                    {selected.checklist.map((line, i) => (
                      <Pressable
                        key={i}
                        style={styles.checklistRow}
                        onPress={() => setCheckedRows((prev) => ({ ...prev, [i]: !prev[i] }))}
                      >
                        <Ionicons
                          name={checkedRows[i] ? 'checkbox' : 'square-outline'}
                          size={18}
                          color={checkedRows[i] ? colors.brand : colors.ink3}
                        />
                        <Text style={[styles.checklistText, checkedRows[i] && styles.checklistTextChecked]}>{line}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionBar}>
                  <Pressable style={styles.shareBtn} onPress={() => onShare(selected)}>
                    <Ionicons name="share-social-outline" size={18} color={colors.ink2} />
                  </Pressable>
                  <Pressable
                    style={styles.applyBtn}
                    onPress={() => selected.applyUrl && Linking.openURL(selected.applyUrl)}
                  >
                    <Text style={styles.applyBtnText}>신청하기</Text>
                  </Pressable>
                </View>
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* 조건 필터 모달 */}
      <Modal visible={filterModalOpen} transparent animationType="slide" onRequestClose={() => setFilterModalOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterModalOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>내 조건 설정</Text>
              <Pressable onPress={() => setFilterModalOpen(false)} hitSlop={12}>
                <Ionicons name="close-outline" size={24} color={colors.ink2} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>나이</Text>
            <View style={styles.ageRow}>
              {[20, 25, 30, 35, 40, 50].map((age) => (
                <Pressable
                  key={age}
                  style={[styles.chip, draftFilter.age === String(age) && styles.chipActive]}
                  onPress={() => setDraftFilter((f) => ({ ...f, age: f.age === String(age) ? '' : String(age) }))}
                >
                  <Text style={[styles.chipText, draftFilter.age === String(age) && styles.chipTextActive]}>{age}세</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>거주 지역</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll}>
              {SUBSIDY_REGIONS.map((region) => (
                <Pressable
                  key={region}
                  style={[styles.chip, draftFilter.region === region && styles.chipActive]}
                  onPress={() => setDraftFilter((f) => ({ ...f, region: f.region === region ? '' : region }))}
                >
                  <Text style={[styles.chipText, draftFilter.region === region && styles.chipTextActive]}>{region}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>직업 상태</Text>
            <View style={styles.chipsWrap}>
              {SUBSIDY_EMPLOYMENT_OPTIONS.map((job) => (
                <Pressable
                  key={job}
                  style={[styles.chip, draftFilter.employment === job && styles.chipActive]}
                  onPress={() => setDraftFilter((f) => ({ ...f, employment: f.employment === job ? '' : job }))}
                >
                  <Text style={[styles.chipText, draftFilter.employment === job && styles.chipTextActive]}>{job}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.filterActionRow}>
              <Pressable style={styles.resetBtn} onPress={resetFilter}>
                <Text style={styles.resetBtnText}>초기화</Text>
              </Pressable>
              <Pressable style={styles.applyFilterBtn} onPress={applyFilter}>
                <Text style={styles.applyFilterBtnText}>적용하기</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, shadow: typeof SHADOW.light, bottomInset: number) {
  return StyleSheet.create({
    content: { padding: 16 },
    filterBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.cardSoft,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 14,
    },
    filterBarText: { flex: 1, fontSize: 12.5, color: colors.ink2, marginRight: 8 },
    filterBarBtn: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
    hero: { fontSize: 19, fontWeight: '800', color: colors.ink1, marginBottom: 14 },
    // 그림자(elevation)가 레이아웃 높이엔 안 잡히고 아래로 번지듯 그려지므로, 다음 줄과 겹쳐 보이지
    // 않도록 여백을 넉넉히 둔다(CalculatorListScreen에서 겪은 것과 같은 문제).
    pillsRow: { gap: 8, paddingBottom: 32 },
    // 카테고리 필터 칩(CalculatorListScreen과 동일 패턴) — active/inactive 사이에서 그림자를 껐다 켜면
    // 안드로이드에서 버튼이 "커지는" 것처럼 보이므로, 두 상태 모두 같은 그림자를 고정으로 깔고
    // 배경색만 바꾼다.
    pill: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    pillActive: { backgroundColor: colors.brand, shadowOpacity: 0 },
    pillText: { fontSize: 13, fontWeight: '800', color: colors.ink2 },
    pillTextActive: { color: '#fff' },
    sortRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
    sortTab: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.cardSoft, ...shadow },
    sortTabActive: { backgroundColor: colors.brandSoft, shadowOpacity: 0 },
    sortTabText: { fontSize: 12.5, fontWeight: '700', color: colors.ink3 },
    sortTabTextActive: { color: colors.brand },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.lg - 4,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 16,
      marginBottom: 10,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    ddayBadge: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.ink2,
      backgroundColor: colors.cardSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      overflow: 'hidden',
    },
    ddayUrgent: { color: colors.loss, backgroundColor: 'rgba(220,38,38,0.1)' },
    ddayClosed: { color: colors.ink3 },
    cardCat: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
    cardTitle: { fontSize: 15.5, fontWeight: '800', color: colors.ink1, marginBottom: 6, lineHeight: 21 },
    cardSummary: { fontSize: 13, color: colors.ink3, lineHeight: 19, marginBottom: 8 },
    cardLink: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
    skelWrap: { gap: 10 },
    skelItem: { height: 120, borderRadius: 16, backgroundColor: colors.cardSoft },
    empty: { textAlign: 'center', color: colors.ink3, fontSize: 13.5, marginTop: 24 },
    emptyWrap: { alignItems: 'center', marginTop: 24, gap: 12 },
    emptyResetBtn: { backgroundColor: colors.brandSoft, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
    emptyResetBtnText: { fontSize: 13, fontWeight: '700', color: colors.brand },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    // Modal은 화면 최상위 오버레이라 제스처/버튼 내비게이션 바 안전영역을 자동으로 피해가지 않는다 —
    // 고정 40px로는 기기별 내비게이션 바 높이를 못 따라가서(특히 삼성 3버튼 내비) 신청하기 버튼이
    // 내비게이션 바와 겹쳐 보였다. insets.bottom을 더해 실제 안전영역만큼 항상 여백을 확보한다.
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: 24,
      paddingBottom: Math.max(40, bottomInset + 24),
      maxHeight: '85%',
    },
    sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    sheetCatBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    sheetCatBadgeText: { fontSize: 12, fontWeight: '700' },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink1, marginBottom: 8 },
    sheetPeriod: { fontSize: 13, color: colors.ink3, marginBottom: 16 },
    benefitBox: { backgroundColor: colors.brandSoft, borderRadius: 14, padding: 14, marginBottom: 16 },
    benefitEyebrow: { fontSize: 12, fontWeight: '700', color: colors.brand, marginBottom: 6 },
    benefitText: { fontSize: 13.5, color: colors.ink1, lineHeight: 20 },
    checklist: { marginBottom: 20, gap: 10 },
    checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checklistText: { flex: 1, fontSize: 13.5, color: colors.ink2, lineHeight: 19 },
    checklistTextChecked: { textDecorationLine: 'line-through', color: colors.ink3 },
    actionBar: { flexDirection: 'row', gap: 10 },
    shareBtn: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.ink2, marginBottom: 8, marginTop: 12 },
    ageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chipsScroll: { gap: 8 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cardSoft, ...shadow },
    chipActive: { backgroundColor: colors.brand, shadowOpacity: 0 },
    chipText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
    chipTextActive: { color: '#fff' },
    filterActionRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
    resetBtn: {
      flex: 1,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resetBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink2 },
    applyFilterBtn: {
      flex: 2,
      height: 46,
      borderRadius: 14,
      backgroundColor: colors.brand,
      alignItems: 'center',
      justifyContent: 'center',
    },
    applyFilterBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  });
}
