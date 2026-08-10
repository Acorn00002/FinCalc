import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../ui/Card';
import NumberField from '../calc/NumberField';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchUserAssets, saveUserAssetGoal } from '../../lib/userAssets';
import type { ThemeColors } from '../../constants/theme';

const GOAL_QUICK_ADDS = [
  { amount: 10_000_000, label: '+1000만' },
  { amount: 100_000_000, label: '+1억' },
  { amount: 1_000_000_000, label: '+10억' },
];

function pad2(n: number) {
  return String(n).padStart(2, '0');
}
function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

type Props = {
  /** AssetDashboardCard가 저장/로드할 때 알려주는 실시간 총자산 — 두 카드가 같은 값을 공유한다. */
  currentTotal: number;
};

// index.html #view-mypage의 자산 목표 트래커(SAVE 스타일) 이식 — userAssets/{uid} 문서의
// goalAmount/goalDate 필드(자산 입력과 같은 문서)를 그대로 재사용한다. 목표가 없으면 입력 폼을,
// 있으면 진행률 카드를 보여주는 home-score-card와 동일한 전환 패턴.
export default function AssetGoalCard({ currentTotal }: Props) {
  const { colors } = useAppTheme();
  const { user, getFreshIdToken } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(true);
  const [goalAmount, setGoalAmount] = useState(0);
  const [goalDate, setGoalDate] = useState('');
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const idToken = await getFreshIdToken();
      if (!idToken) {
        setLoading(false);
        return;
      }
      try {
        const doc = await fetchUserAssets(user.uid, idToken);
        if (cancelled) return;
        if (doc.goalAmount) {
          setGoalAmount(doc.goalAmount);
          setEditing(false);
        }
        if (doc.goalDate) {
          setGoalDate(doc.goalDate);
          const [y, m, d] = doc.goalDate.split('-');
          setYear(y);
          setMonth(m);
          setDay(d);
        }
      } catch {
        // 조회 실패 시 입력 폼 상태 그대로 둔다
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('로그인이 필요해요', '로그인 후 저장할 수 있어요.');
      return;
    }
    if (!goalAmount) {
      Alert.alert('목표 금액을 입력해주세요');
      return;
    }
    const idToken = await getFreshIdToken();
    if (!idToken) {
      Alert.alert('로그인이 필요해요', '로그인 후 저장할 수 있어요.');
      return;
    }

    let nextGoalDate: string | undefined;
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    if (year && month && day && y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      nextGoalDate = `${y}-${pad2(m)}-${pad2(d)}`;
    }

    setSaving(true);
    try {
      await saveUserAssetGoal(user.uid, idToken, { goalAmount, goalDate: nextGoalDate });
      if (nextGoalDate) setGoalDate(nextGoalDate);
      setEditing(false);
    } catch {
      Alert.alert('저장에 실패했어요', '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card style={styles.loadingCard}>
        <ActivityIndicator color={colors.brand} />
      </Card>
    );
  }

  if (editing) {
    return (
      <Card style={styles.card}>
        <Text style={styles.inputTitle}>자산 목표를 설정해보세요</Text>
        <NumberField label="목표 금액" value={goalAmount} onChange={setGoalAmount} suffix="원" quickAdds={GOAL_QUICK_ADDS} showReset />
        <Text style={styles.dateLabel}>목표 기한 (선택)</Text>
        <View style={styles.dateRow}>
          <TextInput
            style={styles.dateInput}
            value={year}
            onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
            placeholder="YYYY"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            maxLength={4}
          />
          <Text style={styles.dateSep}>-</Text>
          <TextInput
            style={styles.dateInput}
            value={month}
            onChangeText={(t) => setMonth(t.replace(/[^0-9]/g, '').slice(0, 2))}
            placeholder="MM"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={styles.dateSep}>-</Text>
          <TextInput
            style={styles.dateInput}
            value={day}
            onChangeText={(t) => setDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
            placeholder="DD"
            placeholderTextColor={colors.ink3}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>목표 저장하기</Text>}
        </Pressable>
      </Card>
    );
  }

  const pct = goalAmount > 0 ? Math.min(100, Math.round((currentTotal / goalAmount) * 100)) : 0;
  let ddayText = '';
  if (goalDate) {
    const diffDays = Math.round(
      (new Date(`${goalDate}T00:00:00`).getTime() - new Date(`${todayYMD()}T00:00:00`).getTime()) / 86400000
    );
    if (diffDays > 0) ddayText = `목표일까지 D-${diffDays}`;
    else if (diffDays === 0) ddayText = '목표일이 오늘이에요';
    else ddayText = `목표일이 ${Math.abs(diffDays)}일 지났어요`;
  }

  return (
    <Card style={styles.card}>
      <View style={styles.resultHead}>
        <Text style={styles.resultTitle}>목표 달성률</Text>
        <Pressable style={styles.editBtn} onPress={() => setEditing(true)} hitSlop={8}>
          <Ionicons name="pencil-outline" size={15} color={colors.ink3} />
        </Pressable>
      </View>
      <Text style={styles.pct}>{pct}%</Text>
      <View style={styles.gaugeTrack}>
        <View style={[styles.gaugeFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.caption}>
        현재 {currentTotal.toLocaleString('ko-KR')}원 / 목표 {goalAmount.toLocaleString('ko-KR')}원
      </Text>
      {ddayText ? <Text style={styles.dday}>{ddayText}</Text> : null}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loadingCard: { marginBottom: 14, paddingVertical: 28, alignItems: 'center' },
    card: { marginBottom: 14 },
    inputTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink1, marginBottom: 14 },
    dateLabel: { fontSize: 13.5, fontWeight: '700', color: colors.ink2, marginBottom: 10 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    dateInput: {
      flex: 1,
      backgroundColor: colors.cardSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 15,
      fontWeight: '700',
      color: colors.ink1,
      textAlign: 'center',
    },
    dateSep: { fontSize: 15, fontWeight: '700', color: colors.ink3 },
    saveBtn: { backgroundColor: colors.brand, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    saveBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
    resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
    resultTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink1 },
    editBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      backgroundColor: colors.cardSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pct: { fontSize: 30, fontWeight: '800', color: colors.brand, marginBottom: 10 },
    gaugeTrack: { width: '100%', height: 10, borderRadius: 999, backgroundColor: colors.cardSoft, overflow: 'hidden' },
    gaugeFill: { height: '100%', borderRadius: 999, backgroundColor: colors.brand },
    caption: { fontSize: 12.5, fontWeight: '600', color: colors.ink3, marginTop: 10 },
    dday: { fontSize: 12.5, fontWeight: '700', color: colors.ink2, marginTop: 6 },
  });
}