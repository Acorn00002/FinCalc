import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppScreen from '../components/AppScreen';
import ScreenTitleBar from '../components/ui/ScreenTitleBar';
import { useAppTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { addFirestoreDocument, deleteFirestoreDocument, runFirestoreQuery } from '../lib/firestoreRest';
import type { ThemeColors, RADIUS } from '../constants/theme';

type PersonalEvent = { id: string; date: string; title: string; memo?: string };

// index.html의 금융 캘린더 "일정 추가"(users/{uid}/personalEvents)를 그대로 이식한 네이티브 관리 화면.
// 캘린더 본 화면(월간 그리드 + 여러 데이터 소스 집계)은 당분간 웹뷰로 유지하고, 로그인 기반의 개인
// 일정 추가/삭제만 네이티브로 옮겼다 — 같은 Firestore 경로를 쓰므로 웹 캘린더에도 그대로 반영된다.
export default function PersonalEventsScreen() {
  const { colors, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, getFreshIdToken } = useAuth();
  const styles = useMemo(() => createStyles(colors, radius, insets.bottom), [colors, radius, insets.bottom]);

  const [events, setEvents] = useState<PersonalEvent[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const idToken = await getFreshIdToken();
      const rows = await runFirestoreQuery({
        collection: `users/${user.uid}/personalEvents`,
        orderByField: 'date',
        orderDirection: 'ASCENDING',
        idToken: idToken ?? undefined,
      });
      setEvents(rows as unknown as PersonalEvent[]);
    } catch {
      setEvents([]);
    }
  }, [user, getFreshIdToken]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setDate('');
    setTitle('');
    setMemo('');
    setFormError('');
    setAddOpen(true);
  };

  const submit = async () => {
    if (!user) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setFormError('날짜는 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    if (!title.trim()) {
      setFormError('제목은 필수예요.');
      return;
    }
    setSubmitting(true);
    try {
      const idToken = await getFreshIdToken();
      if (!idToken) throw new Error('no token');
      await addFirestoreDocument(
        `users/${user.uid}/personalEvents`,
        { date: date.trim(), title: title.trim(), memo: memo.trim(), createdAt: new Date().toISOString() },
        idToken
      );
      setAddOpen(false);
      await load();
    } catch {
      setFormError('추가에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = (ev: PersonalEvent) => {
    Alert.alert('일정 삭제', `"${ev.title}" 일정을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const idToken = await getFreshIdToken();
          if (!idToken) return;
          setEvents((prev) => (prev ?? []).filter((e) => e.id !== ev.id));
          try {
            await deleteFirestoreDocument(`users/${user.uid}/personalEvents/${ev.id}`, idToken);
          } catch {
            await load();
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <AppScreen>
        <ScreenTitleBar title="내 일정 관리" />
        <View style={styles.centerFill}>
          <Text style={styles.empty}>로그인 후 개인 일정을 추가할 수 있어요.</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <ScreenTitleBar title="내 일정 관리" />
      <FlatList
        data={events ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Pressable style={styles.addBtn} onPress={openAdd}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addBtnText}>일정 추가</Text>
          </Pressable>
        }
        ListEmptyComponent={
          events === null ? (
            <Text style={styles.empty}>불러오는 중…</Text>
          ) : (
            <Text style={styles.empty}>아직 추가한 개인 일정이 없어요.</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.eventRow}>
            <View style={styles.eventLeft}>
              <Text style={styles.eventDate}>{item.date}</Text>
              <Text style={styles.eventTitle}>{item.title}</Text>
              {item.memo ? <Text style={styles.eventMemo}>{item.memo}</Text> : null}
            </View>
            <Pressable onPress={() => remove(item)} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={colors.ink3} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>일정 추가</Text>
              <Pressable onPress={() => setAddOpen(false)} hitSlop={12}>
                <Ionicons name="close-outline" size={24} color={colors.ink2} />
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="날짜 (YYYY-MM-DD)"
              placeholderTextColor={colors.ink3}
              value={date}
              onChangeText={setDate}
            />
            <TextInput
              style={styles.input}
              placeholder="제목"
              placeholderTextColor={colors.ink3}
              value={title}
              onChangeText={setTitle}
              maxLength={60}
            />
            <TextInput
              style={styles.input}
              placeholder="메모 (선택)"
              placeholderTextColor={colors.ink3}
              value={memo}
              onChangeText={setMemo}
              maxLength={200}
            />
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
            <Pressable style={styles.submitBtn} onPress={submit} disabled={submitting}>
              <Text style={styles.submitBtnText}>{submitting ? '추가 중…' : '추가하기'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </AppScreen>
  );
}

function createStyles(colors: ThemeColors, radius: typeof RADIUS, bottomInset: number) {
  return StyleSheet.create({
    screen: { flex: 1 },
    centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    content: { padding: 16 },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.brand,
      borderRadius: 999,
      paddingVertical: 12,
      marginBottom: 16,
    },
    addBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
    empty: { textAlign: 'center', color: colors.ink3, fontSize: 13.5, marginTop: 24 },
    eventRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 14,
      marginBottom: 10,
    },
    eventLeft: { flex: 1, marginRight: 12 },
    eventDate: { fontSize: 11.5, color: colors.brand, fontWeight: '700', marginBottom: 4 },
    eventTitle: { fontSize: 14, fontWeight: '700', color: colors.ink1 },
    eventMemo: { fontSize: 12.5, color: colors.ink3, marginTop: 4 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius.lg,
      borderTopRightRadius: radius.lg,
      padding: 24,
      paddingBottom: Math.max(40, bottomInset + 24),
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.ink1 },
    input: {
      backgroundColor: colors.cardSoft,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.ink1,
      marginBottom: 10,
    },
    formError: { fontSize: 12.5, color: colors.loss, marginBottom: 10 },
    submitBtn: { backgroundColor: colors.brand, borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
    submitBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  });
}
