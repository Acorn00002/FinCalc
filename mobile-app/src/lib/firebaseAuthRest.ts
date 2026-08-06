// Firebase JS SDK 없이, Identity Toolkit REST API로 "Google idToken → 진짜 Firebase 세션(uid/idToken)"을
// 교환한다. 지금까지 네이티브 구글 로그인(googleAuth.ts)은 WebView 안의 Firebase JS SDK에 idToken을
// 주입하는 용도로만 썼는데, 마이페이지/라운지/캘린더처럼 네이티브 화면에서 직접 Firestore를 읽고 쓰려면
// 네이티브 쪽에도 진짜 Firebase ID 토큰(Authorization: Bearer)이 있어야 보안 규칙(request.auth)을 통과한다.
const FIREBASE_API_KEY = 'AIzaSyCiADiWiH434SNRR85_VDNf9NnZM0Ozxww';

export type FirebaseSession = {
  idToken: string;
  refreshToken: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  expiresAt: number;
};

export async function signInToFirebaseWithGoogleIdToken(googleIdToken: string): Promise<FirebaseSession> {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${googleIdToken}&providerId=google.com`,
        requestUri: 'http://localhost',
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'Firebase 로그인 교환 실패');
  return {
    idToken: json.idToken,
    refreshToken: json.refreshToken,
    uid: json.localId,
    email: json.email ?? '',
    displayName: json.displayName || json.fullName || '',
    photoURL: json.photoUrl ?? '',
    expiresAt: Date.now() + Number(json.expiresIn ?? 3600) * 1000,
  };
}

export type RefreshedToken = { idToken: string; refreshToken: string; uid: string; expiresAt: number };

export async function refreshFirebaseIdToken(refreshToken: string): Promise<RefreshedToken> {
  const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || '세션 갱신 실패');
  return {
    idToken: json.id_token,
    refreshToken: json.refresh_token,
    uid: json.user_id,
    expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000,
  };
}
