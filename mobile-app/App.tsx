import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import RootNavigator from './src/navigation/RootNavigator';
import AppIntroSplash from './src/components/AppIntroSplash';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { hideNativeSplashOnce } from './src/lib/splash';

// 인트로(아이콘→화살표 발사) 모션은 완전히 네이티브(Animated)로 재생한다 — 예전엔 이 모션을
// 웹페이지(index.html의 .app-splash) CSS 애니메이션에 맡겼는데, 그동안 헤더/하단바 같은 네이티브
// 화면 뼈대가 이미 먼저 마운트돼 있어서 "홈 화면 안에서 아이콘이 움직이는" 것처럼 보였다.
// 네이티브 OS 스플래시는 이 인트로 오버레이가 첫 프레임을 그릴 준비가 되는 즉시 넘겨준다(같은
// 위치에 같은 아이콘이 있어 전환이 이어져 보임) — 그 뒤로는 웹뷰 로딩 속도와 무관하게 항상 같은
// 타이밍으로 재생되고, 끝난 뒤에야 홈 화면(헤더+웹뷰+하단바)이 드러난다.
SplashScreen.preventAutoHideAsync().catch(() => {});
// expo-splash-screen은 hideAsync() 호출 후에도 기본 400ms짜리 페이드아웃 전환을 자체적으로
// 재생한다 — 이게 "아이콘이 한 번 뜨고 나서(그 뒤로도 페이드아웃 되는 동안) 그다음 화면으로
// 넘어간다"처럼 보이는 정지 구간의 상당 부분을 차지하고 있었다. 0으로 낮춰서 hideAsync 즉시
// 완전히 사라지게 한다.
SplashScreen.setOptions({ duration: 0, fade: false });

function ThemedStatusBar() {
  const { mode } = useAppTheme();
  // 배경이 어두우면(다크) 밝은 아이콘을, 밝으면(라이트) 어두운 아이콘을 보여준다.
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    // AppIntroSplash 자신은 리액트 내비게이션 트리 없이 곧바로 그릴 수 있는 가벼운 컴포넌트라,
    // 이 시점이 실질적으로 JS가 가장 먼저 그릴 수 있는 순간이다 — 네이티브 OS 스플래시(정적 아이콘)를
    // 여기서 바로 넘겨야 "아이콘이 한 번 뜨고 그 다음에 애니메이션이 나오는" 이중 단계 없이 곧장
    // 애니메이션으로 이어진다.
    hideNativeSplashOnce();
  }, []);

  // 네비게이션 트리(Drawer+Stack, 화면 20여 개, 홈 웹뷰 로딩 등)는 무거워서 이것까지 같이
  // 마운트하고 나서 스플래시를 넘기면 그 시간만큼 정적 아이콘이 더 오래 보인다 — 그래서 인트로가
  // 끝나기 전까지는 아예 마운트하지 않고, 인트로 재생 시간(~1.5초) 동안 백그라운드에서 준비되게 한다.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {introDone ? (
            <AuthProvider>
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
              <ThemedStatusBar />
            </AuthProvider>
          ) : (
            <AppIntroSplash onDone={() => setIntroDone(true)} />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
