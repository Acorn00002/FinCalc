import * as SplashScreen from 'expo-splash-screen';

// 앱 프로세스 전체에서 딱 한 번만 실제로 숨겨야 한다 — 화면을 옮길 때마다 새로 마운트되는
// WebViewScreen들이 각자 onLoadEnd에서 이 함수를 불러도, 두 번째 호출부터는 조용히 무시된다.
// (예전엔 이 가드가 없어서 화면 전환마다 스플래시가 다시 나타나는 버그가 있었다 — App.tsx 참고.)
let hidden = false;

export function hideNativeSplashOnce() {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => {});
}
