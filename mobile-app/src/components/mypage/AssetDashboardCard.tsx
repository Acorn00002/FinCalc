import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
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
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cash, setCash] = useState(0);
  const [stock, setStock] = useState(0);
  const [realestate, setRealestate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
    setSaving(true);
    try {
      await saveUserAssetBreakdown(user.uid, idToken, { cash, stock, realestate });
      onAssetsChange?.(cash + stock + realestate, { cash, stock, realestate });
    } catch {
      Alert.alert('저장에 실패했어요', '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card style={styles.totalCard}>
        <Text style={styles.totalLabel}>내 총자산</Text>
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

      <Card style={styles.formCard}>
        <Text style={styles.formTitle}>자산 항목 입력</Text>
        <NumberField label="현금/예적금" value={cash} onChange={setCash} suffix="원" quickAdds={CASH_QUICK_ADDS} showReset />
        <NumberField label="주식/투자금" value={stock} onChange={setStock} suffix="원" quickAdds={CASH_QUICK_ADDS} showReset />
        <NumberField
          label="부동산/기타"
          value={realestate}
          onChange={setRealestate}
          suffix="원"
          quickAdds={REALESTATE_QUICK_ADDS}
          showReset
        />
        <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>저장하기</Text>}
        </Pressable>
      </Card>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    totalCard: { marginBottom: 14 },
    totalLabel: { fontSize: 13, fontWeight: '700', color: colors.ink3, marginBottom: 6 },
    totalValue: { fontSize: 26, fontWeight: '800', color: colors.ink1, marginBottom: 16 },
    barTrack: { flexDirection: 'row', width: '100%', height: 12, borderRadius: 999, overflow: 'hidden', backgroundColor: colors.cardSoft, marginBottom: 14 },
    barSeg: { height: '100%' },
    legend: { gap: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink2 },
    legendPct: { fontSize: 13, fontWeight: '700', color: colors.ink1 },
    formCard: { marginBottom: 14 },
    formTitle: { fontSize: 14.5, fontWeight: '700', color: colors.ink1, marginBottom: 14 },
    saveBtn: {
      backgroundColor: colors.brand,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    saveBtnText: { fontSize: 14.5, fontWeight: '700', color: '#fff' },
  });
}