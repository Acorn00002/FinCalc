import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithGoogleNative } from '../lib/googleAuth';
import { signInToFirebaseWithGoogleIdToken, refreshFirebaseIdToken } from '../lib/firebaseAuthRest';

const STORAGE_KEY = 'assetpilot_auth_session';

export type AuthUser = { uid: string; email: string; displayName: string; photoURL: string };

type StoredSession = AuthUser & { refreshToken: string };

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<{ ok: boolean; message?: string }>;
  signOut: () => Promise<void>;
  /** Firestore REST 호출에 쓸 유효한 Firebase idToken을 반환한다. 만료 임박이면 자동 갱신한다. */
  getFreshIdToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// 마이페이지·자산라운지·금융캘린더처럼 로그인이 필요한 네이티브 화면들이 공유하는 인증 상태.
// WebView의 Firebase JS SDK와는 별개로, 네이티브에서 직접 Firestore를 읽고 쓰기 위해 진짜 Firebase
// ID 토큰(REST Authorization: Bearer)을 여기서 들고 있는다 — googleAuth.ts의 네이티브 구글 로그인
// 결과(Google idToken)를 firebaseAuthRest.ts로 Firebase 세션과 교환해서 얻는다.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const idTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef<number>(0);

  const persist = useCallback(async (session: StoredSession | null) => {
    if (session) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const stored: StoredSession = JSON.parse(raw);
        setUser({ uid: stored.uid, email: stored.email, displayName: stored.displayName, photoURL: stored.photoURL });
        const refreshed = await refreshFirebaseIdToken(stored.refreshToken);
        idTokenRef.current = refreshed.idToken;
        refreshTokenRef.current = refreshed.refreshToken;
        expiresAtRef.current = refreshed.expiresAt;
        await persist({ ...stored, refreshToken: refreshed.refreshToken });
      } catch {
        setUser(null);
        await persist(null);
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{ ok: boolean; message?: string }> => {
    const googleResult = await signInWithGoogleNative();
    if (!googleResult.ok) {
      return { ok: false, message: googleResult.code === 'cancelled' ? undefined : googleResult.message };
    }
    try {
      const session = await signInToFirebaseWithGoogleIdToken(googleResult.idToken);
      idTokenRef.current = session.idToken;
      refreshTokenRef.current = session.refreshToken;
      expiresAtRef.current = session.expiresAt;
      const nextUser: AuthUser = {
        uid: session.uid,
        email: session.email,
        displayName: session.displayName,
        photoURL: session.photoURL,
      };
      setUser(nextUser);
      await persist({ ...nextUser, refreshToken: session.refreshToken });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  }, [persist]);

  const signOut = useCallback(async () => {
    setUser(null);
    idTokenRef.current = null;
    refreshTokenRef.current = null;
    expiresAtRef.current = 0;
    await persist(null);
  }, [persist]);

  const getFreshIdToken = useCallback(async (): Promise<string | null> => {
    if (!refreshTokenRef.current) return null;
    if (idTokenRef.current && Date.now() < expiresAtRef.current - 60000) return idTokenRef.current;
    try {
      const refreshed = await refreshFirebaseIdToken(refreshTokenRef.current);
      idTokenRef.current = refreshed.idToken;
      refreshTokenRef.current = refreshed.refreshToken;
      expiresAtRef.current = refreshed.expiresAt;
      return refreshed.idToken;
    } catch {
      return null;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, signInWithGoogle, signOut, getFreshIdToken }),
    [user, isLoading, signInWithGoogle, signOut, getFreshIdToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
