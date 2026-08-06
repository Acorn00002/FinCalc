import React from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenTitleBar from '../components/ui/ScreenTitleBar';
import WebViewScreen from '../components/WebViewScreen';
import { useAppTheme } from '../context/ThemeContext';
import type { RootStackParamList } from '../navigation/types';

type RouteProps = RouteProp<RootStackParamList, 'NewsArticle'>;

// 뉴스 카드를 탭하면 외부 브라우저 대신 앱 안에서 바로 기사를 볼 수 있게 하는 화면.
// 다른 화면들은 AppScreen(Header)이 상단 안전영역을 이미 확보해주지만, 이 화면은 전체화면
// 리더용이라 Header 없이 ScreenTitleBar를 바로 쓰는 만큼 카메라 펀치홀(안전영역)만큼 직접 띄운다.
export default function NewsArticleScreen() {
  const route = useRoute<RouteProps>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top }}>
        <ScreenTitleBar title="뉴스 보기" />
      </View>
      <WebViewScreen url={route.params.url} />
    </View>
  );
}
