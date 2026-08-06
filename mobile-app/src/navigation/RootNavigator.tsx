import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CustomDrawer from '../components/CustomDrawer';
import WebViewRouteScreen from '../screens/WebViewRouteScreen';
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DictionaryScreen from '../screens/DictionaryScreen';
import NoticeScreen from '../screens/NoticeScreen';
import FaqScreen from '../screens/FaqScreen';
import CalculatorListScreen from '../screens/calculators/CalculatorListScreen';
import CalculatorScreen from '../screens/calculators/CalculatorScreen';
import TaxPilotScreen from '../screens/taxpilot/TaxPilotScreen';
import NewsScreen from '../screens/NewsScreen';
import NewsArticleScreen from '../screens/NewsArticleScreen';
import SubsidyScreen from '../screens/SubsidyScreen';
import FinanceProductsScreen from '../screens/FinanceProductsScreen';
import MypageScreen from '../screens/MypageScreen';
import LoungeScreen from '../screens/LoungeScreen';
import PersonalEventsScreen from '../screens/PersonalEventsScreen';
import FutureSimulatorScreen from '../screens/FutureSimulatorScreen';
import AssetScoreScreen from '../screens/AssetScoreScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import type { RootStackParamList } from './types';

const Drawer = createDrawerNavigator();
const Stack = createNativeStackNavigator<RootStackParamList>();

// 이식 안 된 메뉴는 WebViewRoute로, 이식된 메뉴는 각자의 네이티브 화면으로 —
// 이 스택 하나가 두 종류의 화면을 동시에 라우트로 들고 있다.
function MainStack() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false, animation: 'none' }}>
      {/* Home이 첫 화면 — 예전엔 WebViewRoute(#home)가 초기 라우트였는데, 홈 화면 자체를 완전히
          네이티브로 옮기면서 더 이상 WebView 로딩을 기다릴 필요가 없어졌다(인트로 재생 후 바로
          이 화면이 뜬다). WebViewRoute는 아직 남은 증권시장/청약·공모주용으로 계속 등록해 둔다. */}
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} />
      <Stack.Screen name="WebViewRoute" component={WebViewRouteScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Dictionary" component={DictionaryScreen} />
      <Stack.Screen name="Notice" component={NoticeScreen} />
      <Stack.Screen name="Faq" component={FaqScreen} />
      <Stack.Screen name="CalculatorList" component={CalculatorListScreen} />
      <Stack.Screen name="Calculator" component={CalculatorScreen} />
      <Stack.Screen name="TaxPilot" component={TaxPilotScreen} />
      <Stack.Screen name="News" component={NewsScreen} />
      <Stack.Screen name="NewsArticle" component={NewsArticleScreen} />
      <Stack.Screen name="Subsidy" component={SubsidyScreen} />
      <Stack.Screen name="FinanceProducts" component={FinanceProductsScreen} />
      <Stack.Screen name="Mypage" component={MypageScreen} />
      <Stack.Screen name="Lounge" component={LoungeScreen} />
      <Stack.Screen name="PersonalEvents" component={PersonalEventsScreen} />
      <Stack.Screen name="FutureSimulator" component={FutureSimulatorScreen} />
      <Stack.Screen name="AssetScore" component={AssetScoreScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawer {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        drawerStyle: { width: '82%' },
      }}
    >
      <Drawer.Screen name="Main" component={MainStack} />
    </Drawer.Navigator>
  );
}
