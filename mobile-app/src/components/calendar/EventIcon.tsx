import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../context/ThemeContext';
import type { ThemeColors } from '../../constants/theme';
import { resolveCalendarIcon, type CalendarIconEvent } from '../../lib/calendarIcons';

export const EVENT_ICON_SIZE = 34;

type Props = {
  event: CalendarIconEvent;
  allEvents: CalendarIconEvent[];
  brandfetchClientId: string | null;
};

// index.html의 resolveEventIconHtml()/resolveStockIconHtml() 이식.
// 항상 EVENT_ICON_SIZE 정사각형을 차지해서, 로고가 있든 없든(로딩 실패 포함) 행 높이가 흔들리지 않는다.
// RN Image는 기본적으로 디스크 캐시를 쓰므로(같은 회사 = 같은 URI) 스크롤 시 재요청이 거의 없다 —
// 별도 캐싱 라이브러리를 추가하지 않고 이 기본 동작에 의존한다.
function EventIcon({ event, allEvents, brandfetchClientId }: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [imgFailed, setImgFailed] = useState(false);

  const resolution = useMemo(
    () => resolveCalendarIcon(event, allEvents, brandfetchClientId),
    [event, allEvents, brandfetchClientId]
  );

  if (resolution.kind === 'logo' && !imgFailed) {
    return (
      <View style={styles.circle}>
        <Image
          source={{ uri: resolution.uri }}
          style={styles.logoImg}
          onError={() => setImgFailed(true)}
          accessibilityLabel={resolution.company || undefined}
        />
      </View>
    );
  }

  if (resolution.kind === 'logo' || resolution.kind === 'neutral-stock') {
    // logo && imgFailed도 여기로 떨어진다 — 로고 로딩 실패 시 중립 아이콘으로 대체.
    return (
      <View style={[styles.circle, styles.neutralCircle]}>
        <Ionicons name="briefcase-outline" size={16} color={colors.ink3} />
      </View>
    );
  }

  if (resolution.kind === 'ticker') {
    return (
      <View style={[styles.circle, { backgroundColor: resolution.color }]}>
        <Text style={styles.tickerText} numberOfLines={1}>
          {resolution.ticker}
        </Text>
      </View>
    );
  }

  if (resolution.kind === 'ipo') {
    return (
      <View style={[styles.circle, styles.ipoCircle]}>
        <Text style={styles.ipoText}>IPO</Text>
        <View style={styles.flagBadge}>
          <Text style={styles.flagText}>{resolution.flag === 'us' ? '🇺🇸' : '🇰🇷'}</Text>
        </View>
      </View>
    );
  }

  // category
  const categoryIcon: Record<string, string> = {
    realestate: 'business-outline',
    subsidy: 'gift-outline',
    personal: 'person-outline',
    economy: 'globe-outline',
  };
  return (
    <View style={[styles.circle, styles.neutralCircle]}>
      <Ionicons name={(categoryIcon[resolution.category] || 'briefcase-outline') as any} size={16} color={colors.ink3} />
    </View>
  );
}

export default React.memo(EventIcon);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    circle: {
      width: EVENT_ICON_SIZE,
      height: EVENT_ICON_SIZE,
      borderRadius: EVENT_ICON_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'hidden',
      backgroundColor: colors.cardSoft,
    },
    neutralCircle: { backgroundColor: colors.cardSoft },
    logoImg: { width: '100%', height: '100%' },
    tickerText: { fontSize: 10.5, fontWeight: '800', color: '#fff', paddingHorizontal: 2 },
    ipoCircle: { backgroundColor: colors.brandSoft },
    ipoText: { fontSize: 9.5, fontWeight: '800', color: colors.brand },
    flagBadge: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 14,
      height: 14,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    flagText: { fontSize: 9 },
  });
}
