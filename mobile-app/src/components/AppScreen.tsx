import React from 'react';
import { View } from 'react-native';
import { DrawerActions, useNavigation, NavigationProp } from '@react-navigation/native';
import Header from './Header';
import BottomBar from './BottomBar';
import { useAppTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';

// Header/BottomBar를 감싸는 공용 화면 레이아웃 — 새 네이티브 화면(Settings/Dictionary/Notice/Faq)과
// WebViewRouteScreen이 전부 같은 방식(햄버거→드로어 열기, 마이페이지 아이콘→WebView 이동)으로
// Header를 쓰기 때문에 화면마다 반복하지 않고 여기 하나로 모은다.
export default function AppScreen({ children }: { children: React.ReactNode }) {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        onMenuPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        onNotificationsPress={() => navigation.navigate('Notifications')}
      />
      {children}
      <BottomBar />
    </View>
  );
}
