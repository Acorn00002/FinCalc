import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchFirestoreCollection, runFirestoreQuery } from '../lib/firestoreRest';
import type { ThemeColors, RADIUS } from '../constants/theme';
import type { RootStackParamList } from '../navigation/types';

type EventCategory = 'stock' | 'realestate' | 'personal';

type CalEvent = {
  id: string;
  date: string; // YYYY-MM-DD
  category: EventCategory;
  type?: string;
  title: string;
  meta?: string;
  status?: string | null;
};

const CATEGORY_META: Record<EventCategory, { label: string; color: string; bg: string }> = {
  stock: { label: '주식', color: '#585CE5', bg: 'rgba(88,92,229,0.10)' },
  realestate: { label: '부동산', color: '#059669', bg: 'rgba(5,150,105,0.10)' },
  personal: { label: '개인일정', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const FILTER_OPTIONS: { key: 'all' | EventCategory; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'realestate', label: '부동산 청약' },
  { key: 'stock', label: '주식' },
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
function todayStr(): string {
  const d = new Date();
  return formatDateStr(d.getFullYear(), d.getMonth(), d.getDate());
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
// 웹의 MANUAL_CALENDAR_EVENTS(배당/경제지표 등 손으로 채워둔 대량의 하드코딩 목록)는 index.html에만
// 있고 별도 공유 데이터 파일로 분리돼 있지 않아, 이번엔 실제 실시간 데이터인 두 소스만 가져온다:
// Firestore calendarEvents(DART 공시/청약홈 청약 자동 수집)와 로그인한 사용자의 개인 일정.
export default function CalendarScreen() {
  const { colors, radius, shadow } = useAppTheme();
  const { user, getFreshIdToken } = useAuth();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useMemo(() => createStyles(colors, radius, shadow), [colors, radius, shadow]);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | EventCategory>('all');
  const [sharedEvents, setSharedEvents] = useState<CalEvent[]>([]);
  const [personalEvents, setPersonalEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailEvent, setDetailEvent] = useState<CalEvent | null>(null);

  const loadShared = useCallback(async () => {
    try {
      const rows = await fetchFirestoreCollection('calendarEvents');
      setSharedEvents(
        rows.map((r) => ({
          id: r.id as string,
          date: String(r.date || ''),
          category: (r.category as EventCategory) || 'stock',
          type: r.type as string | undefined,
          title: String(r.title || ''),
          meta: r.meta as string | undefined,
          status: (r.status as string | null) ?? null,
        }))
      );
    } catch {
      setSharedEvents([]);
    }
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

  useEffect(() => {
    setLoading(true);
    Promise.all([loadShared(), loadPersonal()]).finally(() => setLoading(false));
  }, [loadShared, loadPersonal]);

  const allEvents = useMemo(() => sharedEvents.concat(personalEvents), [sharedEvents, personalEvents]);

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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headRow}>
          <Text style={styles.heading}>금융 캘린더</Text>
          <Pressable style={styles.addBtn} onPress={() => navigation.navigate('PersonalEvents')}>
            <Ionicons name="add" size={15} color={colors.brand} />
            <Text style={styles.addBtnText}>일정 추가</Text>
          </Pressable>
        </View>

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
                  <View style={[styles.catDot, { backgroundColor: CATEGORY_META[ev.category].color }]} />
                  <View style={styles.eventBody}>
                    <Text style={styles.eventCat}>
                      {CATEGORY_META[ev.category].label}
                      {ev.type ? ` · ${ev.type}` : ''}
                    </Text>
                    <Text style={styles.eventTitle} numberOfLines={2}>
                      {ev.title}
                    </Text>
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
                <View style={[styles.modalCatBadge, { backgroundColor: CATEGORY_META[detailEvent.category].bg }]}>
                  <Text style={[styles.modalCatBadgeText, { color: CATEGORY_META[detailEvent.category].color }]}>
                    {CATEGORY_META[detailEvent.category].label}
                    {detailEvent.type ? ` · ${detailEvent.type}` : ''}
                  </Text>
                </View>
                <Text style={styles.modalTitle}>{detailEvent.title}</Text>
                <Text style={styles.modalDate}>{detailEvent.date}</Text>
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
    catDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
    eventBody: { flex: 1 },
    eventCat: { fontSize: 11, fontWeight: '700', color: colors.ink3, marginBottom: 3 },
    eventTitle: { fontSize: 13.5, fontWeight: '700', color: colors.ink1, lineHeight: 19 },
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
    modalCatBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 12 },
    modalCatBadgeText: { fontSize: 11.5, fontWeight: '700' },
    modalTitle: { fontSize: 16.5, fontWeight: '800', color: colors.ink1, marginBottom: 6, lineHeight: 23 },
    modalDate: { fontSize: 12.5, color: colors.ink3, marginBottom: 4 },
    modalMeta: { fontSize: 13, color: colors.ink2, marginBottom: 16 },
    modalCloseBtn: { alignItems: 'center', paddingVertical: 12, backgroundColor: colors.cardSoft, borderRadius: 999, marginTop: 8 },
    modalCloseBtnText: { fontSize: 13, fontWeight: '700', color: colors.ink2 },
  });
}