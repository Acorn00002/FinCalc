import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DARK_COLORS, LIGHT_COLORS, RADIUS, SHADOW, ThemeColors } from '../constants/theme';
import { useThemePreference, ThemePref } from '../hooks/useThemePreference';

type ThemeContextValue = {
  colors: ThemeColors;
  mode: 'light' | 'dark';
  radius: typeof RADIUS;
  shadow: typeof SHADOW.light;
  pref: ThemePref;
  setPref: (pref: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// pref가 'system'이면 OS 설정을 따르고, 'light'/'dark'면 그 값을 그대로 고정한다.
// 설정 화면에서 setPref를 부르면 이 값을 구독하는 모든 컴포넌트가 즉시 다시 렌더링된다.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { pref, setPref } = useThemePreference();

  const mode: 'light' | 'dark' = pref === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : pref;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: mode === 'dark' ? DARK_COLORS : LIGHT_COLORS,
      mode,
      radius: RADIUS,
      shadow: mode === 'dark' ? SHADOW.dark : SHADOW.light,
      pref,
      setPref,
    }),
    [mode, pref, setPref]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider');
  return ctx;
}
