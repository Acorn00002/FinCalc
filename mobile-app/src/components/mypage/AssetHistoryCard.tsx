import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Card from '../ui/Card';
import { useAppTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchAssetHistory, recordAssetHistorySnapshot, AssetHistoryEntry } from '../../lib/userAssets';
import type { ThemeColors } from '../../constants/theme';
import type { AssetBreakdown } from './AssetDashboardCard';

type Props = {
  /** AssetDashboardCard가 저장/로드할 때 알려주는 실시간 총자산/구성 — "이번 달 기록하기"가 이 값을 그대로 스냅샷으로 저장한다. */
  currentTotal: number;
  currentBreakdown: AssetBreakdown;
};

function monthLabel(monthId: string) {
  const [y, m] = monthId.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

// index.html #view-mypage의 "월별 자산 변화 기록" 이식 — userAssets/{uid}/history/{YYYY-MM}
// 서브컬렉션에서 최근 스냅샷을 읽어 지난달 대비 증감을 리스트로 보여준다.
export default function AssetHistoryCard({ currentTotal, currentBreakdown }: Props) {
  const { colors } = useAppTheme();
  const { user, getFreshIdToken } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<AssetHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);

  const load = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const idToken = await getFreshIdToken();
    if (!idToken) {
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchAssetHistory(user.uid, idToken);
      setEntries(rows);
    } catch {
      // 조회 실패해도 빈 목록으로 화면은 계속 쓸 수 있게 둔다
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleRecord = async () => {
    if (!user) {
      Alert.alert('로그인이 필요해요', '로그인 후 기록할 수 있어요.');
      return;
    }
    if (!currentTotal) {
      Alert.alert("먼저 위 '내 자산 현황'에 자산을 입력하고 저장해주세요");
      return;
    }
    const idToken = await getFreshIdToken();
    if (!idToken) {
      Alert.alert('로그인이 필요해요', '로그인 후 기록할 수 있어요.');
      return;
    }
    setRecording(true);
    try {
      await recordAssetHistorySnapshot(user.uid, idToken, { total: currentTotal, ...currentBreakdown });
      await load();
    } catch {
      Alert.alert('기록에 실패했어요', '다시 시도해주세요.');
    } finally {
      setRecording(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>월별 자산 기록</Text>
        <Pressable style={styles.recordBtn} onPress={handleRecord} disabled={recording}>
          {recording ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : (
            <Text style={styles.recordBtnText}>이번 달 기록하기</Text>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.brand} style={styles.loadingSpinner} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>아직 기록된 자산 히스토리가 없어요. 이번 달 자산을 기록해보세요!</Text>
      ) : (
        entries.map((entry, idx) => {
          const prev = entries[idx + 1];
          let deltaText = '첫 기록';
          let deltaColor = colors.ink3;
          if (prev) {
            const delta = entry.total - prev.total;
            const pct = prev.total > 0 ? Math.round((delta / prev.total) * 1000) / 10 : null;
            deltaColor = delta > 0 ? colors.profit : delta < 0 ? colors.loss : colors.ink3;
            const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '-';
            deltaText = `${arrow} ${Math.abs(delta).toLocaleString('ko-KR')}원${
              pct !== null ? ` (${delta >= 0 ? '+' : '-'}${Math.abs(pct)}%)` : ''
            }`;
          }
          return (
            <View key={entry.id} style={[styles.item, idx > 0 && styles.itemDivider]}>
              <View style={styles.itemLeft}>
                <Text style={styles.itemMonth}>{monthLabel(entry.id)}</Text>
                <Text style={styles.itemTotal}>{entry.total.toLocaleString('ko-KR')}원</Text>
              </View>
              <Text style={[styles.delta, { color: deltaColor }]}>{deltaText}</Text>
            </View>
          );
        })
      )}
    </Card>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: { marginBottom: 14 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 },
    title: { fontSize: 14.5, fontWeight: '700', color: colors.ink1 },
    recordBtn: {
      flexShrink: 0,
      backgroundColor: colors.brandSoft,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
    },
    recordBtnText: { fontSize: 12.5, fontWeight: '800', color: colors.brand },
    loadingSpinner: { paddingVertical: 20 },
    empty: { fontSize: 13, fontWeight: '600', color: colors.ink3, textAlign: 'center', paddingVertical: 24 },
    item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
    itemDivider: { borderTopWidth: 1, borderTopColor: colors.line },
    itemLeft: { flex: 1, gap: 3 },
    itemMonth: { fontSize: 12.5, fontWeight: '600', color: colors.ink3 },
    itemTotal: { fontSize: 14.5, fontWeight: '800', color: colors.ink1 },
    delta: { flexShrink: 0, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  });
}