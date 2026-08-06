import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { NATIVE_UA_SUFFIX } from '../constants/theme';
import type { ThemeColors } from '../constants/theme';
import { useAppTheme } from '../context/ThemeContext';
import { signInWithGoogleNative } from '../lib/googleAuth';
import type { RootStackParamList } from '../navigation/types';

// 안드로이드 WebView는 userAgent prop을 그대로 대치해버려서(iOS의 applicationNameForUserAgent처럼
// "덧붙이기"가 안 됨) 표준적인 모바일 크롬 UA 뒤에 우리 식별 문자열만 붙여 재구성한다.
const ANDROID_BASE_UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

type Props = {
  url: string;
  injectOnLoad?: string;
  /** #finance 하위 탭처럼 url이 그대로라 WebView가 재로드되지 않는 경우에도 재주입을 트리거하기 위한 값.
   *  같은 목적지를 연달아 눌러도 매번 바뀌도록 호출부(WebViewRouteScreen)가 매 네비게이션마다 증가시킨다. */
  injectNonce?: number;
};

export default function WebViewScreen({ url, injectOnLoad, injectNonce }: Props) {
  const { colors, mode } = useAppTheme();
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const webviewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const lastRunNonceRef = useRef<number | undefined>(undefined);

  const runInject = (script: string) => {
    webviewRef.current?.injectJavaScript(`${script}; true;`);
  };

  // 구글이 임베디드 WebView 안에서의 OAuth 팝업(signInWithPopup)을 차단하기 때문에, 웹 페이지가
  // "GOOGLE_LOGIN_REQUEST" 메시지를 보내오면 네이티브 구글 로그인으로 idToken을 받아 그 결과를
  // 웹 페이지의 Firebase JS SDK(firebase.auth().signInWithCredential)에 그대로 주입해 로그인시킨다.
  const handleWebMessage = async (event: WebViewMessageEvent) => {
    let payload: { type?: string; url?: string } = {};
    try {
      payload = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }

    // 뉴스 링크는 전부 target="_blank"라 WebView 네비게이션 가로채기(onShouldStartLoadWithRequest)에
    // 안 걸린다(안드로이드가 "새 창 열기" 요청으로 처리해버림) — 그래서 웹 페이지 쪽에서 클릭을 직접
    // 가로채 postMessage로 알려주면, 그 요청을 받아 네이티브 뉴스 화면으로 대신 이동시킨다.
    if (payload.type === 'OPEN_NEWS_ARTICLE') {
      if (payload.url) navigation.navigate('NewsArticle', { url: payload.url });
      return;
    }
    if (payload.type === 'OPEN_NEWS_LIST') {
      navigation.navigate('News');
      return;
    }

    if (payload.type !== 'GOOGLE_LOGIN_REQUEST') return;

    const result = await signInWithGoogleNative();
    if (result.ok) {
      runInject(
        `(function(){
          try {
            var cred = firebase.auth.GoogleAuthProvider.credential(${JSON.stringify(result.idToken)});
            firebase.auth().signInWithCredential(cred)
              .then(function(){ if (window.showToast) showToast("구글 계정으로 성공적으로 로그인되었습니다.", "ph-google-logo"); })
              .catch(function(error){
                console.error("네이티브 구글 로그인 연동 실패:", error);
                if (window.showToast) showToast("로그인에 실패했어요. 다시 시도해주세요.", "ph-warning");
              });
          } catch(e) { console.error(e); }
        })()`
      );
    } else if (result.code !== 'cancelled') {
      runInject(
        `(function(){ if (window.showToast) showToast(${JSON.stringify(result.message)}, "ph-warning"); })()`
      );
    }
  };

  // 네이티브에서 고른 테마(라이트/다크/시스템 해석 결과)를 웹 쪽 localStorage/전역 함수에도
  // 그대로 반영해, 네이티브 화면과 WebView 화면의 색이 어긋나지 않게 한다.
  const syncThemeScript = (m: 'light' | 'dark') =>
    `(function(){ try { if (window.setThemePreference) { window.setThemePreference('${m}'); } else { document.documentElement.setAttribute('data-theme', '${m}'); localStorage.setItem('fincalc_theme', '${m}'); } } catch(e) {} })()`;

  // url이 그대로라 onLoadEnd가 다시 안 불리는 경우 — 이미 로딩이 끝난 상태라면
  // onLoadEnd를 기다리지 않고 nonce가 바뀔 때 즉시 주입한다.
  useEffect(() => {
    if (injectOnLoad && !isLoading && lastRunNonceRef.current !== injectNonce) {
      runInject(injectOnLoad);
      lastRunNonceRef.current = injectNonce;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [injectNonce]);

  // 설정 화면에서 테마를 바꾸는 순간, 지금 열려 있는 WebView에도 바로 반영한다.
  useEffect(() => {
    if (!isLoading) runInject(syncThemeScript(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // url이 바뀌면(메뉴 이동) 이전 화면의 에러 상태가 남아있지 않도록 초기화한다.
  useEffect(() => {
    setLoadError(false);
  }, [url]);

  // 홈 화면(아직 웹뷰)의 "실시간 경제 뉴스" 위젯이 뉴스 항목/"더보기"를 target="_blank"로 열어서,
  // 웹뷰가 이 링크를 시스템에 그대로 넘겨 외부 브라우저가 뜨던 문제 — news.google.com으로 가는
  // 네비게이션만 가로채서 이미 만들어둔 네이티브 뉴스 화면으로 대신 연다.
  const handleShouldStartLoad = (request: WebViewNavigation): boolean => {
    try {
      const target = new URL(request.url);
      if (target.hostname !== 'news.google.com') return true;
      if (request.url.includes('/rss/articles/')) {
        navigation.navigate('NewsArticle', { url: request.url });
      } else {
        navigation.navigate('News');
      }
      return false;
    } catch {
      return true;
    }
  };

  return (
    <View style={styles.container}>
      {loadError ? (
        // 안드로이드 WebView 기본 에러 페이지(영문/생김새가 앱과 안 어울림) 대신, 네트워크 순간 끊김 같은
        // 흔한 상황에서 바로 재시도할 수 있는 네이티브 에러 화면을 보여준다.
        <View style={styles.errorWrap}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.ink3} />
          <Text style={styles.errorTitle}>페이지를 불러올 수 없어요</Text>
          <Text style={styles.errorDesc}>인터넷 연결을 확인한 뒤 다시 시도해주세요.</Text>
          <Pressable
            style={styles.retryBtn}
            onPress={() => {
              setLoadError(false);
              setIsLoading(true);
              webviewRef.current?.reload();
            }}
          >
            <Text style={styles.retryBtnText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webviewRef}
          source={{ uri: url }}
          style={styles.webview}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => {
            setIsLoading(false);
            runInject(syncThemeScript(mode));
            if (injectOnLoad) {
              runInject(injectOnLoad);
              lastRunNonceRef.current = injectNonce;
            }
          }}
          onError={() => {
            setIsLoading(false);
            setLoadError(true);
          }}
          onHttpError={() => {
            setIsLoading(false);
            setLoadError(true);
          }}
          userAgent={Platform.OS === 'android' ? `${ANDROID_BASE_UA} ${NATIVE_UA_SUFFIX}` : undefined}
          applicationNameForUserAgent={Platform.OS === 'ios' ? NATIVE_UA_SUFFIX : undefined}
          onMessage={handleWebMessage}
          onShouldStartLoadWithRequest={handleShouldStartLoad}
          startInLoadingState={false}
          allowsBackForwardNavigationGestures
        />
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    webview: { flex: 1, backgroundColor: colors.bg },
    errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    errorTitle: { fontSize: 15.5, fontWeight: '800', color: colors.ink1, marginTop: 14 },
    errorDesc: { fontSize: 13, color: colors.ink3, marginTop: 6, textAlign: 'center' },
    retryBtn: { marginTop: 18, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999 },
    retryBtnText: { fontSize: 13.5, fontWeight: '700', color: '#fff' },
  });
}
