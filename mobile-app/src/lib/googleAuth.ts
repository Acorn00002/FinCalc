import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import type { NativeModuleError } from '@react-native-google-signin/google-signin';

// Firebase 콘솔(asset-filot 프로젝트) > Authentication > Sign-in method > Google > "웹 SDK 구성"에
// 있는 Web client ID. Firebase JS SDK가 웹에서 쓰는 것과 동일한 값으로, GoogleAuthProvider.credential()에
// 넘길 idToken이 이 프로젝트용으로 발급되게 하려면 반드시 이 값으로 configure해야 한다.
const WEB_CLIENT_ID = '862512786797-sfh4trg04oab2ti612lp7pdqs8k3929p.apps.googleusercontent.com';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

export type GoogleNativeSignInResult =
  | { ok: true; idToken: string }
  | { ok: false; code: 'cancelled' | 'in-progress' | 'play-services-unavailable' | 'unknown'; message: string };

// WebView 안의 Firebase JS SDK는 signInWithPopup을 못 쓰므로(구글이 임베디드 WebView OAuth를 막음),
// 대신 네이티브 구글 로그인으로 idToken을 받아 웹 페이지에 주입해 firebase.auth().signInWithCredential로
// 로그인시킨다. 이 함수는 그 idToken 획득만 담당한다.
export async function signInWithGoogleNative(): Promise<GoogleNativeSignInResult> {
  ensureConfigured();
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (response.type === 'cancelled') {
      return { ok: false, code: 'cancelled', message: '로그인이 취소되었습니다.' };
    }
    const idToken = response.data.idToken;
    if (!idToken) {
      return { ok: false, code: 'unknown', message: 'idToken을 받지 못했습니다.' };
    }
    return { ok: true, idToken };
  } catch (error) {
    const code = (error as Partial<NativeModuleError>)?.code;
    if (code === statusCodes.SIGN_IN_CANCELLED) {
      return { ok: false, code: 'cancelled', message: '로그인이 취소되었습니다.' };
    }
    if (code === statusCodes.IN_PROGRESS) {
      return { ok: false, code: 'in-progress', message: '이미 로그인이 진행 중입니다.' };
    }
    if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { ok: false, code: 'play-services-unavailable', message: 'Google Play 서비스를 사용할 수 없습니다.' };
    }
    return { ok: false, code: 'unknown', message: error instanceof Error ? error.message : String(error) };
  }
}
