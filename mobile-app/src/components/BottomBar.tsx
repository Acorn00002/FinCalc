import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../context/ThemeContext';
import type { ThemeColors, SHADOW } from '../constants/theme';
import { BOTTOM_TABS, MenuLeaf } from '../constants/menu';
import { navigateToMenuEntryFromStack } from '../navigation/navigateToMenuEntry';
import { sameMenuUrl } from '../lib/embedNavUrl';
import type { RootStackParamList } from '../navigation/types';

// css/styles.css의 .bottom-nav(radius 6px 6px 0 0, shadow -6px 24px)와 .bottom-nav-item(active면 pill 배경) 이식.
export default function BottomBar() {
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, shadow), [colors, shadow]);
  const navigation = useNavigation<import('@react-navigation/native').NavigationProp<RootStackParamList>>();
  const screenName = useNavigationState((state) => state.routes[state.index]?.name);
  const currentUrl = useNavigationState(
    (state) => (state.routes[state.index]?.params as { url?: string } | undefined)?.url
  );

  const isActive = (tab: MenuLeaf) =>
    tab.screen ? screenName === tab.screen : screenName === 'WebViewRoute' && sameMenuUrl(currentUrl, tab.url);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom + 6 }]}>
      {BOTTOM_TABS.map((tab) => {
        const active = isActive(tab);
        const color = active ? colors.brand : colors.ink3;
        return (
          <Pressable
            key={tab.label}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => navigateToMenuEntryFromStack(navigation, tab)}
          >
            <Ionicons name={tab.icon as any} size={22} color={color} />
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors, shadow: typeof SHADOW.light) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      paddingTop: 6,
      paddingHorizontal: 4,
      ...shadow,
    },
    tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8, marginHorizontal: 2 },
    tabActive: { backgroundColor: colors.brandSoft, borderRadius: 24 },
    label: { fontSize: 10.5, fontWeight: '700' },
  });
}
