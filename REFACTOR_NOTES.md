# 코드 구조 리팩터링 — 1단계 (분석 + CSS 분리)

이 문서는 "새 기능을 더 빨리, 안전하게 추가할 수 있는 구조"를 목표로 진행 중인 단계적 리팩터링을
기록한다. 한 번에 다 하지 않고 단계별로 진행하며, 각 단계는 실제로 검증한 뒤 다음 단계로 넘어간다.

## 0. 프로젝트 구조 분석

### 실행·배포 경로
- **웹(정적)**: 저장소 루트가 그대로 Vercel에 배포됨(빌드 스텝 없음, `package.json`에 명시됨). `index.html`이
  메인 SPA, `/calculators/*` `/blog/*` 등은 독립적인 정적 SEO 랜딩 페이지.
- **Firebase**: Authentication(로그인) + Firestore(전체 데이터) + Cloud Functions(`functions/index.js`,
  `asia-northeast3`) + Hosting(주로 `/api/*` → Cloud Function 리라이트 용도, 실제 서비스 도메인은 아님 —
  `asset-filot.web.app`라는 별도 미러 도메인이 Firebase Hosting을 통해 서빙됨).
- **모바일**: `mobile-app/`(React Native/Expo) — 이번 리팩터링에서 다루지 않음(요청 범위 밖).
- **API 계층 — `api/`(Vercel 서버리스) vs `functions/`(Firebase Functions)**: 겹치는 이름이 있어 처음 보면
  "중복"처럼 보이지만, 실제로는 **의도된 이중 배포**다. `api/ask-ai.js`, `api/ipo-schedules.js`,
  `api/finance-products.js`, `api/apartment-subscriptions.js`, `api/news.js`는 각각 `functions/index.js`의
  `aiAsk`/`ipoSchedulesLive`/`financeProductsLive`/`apartmentSubscriptionsLive`/`newsProxy`와 짝을 이루며,
  주 서비스 도메인(gofincalc.com, Vercel이 직접 서빙)과 미러 도메인(asset-filot.web.app, Firebase Hosting이
  서빙) 양쪽에서 같은 기능이 동작하게 하기 위한 것이다(각 파일 상단 주석에 이 의도가 이미 명시돼 있음).
  **삭제 대상이 아니라 "두 곳을 항상 같이 수정해야 하는 유지보수 비용"으로 인식하고 관리해야 한다.**
  `api/brandfetch-config.js`만 Firebase 쪽 짝이 없는데, Vercel 환경변수만 읽는 순수 공개 설정
  엔드포인트라 애초에 이중화가 필요 없다.
- **`functions/index.js`의 나머지 export**(`deleteAccount`, `deleteCalendarEvent`, `dispatchEventReminders`,
  `dispatchScheduledPushes`, `getTaxConsultLeads`, `sendPushNotification`, `syncEconomicIndicators*`,
  `syncFinancialCalendar*`, `syncGov24Subsidies`, `syncIpoScheduleCache`, `upsertCalendarEvent`)는 Vercel
  쪽 짝이 없는 게 정상이다 — 전부 스케줄 작업이거나 비밀값으로 보호된 관리자 전용 쓰기 엔드포인트라
  이중화할 이유가 없다.
- **`backend/`**: Express + Prisma + SQLite로 만든 별도 프로토타입(금융상품 데이터용). `firebase.json`/
  `vercel` 설정 어디에도 연결돼 있지 않다 — 실제 서비스 경로에서 쓰이지 않는 것으로 재확인됨. 삭제 여부는
  이번 리팩터링 범위 밖이라 손대지 않았다(사용자가 명시적으로 정리하라고 하면 별도로 진행).

### 중복/미사용 후보
- `api/*` ↔ `functions/index.js` 짝 함수들 — 위에서 설명한 대로 "중복"이 아니라 "의도된 이중화"임을 확인.
  단, **두 구현이 100% 동일한 로직을 유지해야 하는데 이를 강제하는 장치(공유 모듈, 테스트)가 없다** —
  이번 세션에서 AI 자산 업데이트 기능을 추가할 때도 두 파일에 수작업으로 각각 반영했다. 기술 부채로 기록.
- `backend/` — 실제 서비스 경로 미연결 프로토타입(위 설명 참고).
- 루트의 `최종 i/`, `output/` 디렉터리 — 리팩터링과 무관해 보이는 잔여 파일/폴더로 보이나, 사용자가 직접
  만든 작업물일 수 있어 **삭제하지 않고 그대로 뒀다**. 필요 없으면 사용자가 직접 정리하는 것을 권장.

## 1. 이번 단계(1단계)에서 실제로 한 것

### CSS 분리 (요청 4번 — 완료)
`css/styles.css`(4,289줄, 37개의 느슨한 섹션 주석은 있었지만 실제로는 기능별로 섞여 있었음)를
8개 파일로 분리했다:

| 파일 | 내용 | 줄 수 |
|---|---|---|
| `css/tokens.css` | `:root` 디자인 토큰, 다크모드 변수, 전역 리셋 | 67 |
| `css/layout.css` | 헤더, 사이드바, 탭바, 앱 셸, 토스트 | 1,005 |
| `css/home.css` | 홈 스택, AI 서포터, 계산기 카드 그리드, 뉴스/지원금/청약공모주/경제사전 등 홈에서 진입하는 콘텐츠 위젯 | 1,755 |
| `css/assets.css` | 자산 대시보드, 자산 목표, 자산 히스토리, AI 자산 제안 카드 | 144 |
| `css/community.css` | 자산 라운지(게시글/댓글/신고/블라인드) | 318 |
| `css/calendar.css` | 금융 캘린더 전체(이번 주/월간/내 일정, 상세 모달, 아이콘) | 789 |
| `css/calculators.css` | 핀 파일럿 임베드 상태, 통합 계산기 모달, 증권시장 대시보드 | 170 |
| `css/responsive-native.css` | 네이티브 앱(WebView) 임베드 모드 전용 오버라이드 | 41 |

**안전성 검증 방법**(육안 확인이 아니라 기계적으로 증명):
1. 원본 파일을 괄호 깊이 기준으로 최상위 규칙(rule) 1,313개로 파싱 → 파싱 결과를 원래 순서대로 다시
   이어 붙이면 원본과 **글자 하나까지 정확히 일치**함을 확인(파싱 로직 자체의 정확성 증명).
2. 각 규칙을 8개 파일 중 하나로 분류 → 분류 후 8개 파일의 총 글자 수(166,340자)가 원본과 정확히 일치 —
   **어떤 규칙도 유실되거나 중복되지 않았음**을 증명.
3. 분류 과정에서 같은 selector가 서로 다른 파일로 쪼개진 경우가 있는지 전수 조사 → `@media (...)` 라는
   미디어 쿼리 조건문이 여러 곳에서 재사용된 7건을 제외하면 **실제 선택자 충돌은 0건**(`@media` 조건
   재사용은 서로 다른 내부 규칙을 감싸는 것일 뿐이라 순서와 무관하게 항상 안전함). 즉 어떤 로드 순서를
   택해도 캐스케이드(우선순위) 결과가 원본과 달라지지 않는다는 것을 기계적으로 확인했다.
4. `index.html`의 `<link>` 태그를 8개로 교체하고, 인라인 `<script>` 5개 블록 구문 검사·CSS 8개 파일
   중괄호 균형·`<link>` href가 실제 파일과 정확히 일치하는지까지 확인했다.

**`css/styles.css`(원본)는 삭제하지 않고 그대로 남겨뒀다** — `finpilot/index.html`(계산기 임베드 엔진,
이번 리팩터링 범위 밖)이 별도로 그 파일을 계속 쓰고 있기 때문이다. 당장은 같은 CSS 내용이 두 곳에
존재하는 셈이라 완전한 단일 소스는 아니지만, finpilot을 건드리지 않기 위한 의도적 선택이다(2단계
로드맵 참고).

### 보안 점검 (요청 5번 — 완료, 코드 변경 없음·점검만)
- **클라이언트 노출 비밀값**: `index.html`에 서버 전용 API 키(DART/GEMINI/FSS/ECOS/공공데이터포털 등)가
  하드코딩된 곳 없음을 전수 검색으로 확인. Firebase `apiKey`(줄 177)는 공개돼도 되는 프로젝트 식별자이고
  실제 접근 제어는 Firestore Security Rules와 Firebase Auth가 담당하는 구조라 문제 없음(Firebase 공식
  설계가 그렇다).
- **Firestore 쓰기 권한**: `userAssets/{uid}`는 `request.auth.uid == userId`로 본인만 쓰기 가능하고,
  필드 이름·타입·음수 여부까지 서버(Security Rules)에서 검증한다. `calendarEvents`/`supportPrograms`
  등 자동 수집 컬렉션은 클라이언트 쓰기 자체가 전면 차단(`allow write: if false`)돼 있고 Admin SDK로만
  쓸 수 있다. 관리자 전용 엔드포인트는 전부 `SEND_PUSH_SECRET`/`CALENDAR_SYNC_SECRET` 비밀값으로 보호됨.
- **AI 자산 업데이트 제안**: 코드 검색으로 재확인 — `assetUpdateProposal`은 백엔드에서 **HTTP 응답으로만**
  반환되고, 실제 Firestore 쓰기(`saveUserAssetFields`)는 오직 "저장하기" 버튼 클릭 핸들러 안에서만
  호출된다. AI가 직접 쓰는 경로는 존재하지 않는다.
- **XSS**: AI 답변은 `marked`로 마크다운 파싱 후 `DOMPurify.sanitize()`를 거쳐서만 `innerHTML`에 들어감.
  커뮤니티(자산 라운지) 게시글/댓글은 `escapeHtml()`(`&`, `<`, `>`, `"`, `'` 전부 이스케이프)을 거쳐
  렌더링됨. 뉴스/지원금/청약/공모주 등 외부 API 데이터도 `escapeMyPageHtml()`로 이스케이프해서 출력.

### SEO 점검 (요청 6번 — 완료, 변경 없음 확인)
`index.html`의 canonical/OG 메타/구조화 데이터(JSON-LD), `/calculators/` 20개 독립 페이지, `sitemap.xml`
(66개 URL) 전부 이번 변경(CSS `<link>` 교체)과 무관하며 그대로 유지됨을 확인했다. 해시 기반 화면
(`#calendar`, `#lounge` 등, SPA 내부 라우팅용)과 `/calculators/*` 같은 검색용 독립 URL은 원래부터 서로
다른 정적 파일이라 이번 작업으로 경계가 흐려지지 않았다.

## 2. 이번 단계에서 하지 않은 것(3번 JS 분리) — 왜 미룄는지

`index.html`의 거대한 인라인 `<script>`(약 9,000줄, 전역 `var` 상태와 수십 개의 IIFE로 구성)를 라우팅/
인증/자산관리/커뮤니티/캘린더/뉴스·지원금·상품/AI 서포터/공통 유틸로 나누는 작업은 **이번 턴에서
시도하지 않았다.** 이유:

1. **빌드 스텝이 없다.** 이 프로젝트는 번들러가 없어서(`package.json`에 명시), JS를 여러 파일로 쪼개면
   전부 일반 `<script src="...">` 태그로 로드해야 하고, 로드 순서·전역 스코프 공유 방식을 원본과 똑같이
   맞춰야 한다. `type="module"`로 바꾸면 더 깔끔하지만 strict mode·defer 기본 적용 등 실행 시점 자체가
   달라져서 그 자체가 새로운 위험 요소가 된다.
2. **자동 테스트도, 브라우저로 직접 확인할 도구도 없다.** CSS 분리는 "글자 수 일치 + 선택자 충돌 0건"
   같은 기계적 증명으로 안전성을 보일 수 있었지만, JS는 실행 순서·클로저·전역 상태 공유가 얽혀 있어
   같은 수준의 기계적 증명이 어렵다. 로그인, 계산기, 커뮤니티, 자산 저장처럼 실제 사용자에게 영향이
   큰 기능을 브라우저로 열어보지 못한 채 대규모로 재배치하는 건, "실제로 검증 안 된 변경은 완료로 보고
   하지 말라"는 원칙에 어긋난다고 판단했다.
3. 사용자가 직접 "단계적으로 관리할 것"을 명시했다 — 이번 턴은 안전하게 증명 가능한 CSS 분리까지만
   진행하고, JS 분리는 아래 로드맵으로 넘긴다.

## 3. 다음 단계 로드맵 (구체적)

### 2단계 — 가장 위험이 낮은 JS부터: 공통 유틸리티 추출
`showToast`, `escapeHtml`/`escapeMyPageHtml`, 날짜 포맷터(`formatDateYMD`, `pad2`), 색상 해시
(`getStableBadgeColor`) 등 **다른 기능 상태를 전혀 참조하지 않는 순수 함수들**을 `js/utils.js`로 옮기고
`<script src="js/utils.js">`를 메인 인라인 스크립트보다 먼저 로드한다. 이 함수들은 여러 기능에서 호출만
되고 자기 자신은 아무것도 호출하지 않으므로(의존성이 없는 "리프 노드"), 로드 순서 문제가 생기지 않는다.
검증: 함수별로 호출부를 전수 검색해 시그니처가 그대로 유지되는지 확인 + 구문 검사.

### 3단계 — AI 서포터 모듈 분리
`requestAiAssist`, `renderAiAnswer`, `renderAssetUpdateProposalCard`, `saveUserAssetFields`를
`js/ai-supporter.js`로 분리(이번 세션에 직접 작성해서 의존 관계를 정확히 알고 있는 기능이라 상대적으로
안전). 단, `saveUserAssetFields`를 마이페이지 저장 버튼도 같이 쓰고 있어서, 이 함수를 옮기는 시점에
마이페이지 쪽 호출부도 함께 확인해야 한다.

### 4단계 — 캘린더 모듈 분리
`js/calendar.js` — 이번 세션에 가장 많이 작업해서 의존 관계를 잘 아는 영역. `CALENDAR_EVENTS`,
`calendarActiveFilter` 등 캘린더 전용 상태와 렌더 함수들을 옮긴다. `authState`/`db`/`firebaseAuth`
같은 앱 전역 상태는 참조만 하고 정의는 그대로 메인 스크립트(또는 5단계의 auth 모듈)에 남긴다.

### 5단계 — 인증/라우팅(코어) 모듈 분리
`activateView`, `authState`, `onAuthStateChanged` 리스너, `db`/`firebaseAuth` 초기화 — 이 부분은
**가장 마지막에** 손대야 한다. 거의 모든 다른 기능이 이 상태를 참조하므로, 먼저 다른 기능들을 옮겨서
의존 관계를 줄여둔 다음에 코어를 옮기는 게 안전하다.

### 6단계 — 자산관리 / 커뮤니티 / 뉴스·지원금·상품 모듈 분리
남은 기능들을 순서대로. 각 단계마다: (a) 옮길 함수 목록과 그 함수들이 참조하는 외부 상태를 먼저 표로
정리 → (b) 파일 분리 → (c) 구문 검사 + 실제 라이브 배포 후 사용자가 직접 로그인/계산기/커뮤니티/자산
저장 흐름을 한 번씩 확인 → (d) 문제 없으면 다음 단계.

### 7단계 — finpilot 통합 검토
`finpilot/index.html`이 아직 `css/styles.css`(원본)를 쓰고 있어 CSS가 두 곳에 존재한다. finpilot도
분리된 CSS 파일들을 쓰도록 전환하면 원본 `styles.css`를 완전히 삭제할 수 있다(이번 턴 범위 밖이라
보류).

## 4. 남은 기술 부채 요약

1. `index.html`의 인라인 `<script>`가 아직 하나의 거대한 블록(약 9,000줄) — 위 로드맵대로 단계적 분리 필요.
2. `api/*.js`와 `functions/index.js`의 짝 함수들을 손으로 동기화해야 함(공유 로직 모듈화 여지 있음, 다만
   Vercel/Firebase 런타임이 서로 달라 완전한 코드 공유는 쉽지 않음).
3. `css/styles.css`(원본)가 finpilot 전용으로 계속 남아있어 자산파일럿 메인 앱과 CSS 내용이 일부 중복됨.
4. `backend/`(미사용 프로토타입), 루트의 `최종 i/`/`output/` 디렉터리 정리 여부 — 사용자 확인 필요.
