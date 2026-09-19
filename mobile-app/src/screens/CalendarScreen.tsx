import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import EventIcon, { EVENT_ICON_SIZE } from '../components/calendar/EventIcon';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { runFirestoreQuery } from '../lib/firestoreRest';
import { loadBrandfetchClientId } from '../lib/brandfetchConfig';
import { fetchWithCache } from '../lib/cachedFetch';
import { loadManualCalendarEvents } from '../lib/manualCalendarEvents';
import { getCalendarQueryRange, getKstTodayParts } from '../lib/kstDate';
import type { ThemeColors, RADIUS } from '../constants/theme';
import type { RootStackParamList } from '../navigation/types';

// 'ipo'/'subsidy'는 Firestore calendarEvents에 실제로 존재하는 카테고리인데(functions/index.js
// 참고) 기존엔 여기 선언돼 있지 않아, 해당 이벤트를 열람하면 CATEGORY_META[ev.category]가
// undefined라 앱이 즉시 크래시했다 — 아이콘 작업 중 발견해 함께 고쳤다.
// 'economy'/'tax'는 index.html의 MANUAL_CALENDAR_EVENTS(경제지표·세무 마감일)에만 존재하던
// 카테고리 — 그 목록을 이식하며 함께 추가했다(같은 undefined 크래시를 막기 위해).
type EventCategory = 'stock' | 'realestate' | 'personal' | 'ipo' | 'subsidy' | 'economy' | 'tax';
const KNOWN_CATEGORIES: readonly EventCategory[] = ['stock', 'realestate', 'personal', 'ipo', 'subsidy', 'economy', 'tax'];

type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  category: EventCategory;
  type?: string;
  title: string;
  meta?: string;
  status?: string | null;
  company?: string | null;
  flag?: string | null;
  // 청약/공모주처럼 접수 시작일·종료일이 있는 기간 일정에만 채워진다(index.html의 rangeText와 동일).
  startDate?: string | null;
  endDate?: string | null;
};

function eventRangeText(ev: Pick<CalEvent, 'startDate' | 'endDate'>): string | null {
  if (!ev.startDate || !ev.endDate) return null;
  return `${String(ev.startDate).slice(0, 10)} ~ ${String(ev.endDate).slice(0, 10)}`;
}

const CATEGORY_META: Record<EventCategory, { label: string; color: string; bg: string }> = {
  stock: { label: '주식', color: '#585CE5', bg: 'rgba(88,92,229,0.10)' },
  realestate: { label: '부동산', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  personal: { label: '개인일정', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  ipo: { label: '공모주', color: '#d97706', bg: 'rgba(217,119,6,0.10)' },
  subsidy: { label: '지원금', color: '#0891b2', bg: 'rgba(8,145,178,0.10)' },
  economy: { label: '경제지표', color: '#3182f6', bg: 'rgba(49,130,246,0.10)' },
  tax: { label: '세무', color: '#f59e0b', bg: 'rgba(245,158,11,0.14)' },
};

const FILTER_OPTIONS: { key: 'all' | EventCategory; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'realestate', label: '부동산 청약' },
  { key: 'ipo', label: '공모주' },
  { key: 'stock', label: '주식' },
  { key: 'economy', label: '경제지표' },
  { key: 'subsidy', label: '지원금' },
  { key: 'tax', label: '세무' },
  { key: 'personal', label: '개인 일정' },
];

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAYS_FULL_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function formatDateStr(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}
// 기기 로컬 시간대가 아니라 항상 한국 기준 "오늘"을 써야(요구사항: Asia/Seoul 기준 처리) 해외에서
// 앱을 켜도 웹과 같은 날짜가 '오늘'로 보인다.
function todayStr(): string {
  const { year, month, day } = getKstTodayParts();
  return formatDateStr(year, month, day);
}
function formatUpdatedAt(ts: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} 업데이트`;
}
function ddayLabel(dateStr: string, today: string): string | null {
  const diff = Math.round(
    (new Date(`${dateStr}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000
  );
  if (diff < 0) return null;
  if (diff === 0) return 'D-DAY';
  return `D-${diff}`;
}

// index.html의 금융 캘린더(월간 그리드 + 카테고리 필터 + 날짜 선택 패널)를 네이티브로 이식한 화면.
// 데이터 소스를 웹과 동일하게 3개로 맞췄다: 1) index.html의 MANUAL_CALENDAR_EVENTS(배당락일·실적·
// 세무 마감일 등 손으로 채워둔 실데이터, /api/calendar-manual-events로 서빙), 2) Firestore
// calendarEvents(DART 공시/청약홈 자동 수집, 웹과 동일하게 현재월 기준 -3개월~+6개월 범위로 쿼리),
// 3) 로그인한 사용자의 개인 일정. (예전엔 1번을 앱 전용 스코프컷으로 제외했었는데, 이게 바로
// "웹보다 정보량이 훨씬 적다"는 문제의 주된 원인이었다 — 이번에 포팅해서 없앴다.)
function mapRawCategory(rawCategory: string | undefined): EventCategory {
  // 알 수 없는 카테고리가 와도(백엔드에 새 카테고리가 추가되는 등) CATEGORY_META 조회가 실패해
  // 크래시하지 않도록, 모르는 값은 안전하게 'stock'으로 접어둔다.
  return KNOWN_CATEGORIES.includes(rawCategory as EventCategory) ? (rawCategory as EventCategory) : 'stock';
}

export default function CalendarScreen() {
  const { colors, radius, shadow } = useAppTheme();
  const { user, getFreshIdToken } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);

  const todayParts = useMemo(() => getKstTodayParts(), []);
  const [viewYear, setViewYear] = useState(todayParts.year);
  const [viewMonth, setViewMonth] = useState(todayParts.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | EventCategory>('all');
  const [sharedEvents, setSharedEvents] = useState<CalEvent[]>([]);
  const [manualEvents, setManualEvents] = useState<CalEvent[]>([]);
  const [personalEvents, setPersonalEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  // 신선 요청이 실패했고 대신 보여줄 캐시조차 없을 때만 true — "이 날짜엔 일정이 없음"과
  // "조회 자체에 실패함"을 구분해서 화면에 다르게 보여주기 위함(요구사항: 빈 데이터로 오판 금지).
  const [loadFailed, setLoadFailed] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);

  const loadShared = useCallback(async () => {
    const { startStr, endStr } = getCalendarQueryRange();
    const result = await fetchWithCache(
      'calendar_shared_events_cache_v1',
      async () => {
        const rows = await runFirestoreQuery({
          collection: 'calendarEvents',
          whereFilters: [
            { field: 'date', op: 'GREATER_THAN_OR_EQUAL', value: startStr },
            { field: 'date', op: 'LESS_THAN_OR_EQUAL', value: endStr },
          ],
          orderByField: 'date',
          orderDirection: 'ASCENDING',
        });
        return rows.map((r) => ({
          id: r.id as string,
          date: String(r.date || ''),
          category: mapRawCategory(r.category as string | undefined),
          type: r.type as string | undefined,
          title: String(r.title || ''),
          meta: r.meta as string | undefined,
          status: (r.status as string | null) ?? null,
          company: (r.company as string | null) ?? null,
          flag: (r.flag as string | null) ?? null,
          startDate: (r.startDate as string | null) ?? null,
          endDate: (r.endDate as string | null) ?? null,
        }));
      },
      [] as CalEvent[]
    );
    setSharedEvents(result.data);
    return result;
  }, []);

  const loadManual = useCallback(async () => {
    const result = await loadManualCalendarEvents();
    setManualEvents(
      result.data.map((ev, index) => ({
        id: `manual-${ev.date}-${index}`,
        date: ev.date,
        category: mapRawCategory(ev.category),
        type: ev.type,
        title: ev.title,
        meta: ev.meta,
        status: ev.status ?? null,
        company: ev.company ?? null,
        flag: ev.flag ?? null,
      }))
    );
    return result;
  }, []);

  const loadPersonal = useCallback(async () => {
    if (!user) {
      setPersonalEvents([]);
      return;
    }
    try {
      const idToken = await getFreshIdToken();
      const rows = await runFirestoreQuery({
        collection: `users/${user.uid}/personalEvents`,
        orderByField: 'date',
        orderDirection: 'ASCENDING',
        idToken: idToken ?? undefined,
      });
      setPersonalEvents(
        rows.map((r) => ({
          id: r.id as string,
          date: String(r.date || ''),
          category: 'personal' as const,
          title: String(r.title || ''),
          meta: r.memo as string | undefined,
        }))
      );
    } catch {
      setPersonalEvents([]);
    }
  }, [user, getFreshIdToken]);

  const refreshAll = useCallback(async () => {
    const [sharedResult, manualResult] = await Promise.all([loadShared(), loadManual(), loadPersonal()]);
    // 두 공개 소스가 전부 실패하고 캐시도 없을 때만 "불러오지 못함"으로 취급한다 — 하나만 실패해도
    // 나머지 소스의 실제 데이터는 그대로 보여주는 게, 일정이 없는 날을 오류로 오판하는 것보다 낫다.
    setLoadFailed(sharedResult.failed && manualResult.failed);
    setUsingCache(sharedResult.fromCache || manualResult.fromCache);
    const timestamps = [sharedResult.fetchedAt, manualResult.fetchedAt].filter((t): t is number => t != null);
    setLastUpdated(timestamps.length ? Math.max(...timestamps) : null);
  }, [loadShared, loadManual, loadPersonal]);

  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  // 기업 로고(Brandfetch) 조회에 쓰는 publishable Client ID — 앱 코드에 값을 심어두지 않고
  // 매번 서버(/api/brandfetch-config)에서 받아온다. 실패해도 null로 남아 중립 아이콘으로 대체된다.
  const [brandfetchClientId, setBrandfetchClientId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadBrandfetchClientId().then((id) => {
      if (!cancelled) setBrandfetchClientId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allEvents = useMemo(
    () => manualEvents.concat(sharedEvents).concat(personalEvents),
    [manualEvents, sharedEvents, personalEvents]
  );

  const monthEvents = useMemo(
    () =>
      allEvents.filter((ev) => {
        if (!ev.date.startsWith(`${viewYear}-${pad2(viewMonth + 1)}`)) return false;
        return filter === 'all' || ev.category === filter;
      }),
    [allEvents, viewYear, viewMonth, filter]
  );

  const eventDaysSet = useMemo(() => new Set(monthEvents.map((ev) => Number(ev.date.slice(-2)))), [monthEvents]);

  const grid = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewYear, viewMonth]);

  const changeMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewYear(y);
    setViewMonth(m);
    setSelectedDay(null);
  };

  const selectedDayEvents = useMemo(() => {
    if (selectedDay === null) return [];
    const dateStr = formatDateStr(viewYear, viewMonth, selectedDay);
    return allEvents.filter((ev) => ev.date === dateStr && (filter === 'all' || ev.category === filter));
  }, [allEvents, viewYear, viewMonth, selectedDay, filter]);

  const now = todayStr();

  return (
    <AppScreen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <View style={styles.headRow}>
          <Text style={styles.heading}>금융 캘린더</Text>
          <Pressable style={styles.addBtn} onPress={() => navigation.navigate('PersonalEvents')}>
            <Ionicons name="add" size={15} color={colors.brand} />
            <Text style={styles.addBtnText}>일정 추가</Text>
          </Pressable>
        </View>

        <View style={styles.updatedRow}>
          <Text style={styles.updatedText}>
            {usingCache ? '오프라인 · 마지막으로 불러온 데이터예요' : lastUpdated ? formatUpdatedAt(lastUpdated) : ''}
          </Text>
          <Pressable style={styles.refreshBtn} onPress={onRefresh} disabled={refreshing} hitSlop={8}>
            <Ionicons name="refresh-outline" size={13} color={colors.ink3} />
            <Text style={styles.refreshBtnText}>새로고침</Text>
          </Pressable>
        </View>
        {loadFailed ? (
          <View style={styles.errorBanner}>
            <Ionicons name="cloud-offline-outline" size={15} color={colors.loss} />
            <Text style={styles.errorBannerText}>일정을 불러오지 못했어요. 네트워크를 확인하고 새로고침해주세요.</Text>
          </View>
        ) : null}

        <View style={styles.navRow}>
          <Pressable style={styles.navBtn} onPress={() => changeMonth(-1)}>
            <Ionicons name="chevron-back-outline" size={18} color={colors.ink2} />
          </Pressable>
          <Text style={styles.navLabel}>
            {viewYear}년 {viewMonth + 1}월
          </Text>
          <Pressable style={styles.navBtn} onPress={() => changeMonth(1)}>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.ink2} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {WEEKDAYS_KO.map((w, i) => (
            <Text key={w} style={[styles.weekday, i === 0 && styles.weekdaySun, i === 6 && styles.weekdaySat]}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {grid.map((day, idx) => {
            if (day === null) return <View key={idx} style={styles.cell} />;
            const dateStr = formatDateStr(viewYear, viewMonth, day);
            const isToday = dateStr === now;
            const isSelected = day === selectedDay;
            return (
              <Pressable
                key={idx}
                style={[styles.cell, isSelected && styles.cellSelected]}
                onPress={() => setSelectedDay(isSelected ? null : day)}
              >
                <Text style={[styles.cellNum, isToday && styles.cellNumToday, isSelected && styles.cellNumSelected]}>
                  {day}
                </Text>
                {eventDaysSet.has(day) ? <View style={[styles.dot, isSelected && styles.dotSelected]} /> : null}
              </Pressable>
            );
          })}
        </View>

        {selectedDay !== null ? (
          <View style={styles.selectedPanel}>
            <View style={styles.selectedHeadRow}>
              <Text style={styles.selectedHeading}>
                {viewMonth + 1}월 {selectedDay}일 · {WEEKDAYS_FULL_KO[new Date(viewYear, viewMonth, selectedDay).getDay()]}요일
                {formatDateStr(viewYear, viewMonth, selectedDay) === now ? ' · 오늘' : ''}
              </Text>
              <Pressable onPress={() => setSelectedDay(null)} hitSlop={10}>
                <Ionicons name="close-outline" size={20} color={colors.ink2} />
              </Pressable>
            </View>
            {selectedDayEvents.length === 0 ? (
              <Text style={styles.selectedEmpty}>이 날짜엔 일정이 없어요</Text>
            ) : (
              selectedDayEvents.map((ev) => (
                <Pressable key={ev.id} style={styles.eventRow} onPress={() => setDetailEvent(ev)}>
                  <EventIcon event={ev} allEvents={allEvents} brandfetchClientId={brandfetchClientId} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventCat}>
                      {CATEGORY_META[ev.category].label}
                      {ev.type ? ` · ${ev.type}` : ''}
                    </Text>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {ev.title}
                    </Text>
                    {eventRangeText(ev) ? <Text style={styles.eventRange}>{eventRangeText(ev)}</Text> : null}
                    {ev.meta ? <Text style={styles.eventMeta}>{ev.meta}</Text> : null}
                  </View>
                  {ddayLabel(ev.date, now) ? <Text style={styles.eventDday}>{ddayLabel(ev.date, now)}</Text> : null}
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setFilter(opt.key)}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <Text style={styles.selectedEmpty}>불러오는 중…</Text>
        ) : monthEvents.length === 0 && loadFailed ? (
          <Text style={styles.selectedEmpty}>일정을 불러오지 못했어요. 새로고침해주세요</Text>
        ) : monthEvents.length === 0 ? (
          <Text style={styles.selectedEmpty}>이 달에는 해당 조건의 일정이 없어요</Text>
        ) : (
          <Text style={styles.monthCount}>이번 달 일정 {monthEvents.length}건</Text>
        )}
      </ScrollView>

      <Modal visible={!!detailEvent} transparent animationType="fade" onRequestClose={() => setDetailEvent(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailEvent(null)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {detailEvent ? (
              <>
                <View style={styles.modalTopRow}>
                  <EventIcon event={detailEvent} allEvents={allEvents} brandfetchClientId={brandfetchClientId} />
                  <View style={[styles.modalCatBadge, { backgroundColor: CATEGORY_META[detailEvent.category].bg }]}>
                    <Text style={[styles.modalCatBadgeText, { color: CATEGORY_META[detailEvent.category].color }]}>
                      {CATEGORY_META[detailEvent.category].label}
                      {detailEvent.type ? ` · ${detailEvent.type}` : ''}
                    </Text>
                  </View>
                </View>
                <Text style={styles.modalTitle}>{detailEvent.title}</Text>
                <Text style={styles.modalDate}>{eventRangeText(detailEvent) ?? detailEvent.date}</Text>
                {detailEvent.meta ? <Text style={styles.modalMeta}>{detailEvent.meta}</Text> : null}
                <Pressable style={styles.modalCloseBtn} onPress={() => setDetailEvent(null)}>
                  <Text style={styles.modalCloseBtnText}>닫기</Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, shadow: typeof import('../constants/theme').SHADOW.light) {
  return StyleSheet.create({
    content: { padding: 16, paddingBottom: 40 },
    headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    heading: { fontSize: 20, fontWeight: '800', color: colors.ink1 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.brandSoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
    addBtnText: { fontSize: 12.5, fontWeight: '700', color: colors.brand },
    updatedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    updatedText: { fontSize: 11, color: colors.ink3, flex: 1 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    refreshBtnText: { fontSize: 11.5, fontWeight: '700', color: colors.ink3 },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: 'rgba(225,29,72,0.10)',
      borderRadius: 12,
      padding: 10,
      marginBottom: 14,
    },
    errorBannerText: { flex: 1, fontSize: 11.5, fontWeight: '600', color: colors.loss },
    navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 16 },
    navBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadow },
    navLabel: { fontSize: 16.5, fontWeight: '800', color: colors.ink1, minWidth: 110, textAlign: 'center' },
    weekdayRow: { flexDirection: 'row', marginBottom: 8 },
    weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: colors.ink3 },
    weekdaySun: { color: '#e11d48' },
    weekdaySat: { color: colors.brand },
    grid: { flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.card, borderRadius: radius.lg, padding: 6, marginBottom: 16 },
    cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
    cellSelected: { backgroundColor: colors.brandSoft, borderRadius: 12 },
    cellNum: { fontSize: 14, fontWeight: '600', color: colors.ink1 },
    cellNumToday: { color: colors.brand, fontWeight: '800' },
    cellNumSelected: { color: colors.brand, fontWeight: '800' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.brand },
    dotSelected: { backgroundColor: colors.brand },
    selectedPanel: { backgroundColor: colors.cardSoft, borderRadius: radius.lg, padding: 14, marginBottom: 16 },
    selectedHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    selectedHeading: { fontSize: 13.5, fontWeight: '800', color: colors.ink1 },
    selectedEmpty: { fontSize: 12.5, color: colors.ink3, textAlign: 'center', paddingVertical: 16 },
    eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: colors.card, borderRadius: 14, padding: 12, marginBottom: 8, ...shadow },
    eventBody: { flex: 1 },
    eventCat: { fontSize: 11, fontWeight: '700', color: colors.ink3, marginBottom: 3 },
    eventTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink1, lineHeight: 19 },
    eventRange: { fontSize: 11.5, fontWeight: '700', color: colors.brand, marginTop: 3 },
    eventMeta: { fontSize: 11.5, color: colors.ink3, marginTop: 3 },
    eventDday: { fontSize: 11, fontWeight: '800', color: colors.brand, flexShrink: 0 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    filterPill: { backgroundColor: colors.cardSoft, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
    filterPillActive: { backgroundColor: colors.brand },
    filterPillText: { fontSize: 12.5, fontWeight: '700', color: colors.ink2 },
    filterPillTextActive: { color: '#fff' },
    monthCount: { fontSize: 12, color: colors.ink3, textAlign: 'center', marginTop: 4 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    modalCard: { width: '100%', backgroundColor: colors.card, borderRadius: radius.lg, padding: 22 },
    modalTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    modalCatBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    modalCatBadgeText: { fontSize: 11.5, fontWeight: '700' },
    modalTitle: { fontSize: 16.5, fontWeight: '800', color: colors.ink1, marginBottom: 6, lineHeight: 23 },
    modalDate: { fontSize: 12.5, color: colors.ink3, marginBottom: 4 },
    modalMeta: { fontSize: 13, color: colors.ink2, marginBottom: 16 },
    modalCloseBtn: { alignItems: 'center', paddingVertical: 12, backgroundColor: colors.cardSoft, borderRadius: 999, marginTop: 8 },
    modalCloseBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
  });
}