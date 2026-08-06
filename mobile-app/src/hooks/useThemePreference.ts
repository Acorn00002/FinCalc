import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemePref = 'system' | 'light' | 'dark';

// 웹의 localStorage 키(fincalc_theme_pref)와 일부러 다르게 둔다 — 네이티브는 아직
// 실제 다크 팔레트가 없고 WebView와 storage도 공유되지 않으므로, 이미 동기화된
// 것처럼 보이는 착각을 주지 않기 위함이다.
const STORAGE_KEY = 'assetpilot_theme_pref';

export function useThemePreference() {
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPrefState(stored);
      }
      setIsLoaded(true);
    });
  }, []);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  return { pref, setPref, isLoaded };
}
