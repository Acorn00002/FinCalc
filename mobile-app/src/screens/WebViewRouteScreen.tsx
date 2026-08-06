import React, { useEffect, useRef, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import AppScreen from '../components/AppScreen';
import WebViewScreen from '../components/WebViewScreen';
import type { RootStackParamList } from '../navigation/types';

type WebViewRouteProp = RouteProp<RootStackParamList, 'WebViewRoute'>;

// 아직 네이티브로 이식되지 않은 메뉴 전부가 이 화면으로 온다 — route.params가
// 매 네비게이션마다 새 객체이므로, 그 변화를 감지해 로컬 nonce를 증가시켜
// WebViewScreen에 "이번엔 새로 주입해야 함"을 알려준다.
export default function WebViewRouteScreen() {
  const route = useRoute<WebViewRouteProp>();
  const nonceRef = useRef(0);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    nonceRef.current += 1;
    setNonce(nonceRef.current);
  }, [route.params]);

  return (
    <AppScreen>
      <WebViewScreen url={route.params.url} injectOnLoad={route.params.injectOnLoad} injectNonce={nonce} />
    </AppScreen>
  );
}
