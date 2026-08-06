import type { NavigationProp } from '@react-navigation/native';
import type { MenuLeaf } from '../constants/menu';
import type { RootStackParamList } from './types';
import { toEmbedNavUrl } from '../lib/embedNavUrl';

type MenuTarget =
  | { kind: 'screen'; screen: Exclude<keyof RootStackParamList, 'WebViewRoute'>; params?: Record<string, unknown> }
  | { kind: 'webview'; url: string; injectOnLoad?: string };

// 메뉴 항목이 네이티브 화면으로 갈지 WebView로 갈지 분기하는 유일한 지점.
function resolveMenuTarget(leaf: MenuLeaf): MenuTarget {
  if (leaf.screen) return { kind: 'screen', screen: leaf.screen, params: leaf.screenParams };
  return { kind: 'webview', url: leaf.url, injectOnLoad: leaf.injectOnLoad };
}

// BottomBar는 이미 MainStack 안(각 화면의 AppScreen 내부)에서 렌더링되므로, 그 스택의
// navigation을 그대로 받아 화면 이름으로 바로 navigate한다.
export function navigateToMenuEntryFromStack(navigation: NavigationProp<RootStackParamList>, leaf: MenuLeaf) {
  const target = resolveMenuTarget(leaf);
  if (target.kind === 'screen') {
    // 화면마다 파라미터 타입이 달라 정확한 오버로드 매칭이 안 되므로, 여기서만 느슨하게 호출한다.
    (navigation.navigate as (name: string, params?: object) => void)(target.screen, target.params);
  } else {
    navigation.navigate('WebViewRoute', { url: toEmbedNavUrl(target.url), injectOnLoad: target.injectOnLoad });
  }
}

// drawerContent가 받는 navigation은 특정 화면에 종속되지 않는 축약된 헬퍼 타입이라
// react-navigation의 엄격한 NavigationProp 제네릭과 맞지 않는다 — 실제로 쓰는 navigate만 받는다.
type DrawerNavigateCapable = { navigate: (name: string, params?: object) => void };

// CustomDrawer는 Drawer.Navigator 바깥(drawerContent)에서 렌더링되므로, Drawer의 유일한
// 화면인 "Main"(=MainStack)에 중첩 파라미터로 화면 이름을 전달해야 한다.
export function navigateToMenuEntryFromDrawer(navigation: DrawerNavigateCapable, leaf: MenuLeaf) {
  const target = resolveMenuTarget(leaf);
  if (target.kind === 'screen') {
    navigation.navigate('Main', { screen: target.screen, params: target.params });
  } else {
    navigation.navigate('Main', {
      screen: 'WebViewRoute',
      params: { url: toEmbedNavUrl(target.url), injectOnLoad: target.injectOnLoad },
    });
  }
}
