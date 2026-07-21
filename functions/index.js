const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ---------- /api/news ----------
// 구글 뉴스 "경제(Business)" 카테고리 RSS — topic ID는 opaque 값이라 임의로 만들 수 없으므로
// 실제 요청이 200/XML로 응답하는 것을 확인한 ID만 사용한다.
const GOOGLE_NEWS_RSS_URL =
  "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko";

// 홈 화면(index.html)이 /api/news로 호출하면 Firebase Hosting rewrite를 통해 이 함수로 들어온다.
// 서버 대 서버로 구글 뉴스를 대신 가져오기 때문에 브라우저 쪽 CORS 문제가 발생하지 않는다.
exports.newsProxy = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  try {
    const upstream = await fetch(GOOGLE_NEWS_RSS_URL, {
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
  "이모티콘 없이도 정돈되고 가독성 높은 전문적인 답변을 만드세요.";

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
const CHEONGYAKHOME_API_URL =
  process.env.CHEONGYAKHOME_API_URL ||
  "https://apis.data.go.kr/1613000/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail";

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

// 청약홈(한국부동산원) APT 분양정보 — data.go.kr 표준 응답 포맷(response.body.items)을 기본으로 하되,
// 서비스별로 조금씩 다른 실제 필드명 후보들도 함께 대비해둔다. 활용신청 승인 후 실제 응답을 보고
// 아래 필드 매핑(houseNm/pblancNo/rceptBgnde 등)을 문서와 대조해 필요시 조정할 것.
async function fetchCheongyakhomeSubscriptions() {
  if (!DATA_GO_KR_API_KEY) {
    console.warn("DATA_GO_KR_API_KEY가 설정되지 않아 청약홈 청약 일정 수집을 건너뜁니다.");
    return [];
  }

  const url = CHEONGYAKHOME_API_URL +
    "?serviceKey=" + DATA_GO_KR_API_KEY +
    "&page=1&perPage=100&type=json";

  const res = await fetch(url);
  if (!res.ok) {
    console.error("청약홈 API 응답 오류:", res.status);
    return [];
  }
  const data = await res.json();
  const items = (data.response && data.response.body && data.response.body.items) ||
    data.data || data.items || [];

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
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
