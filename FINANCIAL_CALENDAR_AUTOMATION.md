# 금융 캘린더 자동화 — 구조 분석 및 작업 내역

## 1. 기존 구조 분석 결과

이 프로젝트는 Next.js/Supabase가 아니라 **정적 사이트(Vercel 자동 배포) + Firebase(Firestore/Auth/Cloud Functions,
리전 `asia-northeast3`)** 구조다. 캘린더 자동화도 이미 상당 부분 만들어져 운영 중이었다:

- **DART(OpenDART) 연동** — 배당/실적 공시, 공모주(IPO) 신고서까지 실제 키로 라이브 검증됨(`functions/index.js`의
  `fetchDartDisclosures`, `fetchDartIpoFilingList`, `fetchDartIpoDetail` 등).
- **청약홈/data.go.kr 연동** — 아파트 청약 일정(`fetchCheongyakhomeSubscriptions`, `fetchApartmentSubscriptions`).
- **Firestore 저장소** — `calendarEvents`(캘린더 표시용), `ipoScheduleCache`(공모주 캐시), `supportPrograms`(정부지원금).
- **스케줄링** — Vercel Cron이 아니라 **Firebase Scheduled Functions**(`onSchedule`)가 이미 이 역할을 하고 있다.
  예: `syncFinancialCalendar`(매일 새벽 2시), `syncIpoScheduleCache`(20분마다).
- **보안** — Firestore Security Rules로 `allow read: if true; allow write: if false;`(Admin SDK만 서버에서 쓰기),
  민감한 수동 트리거는 `CALENDAR_SYNC_SECRET`/`SEND_PUSH_SECRET` 쿼리 파라미터로 보호.
- **관리자 화면** — `#admin-calendar`(로그인 불필요, 비밀값으로 보호)에서 캘린더 일정 CRUD 가능.
- **프론트엔드 반영** — `index.html`이 하드코딩된 `MANUAL_CALENDAR_EVENTS`(수동 폴백)와 Firestore
  `calendarEvents`를 합쳐서(`concat`) 렌더링 — 자동화가 실패해도 수동 데이터가 사라지지 않는 구조가 이미 있었다.

**중요한 이름 관련 사항**: 처음 받은 지시에는 `financialEvents`/Vercel Cron/`CRON_SECRET`이라는 이름이 지정돼
있었지만, 이후 "기존 Firebase Firestore를 그대로 사용하라"는 정정 지시를 받았다. 이미 살아있고 프론트엔드/관리자
화면과 완전히 연결된 `calendarEvents` 컬렉션과 Firebase 자체 스케줄링(`onSchedule`)을 **그대로 유지**하는 쪽이,
같은 데이터를 가리키는 컬렉션을 새로 만들어 이름만 다르게 이관하는 것보다 안전하다고 판단해 그렇게 했다.
대신 **기존에 없던, 새로 추가하는 것들**에는 지시받은 이름을 그대로 사용했다: 변경 이력은 `eventChangeLogs`,
동기화 실행 로그는 `syncLogs`.

## 2. 변경한 파일 목록

- `functions/index.js` — 변경 이력 추적, 동기화 로그 기록, ECOS 경제지표 동기화 함수 추가.
- `functions/helpers/ecosParser.js` (신규) — ECOS 응답 파싱 로직(순수 함수, Firebase 의존성 없음). `functions/lib/`는
  이 저장소에서 `.gitignore` 처리된 경로(TS 빌드 산출물 자리)라 실수로 그 안에 두면 배포에서 누락될 뻔했다 —
  발견해서 `helpers/`로 옮겼다.
- `functions/test/ecosParser.test.js` (신규) — 위 파서에 대한 fixture 기반 단위 테스트(`node:test`, 신규 의존성 없음).
- `functions/package.json` — `npm test` 스크립트 추가.
- `functions/.env` — `ECOS_API_KEY=`(빈 값) 항목과 발급 안내 주석 추가.
- `firestore.rules` — `economicIndicators`/`eventChangeLogs`/`syncLogs` 컬렉션에 대한 공개읽기/서버전용쓰기 규칙 추가.
- `index.html` — `#admin-calendar` 화면에 "동기화 로그"와 "경제지표 스냅샷" 섹션 추가(기존 디자인/구조 재사용, 새 UI
  패턴을 만들지 않음).

## 3. 구현 완료 기능

- **캘린더 일정 변경 이력 추적**: `upsertCalendarEvents`가 기존 문서와 비교해 `date`/`title`/`meta`/`status`가
  바뀌면 `eventChangeLogs`에 `{eventId, source, sourceId, diffs, changedAt}` 문서를 남긴다. 최초 등록 시각은
  `firstSeenAt`, 마지막 확인 시각은 `lastSeenAt`으로 별도 기록.
- **동기화 실행 로그**: 캘린더 동기화(`runCalendarSync`)와 경제지표 동기화(`syncEconomicIndicators`)가 끝날 때마다
  `syncLogs`에 `{job, ok, error, result, ranAt}`을 기록.
- **한국은행 ECOS 경제지표 동기화(신규)**: 기준금리(`722Y001`/`0101000`), 소비자물가지수(`901Y009`/`0`),
  원/달러 환율(`731Y001`/`0000001`) 3종을 `economicIndicators` 컬렉션(문서 ID = 지표 key)에 스냅샷 저장.
  - 매일 오전 9시(KST) 자동 실행: `exports.syncEconomicIndicators` (`onSchedule`)
  - 수동 실행(키 발급 직후 검증용): `exports.syncEconomicIndicatorsManual` (`?secret=CALENDAR_SYNC_SECRET`)
  - **주의**: ECOS는 "통계값"만 제공하고 "다음 발표일"은 알려주지 않는다. 발표 예정일을 추측해서 캘린더
    이벤트로 만들지 않기로 했다 — 대신 "가장 최근 관측치" 스냅샷만 저장하고, 관리자 화면에서 확인 가능하게 했다.
- **관리자 화면 확장**: `#admin-calendar`에 동기화 로그 최근 20건, 경제지표 스냅샷을 읽기 전용으로 보여주는
  섹션 추가(별도 비밀값 없이 조회 가능 — 해당 컬렉션들이 공개읽기이고, 화면 자체가 URL로만 접근 가능한 관리자
  전용 라우트이기 때문).

## 4. API 키 없어 대기 중인 기능

- **ECOS 경제지표 동기화** — `ECOS_API_KEY`가 아직 발급되지 않았다. 키가 없으면
  `syncEconomicIndicators`가 에러 없이 스스로 건너뛰고(`{skipped: true}`) `syncLogs`에 그 사실만 기록한다.
  키를 넣기 전까지는 `economicIndicators` 컬렉션에 아무 데이터도 쌓이지 않는다.

## 5. 사용자가 직접 해야 할 작업

1. https://ecos.bok.or.kr 에서 회원가입 후 Open API 인증키 신청(보통 즉시 발급).
2. 발급받은 키를 `functions/.env`의 `ECOS_API_KEY=` 뒤에 붙여넣기(절대 코드/커밋에 직접 적지 말 것).
3. Firebase Functions 배포 시 이 값을 실제 환경에도 반영: `firebase functions:config` 대신 이 프로젝트는
   `.env` 파일을 그대로 배포에 사용하는 방식이므로, 배포 서버(로컬에서 `firebase deploy --only functions` 실행하는
   머신)의 `functions/.env`에 값이 들어 있어야 한다.
4. 키를 넣은 뒤, 브라우저에서 아래 수동 트리거로 실제 응답을 한 번 확인할 것을 권장한다(라이브 검증 안 된 코드이므로):
   `https://<functions-domain>/syncEconomicIndicatorsManual?secret=<CALENDAR_SYNC_SECRET 값>`
5. `#admin-calendar` 화면에서 "경제지표 스냅샷" 섹션에 값이 뜨는지 확인.

## 6. 환경변수 목록 (이번 작업 관련)

| 변수 | 위치 | 상태 |
|---|---|---|
| `ECOS_API_KEY` | `functions/.env` | 비어 있음 — 사용자가 발급 후 채워야 함 |
| `CALENDAR_SYNC_SECRET` | `functions/.env` | 기존 값 재사용(ECOS 수동 트리거도 동일 비밀값 사용) |

새 시크릿을 추가로 만들지 않고 기존 `CALENDAR_SYNC_SECRET`을 재사용했다 — 캘린더 동기화와 경제지표 동기화는
성격이 같은 "관리자 전용 수동 동기화" 작업이라 시크릿을 분리할 이유가 없었다.

## 7. 테스트/빌드 결과

- `node -c functions/index.js` → 문법 오류 없음.
- `cd functions && npm test` → `node --test test/ecosParser.test.js` 실행, **8개 테스트 모두 통과**
  (정상 응답 파싱, 비정렬 row 처리, ECOS 에러코드 응답, 빈 row, 응답 형식 자체가 다른 경우, 숫자 변환 실패,
  일별/월별 기간 계산의 월 경계 처리).
- 이 프로젝트에는 기존에 `functions/` 테스트 인프라가 전혀 없었기 때문에, ECOS 파서만 순수 함수로 분리해
  (`functions/lib/ecosParser.js`) 테스트 가능하게 만들었다. 나머지 기존 함수(DART/청약홈 등)는 이번 작업
  범위가 아니라 테스트를 추가하지 않았다.

## 8. 배포 전 주의사항

- `functions/.env`는 git에 커밋되지 않는다(`.gitignore` 처리됨) — 배포 전 실제 배포 환경에 `ECOS_API_KEY`를
  직접 넣어야 한다(위 5번 참고).
- `firestore.rules` 변경분은 `firebase deploy --only firestore:rules`로 별도 배포해야 Cloud Functions 코드
  배포와 별개로 반영된다.
- `upsertCalendarEvents`의 반환값 형태가 `숫자` → `{written, added, updated, changed}` 객체로 바뀌었다.
  이 함수를 호출하는 곳은 `runCalendarSync` 한 곳뿐임을 확인했고 그에 맞춰 수정했다(다른 호출부 없음, grep으로 확인).
- 기존 로그인/회원 데이터/기존 Firestore 문서/캘린더 디자인/기존 기능은 삭제하거나 이관하지 않았다 — 전부
  기존 컬렉션·이름·구조를 그대로 두고 새 컬렉션만 추가했다.

## 9. 다음 우선순위

1. `ECOS_API_KEY` 발급 후 실제 응답 형식 확인(문서상의 필드명을 기준으로 작성했으나 라이브 검증은 아직 안 됨).
2. 경제지표를 캘린더 UI(홈 화면의 `#calendar`)에도 노출할지 결정 — 현재는 관리자 화면에서만 보이고, 사용자용
   캘린더에는 아직 반영하지 않았다(스냅샷 통계를 "일정"처럼 보여줄지, 별도 위젯으로 보여줄지는 디자인 결정이 필요).
3. `eventChangeLogs`가 쌓이기 시작하면 관리자 화면에 "무엇이 바뀌었는지" 좀 더 보기 좋게 표시(현재는 원시
   diff 저장만 하고 UI에는 노출하지 않음).
4. DART/청약홈 등 기존 수집 함수들에도 동일한 패턴으로 테스트를 확장할지 검토(이번엔 범위 밖이라 보류).
