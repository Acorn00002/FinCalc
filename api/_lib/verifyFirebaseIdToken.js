// Firebase ID 토큰을 Admin SDK/서비스 계정 없이 순수 JWT 서명 검증만으로 신뢰하기 위한 헬퍼.
// Vercel(api/ 서버리스 함수)에는 Firebase 서비스 계정 키가 환경변수로 등록돼 있지 않아서(등록하려면
// Vercel 프로젝트 설정에 별도로 credential을 추가해야 함) firebase-admin을 쓸 수 없다. 대신 Firebase가
// ID 토큰 서명에 쓰는 공개키(JWKS)를 구글이 공개 엔드포인트로 제공하므로, jose로 서명·발급자(iss)·
// 대상(aud)·만료(exp)만 검증하면 서비스 계정 없이도 "이 토큰이 진짜 이 프로젝트의 Firebase가 발급한
// 유효한 로그인 세션"이라는 걸 안전하게 확인할 수 있다(Admin SDK의 verifyIdToken()과 동일한 신뢰 근거).
import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = "asset-filot";
const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`;
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

// createRemoteJWKSet은 내부적으로 키 캐시를 유지해서, 같은 서버리스 인스턴스가 재사용되는 동안은
// 매 요청마다 JWKS를 다시 받아오지 않는다.
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

// 검증에 성공하면 uid(payload.sub)를 반환하고, 실패하면 예외를 던진다.
export async function verifyFirebaseIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUER,
    audience: PROJECT_ID,
  });
  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("토큰에 sub(uid) 클레임이 없습니다.");
  }
  return payload.sub;
}