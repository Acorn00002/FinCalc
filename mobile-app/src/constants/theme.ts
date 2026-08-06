// 웹(css/styles.css)의 :root / html[data-theme="dark"] 변수와 동일한 값.
// 라이트/다크 각각의 팔레트를 그대로 옮겨와서, ThemeContext가 시스템/사용자 설정에 따라
// 둘 중 하나를 골라 앱 전역에 실시간으로 적용한다.
export type ThemeColors = {
  bg: string;
  card: string;
  cardSoft: string;
  ink1: string;
  ink2: string;
  ink3: string;
  line: string;
  brand: string;
  brand2: string;
  brandSoft: string;
  profit: string;
  loss: string;
};

export const LIGHT_COLORS: ThemeColors = {
  bg: '#f2f4f6',
  card: '#ffffff',
  cardSoft: '#f9fafb',
  ink1: '#191f28',
  ink2: '#4e5968',
  ink3: '#8b95a1',
  line: '#eef0f2',
  brand: '#585CE5',
  brand2: '#3182f6',
  brandSoft: 'rgba(88,92,229,0.08)',
  profit: '#059669',
  loss: '#dc2626',
};

export const DARK_COLORS: ThemeColors = {
  bg: '#0b0f14',
  card: '#161b22',
  cardSoft: '#1c222b',
  ink1: '#f0f2f5',
  ink2: '#a8b1bd',
  ink3: '#6b7480',
  line: '#262c36',
  brand: '#7377ef',
  brand2: '#5b9bf7',
  brandSoft: 'rgba(115,119,239,0.16)',
  profit: '#059669',
  loss: '#dc2626',
};

// css의 --radius-lg/--radius-md와 동일.
export const RADIUS = { lg: 24, md: 18 };

// css --shadow-card / --shadow-card-hover의 네이티브 근사치 — RN은 CSS의 이중 box-shadow를
// 그대로 표현할 수 없어(iOS는 단일 shadow, Android는 elevation) 가장 가까운 단일 그림자로 근사한다.
export const SHADOW = {
  light: { shadowColor: '#0f172a', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  dark: { shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
};

// 과거 코드 호환용 — 새 코드는 useAppTheme()의 colors를 쓴다. 컴포넌트 밖(상수 파일 등)에서
// 색상이 필요 없는 경우에만 이 라이트 고정값을 참조한다.
export const theme = { ...LIGHT_COLORS, radius: RADIUS };

export const SITE_ORIGIN = 'https://gofincalc.com';

// react-native-webview의 userAgent에 이 문자열을 붙여 보내면 웹(index.html)이
// 자체 헤더·사이드바·하단바를 숨기고 본문만 채운다 (index.html 상단 조기 스크립트 참고).
export const NATIVE_UA_SUFFIX = 'AssetPilotNativeApp/1.0';
