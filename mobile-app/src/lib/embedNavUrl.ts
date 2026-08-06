// 앱 콜드 스타트 때의 "진짜 첫 로드"(WebViewRouteScreen의 initialParams)만 이 마커 없이 그대로 두고,
// 메뉴를 눌러서 이동하는 모든 후속 네비게이션에는 이 마커를 붙인다. index.html이 이 마커를 보고
// 자기 자신의 화살표 발사 스플래시를 재생할지 말지 판단한다(css/styles.css의 native-embed-skip-splash).
export function toEmbedNavUrl(url: string): string {
  return url.includes('#') ? url.replace('#', '?embednav=1#') : `${url}?embednav=1`;
}

// menu.ts의 각 메뉴 항목은 embednav 마커 없는 순수 url을 갖고 있는데, 실제 내비게이션된 currentUrl은
// toEmbedNavUrl()이 붙인 "?embednav=1"이 끼어있어 전체 문자열을 그대로 비교하면 항상 어긋난다
// (하단바/드로어의 "지금 이 메뉴가 활성 상태인가" 판정이 다 여기 있는 #hash만 보면 되므로, 그 부분만 비교한다).
export function sameMenuUrl(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const hashOf = (u: string) => {
    const i = u.indexOf('#');
    return i === -1 ? u : u.slice(i);
  };
  return hashOf(a) === hashOf(b);
}
