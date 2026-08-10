const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ---------- /api/news ----------
// 구글 뉴스 카테고리별 RSS — 헤드라인/경제/세계는 고정 topic ID(opaque 값, 실제 200/XML 응답을 확인한 것만 사용),
// 시사/생활은 대응하는 topic ID가 없어(구글 뉴스 상단 탭에 없음) 검색 RSS(q=키워드)로 대체한다.
// 참고: "지역" topic ID는 지오로케이션에 묶여있는지 응답이 불안정해서(200 → 이후 요청 시 404) 배제했다.
// category 쿼리 파라미터가 없거나 목록에 없으면 기존 기본값(경제)을 그대로 쓴다 — 홈 위젯/모바일 앱은
// category 없이 호출하므로 하위 호환이 깨지지 않는다.
const NEWS_CATEGORY_URLS = {
  headline: "https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNRFp4WkRNU0FtdHZLQUFQAQ?hl=ko&gl=KR&ceid=KR:ko",
  economy: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko",
  society: "https://news.google.com/rss/search?q=" + encodeURIComponent("사회") + "&hl=ko&gl=KR&ceid=KR:ko",
  life: "https://news.google.com/rss/search?q=" + encodeURIComponent("생활") + "&hl=ko&gl=KR&ceid=KR:ko",
  world: "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko"
};
const DEFAULT_NEWS_CATEGORY = "economy";

function resolveNewsUrl(category) {
  return NEWS_CATEGORY_URLS[category] || NEWS_CATEGORY_URLS[DEFAULT_NEWS_CATEGORY];
}

// 홈 화면(index.html)이 /api/news로 호출하면 Firebase Hosting rewrite를 통해 이 함수로 들어온다.
// 서버 대 서버로 구글 뉴스를 대신 가져오기 때문에 브라우저 쪽 CORS 문제가 발생하지 않는다.
exports.newsProxy = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  try {
    const upstream = await fetch(resolveNewsUrl(req.query.category), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AssetPilotNewsProxy/1.0)" }
    });

    if (!upstream.ok) {
      res.status(502).send("뉴스 응답 오류: " + upstream.status);
      return;
    }

    const xml = await upstream.text();
    res.set("Content-Type", "application/xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
    res.status(200).send(xml);
  } catch (error) {
    console.error("newsProxy 실패:", error);
    res.status(502).send("실시간 뉴스를 불러오지 못했습니다.");
  }
});

// ---------- /api/ai ----------
// AI 1회 호출 비용(포인트) — 프론트엔드 안내 문구용 상수(index.html의 AI_CALL_COST)와 반드시 같은 값으로 맞출 것.
const AI_CALL_COST = 50;
// 2026-07 기준 gemini-1.5-flash는 완전히 셧다운되어 요청 시 항상 404를 반환한다(구글 공식 지원 종료).
// 현재 시점 최저비용 flash-lite 라인업 중 신규 모델(gemini-3.1-flash-lite)로 대체 —
// 2.5-flash-lite는 2026-10-16 종료 예정이라 곧 재교체가 필요했을 것이라 더 최근 모델을 선택함.
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_PROMPT_LENGTH = 4000;

class InsufficientPointsError extends Error {
  constructor(currentPoints) {
    super("포인트가 부족합니다.");
    this.currentPoints = currentPoints;
  }
}

function todayYMD() {
  const d = new Date();
  const pad2 = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

const GEMINI_SYSTEM_INSTRUCTION =
  "당신은 '자산파일럿'의 전문적이고 신뢰감 있는 AI 금융 서포터입니다. " +
  "이모티콘 사용을 엄격히 제한하세요 — 문단 시작이나 문장 끝마다 이모티콘을 붙이지 말고, " +
  "전체 답변에서 강조가 꼭 필요한 예외적인 경우에만 최대 1~2개까지만 사용하세요. " +
  "대신 마크다운 문법(제목, 굵은 글씨, 불렛포인트, 표 등)을 적극 활용해 " +
  "이모티콘 없이도 정돈되고 가독성 높은 전문적인 답변을 만드세요. " +
  "사용자가 보유 종목과 비중(예: '삼성전자: 40%')을 알려주며 포트폴리오 분석을 요청하면, " +
  "반드시 다음 3개의 마크다운 ## 섹션으로만 구성해 답변하고 그 외의 섹션은 추가하지 마세요 " +
  "(제목 문구와 순서를 정확히 그대로 쓰세요): " +
  "'## 📊 포트폴리오 진단 요약'(자산 배분과 전반적인 상태를 2~3문장으로 요약), " +
  "'## ⚠️ 리스크 및 취약점'(종목·자산군 쏠림, 변동성 등 구체적 위험 요인을 불렛포인트로), " +
  "'## 💡 개선 제안'(실행 가능한 조정 방향을 불렛포인트로). " +
  "포트폴리오 분석 요청이 아닌 질문(시장 브리핑, 뉴스 요약, 절세 팁 등)에는 이 3단계 형식을 쓰지 말고 평소처럼 자유롭게 답변하세요.";

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다.");

  const url = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent?key=" + apiKey;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: GEMINI_SYSTEM_INSTRUCTION }] },
      // 구글 검색 그라운딩 — 모델 학습 시점 이후의 최신 시사/정치/경제 정보를 반영해 답변하도록 함
      tools: [{ google_search: {} }],
      contents: [{ parts: [{ text: prompt }] }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error("Gemini API 오류: " + response.status + " " + errText);
  }

  const data = await response.json();
  const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content
    ? data.candidates[0].content.parts
    : null;
  const text = parts && parts[0] ? parts[0].text : "";
  if (!text) throw new Error("Gemini 응답에 텍스트가 없습니다.");
  return text;
}

// 홈 화면 등에서 로그인한 사용자가 AI 기능을 요청할 때 호출하는 엔드포인트.
// 포인트 조회/차감은 반드시 이 서버 쪽에서만 수행하고, 프론트엔드는 결과만 받는다.
exports.aiAsk = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }

  const prompt = req.body && typeof req.body.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) {
    res.status(400).json({ error: "prompt가 필요합니다." });
    return;
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    res.status(400).json({ error: "요청이 너무 깁니다. " + MAX_PROMPT_LENGTH + "자 이내로 입력해주세요." });
    return;
  }

  // 1. Authorization 헤더의 Firebase ID 토큰을 검증해 uid를 서버에서 직접 확보한다 (클라이언트가 보낸 uid는 신뢰하지 않음)
  const authHeader = req.get("Authorization") || "";
  const idToken = authHeader.indexOf("Bearer ") === 0 ? authHeader.slice(7) : "";
  if (!idToken) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return;
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch (error) {
    res.status(401).json({ error: "인증 정보가 유효하지 않습니다." });
    return;
  }

  // TODO: 개발 완료 후 포인트 차감 로직 재활성화 — 지금은 개발 단계라 아래 플래그로
  // 포인트 조회/차감/부족 가드를 통째로 우회한다. 정식 출시 전 반드시 false로 되돌릴 것.
  const DEV_BYPASS_POINT_CHECK = true;

  // 2. 포인트 조회 + 차감을 하나의 Firestore 트랜잭션으로 원자 처리.
  //    포인트가 부족하면 여기서 즉시 중단되고, Gemini API는 호출조차 되지 않는다(불필요한 비용 방지).
  const userRef = db.collection("users").doc(uid);
  let remainingPoints = null;

  if (!DEV_BYPASS_POINT_CHECK) {
    try {
      remainingPoints = await db.runTransaction(async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists ? snap.data() : null;
        const current = data && typeof data.totalPoints === "number" ? data.totalPoints : 0;
        if (current < AI_CALL_COST) {
          throw new InsufficientPointsError(current);
        }
        const next = current - AI_CALL_COST;
        const historyEntry = { date: todayYMD(), reason: "AI 어시스턴트 호출", amount: -AI_CALL_COST };
        tx.update(userRef, {
          totalPoints: next,
          pointHistory: admin.firestore.FieldValue.arrayUnion(historyEntry)
        });
        return next;
      });
    } catch (error) {
      if (error instanceof InsufficientPointsError) {
        res.status(402).json({
          error: "포인트가 부족합니다.",
          requiredPoints: AI_CALL_COST,
          currentPoints: error.currentPoints
        });
        return;
      }
      console.error("포인트 차감 트랜잭션 실패:", error);
      res.status(500).json({ error: "포인트 처리 중 오류가 발생했습니다." });
      return;
    }
  }

  // 3. 포인트 차감에 성공한 뒤에만 Gemini를 호출한다. Gemini 호출이 실패하면 방금 차감한 포인트를 그대로 환불한다.
  //    (Firestore 트랜잭션 안에서 외부 API를 직접 호출하지 않는 이유: 트랜잭션은 경합 시 재시도될 수 있어
  //    그 안에서 외부 호출을 하면 같은 요청이 중복 실행될 위험이 있다 — 그래서 "차감 → 호출 → 실패 시 환불" 순서로 분리했다.)
  try {
    const reply = await callGemini(prompt);
    res.status(200).json({ reply: reply, remainingPoints: remainingPoints });
  } catch (error) {
    console.error("Gemini 호출 실패, 포인트 환불 처리:", error);
    // TODO: 개발 완료 후 포인트 차감 로직 재활성화 — DEV_BYPASS_POINT_CHECK가 꺼지면 이 환불도 다시 의미를 갖는다
    if (!DEV_BYPASS_POINT_CHECK) {
      try {
        const refundEntry = { date: todayYMD(), reason: "AI 호출 실패 환불", amount: AI_CALL_COST };
        await userRef.update({
          totalPoints: admin.firestore.FieldValue.increment(AI_CALL_COST),
          pointHistory: admin.firestore.FieldValue.arrayUnion(refundEntry)
        });
      } catch (refundError) {
        console.error("포인트 환불 실패 — 수동 확인 필요:", uid, refundError);
      }
    }
    res.status(502).json({ error: "AI 응답 생성에 실패했습니다. 포인트는 차감되지 않았습니다." });
  }
});

// ---------- 금융 캘린더 자동 수집 (DART 공시 + 청약홈 청약 일정) ----------
// 경제지표(FOMC, 실업수당청구건수 등) 발표 일정은 무료로 제공하는 국내 공공 API가 없어
// 이 파이프라인 범위에서 제외했다 — index.html의 MANUAL_CALENDAR_EVENTS로 계속 수동 관리한다.
// DART는 국내 상장사 공시만 다루므로, 해외(미국) 기업 실적/배당 일정도 이 파이프라인 대상이 아니다.
//
// 두 API 모두 신규 발급 키가 필요하다 (아직 미발급 — 발급 후 functions/.env에 채워 넣을 것):
//   - DART_API_KEY: https://opendart.fss.or.kr 회원가입 → 오픈API 이용 → 인증키 신청 (즉시 발급)
//   - DATA_GO_KR_API_KEY: https://www.data.go.kr 회원가입 → "한국부동산원_청약홈 분양정보 조회 서비스"
//     검색 → 활용신청 (승인 대기가 필요할 수 있음). 승인 후 마이페이지 > 활용신청 현황 > 상세보기에서
//     정확한 "요청 URL"을 확인해 CHEONGYAKHOME_API_URL 값이 다르면 아래 상수를 그 값으로 교체할 것.
// 키가 없는 동안에는 해당 소스만 조용히 건너뛰고 나머지는 정상 동작한다.

const DART_API_KEY = process.env.DART_API_KEY || "";
const DATA_GO_KR_API_KEY = process.env.DATA_GO_KR_API_KEY || "";
const CALENDAR_SYNC_SECRET = process.env.CALENDAR_SYNC_SECRET || "";

const DART_LIST_URL = "https://opendart.fss.or.kr/api/list.json";
// 실제 발급받은 키로 확인한 정확한 엔드포인트(odcloud.kr 기반, Swagger 문서로 직접 검증):
// Base URL이 apis.data.go.kr이 아니라 api.odcloud.kr이고, 인증은 Authorization: Infuser {키} 헤더 방식이다.
const CHEONGYAKHOME_API_URL =
  process.env.CHEONGYAKHOME_API_URL ||
  "https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";

function pad2(n) { return String(n).padStart(2, "0"); }

// DART가 요구하는 YYYYMMDD 형식 (오늘 기준 offsetDays만큼 이동)
function dartDateCompact(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + (offsetDays || 0));
  return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
}

// "20260722" → "2026-07-22" (캘린더 표준 스키마는 대시 포함 형식을 쓴다)
function toDashedDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const s = String(yyyymmdd);
  return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
}

// 코스피(Y) / 코스닥(K) 각각 최근 2일치 공시를 조회 — 스케줄러가 매일 실행되지만,
// 하루 정도 밀리거나 한 번 실패해도 다음날 재수집되도록 창을 넉넉히 둔다(upsert라 중복 걱정 없음).
async function fetchDartDisclosuresForMarket(corpCls) {
  const events = [];
  const bgnDe = dartDateCompact(-2);
  const endDe = dartDateCompact(0);
  const pageCount = 100;
  let pageNo = 1;

  for (;;) {
    const url = DART_LIST_URL +
      "?crtfc_key=" + encodeURIComponent(DART_API_KEY) +
      "&bgn_de=" + bgnDe +
      "&end_de=" + endDe +
      "&corp_cls=" + corpCls +
      "&page_no=" + pageNo +
      "&page_count=" + pageCount;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("DART API 응답 오류(" + corpCls + "):", res.status);
      break;
    }
    const data = await res.json();

    if (data.status === "013") break; // 조회된 데이터 없음 — 정상 케이스
    if (data.status !== "000") {
      console.error("DART API 오류(" + corpCls + "):", data.status, data.message);
      break;
    }

    const list = data.list || [];
    list.forEach((item) => {
      const reportName = item.report_nm || "";
      let type = null;
      if (reportName.indexOf("배당") > -1) type = "배당";
      else if (
        reportName.indexOf("사업보고서") > -1 ||
        reportName.indexOf("분기보고서") > -1 ||
        reportName.indexOf("반기보고서") > -1
      ) type = "실적";
      if (!type) return; // 배당/실적과 무관한 일반 공시는 캘린더에 올리지 않는다

      const dashedDate = toDashedDate(item.rcept_dt);
      if (!dashedDate || !item.rcept_no) return;

      events.push({
        sourceId: item.rcept_no,
        date: dashedDate,
        category: "stock",
        type: type,
        title: item.corp_name + " " + reportName.replace(/\s*\([^)]*\)\s*$/, "").trim(),
        meta: (corpCls === "Y" ? "코스피" : "코스닥") + " · " + (item.stock_code || ""),
        status: null,
        flag: "kr",
        company: item.corp_name,
        logo: null,
        source: "dart",
        sourceUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + item.rcept_no
      });
    });

    if (list.length < pageCount) break;
    pageNo += 1;
    if (pageNo > 10) break; // 안전장치 — 이틀치 공시가 1000건을 넘는 경우는 사실상 없음
  }

  return events;
}

async function fetchDartDisclosures() {
  if (!DART_API_KEY) {
    console.warn("DART_API_KEY가 설정되지 않아 DART 공시 수집을 건너뜁니다.");
    return [];
  }
  const [kospi, kosdaq] = await Promise.all([
    fetchDartDisclosuresForMarket("Y"),
    fetchDartDisclosuresForMarket("K")
  ]);
  return kospi.concat(kosdaq);
}

// ---------- 공모주 청약 일정 (청약·공모주 페이지, /api/ipo-schedules) ----------
// DART에는 "이번 주 공모주 목록"을 바로 주는 API가 없어서, 두 단계로 조합한다.
//   1) list.json에서 corp_code 없이 "증권신고서(지분증권)"(pblntf_ty=C, pblntf_detail_ty=C001) 공시를
//      최근 60일 범위로 검색한다. 이 상세유형은 지분증권 관련 공시를 폭넓게 묶어서, 실제로는
//      상장사의 유상증자·일괄신고(회사채/ELS) 실적보고서 등이 훨씬 더 많이 섞여 나온다(실측 확인:
//      45일 검색에 3800여 건). report_nm에 "증권신고서(지분증권)"이 포함된 것만 남긴다([기재정정]/
//      [발행조건확정] 접두어 포함) — stock_code 유무로는 더 이상 걸러내지 않는다(2단계에서 판단).
//   2) 회사마다 정정 공시가 여러 번 올라오므로 접수일(rcept_dt) 기준 최신 1건만 남긴 뒤,
//      각 회사의 corp_code로 estkRs.json(지분증권 증권신고서 상세)을 조회해 청약기일(sbd)·납입기일(pymd)·
//      모집방법(slmthn) 등을 가져온다. 실제 키로 slmthn 값을 확인해보니, 이미 상장된 회사의 유상증자는
//      "실권주 일반공모"라는 명시적 문구가 있는 것만 일반 투자자가 청약 가능한 물량이고 — 그 외
//      (주주배정/제3자배정 등)는 청약 불가능한 사모성 공시라 stock_code가 있으면서 slmthn에
//      "실권주"가 없는 건 제외한다. 스팩/리츠는 회사명 패턴("기업인수목적"/"리츠")으로 분류한다
//      (국내에서 이 명명 규칙은 사실상 강제 사항이라 신뢰도가 높음).
// 주의: 실제 발급받은 키로 라이브 검증까지 마쳤다(2026-08 기준). estkRs 응답은 data.list가 아니라
// data.group[].list(그룹별 배열)로 내려온다는 것과, sbd 형식이 "2026년 09월 16일 ~ 2026년 09월 17일"인
// 것도 실측으로 확인했다.
const DART_ESTKRS_URL = "https://opendart.fss.or.kr/api/estkRs.json";

// "2026.08.07 ~ 2026.08.08" / "2026년 08월 07일~08일" 등 다양한 표기에서 날짜를 최대한 관대하게 뽑아낸다.
function extractDartDates(str) {
  if (!str) return [];
  const re = /(\d{4})[.\-년]\s*(\d{1,2})[.\-월]\s*(\d{1,2})/g;
  const out = [];
  let m;
  while ((m = re.exec(str)) !== null) {
    out.push(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  return out;
}

function parseDartDateRange(str) {
  const dates = extractDartDates(str);
  if (!dates.length) return null;
  return { start: dates[0], end: dates[dates.length - 1] };
}

async function fetchDartIpoFilingList() {
  const bgnDe = dartDateCompact(-60);
  const endDe = dartDateCompact(0);
  const pageCount = 100;
  let pageNo = 1;
  const filings = [];

  for (;;) {
    const url = DART_LIST_URL +
      "?crtfc_key=" + encodeURIComponent(DART_API_KEY) +
      "&pblntf_ty=C" +
      "&pblntf_detail_ty=C001" +
      "&bgn_de=" + bgnDe +
      "&end_de=" + endDe +
      "&page_no=" + pageNo +
      "&page_count=" + pageCount;

    const res = await fetch(url);
    if (!res.ok) {
      console.error("DART IPO 목록 조회 오류:", res.status);
      break;
    }
    const data = await res.json();
    if (data.status === "013") break; // 조회된 데이터 없음
    if (data.status !== "000") {
      console.error("DART IPO 목록 API 오류:", data.status, data.message);
      break;
    }

    filings.push.apply(filings, data.list || []);
    if ((data.list || []).length < pageCount) break;
    pageNo += 1;
    if (pageNo > 10) break;
  }

  // 증권신고서(지분증권) 본문/정정/발행조건확정만 남긴다. 이미 상장된 회사도 일단은 통과시키고
  // (실권주 일반공모인지는 상세 조회에서 slmthn으로 가려낸다), 그 외 유형(실적보고서/일괄신고 등)은 제외.
  return filings.filter(function (f) {
    return f.report_nm && f.report_nm.indexOf("증권신고서(지분증권)") > -1;
  });
}

// 같은 회사가 정정신고서를 여러 번 낼 수 있어, corp_code당 접수일이 가장 최근인 1건만 남긴다.
function dedupeLatestByCorp(filings) {
  const latest = {};
  filings.forEach((f) => {
    const prev = latest[f.corp_code];
    if (!prev || f.rcept_dt > prev.rcept_dt) latest[f.corp_code] = f;
  });
  return Object.values(latest);
}

// 회사명 패턴으로 스팩/리츠를 가려낸다 — 국내 스팩은 반드시 회사명에 "기업인수목적"이 들어가고
// (예: "엔에이치기업인수목적34호"), 리츠는 "리츠" 또는 "위탁관리부동산투자회사"가 들어가는 게
// 사실상 강제되는 명명 규칙이라 신뢰도가 높다.
function classifyIpoCategory(corpName, slmthn) {
  if (slmthn && slmthn.indexOf("실권주") > -1) return "rights";
  if (corpName.indexOf("기업인수목적") > -1) return "spac";
  if (corpName.indexOf("리츠") > -1 || corpName.indexOf("위탁관리부동산투자회사") > -1) return "reit";
  return "general";
}

async function fetchDartIpoDetail(filing) {
  const bgnDe = dartDateCompact(-60);
  const endDe = dartDateCompact(60);
  const url = DART_ESTKRS_URL +
    "?crtfc_key=" + encodeURIComponent(DART_API_KEY) +
    "&corp_code=" + filing.corp_code +
    "&bgn_de=" + bgnDe +
    "&end_de=" + endDe;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "000" || !data.group || !data.group.length) return null;

    // estkRs 응답은 그룹(일반사항/증권의종류/인수인정보/...)별로 나뉜 배열이라 하나로 펼쳐서 찾는다.
    const rows = data.group.reduce(function (acc, g) { return acc.concat(g.list || []); }, []);
    const generalRow = rows.find((r) => r.sbd) || rows[0];
    const priceRow = rows.find((r) => r.slprc);
    const underwriterRow = rows.find((r) => r.actnmn);
    const methodRow = rows.find((r) => r.slmthn);
    const slmthn = methodRow ? methodRow.slmthn : "";

    // 이미 상장된 회사의 지분증권 신고서는 대부분 주주배정(제3자배정 등) 사모 성격이라 일반 투자자가
    // 청약할 수 없다 — "실권주 일반공모"라고 명시된 것만 실제 청약 가능한 물량이라 통과시킨다.
    if (filing.stock_code && slmthn.indexOf("실권주") === -1) return null;

    const subRange = parseDartDateRange(generalRow && generalRow.sbd);
    if (!subRange) return null; // 청약기일을 못 찾으면 목록에 올리지 않는다(추측 데이터 방지)

    const paymentDates = extractDartDates(generalRow && generalRow.pymd);
    const priceRaw = priceRow && priceRow.slprc ? String(priceRow.slprc).replace(/[^0-9]/g, "") : "";
    const price = priceRaw ? parseInt(priceRaw, 10) : null;
    const category = classifyIpoCategory(filing.corp_name, slmthn);

    // 공모금액(slta)·공모주식수(stkcnt) — 시가총액은 상장 전 회사의 "총발행주식수"를 이 API로
    // 얻을 수 없어(공모 대상 수량만 나옴) 계산하지 않는다(추측 수치 제공 금지, 프론트에서 "미정" 처리).
    const amountRaw = priceRow && priceRow.slta ? String(priceRow.slta).replace(/[^0-9]/g, "") : "";
    const sharesRaw = priceRow && priceRow.stkcnt ? String(priceRow.stkcnt).replace(/[^0-9]/g, "") : "";

    return {
      id: filing.corp_code,
      name: filing.corp_name,
      stockCode: filing.stock_code || null,
      // 상장 전 회사는 코스피/코스닥이 확정 표기되지 않아 "신규상장"으로 통일하고,
      // 이미 상장된 회사(실권주 청약)는 실제 시장 구분(코스피 Y/코스닥 K)을 보여준다.
      market: filing.stock_code ? (filing.corp_cls === "Y" ? "코스피" : "코스닥") : "신규상장",
      category: category,
      underwriter: underwriterRow ? underwriterRow.actnmn : "",
      priceMin: price,
      priceMax: price,
      offeringAmount: amountRaw ? parseInt(amountRaw, 10) : null,
      offeringShares: sharesRaw ? parseInt(sharesRaw, 10) : null,
      subStart: subRange.start.toISOString(),
      subEnd: subRange.end.toISOString(),
      refundDate: paymentDates.length ? paymentDates[paymentDates.length - 1].toISOString() : null,
      sourceUrl: "https://dart.fss.or.kr/dsaf001/main.do?rcpNo=" + filing.rcept_no
    };
  } catch (error) {
    console.error("DART IPO 상세 조회 실패(" + filing.corp_name + "):", error.message);
    return null;
  }
}

async function fetchDartIpoSchedules() {
  if (!DART_API_KEY) {
    console.warn("DART_API_KEY가 설정되지 않아 공모주 일정 수집을 건너뜁니다.");
    return [];
  }
  const filings = dedupeLatestByCorp(await fetchDartIpoFilingList());
  const details = await Promise.all(filings.map(fetchDartIpoDetail));
  return details.filter(Boolean);
}

// fetchDartIpoSchedules()는 매칭된 신고서 건수만큼 DART 상세 조회(estkRs.json)를 병렬로 날려서
// 한 번 실행에 수 초~수십 초가 걸릴 수 있다 — 클라이언트가 매번 이 비용을 직접 기다리지 않도록
// 결과를 Firestore(ipoScheduleCache/latest)에 캐싱해둔다. index.html의 loadIpoSchedules()가 이
// 문서를 먼저 읽고, syncIpoScheduleCache(아래 스케줄 함수)가 20분마다 미리 갱신해서 채워둔다.
async function refreshIpoScheduleCache() {
  const schedules = await fetchDartIpoSchedules();
  await db.collection("ipoScheduleCache").doc("latest").set({
    schedules: schedules,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return schedules;
}

// 청약홈(한국부동산원) APT 분양정보 — data.go.kr 표준 응답 포맷(response.body.items)을 기본으로 하되,
// 서비스별로 조금씩 다른 실제 필드명 후보들도 함께 대비해둔다. 활용신청 승인 후 실제 응답을 보고
// 아래 필드 매핑(houseNm/pblancNo/rceptBgnde 등)을 문서와 대조해 필요시 조정할 것.
async function fetchCheongyakhomeSubscriptions() {
  if (!DATA_GO_KR_API_KEY) {
    console.warn("DATA_GO_KR_API_KEY가 설정되지 않아 청약홈 청약 일정 수집을 건너뜁니다.");
    return [];
  }

  // odcloud.kr(공공데이터포털 신규 표준) 계열 API는 apis.data.go.kr과 달리 serviceKey 쿼리 파라미터가 아니라
  // "Authorization: Infuser {키}" 헤더로 인증한다 — 실제 호출로 두 방식을 직접 대조해 확인했다.
  const url = CHEONGYAKHOME_API_URL + "?page=1&perPage=100";

  const res = await fetch(url, {
    headers: { Authorization: "Infuser " + DATA_GO_KR_API_KEY }
  });
  if (!res.ok) {
    console.error("청약홈 API 응답 오류:", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const items = data.data || (data.response && data.response.body && data.response.body.items) ||
    data.items || [];

  const events = [];
  items.forEach((item) => {
    const houseName = item.houseNm || item.HOUSE_NM || item.title;
    const noticeId = item.pblancNo || item.PBLANC_NO || item.id;
    const receptionDateRaw = item.rceptBgnde || item.RCEPT_BGNDE || item.date;
    if (!houseName || !receptionDateRaw) return;

    const dashedDate = String(receptionDateRaw).length === 8
      ? toDashedDate(receptionDateRaw)
      : String(receptionDateRaw);
    if (!dashedDate) return;

    events.push({
      sourceId: String(noticeId || (houseName + receptionDateRaw)),
      date: dashedDate,
      category: "realestate",
      type: "청약",
      title: houseName + " 청약",
      meta: item.subscrptAreaCodeNm || item.SUBSCRPT_AREA_CODE_NM || "",
      status: null,
      flag: "kr",
      company: null,
      logo: null,
      source: "cheongyakhome",
      sourceUrl: "https://www.applyhome.co.kr/ai/aia/selectAPTLttotPblancDetail.do?houseManageNo=" +
        (item.houseManageNo || item.HOUSE_MANAGE_NO || "")
    });
  });

  return events;
}

// sourceId 기반 결정론적 문서 ID(예: "dart_20260722000123")로 set(merge:true) 하기 때문에
// 같은 이벤트를 다시 수집해도 새 문서가 늘어나지 않고 필드만 갱신된다 — 이것이 중복 수집 방지 + upsert의 핵심.
async function upsertCalendarEvents(events) {
  if (!events.length) return 0;
  const batchSize = 400; // Firestore 배치 최대 500건 제한에 여유를 둠
  let written = 0;

  for (let i = 0; i < events.length; i += batchSize) {
    const chunk = events.slice(i, i + batchSize);
    const batch = db.batch();
    chunk.forEach((ev) => {
      if (!ev.date || !ev.sourceId) return;
      const ref = db.collection("calendarEvents").doc(ev.source + "_" + ev.sourceId);
      batch.set(ref, Object.assign({}, ev, {
        updatedAt: new Date()
      }), { merge: true });
      written += 1;
    });
    await batch.commit();
  }
  return written;
}

async function runCalendarSync() {
  const [dartEvents, cheongyakhomeEvents] = await Promise.all([
    fetchDartDisclosures().catch((err) => { console.error("DART 수집 실패:", err); return []; }),
    fetchCheongyakhomeSubscriptions().catch((err) => { console.error("청약홈 수집 실패:", err); return []; })
  ]);

  const written = await upsertCalendarEvents(dartEvents.concat(cheongyakhomeEvents));
  const summary = { dart: dartEvents.length, cheongyakhome: cheongyakhomeEvents.length, written: written };
  console.log("금융 캘린더 동기화 완료:", JSON.stringify(summary));
  return summary;
}

// 매일 새벽 2시(KST) 자동 실행
exports.syncFinancialCalendar = onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    await runCalendarSync();
  }
);

// 수동 실행용 — API 키를 새로 넣은 뒤 새벽 2시까지 기다리지 않고 바로 테스트하고 싶을 때 사용.
// ?secret=CALENDAR_SYNC_SECRET 쿼리 파라미터로 보호한다 (공개 엔드포인트를 무단으로 반복 호출하면
// DART/공공데이터포털의 일일 호출 한도를 낭비할 수 있어 반드시 비밀값 없이는 실행되지 않게 막아둠).
exports.syncFinancialCalendarManual = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (!CALENDAR_SYNC_SECRET || req.query.secret !== CALENDAR_SYNC_SECRET) {
    res.status(403).json({ error: "권한이 없습니다." });
    return;
  }
  try {
    const result = await runCalendarSync();
    res.status(200).json(result);
  } catch (error) {
    console.error("수동 캘린더 동기화 실패:", error);
    res.status(500).json({ error: "동기화 중 오류가 발생했습니다." });
  }
});

// ---------- 푸시 알림 발송 ----------
// 이 앱은 별도 관리자 계정 체계가 없어(1인 개발), CALENDAR_SYNC_SECRET과 동일한 방식으로
// 공유 비밀값 하나로 발송 권한을 제한한다. 값을 아는 사람만 /api/send-push를 호출할 수 있다.
const SEND_PUSH_SECRET = process.env.SEND_PUSH_SECRET || "";

// notifications 문서 하나를 실제 FCM 푸시로 fcmTokens에 등록된 모든 기기에 발송한다.
// 만료/삭제된 토큰은 발송 응답에서 걸러내 fcmTokens에서 함께 정리한다(무효 토큰이 계속 쌓이는 것 방지).
async function dispatchPushToAllTokens(title, body, link) {
  const tokensSnap = await db.collection("fcmTokens").get();
  const tokens = tokensSnap.docs.map((doc) => doc.id);
  if (!tokens.length) return { successCount: 0, failureCount: 0 };

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

  let successCount = 0;
  let failureCount = 0;
  const staleTokens = [];

  for (const chunk of chunks) {
    const response = await admin.messaging().sendEachForMulticast({
      notification: { title, body },
      data: { link: link || "" },
      tokens: chunk
    });
    successCount += response.successCount;
    failureCount += response.failureCount;
    response.responses.forEach((r, idx) => {
      if (!r.success && r.error && r.error.code === "messaging/registration-token-not-registered") {
        staleTokens.push(chunk[idx]);
      }
    });
  }

  await Promise.all(staleTokens.map((token) =>
    db.collection("fcmTokens").doc(token).delete().catch(() => {})
  ));

  return { successCount, failureCount, staleRemoved: staleTokens.length };
}

// 즉시 발송 또는 예약 발송 — 예약된 건은 notifications 문서를 sent:false로 만들어두기만 하고,
// 실제 발송은 아래 dispatchScheduledPushes 스케줄러가 시간이 되면 처리한다.
exports.sendPushNotification = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }
  if (!SEND_PUSH_SECRET || req.query.secret !== SEND_PUSH_SECRET) {
    res.status(403).json({ error: "권한이 없습니다." });
    return;
  }

  const { title, body, icon, link, scheduledFor } = req.body || {};
  if (!title || !body) {
    res.status(400).json({ error: "title, body가 필요합니다." });
    return;
  }

  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
  const isScheduled = !!(scheduledDate && !isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now());

  try {
    const docRef = await db.collection("notifications").add({
      title,
      body,
      icon: icon || "ph-bell",
      link: link || "",
      createdAt: new Date(),
      scheduledFor: isScheduled ? scheduledDate : null,
      sent: !isScheduled
    });

    if (!isScheduled) {
      const result = await dispatchPushToAllTokens(title, body, link);
      res.status(200).json({ id: docRef.id, scheduled: false, ...result });
      return;
    }

    res.status(200).json({ id: docRef.id, scheduled: true, scheduledFor: scheduledDate.toISOString() });
  } catch (error) {
    console.error("푸시 발송 실패:", error);
    res.status(500).json({ error: "발송 중 오류가 발생했습니다." });
  }
});

// 10분마다 예약 시각이 지난 미발송 알림을 찾아 실제로 발송한다.
exports.dispatchScheduledPushes = onSchedule(
  { schedule: "*/10 * * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const snapshot = await db.collection("notifications").where("sent", "==", false).get();
    if (snapshot.empty) return;

    const now = Date.now();
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.scheduledFor || data.scheduledFor.toDate().getTime() > now) continue;
      try {
        await dispatchPushToAllTokens(data.title, data.body, data.link);
        await doc.ref.update({ sent: true });
      } catch (error) {
        console.error("예약 발송 실패(문서 " + doc.id + "):", error);
      }
    }
  }
);

// ---------- 금융 캘린더 관리자 CRUD (정부지원금 / 부동산청약 / 공모주 등) ----------
// calendarEvents는 firestore.rules에서 클라이언트 write를 전부 막아뒀으므로, 수동 등록도
// DART/청약홈 자동 수집과 동일하게 Admin SDK를 쓰는 이 함수를 거쳐야 한다.
// 별도 관리자 계정 체계가 없어 SEND_PUSH_SECRET을 그대로 재사용한다(같은 사람이 관리하는 값이라 자연스러움).
exports.upsertCalendarEvent = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }
  if (!SEND_PUSH_SECRET || req.query.secret !== SEND_PUSH_SECRET) {
    res.status(403).json({ error: "권한이 없습니다." });
    return;
  }

  const { id, date, category, type, title, meta, status, flag, link, details } = req.body || {};
  if (!date || !category || !title) {
    res.status(400).json({ error: "date, category, title은 필수입니다." });
    return;
  }

  const docData = {
    date,
    category,
    type: type || "",
    title,
    meta: meta || "",
    status: status || null,
    flag: flag || "kr",
    link: link || "",
    details: details && typeof details === "object" ? details : null,
    source: "admin",
    updatedAt: new Date()
  };

  try {
    if (id) {
      await db.collection("calendarEvents").doc(id).set(docData, { merge: true });
      res.status(200).json({ id });
      return;
    }
    const ref = await db.collection("calendarEvents").add(Object.assign({ createdAt: new Date() }, docData));
    res.status(200).json({ id: ref.id });
  } catch (error) {
    console.error("일정 저장 실패:", error);
    res.status(500).json({ error: "저장 중 오류가 발생했습니다." });
  }
});

exports.deleteCalendarEvent = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }
  if (!SEND_PUSH_SECRET || req.query.secret !== SEND_PUSH_SECRET) {
    res.status(403).json({ error: "권한이 없습니다." });
    return;
  }
  const { id } = req.body || {};
  if (!id) {
    res.status(400).json({ error: "id가 필요합니다." });
    return;
  }
  try {
    await db.collection("calendarEvents").doc(id).delete();
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("일정 삭제 실패:", error);
    res.status(500).json({ error: "삭제 중 오류가 발생했습니다." });
  }
});

// ---------- 세무사 1:1 절세 상담 신청 목록 조회 ----------
// taxConsultLeads는 연락처 등 개인정보라 firestore.rules에서 클라이언트 read를 전면 차단해뒀다
// (본인조차 다시 못 봄). 그래서 조회는 Admin SDK로 규칙을 우회하는 이 함수를 통해서만 가능하고,
// 다른 관리자 함수와 동일하게 SEND_PUSH_SECRET을 아는 사람만 호출할 수 있다.
exports.getTaxConsultLeads = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  if (!SEND_PUSH_SECRET || req.query.secret !== SEND_PUSH_SECRET) {
    res.status(403).json({ error: "권한이 없습니다." });
    return;
  }
  try {
    const snapshot = await db.collection("taxConsultLeads").orderBy("createdAt", "desc").limit(200).get();
    const leads = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        category: data.category || "",
        contact: data.contact || "",
        message: data.message || "",
        createdAt: data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toISOString() : null
      };
    });
    res.status(200).json({ leads });
  } catch (error) {
    console.error("절세 상담 목록 조회 실패:", error);
    res.status(500).json({ error: "목록을 불러오지 못했습니다." });
  }
});

// ---------- D-Day 일정 알림(🔔) 발송 ----------
// 사용자가 특정 일정에 알림을 켜면 users/{uid}/eventReminders/{eventId} 문서가 생기고(클라이언트가 직접
// 자기 서브컬렉션에 쓰는 것이라 관리자 비밀값이 필요 없음 — firestore.rules에서 본인 uid만 허용),
// 이 함수가 매일 아침 그 목록 전체(collectionGroup)를 훑어 D-1/D-Day인 것만 골라 해당 유저에게만 발송한다.
async function dispatchPushToUser(uid, title, body, link) {
  const tokensSnap = await db.collection("fcmTokens").where("uid", "==", uid).get();
  const tokens = tokensSnap.docs.map((doc) => doc.id);
  if (!tokens.length) return;

  const response = await admin.messaging().sendEachForMulticast({
    notification: { title, body },
    data: { link: link || "" },
    tokens
  });
  const staleTokens = [];
  response.responses.forEach((r, idx) => {
    if (!r.success && r.error && r.error.code === "messaging/registration-token-not-registered") {
      staleTokens.push(tokens[idx]);
    }
  });
  await Promise.all(staleTokens.map((token) => db.collection("fcmTokens").doc(token).delete().catch(() => {})));
}

exports.dispatchEventReminders = onSchedule(
  { schedule: "0 8 * * *", timeZone: "Asia/Seoul", region: "asia-northeast3" },
  async () => {
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }); // YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

    const snapshot = await db.collectionGroup("eventReminders").get();
    if (snapshot.empty) return;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.eventDate || (data.eventDate !== todayStr && data.eventDate !== tomorrowStr)) continue;

      const uid = doc.ref.parent.parent.id;
      const isToday = data.eventDate === todayStr;
      const title = isToday ? "오늘 마감/예정: " + (data.eventTitle || "일정") : "내일 마감/예정: " + (data.eventTitle || "일정");
      const body = data.eventMeta || "자산 파일럿 캘린더에서 자세히 확인해보세요.";

      try {
        await dispatchPushToUser(uid, title, body, "#calendar");
      } catch (error) {
        console.error("일정 알림 발송 실패(uid " + uid + "):", error);
      }
    }
  }
);

// ---------- 정부지원금 실데이터 동기화 (공공데이터포털 "보조금24" — 행정안전부_대한민국 공공서비스(혜택) 정보) ----------
// serviceList(목록) → serviceDetail(신청링크 등 상세) → supportConditions(연령 등 자격조건) 3개 엔드포인트를 조합해
// supportPrograms 컬렉션에 저장한다. 클라이언트는 이 컬렉션을 그대로 읽어서 기존 필터링 UI에 꽂아 쓴다.
const GOV24_API_KEY = process.env.EXPO_PUBLIC_GOV24_API_KEY || "";
const GOV24_BASE_URL = "https://api.odcloud.kr/api/gov24/v3";

// 보조금24가 실제로 쓰는 서비스분야 8종 그대로를 카테고리로 사용한다 — 임의로 4개로 뭉치면
// 정보 손실이 생기므로, 원본 분류 체계를 그대로 노출하는 쪽이 더 정확하다.
const GOV24_CATEGORIES = ["보육·교육", "주거·자립", "농림축산어업", "행정·안전", "문화·환경", "보건·의료", "고용·창업", "생활안정"];

const GOV24_REGION_PREFIXES = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시",
  "세종특별자치시", "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도",
  "경상북도", "경상남도", "제주특별자치도"
];

async function gov24Fetch(path, condParams, page, perPage) {
  const params = new URLSearchParams();
  params.set("serviceKey", GOV24_API_KEY);
  params.set("page", String(page));
  params.set("perPage", String(perPage));
  Object.keys(condParams || {}).forEach((k) => params.set(k, condParams[k]));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(GOV24_BASE_URL + path + "?" + params.toString(), { signal: controller.signal });
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

// 보조금24 지원조건 API에는 명시적인 "지역" 코드가 없어서, 소관기관 정보로 대신 추정한다.
// 중앙행정기관/공공기관이 주관하면 전국 대상으로, 지자체가 주관하면 기관명에서 시/도 이름을 뽑아낸다.
function inferGov24Region(row) {
  const orgType = row["소관기관유형"] || "";
  if (orgType.indexOf("중앙행정기관") !== -1 || orgType.indexOf("공공기관") !== -1) return "전국";
  const orgName = row["소관기관명"] || "";
  const matched = GOV24_REGION_PREFIXES.filter(function (p) { return orgName.indexOf(p.slice(0, 2)) !== -1; })[0];
  return matched || "전국";
}

// 보조금24 지원조건의 직업 코드(JA12xx 등)는 공식 코드표 없이는 정확히 매핑하기 어려워서,
// 대신 서비스명/지원대상 텍스트에서 키워드를 찾는 방식으로 최대한 보수적으로(놓치지 않는 쪽으로) 추정한다.
// 아무 키워드도 못 찾으면 빈 배열(= 직업 제한 없음)로 두어, 실제로 해당될 수 있는 사용자를 걸러내지 않는다.
function inferGov24Employment(row) {
  const text = [row["서비스명"], row["지원대상"], row["서비스목적요약"]].filter(Boolean).join(" ");
  const result = [];
  if (/대학생/.test(text)) result.push("대학생");
  if (/(재직자|근로자|직장인)/.test(text)) result.push("재직자");
  if (/(자영업자|소상공인)/.test(text)) result.push("자영업자");
  if (/(프리랜서)/.test(text)) result.push("프리랜서");
  if (/(구직|취업준비|미취업)/.test(text)) result.push("취준생");
  if (/(무직|실업자)/.test(text)) result.push("무직");
  return result;
}

// "신청기한"은 자유 텍스트라(예: "상시신청", "○ 정기신청 : 5.1.~5.31.") 항상 날짜를 뽑아낼 수는 없다.
// 텍스트에 등장하는 마지막 YYYY.MM.DD 형태를 마감일로 간주하고, 못 찾으면 null(=상시/문의로 표시)로 둔다.
function parseGov24Deadline(text) {
  if (!text) return null;
  const matches = String(text).match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/g);
  if (!matches || !matches.length) return null;
  const parts = matches[matches.length - 1].split(/[.\-]/);
  const y = parts[0];
  const m = String(Number(parts[1])).padStart(2, "0");
  const d = String(Number(parts[2])).padStart(2, "0");
  if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return y + "-" + m + "-" + d;
}

function splitGov24Checklist(text) {
  if (!text) return [];
  return String(text)
    .split(/\r?\n/)
    .map(function (line) { return line.replace(/^[\s○\-•*]+/, "").trim(); })
    .filter(function (line) { return line.length > 3; })
    .slice(0, 6);
}

// 동시에 너무 많은 요청을 보내면 odcloud 쪽에서 제한할 수 있어, 정해진 개수만큼만 동시에 처리한다.
async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

exports.syncGov24Subsidies = onRequest({ cors: true, region: "asia-northeast3", timeoutSeconds: 540 }, async (req, res) => {
  if (!SEND_PUSH_SECRET || req.query.secret !== SEND_PUSH_SECRET) {
    res.status(403).json({ error: "권한이 없습니다." });
    return;
  }
  if (!GOV24_API_KEY) {
    res.status(500).json({ error: "GOV24 API 키(EXPO_PUBLIC_GOV24_API_KEY)가 설정되지 않았습니다." });
    return;
  }
  const pagesPerCategory = Number(req.query.pages) || 1; // 카테고리당 최대 페이지 수(1페이지 = 50건)
  try {
    let candidateRows = [];
    for (const category of GOV24_CATEGORIES) {
      for (let page = 1; page <= pagesPerCategory; page++) {
        const json = await gov24Fetch("/serviceList", { "cond[서비스분야::EQ]": category }, page, 50);
        if (!json.data || !json.data.length) break;
        candidateRows = candidateRows.concat(json.data);
        if (json.data.length < 50) break;
      }
    }

    // 기업/시설 전용 서비스는 이 앱(개인 사용자 대상)과 맞지 않으니 제외
    const personalRows = candidateRows.filter(function (row) {
      const userType = row["사용자구분"] || "";
      return userType.indexOf("개인") !== -1 || userType.indexOf("가구") !== -1;
    });

    let savedCount = 0;
    const errors = [];
    await mapWithConcurrency(personalRows, 6, async function (row) {
      const serviceId = row["서비스ID"];
      if (!serviceId) return;

      let detail = {};
      let conditions = {};
      try {
        const detailJson = await gov24Fetch("/serviceDetail", { "cond[서비스ID::EQ]": serviceId }, 1, 1);
        detail = (detailJson.data && detailJson.data[0]) || {};
      } catch (e) { /* 상세조회 실패 시 목록 데이터만으로 진행 */ }
      try {
        const condJson = await gov24Fetch("/supportConditions", { "cond[서비스ID::EQ]": serviceId }, 1, 1);
        conditions = (condJson.data && condJson.data[0]) || {};
      } catch (e) { /* 지원조건 조회 실패 시 무제한 연령으로 취급 */ }

      const ageMin = typeof conditions["JA0110"] === "number" ? conditions["JA0110"] : 0;
      const ageMax = typeof conditions["JA0111"] === "number" ? conditions["JA0111"] : 99;
      const applyUrl = detail["온라인신청사이트URL"] || row["상세조회URL"] || "";
      const checklist = splitGov24Checklist(detail["선정기준"] || row["선정기준"] || row["지원대상"]);
      const deadlineText = row["신청기한"] || "";

      const doc = {
        title: row["서비스명"] || "",
        category: row["서비스분야"] || "기타",
        summary: (row["서비스목적요약"] || row["서비스명"] || "").slice(0, 90),
        targetAge: { min: ageMin, max: ageMax },
        targetRegions: [inferGov24Region(row)],
        targetEmployment: inferGov24Employment(row),
        benefits: (row["지원내용"] || "").slice(0, 400),
        deadlineText: deadlineText,
        endDate: parseGov24Deadline(deadlineText),
        applyUrl: applyUrl,
        checklist: checklist,
        source: "gov24",
        updatedAt: new Date()
      };

      try {
        await db.collection("supportPrograms").doc(serviceId).set(doc, { merge: true });
        savedCount++;
      } catch (error) {
        errors.push(serviceId + ": " + error.message);
      }
    });

    res.status(200).json({
      candidateCount: candidateRows.length,
      personalCount: personalRows.length,
      savedCount: savedCount,
      errorCount: errors.length
    });
  } catch (error) {
    console.error("보조금24 동기화 실패:", error);
    res.status(500).json({ error: "동기화 중 오류가 발생했습니다: " + error.message });
  }
});

// ---------- /api/finance-products (실시간 예/적금 및 대출 추천 리스트) ----------
// 금융감독원 "금융상품 한눈에" Open API(finlife.fss.or.kr)를 대신 호출해주는 프록시.
// 키를 클라이언트(앱/웹)에 절대 내려보내지 않기 위해, 반드시 이 서버를 거쳐서만 조회한다.
const FSS_API_KEY = process.env.FSS_API_KEY || "";
const FSS_BASE_URL = "https://finlife.fss.or.kr/finlifeapi";
const FSS_TOP_FIN_GRP_NO = "020000"; // 은행권(시중은행) — 기존 정적 비교표와 동일한 범위
const FSS_ENDPOINT_BY_TYPE = {
  deposit: "depositProductsSearch",
  savings: "savingProductsSearch",
  mortgage: "mortgageLoanProductsSearch",
  jeonse: "rentHouseLoanProductsSearch",
  credit: "creditLoanProductsSearch"
};
const FSS_LOAN_TYPES = ["mortgage", "jeonse", "credit"];

// 결과가 여러 페이지로 나뉠 수 있어(topFinGrpNo=020000 하나만 조회해도 은행 수가 많음) 전부 모을 때까지 순회한다.
async function fetchFssAllPages(endpoint) {
  let pageNo = 1;
  let baseList = [];
  let optionList = [];
  for (;;) {
    const url = FSS_BASE_URL + "/" + endpoint + ".json" +
      "?auth=" + encodeURIComponent(FSS_API_KEY) +
      "&topFinGrpNo=" + FSS_TOP_FIN_GRP_NO +
      "&pageNo=" + pageNo;
    const r = await fetch(url);
    if (!r.ok) throw new Error("FSS API 응답 오류: " + r.status);
    const data = await r.json();
    const result = data.result;
    if (!result || result.err_cd !== "000") {
      throw new Error("FSS API 오류: " + (result ? result.err_cd + " " + result.err_msg : "응답 없음"));
    }
    baseList = baseList.concat(result.baseList || []);
    optionList = optionList.concat(result.optionList || []);
    if (!result.max_page_no || pageNo >= result.max_page_no) break;
    pageNo++;
  }
  return { baseList: baseList, optionList: optionList };
}

function fssProductKey(item) { return item.fin_co_no + "_" + item.fin_prdt_cd; }

exports.financeProductsLive = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  try {
    const type = String(req.query.type || "");
    const endpoint = FSS_ENDPOINT_BY_TYPE[type];
    if (!endpoint) {
      res.status(400).json({ error: "type은 deposit/savings/mortgage/jeonse/credit 중 하나여야 합니다." });
      return;
    }
    if (!FSS_API_KEY) {
      res.status(500).json({ error: "FSS_API_KEY가 설정되지 않았습니다." });
      return;
    }

    const { baseList, optionList } = await fetchFssAllPages(endpoint);
    const isLoan = FSS_LOAN_TYPES.indexOf(type) !== -1;

    const optionsByKey = {};
    optionList.forEach((opt) => {
      const key = fssProductKey(opt);
      if (!optionsByKey[key]) optionsByKey[key] = [];
      optionsByKey[key].push(opt);
    });

    const products = baseList.map((base) => {
      const options = optionsByKey[fssProductKey(base)] || [];
      let baseRate = null;
      let maxRate = null;
      let term = "";

      if (type === "credit") {
        // 신용대출은 lend_rate_min/max가 아니라 신용등급별 금리(crdt_grad_1~13, crdt_grad_avg)로
        // 내려온다 — 등급별 최저~최고 금리를 그대로 대표 구간으로 쓴다.
        options.forEach((o) => {
          Object.keys(o).forEach((key) => {
            if (key.indexOf("crdt_grad_") !== 0) return;
            const rate = parseFloat(o[key]);
            if (isNaN(rate)) return;
            if (baseRate === null || rate < baseRate) baseRate = rate;
            if (maxRate === null || rate > maxRate) maxRate = rate;
          });
        });
      } else if (isLoan) {
        // 주담대/전세자금대출은 옵션마다 상환방식/금리유형이 달라 그 중 최저~최고 구간을 대표값으로 묶는다.
        options.forEach((o) => {
          const min = parseFloat(o.lend_rate_min);
          const max = parseFloat(o.lend_rate_max);
          const avg = parseFloat(o.lend_rate_avg);
          const rep = !isNaN(min) ? min : avg;
          if (!isNaN(rep) && (baseRate === null || rep < baseRate)) baseRate = rep;
          if (!isNaN(max) && (maxRate === null || max > maxRate)) maxRate = max;
        });
        if (maxRate === null) maxRate = baseRate;
      } else {
        // 예적금은 만기 12개월 옵션을 대표값으로 쓰고, 없으면 첫 옵션을 쓴다.
        const twelveMonth = options.filter((o) => String(o.save_trm) === "12")[0] || options[0];
        if (twelveMonth) {
          baseRate = parseFloat(twelveMonth.intr_rate);
          maxRate = parseFloat(twelveMonth.intr_rate2);
          if (isNaN(baseRate)) baseRate = null;
          if (isNaN(maxRate)) maxRate = baseRate;
          term = "12개월 기준";
        }
      }

      return {
        bank: base.kor_co_nm || "",
        name: base.fin_prdt_nm || "",
        joinWay: base.join_way || "",
        maturityInterest: base.mtrt_int || "",
        specialCondition: base.spcl_cnd || "",
        joinDeny: base.join_deny || "",
        joinMember: base.join_member || "",
        etcNote: base.etc_note || "",
        maxLimit: base.max_limit || "",
        baseRate: baseRate,
        maxRate: maxRate,
        term: term,
        disclosedMonth: base.dcls_month || ""
      };
    }).filter((p) => p.baseRate !== null || p.maxRate !== null);

    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200");
    res.status(200).json({ products: products, asOf: baseList[0] ? baseList[0].dcls_month : "" });
  } catch (error) {
    console.error("financeProductsLive 실패:", error);
    res.status(502).json({ error: "실시간 금융상품 정보를 불러오지 못했습니다." });
  }
});

// index.html은 이제 Firestore 캐시(ipoScheduleCache/latest)를 우선 읽고, 캐시가 비어있을 때만
// 이 엔드포인트로 폴백한다 — 그래서 이 핸들러도 결과를 그냥 반환만 하지 않고 refreshIpoScheduleCache()로
// 캐시를 함께 갱신해서, 폴백이 일어난 그 요청이 다음번 캐시 읽기를 즉시 성공시키게 해준다.
exports.ipoSchedulesLive = onRequest({ cors: true, region: "asia-northeast3", timeoutSeconds: 120 }, async (req, res) => {
  try {
    if (!DART_API_KEY) {
      res.status(500).json({ error: "DART_API_KEY가 설정되지 않았습니다." });
      return;
    }
    const schedules = await refreshIpoScheduleCache();
    res.set("Cache-Control", "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({ schedules: schedules });
  } catch (error) {
    console.error("ipoSchedulesLive 실패:", error);
    res.status(502).json({ error: "실시간 공모주 일정을 불러오지 못했습니다." });
  }
});

// 20분마다 자동으로 청약·공모주 캐시를 미리 갱신 — 실사용자가 캐시 미스로 DART 상세 조회(병렬 수십 건)를
// 직접 기다리는 일이 거의 없게 한다. DART_API_KEY가 없으면(로컬/미설정 환경) 조용히 건너뛴다.
exports.syncIpoScheduleCache = onSchedule(
  { schedule: "*/20 * * * *", timeZone: "Asia/Seoul", region: "asia-northeast3", timeoutSeconds: 120 },
  async () => {
    if (!DART_API_KEY) return;
    try {
      await refreshIpoScheduleCache();
    } catch (error) {
      console.error("청약·공모주 캐시 자동 갱신 실패:", error);
    }
  }
);

// ---------- 아파트 청약 일정 (청약·공모주 페이지 "아파트 청약" 탭, /api/apartment-subscriptions) ----------
// 한국부동산원_청약홈 분양정보 조회 서비스(data.go.kr 데이터ID 15098547) — CHEONGYAKHOME_API_URL과
// 동일한 API를 쓰지만, 이쪽은 이 탭 전용으로 필드를 훨씬 풍부하게(특별공급/1·2순위 접수일,
// 당첨자발표일, 시공사/시행사, 규제지역 여부 등) 그대로 내려준다. Swagger 문서로 실제 필드명을
// 전부 확인하고 실 키로 라이브 테스트까지 마쳤다(대구 "달서자이 제니크" 등 실제 매물 확인).
async function fetchApartmentSubscriptions() {
  if (!DATA_GO_KR_API_KEY) return [];

  const bgnDe = dartDateCompact(-45).replace(
    /(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"
  );
  const pageSize = 200;
  let page = 1;
  const rows = [];

  for (;;) {
    const url = CHEONGYAKHOME_API_URL +
      "?page=" + page +
      "&perPage=" + pageSize +
      "&cond[RCRIT_PBLANC_DE::GTE]=" + bgnDe;
    const res = await fetch(url, { headers: { Authorization: "Infuser " + DATA_GO_KR_API_KEY } });
    if (!res.ok) {
      console.error("청약홈 분양정보 API 오류:", res.status);
      break;
    }
    const data = await res.json();
    const items = data.data || [];
    rows.push.apply(rows, items);
    if (items.length < pageSize) break;
    page += 1;
    if (page > 10) break;
  }

  return rows.map(function (item) {
    return {
      id: item.HOUSE_MANAGE_NO || item.PBLANC_NO,
      name: item.HOUSE_NM || "",
      houseType: item.HOUSE_SECD_NM || "",
      supplyType: item.HOUSE_DTL_SECD_NM || "",
      region: item.SUBSCRPT_AREA_CODE_NM || "",
      address: item.HSSPLY_ADRES || "",
      totalUnits: item.TOT_SUPLY_HSHLDCO ? parseInt(item.TOT_SUPLY_HSHLDCO, 10) : null,
      constructor: item.CNSTRCT_ENTRPS_NM || "",
      developer: item.BSNS_MBY_NM || "",
      specialSupplyStart: item.SPSPLY_RCEPT_BGNDE || null,
      specialSupplyEnd: item.SPSPLY_RCEPT_ENDDE || null,
      subStart: item.RCEPT_BGNDE || null,
      subEnd: item.RCEPT_ENDDE || null,
      winnerDate: item.PRZWNER_PRESNATN_DE || null,
      contractStart: item.CNTRCT_CNCLS_BGNDE || null,
      contractEnd: item.CNTRCT_CNCLS_ENDDE || null,
      moveInMonth: item.MVN_PREARNGE_YM || null,
      speculativeZone: item.SPECLT_RDN_EARTH_AT === "Y",
      adjustmentZone: item.MDAT_TRGET_AREA_SECD === "Y",
      priceCapZone: item.PARCPRC_ULS_AT === "Y",
      sourceUrl: item.PBLANC_URL || "https://www.applyhome.co.kr"
    };
  }).filter(function (x) { return x.id && x.name && x.subStart && x.subEnd; });
}

exports.apartmentSubscriptionsLive = onRequest({ cors: true, region: "asia-northeast3", timeoutSeconds: 120 }, async (req, res) => {
  try {
    if (!DATA_GO_KR_API_KEY) {
      res.status(500).json({ error: "DATA_GO_KR_API_KEY가 설정되지 않았습니다." });
      return;
    }
    const listings = await fetchApartmentSubscriptions();
    res.set("Cache-Control", "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600");
    res.status(200).json({ listings: listings });
  } catch (error) {
    console.error("apartmentSubscriptionsLive 실패:", error);
    res.status(502).json({ error: "실시간 아파트 청약 일정을 불러오지 못했습니다." });
  }
});
