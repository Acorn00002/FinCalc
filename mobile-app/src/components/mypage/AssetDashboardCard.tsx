import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Card from '../ui/Card';
import NumberField from '../calc/NumberField';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchUserAssets, saveUserAssetBreakdown } from '../../lib/userAssets';
import type { ThemeColors } from '../../constants/theme';

const CASH_QUICK_ADDS = [
  { amount: 100_000, label: '+10만' },
  { amount: 1_000_000, label: '+100만' },
  { amount: 10_000_000, label: '+1000만' },
  { amount: 100_000_000, label: '+1억' },
];
const REALESTATE_QUICK_ADDS = [
  { amount: 1_000_000, label: '+100만' },
  { amount: 10_000_000, label: '+1000만' },
  { amount: 100_000_000, label: '+1억' },
  { amount: 1_000_000_000, label: '+10억' },
];

export type AssetBreakdown = { cash: number; stock: number; realestate: number };

type Props = {
  /** 저장/로드 시 총자산·구성을 부모(마이페이지)에 알려줘 목표 트래커·자산 상위% 카드가 같은 값을 쓸 수 있게 한다. */
  onAssetsChange?: (total: number, breakdown: AssetBreakdown) => void;
};

// index.html #view-mypage의 "내 자산 현황 및 동향" 대시보드 이식 — Firestore userAssets/{uid}
// 문서에 현금/주식/부동산을 저장하고, 총자산과 구성비를 바 차트+범례로 보여준다.
export default function AssetDashboardCard({ onAssetsChange }: Props) {
  const { colors } = useAppTheme();
  const { user, getFreshIdToken } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cash, setCash] = useState(0);
  const [stock, setStock] = useState(0);
  const [realestate, setRealestate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 입력 폼을 항상 펼쳐두지 않고, 편집 버튼을 눌렀을 때만 draft 값으로 채워 모달을 연다.
  // 저장을 누르기 전까지는 cash/stock/realestate(=화면에 보이는 저장된 값)를 건드리지 않으므로,
  // 취소/배경 탭으로 닫으면 draft만 버려지고 자동으로 "되돌리기"가 된다.
  const [editing, setEditing] = useState(false);
  const [draftCash, setDraftCash] = useState(0);
  const [draftStock, setDraftStock] = useState(0);
  const [draftRealestate, setDraftRealestate] = useState(0);

  const openEdit = () => {
    setDraftCash(cash);
    setDraftStock(stock);
    setDraftRealestate(realestate);
    setEditing(true);
  };
  const closeEdit = () => setEditing(false);

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
        setCash(doc.cash);
        setStock(doc.stock);
        setRealestate(doc.realestate);
        onAssetsChange?.(doc.cash + doc.stock + doc.realestate, {
          cash: doc.cash,
          stock: doc.stock,
          realestate: doc.realestate,
        });
      } catch {
        // 조회 실패해도 0으로 화면은 계속 쓸 수 있게 둔다
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const total = cash + stock + realestate;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  const handleSave = async () => {
    if (!user) {
      Alert.alert('로그인이 필요해요', '로그인 후 저장할 수 있어요.');
      return;
    }
    const idToken = await getFreshIdToken();
    if (!idToken) {
      Alert.alert('로그인이 필요해요', '로그인 후 저장할 수 있어요.');
      return;
    }
    const next = { cash: draftCash, stock: draftStock, realestate: draftRealestate };
    setSaving(true);
    try {
      await saveUserAssetBreakdown(user.uid, idToken, next);
      setCash(next.cash);
      setStock(next.stock);
      setRealestate(next.realestate);
      onAssetsChange?.(next.cash + next.stock + next.realestate, next);
      setEditing(false);
    } catch {
      Alert.alert('저장에 실패했어요', '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card style={styles.totalCard}>
        <View style={styles.totalHeadRow}>
          <Text style={styles.totalLabel}>내 총자산</Text>
          <Pressable style={styles.editBtn} onPress={openEdit} accessibilityLabel="자산 현황 편집" hitSlop={8}>
            <Ionicons name="pencil" size={13} color={colors.brand} />
            <Text style={styles.editBtnText}>편집</Text>
          </Pressable>
        </View>
        <Text style={styles.totalValue}>{loading ? '-' : `${total.toLocaleString('ko-KR')}원`}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barSeg, { width: `${pct(cash)}%`, backgroundColor: '#3182f6' }]} />
          <View style={[styles.barSeg, { width: `${pct(stock)}%`, backgroundColor: '#585CE5' }]} />
          <View style={[styles.barSeg, { width: `${pct(realestate)}%`, backgroundColor: '#059669' }]} />
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#3182f6' }]} />
            <Text style={styles.legendLabel}>현금/예적금</Text>
            <Text style={styles.legendPct}>{pct(cash)}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#585CE5' }]} />
            <Text style={styles.legendLabel}>주식/투자금</Text>
            <Text style={styles.legendPct}>{pct(stock)}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
            <Text style={styles.legendLabel}>부동산/기타</Text>
            <Text style={styles.legendPct}>{pct(realestate)}%</Text>
          </View>
        </View>
      </Card>

      <Modal visible={editing} transparent animationType="slide" onRequestClose={closeEdit}>
        <Pressable style={styles.modalBackdrop} onPress={closeEdit}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardWrap}
          >
            {/* 안쪽 Pressable로 탭 전파를 막아, 시트 내부를 눌러도 배경 탭(닫기)으로 번지지 않게 한다. */}
            <Pressable style={[styles.modalSheet, { paddingBottom: 28 + insets.bottom }]} onPress={() => {}}>
              <View style={styles.modalHandle} />
              <View style={styles.modalTopRow}>
                <Text style={styles.formTitle}>자산 항목 입력</Text>
                <Pressable onPress={closeEdit} hitSlop={10} accessibilityLabel="닫기">
                  <Ionicons name="close" size={20} color={colors.ink3} />
                </Pressable>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <NumberField label="현금/예적금" value={draftCash} onChange={setDraftCash} suffix="원" quickAdds={CASH_QUICK_ADDS} showReset />
                <NumberField label="주식/투자금" value={draftStock} onChange={setDraftStock} suffix="원" quickAdds={CASH_QUICK_ADDS} showReset />
                <NumberField
                  label="부동산/기타"
                  value={draftRealestate}
                  onChange={setDraftRealestate}
                  suffix="원"
                  quickAdds={REALESTATE_QUICK_ADDS}
                  showReset
                />
                <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>저장하기</Text>}
                </Pressable>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    totalCard: { marginBottom: 14 },
    totalHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    totalLabel: { fontSize: 13, fontWeight: '700', color: colors.ink3 },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
    },
    editBtnText: { fontSize: 12, fontWeight: '700', color: colors.brand },
    totalValue: { fontSize: 26, fontWeight: '800', color: colors.ink1, marginBottom: 16 },
    barTrack: { flexDirection: 'row', width: '100%', height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.cardSoft, marginBottom: 14 },
    barSeg: { height: '100%' },
    legend: { gap: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink2 },
    legendPct: { fontSize: 13, fontWeight: '700', color: colors.ink1 },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalKeyboardWrap: { width: '100%' },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      maxHeight: '86%',
    },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 14 },
    modalTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    formTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink1 },
    saveBtn: {
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
      marginBottom: 8,
    },
    saveBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  });
}