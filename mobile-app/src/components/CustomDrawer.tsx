import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentComponentProps, DrawerContentScrollView } from '@react-navigation/drawer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors } from '../constants/theme';
import { SIDEBAR_MENU, MenuLeaf, isMenuGroup } from '../constants/menu';
import { navigateToMenuEntryFromDrawer } from '../navigation/navigateToMenuEntry';
import { sameMenuUrl } from '../lib/embedNavUrl';
import BrandArrowIcon from './BrandArrowIcon';

// props.state는 Drawer 자체의 상태라, 실제로 어떤 메뉴가 활성인지 보려면 그 안에 중첩된
// MainStack의 상태(화면 이름 + WebView라면 그 url)까지 한 단계 더 들어가야 한다.
function useActiveEntry(state: DrawerContentComponentProps['state']) {
  const mainRoute = state.routes.find((r) => r.name === 'Main');
  const nested = mainRoute?.state;
  if (!nested) return { screenName: undefined as string | undefined, url: undefined as string | undefined, params: undefined as Record<string, unknown> | undefined };
  const activeIndex = nested.index ?? nested.routes.length - 1;
  const activeRoute = nested.routes[activeIndex] as { name: string; params?: { url?: string } & Record<string, unknown> } | undefined;
  return { screenName: activeRoute?.name, url: activeRoute?.params?.url, params: activeRoute?.params };
}

export default function CustomDrawer(props: DrawerContentComponentProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { screenName, url, params } = useActiveEntry(props.state);
  // 기본은 전부 접힌 상태 — 요청하신 12개 순서를 그대로 보여주고, 하위 항목은 탭해서 펼친다.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (leaf: MenuLeaf) => {
    if (!leaf.screen) return screenName === 'WebViewRoute' && sameMenuUrl(url, leaf.url);
    if (screenName !== leaf.screen) return false;
    // Calculator처럼 같은 화면을 서로 다른 calcId로 여러 메뉴가 공유하는 경우, calcId까지 일치해야 활성.
    const wantCalcId = leaf.screenParams?.calcId;
    if (wantCalcId !== undefined) return params?.calcId === wantCalcId;
    return true;
  };

  const goTo = (leaf: MenuLeaf) => {
    navigateToMenuEntryFromDrawer(props.navigation, leaf);
    props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.card }} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.brandRow, { paddingTop: insets.top + 20 }]}>
        <BrandArrowIcon size={22} color={colors.brand} />
        <Text style={styles.brandText}>자산 파일럿</Text>
      </View>

      {SIDEBAR_MENU.map((entry) => {
        if (isMenuGroup(entry)) {
          const isOpen = !!expanded[entry.label];
          return (
            <View key={entry.label}>
              <Pressable style={styles.row} onPress={() => toggleGroup(entry.label)}>
                <Ionicons name={entry.icon as any} size={20} color={colors.ink2} style={styles.rowIcon} />
                <Text style={styles.rowLabel}>{entry.label}</Text>
                <Ionicons
                  name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
                  size={16}
                  color={colors.ink3}
                />
              </Pressable>
              {isOpen
                ? entry.children.map((child) => (
                    <Pressable
                      key={child.label}
                      style={[styles.row, styles.childRow, isActive(child) && styles.rowActive]}
                      onPress={() => goTo(child)}
                    >
                      <Ionicons name={child.icon as any} size={18} color={colors.ink2} style={styles.rowIcon} />
                      <Text style={styles.rowLabelSmall}>{child.label}</Text>
                      {child.badge ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{child.badge}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  ))
                : null}
            </View>
          );
        }

        return (
          <Pressable
            key={entry.label}
            style={[styles.row, isActive(entry) && styles.rowActive]}
            onPress={() => goTo(entry)}
          >
            <Ionicons name={entry.icon as any} size={20} color={colors.ink2} style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{entry.label}</Text>
          </Pressable>
        );
      })}
    </DrawerContentScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrollContent: { paddingTop: 4, paddingBottom: 24, backgroundColor: colors.card },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 16,
      marginBottom: 4,
    },
    brandText: { fontSize: 18, fontWeight: '800', color: colors.ink1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 10,
    },
    childRow: { paddingLeft: 32, paddingVertical: 10 },
    rowActive: { backgroundColor: colors.brandSoft, borderRadius: 12, marginHorizontal: 8 },
    rowIcon: { width: 20 },
    rowLabel: { flex: 1, fontSize: 14.5, fontWeight: '700', color: colors.ink1 },
    rowLabelSmall: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.ink2 },
    badge: { backgroundColor: colors.cardSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
    badgeText: { fontSize: 10, fontWeight: '700', color: colors.ink3 },
  });
}
