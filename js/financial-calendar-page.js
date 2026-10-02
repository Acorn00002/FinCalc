// /financial-calendar/ 전용 독립 스크립트 — index.html의 "핵심 캘린더" 코드(그리드·필터·타임라인·
// 이번 주/월간 모드·일정 상세 모달)를 그대로 옮겼다. 포인트/미션/출석체크/리워드샵/개인 일정 추가·
// "내 일정" 모드는 로그인 기반 개인화 기능이라 이 페이지에는 포함하지 않는다(범위는 사용자 승인).
// 데이터 소스(MANUAL_CALENDAR_EVENTS 수동 목록 + Firestore calendarEvents 자동수집)는 index.html과
// 100% 동일 — 손대지 않았다. runCalendarAction만 activateView() 대신 실제 링크로 이동하도록 바꿨다
// (다른 화면 전환이 없는 독립 페이지라 activateView가 존재하지 않기 때문).
(function () {
  "use strict";

  var firebaseConfig = {
    apiKey: "AIzaSyCiADiWiH434SNRR85_VDNf9NnZM0Ozxww",
    authDomain: "asset-filot.firebaseapp.com",
    projectId: "asset-filot",
    storageBucket: "asset-filot.firebasestorage.app",
    messagingSenderId: "862512786797",
    appId: "1:862512786797:web:7ee42935258c645a2fbe64",
    measurementId: "G-HWY33CNTB1"
  };
  firebase.initializeApp(firebaseConfig);
  var firebaseAuth = firebase.auth();
  var db = firebase.firestore();

  function escapeMyPageHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function pad2(n) { return n < 10 ? "0" + n : String(n); }
  function formatDateYMD(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }

  var toast = document.getElementById("toast");
  var toastText = document.getElementById("toastText");
  var toastTimer = null;
  function showToast(text, icon) {
    if (!toast || !toastText) return;
    toastText.textContent = text;
    toast.querySelector("i").className = "ph-duotone " + (icon || "ph-rocket-launch");
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("show"); }, 2200);
  }


  var MANUAL_CALENDAR_EVENTS = [
    { date: "2026-07-20", category: "stock", type: "배당", title: "오리온 배당락일", meta: "코스피 · 271560", status: null, flag: "kr", company: "오리온" },
    { date: "2026-07-20", category: "stock", type: "배당", title: "맥코믹 앤 컴퍼니 무의결권주 배당지급일", meta: "미국 MKC · 13:00", status: null, flag: "us", company: "맥코믹", logo: null },
    { date: "2026-07-20", category: "realestate", type: "청약", title: "강원 춘천 리버뷰 아이파크 청약", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-07-20", category: "realestate", type: "청약", title: "경기 고양창릉 S-4블록 공공분양주택 본청약", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-07-21", category: "stock", type: "배당", title: "마이크론 테크놀로지 배당지급일", meta: "미국 MU · 13:00", status: null, flag: "us", company: "마이크론", logo: null },
    { date: "2026-07-22", category: "stock", type: "실적", title: "SK하이닉스 2026년 2분기 실적발표", meta: "코스피 000660", status: "예정", flag: "kr", company: "SK하이닉스", logo: null },
    { date: "2026-07-23", category: "economy", type: "경제지표", title: "미국 지난주 신규 실업수당청구건수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-07-23", category: "stock", type: "실적", title: "미국 알파벳 A 2026년 2분기 실적발표", meta: "GOOGL · 05:00", status: "예정", flag: "us", company: "알파벳", logo: null },
    { date: "2026-07-23", category: "stock", type: "실적", title: "미국 테슬라 2026년 2분기 실적발표", meta: "TSLA · 05:00", status: "예정", flag: "us", company: "테슬라", logo: null },
    { date: "2026-07-23", category: "stock", type: "실적", title: "현대차 2026년 2분기 실적발표", meta: "코스피 005380 · 16:00", status: "예정", flag: "kr", company: "현대차", logo: null },
    { date: "2026-07-23", category: "stock", type: "배당", title: "KCC글라스 배당락일", meta: "344820", status: null, flag: "kr", company: "KCC글라스" },
    { date: "2026-07-23", category: "stock", type: "배당", title: "동남합성 배당락일", meta: "023450", status: null, flag: "kr", company: "동남합성" },
    { date: "2026-07-27", category: "tax", type: "세무", title: "2026년 1기 부가가치세 확정신고 납부 마감일", meta: "", status: null, flag: "kr" },
    { date: "2026-07-30", category: "economy", type: "경제지표", title: "미국 금리 결정", meta: "FOMC · 03:00", status: "예정", flag: "us" },
    { date: "2026-07-30", category: "stock", type: "실적", title: "삼성전자 2026년 2분기 실적발표", meta: "코스피 005930", status: "예정", flag: "kr", company: "삼성전자", logo: null },
    { date: "2026-07-30", category: "stock", type: "실적", title: "미국 마이크로소프트 2026년 2분기 실적발표", meta: "MSFT · 05:00", status: "예정", flag: "us", company: "마이크로소프트", logo: null },
    { date: "2026-07-30", category: "stock", type: "실적", title: "미국 메타 2026년 2분기 실적발표", meta: "META · 05:00", status: "예정", flag: "us", company: "메타", logo: null },
    { date: "2026-07-30", category: "stock", type: "배당", title: "E1 배당락일", meta: "017940", status: null, flag: "kr", company: "E1" },

    // ---- 2026년 8월 ----
    { date: "2026-08-01", category: "tax", type: "세무", title: "주민세 사업소분 신고 시작일", meta: "", status: null, flag: "kr" },

    { date: "2026-08-03", category: "economy", type: "경제지표", title: "미국 7월 ISM 제조업 구매관리자지수(PMI)", meta: "23:00", status: "예정", flag: "us" },
    { date: "2026-08-03", category: "stock", type: "배당", title: "배너 배당락일", meta: "BANR · 13:00", status: null, flag: "us", company: "배너", logo: null },
    { date: "2026-08-03", category: "stock", type: "배당", title: "오스타운 파이낸셜 서비시스 배당락일", meta: "ORRF · 13:00", status: null, flag: "us", company: "오스타운 파이낸셜", logo: null },
    { date: "2026-08-03", category: "stock", type: "배당", title: "인디펜던트 뱅코프 미시건 배당락일", meta: "IBCP · 13:00", status: null, flag: "us", company: "인디펜던트 뱅코프", logo: null },
    { date: "2026-08-03", category: "realestate", type: "청약", title: "강원 리쉐스302 청약", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-08-03", category: "realestate", type: "청약", title: "경기 수원당수지구 A5블록 신혼희망타운(공공분양) 추가 입주자모집", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-08-03", category: "realestate", type: "청약", title: "경남 센트레빌 아스테리움 거제 청약", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-08-03", category: "realestate", type: "청약", title: "부산 더샵 트리센트 청약", meta: "09:00", status: null, flag: "kr" },

    { date: "2026-08-04", category: "stock", type: "실적", title: "미국 팔란티어 2026년 2분기 실적 발표", meta: "PLTR · 05:00", status: "예정", flag: "us", company: "팔란티어", logo: null },
    { date: "2026-08-04", category: "stock", type: "배당", title: "전진건설로봇 배당락일", meta: "코스피", status: null, flag: "kr", company: "전진건설로봇" },

    { date: "2026-08-05", category: "economy", type: "경제지표", title: "미국 7월 ISM 비제조업 구매관리자지수(PMI)", meta: "23:00", status: "예정", flag: "us" },
    { date: "2026-08-05", category: "stock", type: "실적", title: "미국 AMD 2026년 2분기 실적 발표", meta: "AMD · 05:00", status: "예정", flag: "us", company: "AMD", logo: null },
    { date: "2026-08-05", category: "stock", type: "배당", title: "웨스트 파마슈티컬 서비시즈 배당지급일", meta: "WST · 13:00", status: null, flag: "us", company: "웨스트 파마슈티컬", logo: null },
    { date: "2026-08-05", category: "stock", type: "배당", title: "레이크랜드 파이낸셜 배당지급일", meta: "LKFN · 13:00", status: null, flag: "us", company: "레이크랜드 파이낸셜", logo: null },

    { date: "2026-08-06", category: "stock", type: "배당", title: "JB금융지주 배당락일", meta: "코스피", status: null, flag: "kr", company: "JB금융지주", logo: null },
    { date: "2026-08-06", category: "stock", type: "배당", title: "KB금융 배당락일", meta: "코스피", status: null, flag: "kr", company: "KB금융", logo: null },
    { date: "2026-08-06", category: "stock", type: "배당", title: "두산밥캣 배당락일", meta: "코스피", status: null, flag: "kr", company: "두산밥캣", logo: null },
    { date: "2026-08-06", category: "stock", type: "배당", title: "오리온 배당지급일", meta: "코스피 · 271560", status: null, flag: "kr", company: "오리온" },

    { date: "2026-08-07", category: "stock", type: "배당", title: "우리금융지주 배당락일", meta: "코스피", status: null, flag: "kr", company: "우리금융지주", logo: null },
    { date: "2026-08-07", category: "stock", type: "배당", title: "하나금융지주 배당락일", meta: "코스피", status: null, flag: "kr", company: "하나금융지주", logo: null },
    { date: "2026-08-07", category: "stock", type: "배당", title: "현대모비스 배당락일", meta: "코스피", status: null, flag: "kr", company: "현대모비스", logo: null },
    { date: "2026-08-07", category: "stock", type: "배당", title: "IBM 배당락일", meta: "IBM · 13:00", status: null, flag: "us", company: "IBM", logo: null },
    { date: "2026-08-07", category: "stock", type: "배당", title: "PPG 인더스트리스 배당락일", meta: "PPG · 13:00", status: null, flag: "us", company: "PPG", logo: null },
    { date: "2026-08-07", category: "stock", type: "배당", title: "한화리츠 배당지급일", meta: "코스피", status: null, flag: "kr", company: "한화리츠" },

    { date: "2026-08-11", category: "stock", type: "배당", title: "텍사스 인스트루먼트 배당지급일", meta: "TXN · 13:00", status: null, flag: "us", company: "텍사스 인스트루먼트", logo: null },
    { date: "2026-08-11", category: "stock", type: "배당", title: "오스타운 파이낸셜 서비시스 배당지급일", meta: "ORRF · 13:00", status: null, flag: "us", company: "오스타운 파이낸셜", logo: null },

    { date: "2026-08-13", category: "stock", type: "배당", title: "스머커 배당락일", meta: "SJM · 13:00", status: null, flag: "us", company: "스머커", logo: null },

    { date: "2026-08-14", category: "stock", type: "배당", title: "E1 배당지급일", meta: "017940", status: null, flag: "kr", company: "E1" },
    { date: "2026-08-14", category: "stock", type: "배당", title: "SK가스 배당지급일", meta: "코스피", status: null, flag: "kr", company: "SK가스" },
    { date: "2026-08-14", category: "stock", type: "배당", title: "동남합성 배당지급일", meta: "023450", status: null, flag: "kr", company: "동남합성" },
    { date: "2026-08-14", category: "stock", type: "배당", title: "리얼티 인컴 배당지급일", meta: "O · 13:00", status: null, flag: "us", company: "리얼티 인컴", logo: null },
    { date: "2026-08-14", category: "stock", type: "배당", title: "원오크 배당지급일", meta: "OKE · 13:00", status: null, flag: "us", company: "원오크", logo: null },
    { date: "2026-08-14", category: "stock", type: "배당", title: "배너 배당지급일", meta: "BANR · 13:00", status: null, flag: "us", company: "배너", logo: null },
    { date: "2026-08-14", category: "stock", type: "배당", title: "노스웨스트 내추럴 홀딩 배당지급일", meta: "NWN · 13:00", status: null, flag: "us", company: "노스웨스트 내추럴", logo: null },
    { date: "2026-08-14", category: "stock", type: "배당", title: "버투스 인베스트먼트 파트너스 배당지급일", meta: "VRTS · 13:00", status: null, flag: "us", company: "버투스", logo: null },
    { date: "2026-08-14", category: "stock", type: "배당", title: "인디펜던트 뱅코프 미시건 배당지급일", meta: "IBCP · 13:00", status: null, flag: "us", company: "인디펜던트 뱅코프", logo: null },

    { date: "2026-08-16", category: "tax", type: "세무", title: "주민세 개인분 정기분 납부 시작일", meta: "", status: null, flag: "kr" },

    { date: "2026-08-17", category: "stock", type: "배당", title: "P&G(프록터 & 갬블) 배당지급일", meta: "PG · 13:00", status: null, flag: "us", company: "P&G", logo: null },
    { date: "2026-08-17", category: "stock", type: "배당", title: "이스트 웨스트 뱅코프 배당지급일", meta: "EWBC · 13:00", status: null, flag: "us", company: "이스트 웨스트 뱅코프", logo: null },
    { date: "2026-08-17", category: "stock", type: "배당", title: "A O 스미스 배당지급일", meta: "AOS · 13:00", status: null, flag: "us", company: "A O 스미스", logo: null },

    { date: "2026-08-18", category: "stock", type: "배당", title: "콘솔리데이티드 에디슨 배당락일", meta: "ED · 13:00", status: null, flag: "us", company: "콘솔리데이티드 에디슨", logo: null },

    { date: "2026-08-21", category: "stock", type: "배당", title: "전진건설로봇 배당지급일", meta: "코스피", status: null, flag: "kr", company: "전진건설로봇" },
    { date: "2026-08-21", category: "stock", type: "배당", title: "하나금융지주 배당지급일", meta: "코스피", status: null, flag: "kr", company: "하나금융지주", logo: null },
    { date: "2026-08-21", category: "stock", type: "배당", title: "APA 배당지급일", meta: "APA · 13:00", status: null, flag: "us", company: "APA", logo: null },

    { date: "2026-08-24", category: "stock", type: "배당", title: "존슨앤드존슨 배당락일", meta: "JNJ · 13:00", status: null, flag: "us", company: "존슨앤드존슨", logo: null },
    { date: "2026-08-24", category: "stock", type: "배당", title: "두산밥캣 배당지급일", meta: "코스피", status: null, flag: "kr", company: "두산밥캣", logo: null },

    { date: "2026-08-25", category: "stock", type: "배당", title: "패스널 배당지급일", meta: "FAST · 13:00", status: null, flag: "us", company: "패스널", logo: null },

    { date: "2026-08-27", category: "economy", type: "경제지표", title: "한국 7월 금리 결정", meta: "10:00", status: "예정", flag: "kr" },
    { date: "2026-08-27", category: "stock", type: "실적", title: "미국 엔비디아 2026년 3분기 실적 발표", meta: "NVDA · 05:00", status: "예정", flag: "us", company: "엔비디아", logo: null },
    { date: "2026-08-27", category: "stock", type: "배당", title: "JB금융지주 배당지급일", meta: "코스피", status: null, flag: "kr", company: "JB금융지주", logo: null },

    { date: "2026-08-28", category: "stock", type: "실적", title: "미국 알리바바 2026년 2분기 실적 발표", meta: "BABA · 21:00", status: "예정", flag: "us", company: "알리바바", logo: null },
    { date: "2026-08-28", category: "stock", type: "배당", title: "SK텔레콤 배당락일", meta: "코스피", status: null, flag: "kr", company: "SK텔레콤", logo: null },
    { date: "2026-08-28", category: "stock", type: "배당", title: "동서 배당락일", meta: "코스피", status: null, flag: "kr", company: "동서" },
    { date: "2026-08-28", category: "stock", type: "배당", title: "현대차 배당락일", meta: "코스피 005380", status: null, flag: "kr", company: "현대차", logo: null },
    { date: "2026-08-28", category: "stock", type: "배당", title: "신한지주 배당지급일", meta: "코스피", status: null, flag: "kr", company: "신한지주", logo: null },
    { date: "2026-08-28", category: "stock", type: "배당", title: "코람코더원리츠 배당지급일", meta: "코스피", status: null, flag: "kr", company: "코람코더원리츠" },
    { date: "2026-08-28", category: "stock", type: "배당", title: "페이첵스 배당지급일", meta: "PAYX · 13:00", status: null, flag: "us", company: "페이첵스", logo: null },

    { date: "2026-08-31", category: "stock", type: "배당", title: "록히드 마틴 배당락일", meta: "LMT · 13:00", status: null, flag: "us", company: "록히드 마틴", logo: null },
    { date: "2026-08-31", category: "stock", type: "배당", title: "리전스 파이낸셜 배당락일", meta: "RF · 13:00", status: null, flag: "us", company: "리전스 파이낸셜", logo: null },
    { date: "2026-08-31", category: "stock", type: "배당", title: "NH프라임리츠 배당지급일", meta: "코스피", status: null, flag: "kr", company: "NH프라임리츠" },
    { date: "2026-08-31", category: "stock", type: "배당", title: "에이피알 배당지급일", meta: "코스피", status: null, flag: "kr", company: "에이피알" },
    { date: "2026-08-31", category: "stock", type: "배당", title: "우리금융지주 배당지급일", meta: "코스피", status: null, flag: "kr", company: "우리금융지주", logo: null },
    { date: "2026-08-31", category: "stock", type: "배당", title: "코람코라이프인프라리츠 배당지급일", meta: "코스피", status: null, flag: "kr", company: "코람코라이프인프라리츠" },
    { date: "2026-08-31", category: "stock", type: "배당", title: "현대모비스 배당지급일", meta: "코스피", status: null, flag: "kr", company: "현대모비스", logo: null },

    // ---- 2026년 9월 ----
    { date: "2026-09-01", category: "economy", type: "경제지표", title: "2026년 8월 수출입 동향", meta: "11:00", status: null, flag: "kr" },
    { date: "2026-09-01", category: "stock", type: "공시", title: "LG생활건강 [기재정정]유상증자결정(종속회사의주요경영사항)", meta: "051900", status: null, flag: "kr", company: "LG생활건강" },
    { date: "2026-09-01", category: "stock", type: "공시", title: "기아 영업(잠정)실적(공정공시)", meta: "000270", status: null, flag: "kr", company: "기아", logo: null },
    { date: "2026-09-01", category: "stock", type: "공시", title: "두산에너빌리티 [기재정정]단일판매ㆍ공급계약체결", meta: "034020", status: null, flag: "kr", company: "두산에너빌리티" },
    { date: "2026-09-01", category: "stock", type: "공시", title: "현대자동차 영업(잠정)실적(공정공시)", meta: "005380", status: null, flag: "kr", company: "현대자동차", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "슐럼버거 배당락일", meta: "SLB · 13:00", status: null, flag: "us", company: "슐럼버거", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "인스페리티 배당락일", meta: "NSP · 13:00", status: null, flag: "us", company: "인스페리티", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "HD한국조선해양 배당지급일", meta: "009540", status: null, flag: "kr", company: "HD한국조선해양" },
    { date: "2026-09-01", category: "stock", type: "배당", title: "비자 배당지급일", meta: "V · 13:00", status: null, flag: "us", company: "비자", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "코노코필립스 배당지급일", meta: "COP · 13:00", status: null, flag: "us", company: "코노코필립스", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "WW 그레인저 배당지급일", meta: "GWW · 13:00", status: null, flag: "us", company: "WW 그레인저", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "포드 모터 배당지급일", meta: "F · 13:00", status: null, flag: "us", company: "포드 모터", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "애플랙 배당지급일", meta: "AFL · 13:00", status: null, flag: "us", company: "애플랙", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "처치 앤드 드와이트 배당지급일", meta: "CHD · 13:00", status: null, flag: "us", company: "처치 앤드 드와이트", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "스머커 배당지급일", meta: "SJM · 13:00", status: null, flag: "us", company: "스머커", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "펜스케 오토모티브 그룹 배당지급일", meta: "PAG · 13:00", status: null, flag: "us", company: "펜스케 오토모티브", logo: null },
    { date: "2026-09-01", category: "stock", type: "배당", title: "머피 오일 배당지급일", meta: "MUR · 13:00", status: null, flag: "us", company: "머피 오일", logo: null },
    { date: "2026-09-01", category: "tax", type: "세무", title: "주민세 개인분 정기분 납부 마감일", meta: "", status: null, flag: "kr" },
    { date: "2026-09-01", category: "tax", type: "세무", title: "주민세 사업소분 신고 마감일", meta: "", status: null, flag: "kr" },

    { date: "2026-09-02", category: "stock", type: "실적", title: "델 테크놀로지스 2026년 9월 실적발표", meta: "DELL · 05:00", status: "예정", flag: "us", company: "델 테크놀로지스", logo: null },
    { date: "2026-09-02", category: "stock", type: "공시", title: "SNT홀딩스 주식소각결정(자회사의 주요경영사항)", meta: "036530", status: null, flag: "kr", company: "SNT홀딩스" },
    { date: "2026-09-02", category: "stock", type: "공시", title: "카프로 기타시장안내 (상장폐지결정 효력정지 가처분 신청 기각결정에 따른 정리매매절차 재개)", meta: "006380", status: null, flag: "kr", company: "카프로" },
    { date: "2026-09-02", category: "stock", type: "공시", title: "파라다이스 연결재무제표기준영업(잠정)실적(공정공시)", meta: "034230", status: null, flag: "kr", company: "파라다이스" },
    { date: "2026-09-02", category: "stock", type: "공시", title: "한화 [기재정정]중대재해발생", meta: "000880", status: null, flag: "kr", company: "한화" },
    { date: "2026-09-02", category: "stock", type: "공시", title: "현대자동차 생산재개(자율공시)", meta: "005380", status: null, flag: "kr", company: "현대자동차", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "홈디포 배당락일", meta: "HD · 13:00", status: null, flag: "us", company: "홈디포", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "린드 배당락일", meta: "LIN · 13:00", status: null, flag: "us", company: "린드", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "퀄컴 배당락일", meta: "QCOM · 13:00", status: null, flag: "us", company: "퀄컴", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "프린서플 파이낸셜 그룹 배당락일", meta: "PFG · 13:00", status: null, flag: "us", company: "프린서플 파이낸셜", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "브로드리지 파이낸셜 솔루션 배당락일", meta: "BR · 13:00", status: null, flag: "us", company: "브로드리지", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "이선 알렌 인테리어스 배당락일", meta: "ETD · 13:00", status: null, flag: "us", company: "이선 알렌", logo: null },
    { date: "2026-09-02", category: "stock", type: "배당", title: "HF 싱클레어 배당지급일", meta: "DINO · 13:00", status: null, flag: "us", company: "HF 싱클레어", logo: null },

    { date: "2026-09-03", category: "stock", type: "실적", title: "브로드컴 2026년 9월 실적발표...매출 $296억 서프라이즈", meta: "AVGO · 05:00", status: "예정", flag: "us", company: "브로드컴", logo: null },
    { date: "2026-09-03", category: "stock", type: "공시", title: "BNK금융지주 기업가치제고계획(자율공시)", meta: "138930", status: null, flag: "kr", company: "BNK금융지주" },
    { date: "2026-09-03", category: "stock", type: "공시", title: "덴티움 소송등의제기ㆍ신청(경영권분쟁소송)", meta: "145720", status: null, flag: "kr", company: "덴티움" },
    { date: "2026-09-03", category: "stock", type: "공시", title: "에넥스 [기재정정]주요사항보고서(유상증자결정)", meta: "011090", status: null, flag: "kr", company: "에넥스" },
    { date: "2026-09-03", category: "stock", type: "공시", title: "토니모리 최대주주변경", meta: "214420", status: null, flag: "kr", company: "토니모리" },
    { date: "2026-09-03", category: "stock", type: "공시", title: "한화오션 단일판매ㆍ공급계약체결", meta: "042660", status: null, flag: "kr", company: "한화오션" },
    { date: "2026-09-03", category: "stock", type: "배당", title: "펩시코 배당락일", meta: "PEP · 13:00", status: null, flag: "us", company: "펩시코", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "킴벌리클라크 배당락일", meta: "KMB · 13:00", status: null, flag: "us", company: "킴벌리클라크", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "CH 로빈슨 월드와이드 배당락일", meta: "CHRW · 13:00", status: null, flag: "us", company: "CH 로빈슨", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "앰코 배당락일", meta: "AMCR · 13:00", status: null, flag: "us", company: "앰코", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "제뉴인 파츠 배당락일", meta: "GPC · 13:00", status: null, flag: "us", company: "제뉴인 파츠", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "올드 리퍼블릭 인터내셔널 배당락일", meta: "ORI · 13:00", status: null, flag: "us", company: "올드 리퍼블릭", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "포스코인터내셔널 배당지급일", meta: "047050", status: null, flag: "kr", company: "포스코인터내셔널" },
    { date: "2026-09-03", category: "stock", type: "배당", title: "UPS 배당지급일", meta: "UPS · 13:00", status: null, flag: "us", company: "UPS", logo: null },
    { date: "2026-09-03", category: "stock", type: "배당", title: "CNA 파이낸셜 배당지급일", meta: "CNA · 13:00", status: null, flag: "us", company: "CNA 파이낸셜", logo: null },

    { date: "2026-09-04", category: "ipo", type: "신규상장", title: "스카이랩스 코스닥 상장...시초가 수익률 -15%, 아쉬운 시초가", meta: "09:00", status: null, flag: "kr", company: "스카이랩스" },
    { date: "2026-09-04", category: "stock", type: "실적", title: "룰루레몬 애슬레티카 2026년 9월 실적발표", meta: "LULU · 05:00", status: "예정", flag: "us", company: "룰루레몬", logo: null },
    { date: "2026-09-04", category: "stock", type: "공시", title: "SKC 타법인주식및출자증권취득결정", meta: "011790", status: null, flag: "kr", company: "SKC" },
    { date: "2026-09-04", category: "stock", type: "공시", title: "SK하이닉스 풍문또는보도에대한해명(미확정)", meta: "000660", status: null, flag: "kr", company: "SK하이닉스", logo: null },
    { date: "2026-09-04", category: "stock", type: "공시", title: "고려아연 [기재정정]소송등의제기ㆍ신청(경영권분쟁소송)", meta: "010130", status: null, flag: "kr", company: "고려아연" },
    { date: "2026-09-04", category: "stock", type: "공시", title: "에넥스 [기재정정]주요사항보고서(유상증자결정)", meta: "011090", status: null, flag: "kr", company: "에넥스" },
    { date: "2026-09-04", category: "stock", type: "공시", title: "윌비스 주요사항보고서(회생절차개시신청)", meta: "008600", status: null, flag: "kr", company: "윌비스" },
    { date: "2026-09-04", category: "stock", type: "공시", title: "진원생명과학 불성실공시법인지정", meta: "011000", status: null, flag: "kr", company: "진원생명과학" },
    { date: "2026-09-04", category: "stock", type: "공시", title: "현대건설 중대재해발생", meta: "000720", status: null, flag: "kr", company: "현대건설" },
    { date: "2026-09-04", category: "stock", type: "배당", title: "알파벳 A 배당락일", meta: "GOOGL · 13:00", status: null, flag: "us", company: "알파벳", logo: null },
    { date: "2026-09-04", category: "stock", type: "배당", title: "알파벳 C 배당락일", meta: "GOOG · 13:00", status: null, flag: "us", company: "알파벳", logo: null },
    { date: "2026-09-04", category: "stock", type: "배당", title: "스탠리 블랙 앤 데커 배당락일", meta: "SWK · 13:00", status: null, flag: "us", company: "스탠리 블랙 앤 데커", logo: null },
    { date: "2026-09-04", category: "stock", type: "배당", title: "마제티 배당락일", meta: "MZTI · 13:00", status: null, flag: "us", company: "마제티" },
    { date: "2026-09-04", category: "stock", type: "배당", title: "HD현대 배당지급일", meta: "267250", status: null, flag: "kr", company: "HD현대" },

    { date: "2026-09-07", category: "stock", type: "배당", title: "미래에셋맵스리츠 배당지급일", meta: "357250", status: null, flag: "kr", company: "미래에셋맵스리츠" },
    { date: "2026-09-07", category: "stock", type: "배당", title: "케이티앤지 배당지급일", meta: "033780", status: null, flag: "kr", company: "케이티앤지", logo: null },
    { date: "2026-09-07", category: "economy", type: "증시일정", title: "미국 증시 휴장 - 노동절(Labor Day)", meta: "", status: null, flag: "us" },
    { date: "2026-09-07", category: "realestate", type: "청약", title: "경기 의정부우정 A2블록 공공분양주택(본청약)", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-07", category: "realestate", type: "청약", title: "서울 브라운스톤 월곡 센트럴", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-07", category: "realestate", type: "청약", title: "울산 문수데시앙2단지 공가세대 일반공급", meta: "09:00", status: null, flag: "kr" },

    { date: "2026-09-08", category: "stock", type: "배당", title: "벡턴 디킨슨 배당락일", meta: "BDX · 13:00", status: null, flag: "us", company: "벡턴 디킨슨", logo: null },
    { date: "2026-09-08", category: "stock", type: "배당", title: "존슨앤드존슨 배당지급일", meta: "JNJ · 13:00", status: null, flag: "us", company: "존슨앤드존슨", logo: null },
    { date: "2026-09-08", category: "stock", type: "배당", title: "애트모스 에너지 배당지급일", meta: "ATO · 13:00", status: null, flag: "us", company: "애트모스 에너지", logo: null },
    { date: "2026-09-08", category: "realestate", type: "청약", title: "경기 남양주진접2지구 A-4블록 신혼희망타운(공공분양) 잔여세대 추가입주자모집공고", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-08", category: "realestate", type: "청약", title: "대전 경남아너스빌 센텀스카이", meta: "09:00", status: null, flag: "kr" },

    { date: "2026-09-09", category: "stock", type: "배당", title: "엔비디아 배당락일", meta: "NVDA · 13:00", status: null, flag: "us", company: "엔비디아", logo: null },
    { date: "2026-09-09", category: "stock", type: "배당", title: "노드슨 배당락일", meta: "NDSN · 13:00", status: null, flag: "us", company: "노드슨", logo: null },
    { date: "2026-09-09", category: "stock", type: "배당", title: "동원시스템즈 배당지급일", meta: "014820", status: null, flag: "kr", company: "동원시스템즈" },
    { date: "2026-09-09", category: "stock", type: "배당", title: "아처 대니얼스 미들랜드 배당지급일", meta: "ADM · 13:00", status: null, flag: "us", company: "아처 대니얼스 미들랜드", logo: null },

    { date: "2026-09-10", category: "ipo", type: "공모청약", title: "네오사피엔스 청약 (대신증권)", meta: "10:00", status: null, flag: "kr", company: "네오사피엔스" },
    { date: "2026-09-10", category: "stock", type: "배당", title: "LG 배당락일", meta: "003550", status: null, flag: "kr", company: "LG" },
    { date: "2026-09-10", category: "stock", type: "배당", title: "처브 배당락일", meta: "CB · 13:00", status: null, flag: "us", company: "처브", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "오토매틱 데이터 프로세싱 배당락일", meta: "ADP · 13:00", status: null, flag: "us", company: "ADP", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "알버말 배당락일", meta: "ALB · 13:00", status: null, flag: "us", company: "알버말", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "플라워스 푸즈 배당락일", meta: "FLO · 13:00", status: null, flag: "us", company: "플라워스 푸즈", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "아메리세이프 배당락일", meta: "AMSF · 13:00", status: null, flag: "us", company: "아메리세이프" },
    { date: "2026-09-10", category: "stock", type: "배당", title: "일라이 릴리 배당지급일", meta: "LLY · 13:00", status: null, flag: "us", company: "일라이 릴리", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "엑슨 모빌 배당지급일", meta: "XOM · 13:00", status: null, flag: "us", company: "엑슨 모빌", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "셰브론 배당지급일", meta: "CVX · 13:00", status: null, flag: "us", company: "셰브론", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "IBM 배당지급일", meta: "IBM · 13:00", status: null, flag: "us", company: "IBM", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "에머슨 일렉트릭 배당지급일", meta: "EMR · 13:00", status: null, flag: "us", company: "에머슨 일렉트릭", logo: null },
    { date: "2026-09-10", category: "stock", type: "배당", title: "스냅 온 배당지급일", meta: "SNA · 13:00", status: null, flag: "us", company: "스냅 온", logo: null },

    { date: "2026-09-11", category: "stock", type: "실적", title: "미국 오라클 2026년 3분기 실적 발표", meta: "ORCL · 05:00", status: "예정", flag: "us", company: "오라클", logo: null },
    { date: "2026-09-11", category: "stock", type: "실적", title: "어도비 2026년 9월 실적발표", meta: "ADBE · 05:00", status: "예정", flag: "us", company: "어도비", logo: null },
    { date: "2026-09-11", category: "stock", type: "실적", title: "크로거 2026년 9월 실적발표", meta: "KR · 21:00", status: "예정", flag: "us", company: "크로거", logo: null },
    { date: "2026-09-11", category: "stock", type: "배당", title: "유나이티드헬스 그룹 배당락일", meta: "UNH · 13:00", status: null, flag: "us", company: "유나이티드헬스", logo: null },
    { date: "2026-09-11", category: "stock", type: "배당", title: "암젠 배당지급일", meta: "AMGN · 13:00", status: null, flag: "us", company: "암젠", logo: null },
    { date: "2026-09-11", category: "stock", type: "배당", title: "셔윈-윌리엄즈 배당지급일", meta: "SHW · 13:00", status: null, flag: "us", company: "셔윈-윌리엄즈", logo: null },
    { date: "2026-09-11", category: "stock", type: "배당", title: "PPG 인더스트리스 배당지급일", meta: "PPG · 13:00", status: null, flag: "us", company: "PPG", logo: null },

    { date: "2026-09-14", category: "ipo", type: "공모청약", title: "와이즈플래닛컴퍼니 청약 (대신증권)", meta: "10:00", status: null, flag: "kr", company: "와이즈플래닛컴퍼니" },
    { date: "2026-09-14", category: "stock", type: "배당", title: "코카콜라 배당락일", meta: "KO · 13:00", status: null, flag: "us", company: "코카콜라", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "머크 배당락일", meta: "MRK · 13:00", status: null, flag: "us", company: "머크", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "알트리아 그룹 배당락일", meta: "MO · 13:00", status: null, flag: "us", company: "알트리아", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "이콜랩 배당락일", meta: "ECL · 13:00", status: null, flag: "us", company: "이콜랩", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "데번 에너지 배당락일", meta: "DVN · 13:00", status: null, flag: "us", company: "데번 에너지", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "티 로 프라이스 그룹 배당락일", meta: "TROW · 13:00", status: null, flag: "us", company: "티 로 프라이스", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "메이시스 배당락일", meta: "M · 13:00", status: null, flag: "us", company: "메이시스", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "인터파퓸스 배당락일", meta: "IPAR · 13:00", status: null, flag: "us", company: "인터파퓸스" },
    { date: "2026-09-14", category: "stock", type: "배당", title: "페더럴 애그리컬처럴 모기지 배당락일", meta: "AGM · 13:00", status: null, flag: "us", company: "페더럴 애그리컬처럴 모기지" },
    { date: "2026-09-14", category: "stock", type: "배당", title: "ESR켄달스퀘어리츠 배당지급일", meta: "365550", status: null, flag: "kr", company: "ESR켄달스퀘어리츠" },
    { date: "2026-09-14", category: "stock", type: "배당", title: "알파벳 A 배당지급일", meta: "GOOGL · 13:00", status: null, flag: "us", company: "알파벳", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "알파벳 C 배당지급일", meta: "GOOG · 13:00", status: null, flag: "us", company: "알파벳", logo: null },
    { date: "2026-09-14", category: "stock", type: "배당", title: "컬럼비아 뱅킹 시스템스 배당지급일", meta: "COLB · 13:00", status: null, flag: "us", company: "컬럼비아 뱅킹" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "경기 더샵 여주역더퍼스트", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "경기 양주회천지구 A-26블록 공공분양주택", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "광주 올 뉴 챔피언스시티 1차", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "울산 그랑라크 에일린의 뜰", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "울산 남울산 노르웨이숲(조합원 취소분)(2회차)", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "충남 두정역 푸르지오 그랑피크", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "충남 천안 아이파크 시티 3단지", meta: "09:00", status: null, flag: "kr" },
    { date: "2026-09-14", category: "realestate", type: "청약", title: "충남 천안 아이파크 시티 4단지", meta: "09:00", status: null, flag: "kr" },

    { date: "2026-09-15", category: "ipo", type: "공모청약", title: "빅웨이브로보틱스 청약 (유진투자증권)", meta: "10:00", status: null, flag: "kr", company: "빅웨이브로보틱스" },
    { date: "2026-09-15", category: "stock", type: "배당", title: "아레스 매니지먼트 배당락일", meta: "ARES · 13:00", status: null, flag: "us", company: "아레스 매니지먼트", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "피델리티 내셔널 파이낸셜 배당락일", meta: "FNF · 13:00", status: null, flag: "us", company: "피델리티 내셔널 파이낸셜", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "웨스턴 유니언 배당락일", meta: "WU · 13:00", status: null, flag: "us", company: "웨스턴 유니언", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "넥스트에라 에너지 배당지급일", meta: "NEE · 13:00", status: null, flag: "us", company: "넥스트에라 에너지", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "신타스 배당지급일", meta: "CTAS · 13:00", status: null, flag: "us", company: "신타스", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "리얼티 인컴 배당지급일", meta: "O · 13:00", status: null, flag: "us", company: "리얼티 인컴", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "콘솔리데이티드 에디슨 배당지급일", meta: "ED · 13:00", status: null, flag: "us", company: "콘솔리데이티드 에디슨", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "허쉬 배당지급일", meta: "HSY · 13:00", status: null, flag: "us", company: "허쉬", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "도버 배당지급일", meta: "DOV · 13:00", status: null, flag: "us", company: "도버", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "오토리브 배당지급일", meta: "ALV · 13:00", status: null, flag: "us", company: "오토리브", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "올드 리퍼블릭 인터내셔널 배당지급일", meta: "ORI · 13:00", status: null, flag: "us", company: "올드 리퍼블릭", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "클리어웨이 에너지 C 배당지급일", meta: "CWEN · 13:00", status: null, flag: "us", company: "클리어웨이 에너지" },
    { date: "2026-09-15", category: "stock", type: "배당", title: "로버트 하프 배당지급일", meta: "RHI · 13:00", status: null, flag: "us", company: "로버트 하프", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "내셔널 뱅크 홀딩스 배당지급일", meta: "NBHC · 13:00", status: null, flag: "us", company: "내셔널 뱅크 홀딩스" },
    { date: "2026-09-15", category: "stock", type: "배당", title: "웬디스 컴퍼니 배당지급일", meta: "WEN · 13:00", status: null, flag: "us", company: "웬디스", logo: null },
    { date: "2026-09-15", category: "stock", type: "배당", title: "센트럴 퍼시픽 파이낸셜 배당지급일", meta: "CPF · 13:00", status: null, flag: "us", company: "센트럴 퍼시픽 파이낸셜" },
    { date: "2026-09-15", category: "realestate", type: "청약", title: "경기 시흥 은계 에피트(조합원 취소분)", meta: "09:00", status: null, flag: "kr" },

    { date: "2026-09-16", category: "ipo", type: "공모청약", title: "글로벌테크놀로지 청약 (한국투자증권)", meta: "10:00", status: null, flag: "kr", company: "글로벌테크놀로지" },
    { date: "2026-09-16", category: "ipo", type: "공모청약", title: "덕산넵코어스 청약 (대신증권)", meta: "10:00", status: null, flag: "kr", company: "덕산넵코어스" },
    { date: "2026-09-16", category: "stock", type: "배당", title: "베스트 바이 배당락일", meta: "BBY · 13:00", status: null, flag: "us", company: "베스트 바이", logo: null },
    { date: "2026-09-16", category: "stock", type: "배당", title: "맥도날드 배당지급일", meta: "MCD · 13:00", status: null, flag: "us", company: "맥도날드", logo: null },
    { date: "2026-09-16", category: "tax", type: "세무", title: "자동차 연세액 납부 시작일", meta: "", status: null, flag: "kr" },
    { date: "2026-09-16", category: "tax", type: "세무", title: "재산세 주택분의 2/2 정기분 납부, 재산세 토지분 정기분 납부 시작일", meta: "", status: null, flag: "kr" },

    { date: "2026-09-17", category: "ipo", type: "공모청약", title: "브릴스 청약 (아이비케이투자증권)", meta: "10:00", status: null, flag: "kr", company: "브릴스" },
    { date: "2026-09-17", category: "stock", type: "배당", title: "SK텔레콤 배당지급일", meta: "017670", status: null, flag: "kr", company: "SK텔레콤", logo: null },
    { date: "2026-09-17", category: "stock", type: "배당", title: "홈디포 배당지급일", meta: "HD · 13:00", status: null, flag: "us", company: "홈디포", logo: null },
    { date: "2026-09-17", category: "stock", type: "배당", title: "린드 배당지급일", meta: "LIN · 13:00", status: null, flag: "us", company: "린드", logo: null },
    { date: "2026-09-17", category: "stock", type: "배당", title: "팩트셋 리서치 시스템스 배당지급일", meta: "FDS · 13:00", status: null, flag: "us", company: "팩트셋", logo: null },
    { date: "2026-09-17", category: "stock", type: "배당", title: "모엘리스 배당지급일", meta: "MC · 13:00", status: null, flag: "us", company: "모엘리스", logo: null },
    { date: "2026-09-17", category: "stock", type: "배당", title: "인스페리티 배당지급일", meta: "NSP · 13:00", status: null, flag: "us", company: "인스페리티", logo: null },
    { date: "2026-09-17", category: "stock", type: "배당", title: "이선 알렌 인테리어스 배당지급일", meta: "ETD · 13:00", status: null, flag: "us", company: "이선 알렌", logo: null },
    { date: "2026-09-17", category: "realestate", type: "청약", title: "인천 인천계양지구 A6블록 공공분양주택(본청약)", meta: "09:00", status: null, flag: "kr" },

    { date: "2026-09-18", category: "ipo", type: "공모청약", title: "엘리스그룹 청약 (미래에셋증권)", meta: "10:00", status: null, flag: "kr", company: "엘리스그룹" },
    { date: "2026-09-18", category: "stock", type: "실적", title: "페덱스 2026년 9월 실적발표", meta: "FDX · 05:00", status: "예정", flag: "us", company: "페덱스", logo: null },
    { date: "2026-09-18", category: "stock", type: "배당", title: "브로드컴 배당락일", meta: "AVGO · 13:00", status: null, flag: "us", company: "브로드컴", logo: null },
    { date: "2026-09-18", category: "stock", type: "배당", title: "동서 배당지급일", meta: "026960", status: null, flag: "kr", company: "동서" },
    { date: "2026-09-18", category: "stock", type: "배당", title: "현대엘리베이터 배당지급일", meta: "017800", status: null, flag: "kr", company: "현대엘리베이터", logo: null },

    { date: "2026-09-22", category: "stock", type: "배당", title: "신시내티 파이낸셜 배당락일", meta: "CINF · 13:00", status: null, flag: "us", company: "신시내티 파이낸셜", logo: null },
    { date: "2026-09-22", category: "stock", type: "배당", title: "유나이티드헬스 그룹 배당지급일", meta: "UNH · 13:00", status: null, flag: "us", company: "유나이티드헬스", logo: null },
    { date: "2026-09-22", category: "stock", type: "배당", title: "스탠리 블랙 앤 데커 배당지급일", meta: "SWK · 13:00", status: null, flag: "us", company: "스탠리 블랙 앤 데커", logo: null },
    { date: "2026-09-22", category: "stock", type: "배당", title: "캐피털 시티 뱅크 그룹 배당지급일", meta: "CCBG · 13:00", status: null, flag: "us", company: "캐피털 시티 뱅크" },

    { date: "2026-09-23", category: "stock", type: "배당", title: "LG 배당지급일", meta: "003550", status: null, flag: "kr", company: "LG" },

    { date: "2026-09-24", category: "stock", type: "실적", title: "다든 레스토랑 2026년 9월 실적발표", meta: "DRI · 21:00", status: "예정", flag: "us", company: "다든 레스토랑", logo: null },
    { date: "2026-09-24", category: "stock", type: "배당", title: "메드트로닉 배당락일", meta: "MDT · 13:00", status: null, flag: "us", company: "메드트로닉", logo: null },
    { date: "2026-09-24", category: "stock", type: "배당", title: "퀄컴 배당지급일", meta: "QCOM · 13:00", status: null, flag: "us", company: "퀄컴", logo: null },
    { date: "2026-09-24", category: "stock", type: "배당", title: "앰코 배당지급일", meta: "AMCR · 13:00", status: null, flag: "us", company: "앰코", logo: null },

    { date: "2026-09-25", category: "stock", type: "실적", title: "코스트코 홀세일 2026년 9월 실적발표", meta: "COST · 05:00", status: "예정", flag: "us", company: "코스트코", logo: null },
    { date: "2026-09-25", category: "stock", type: "배당", title: "록히드 마틴 배당지급일", meta: "LMT · 13:00", status: null, flag: "us", company: "록히드 마틴", logo: null },
    { date: "2026-09-25", category: "stock", type: "배당", title: "프린서플 파이낸셜 그룹 배당지급일", meta: "PFG · 13:00", status: null, flag: "us", company: "프린서플 파이낸셜", logo: null },
    { date: "2026-09-25", category: "stock", type: "배당", title: "플라워스 푸즈 배당지급일", meta: "FLO · 13:00", status: null, flag: "us", company: "플라워스 푸즈", logo: null },
    { date: "2026-09-25", category: "stock", type: "배당", title: "아메리세이프 배당지급일", meta: "AMSF · 13:00", status: null, flag: "us", company: "아메리세이프" },

    { date: "2026-09-29", category: "stock", type: "배당", title: "일리노이 툴 웍스 배당락일", meta: "ITW · 13:00", status: null, flag: "us", company: "일리노이 툴 웍스", logo: null },
    { date: "2026-09-29", category: "stock", type: "배당", title: "프랭클린 리소시스 배당락일", meta: "BEN · 13:00", status: null, flag: "us", company: "프랭클린 리소시스", logo: null },
    { date: "2026-09-29", category: "stock", type: "배당", title: "OFG 뱅코프 배당락일", meta: "OFG · 13:00", status: null, flag: "us", company: "OFG 뱅코프" },
    { date: "2026-09-29", category: "stock", type: "배당", title: "티 로 프라이스 그룹 배당지급일", meta: "TROW · 13:00", status: null, flag: "us", company: "티 로 프라이스", logo: null },

    { date: "2026-09-30", category: "stock", type: "배당", title: "에어 프로덕츠 앤 케미컬스 배당락일", meta: "APD · 13:00", status: null, flag: "us", company: "에어 프로덕츠", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "카디널 헬스 배당락일", meta: "CAH · 13:00", status: null, flag: "us", company: "카디널 헬스", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "페더럴 리얼티 인베스트먼트 배당락일", meta: "FRT · 13:00", status: null, flag: "us", company: "페더럴 리얼티" },
    { date: "2026-09-30", category: "stock", type: "배당", title: "현대차 배당지급일", meta: "005380", status: null, flag: "kr", company: "현대차", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "브로드컴 배당지급일", meta: "AVGO · 13:00", status: null, flag: "us", company: "브로드컴", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "펩시코 배당지급일", meta: "PEP · 13:00", status: null, flag: "us", company: "펩시코", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "벡턴 디킨슨 배당지급일", meta: "BDX · 13:00", status: null, flag: "us", company: "벡턴 디킨슨", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "아레스 매니지먼트 배당지급일", meta: "ARES · 13:00", status: null, flag: "us", company: "아레스 매니지먼트", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "데번 에너지 배당지급일", meta: "DVN · 13:00", status: null, flag: "us", company: "데번 에너지", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "피델리티 내셔널 파이낸셜 배당지급일", meta: "FNF · 13:00", status: null, flag: "us", company: "피델리티 내셔널 파이낸셜", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "인터파퓸스 배당지급일", meta: "IPAR · 13:00", status: null, flag: "us", company: "인터파퓸스" },
    { date: "2026-09-30", category: "stock", type: "배당", title: "마제티 배당지급일", meta: "MZTI · 13:00", status: null, flag: "us", company: "마제티" },
    { date: "2026-09-30", category: "stock", type: "배당", title: "웨스턴 유니언 배당지급일", meta: "WU · 13:00", status: null, flag: "us", company: "웨스턴 유니언", logo: null },
    { date: "2026-09-30", category: "stock", type: "배당", title: "페더럴 애그리컬처럴 모기지 배당지급일", meta: "AGM · 13:00", status: null, flag: "us", company: "페더럴 애그리컬처럴 모기지" },
    { date: "2026-09-30", category: "tax", type: "세무", title: "자동차 연세액 납부 마감일", meta: "", status: null, flag: "kr" },
    { date: "2026-09-30", category: "tax", type: "세무", title: "재산세 주택분의 2/2 정기분 납부, 재산세 토지분 정기분 납부 마감일", meta: "", status: null, flag: "kr" },

    // ---- 2026년 10월 ----
    { date: "2026-10-01", category: "ipo", type: "공모청약", title: "멜콘 공모주 청약", meta: "대신증권 · 10:00", status: "예정", flag: "kr", company: "멜콘" },
    { date: "2026-10-01", category: "ipo", type: "신규상장", title: "브릴스 코스닥 신규상장", meta: "09:00", status: "예정", flag: "kr", company: "브릴스" },
    { date: "2026-10-01", category: "economy", type: "경제지표", title: "미국 9월 4주차 신규 실업수당청구건수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-01", category: "economy", type: "경제지표", title: "미국 9월 ISM 제조업 구매관리자지수(PMI)", meta: "23:00", status: "예정", flag: "us" },
    { date: "2026-10-01", category: "economy", type: "경제지표", title: "한국 2026년 9월 수출입 동향", meta: "11:00", status: "예정", flag: "kr" },
    { date: "2026-10-01", category: "stock", type: "실적", title: "미국 마이크론 테크놀로지 2026년 3분기 실적발표", meta: "MU · 05:00", status: "예정", flag: "us", company: "마이크론", logo: null },
    { date: "2026-10-01", category: "stock", type: "공시", title: "LG에너지솔루션, 대규모 계약 체결", meta: "373220", status: null, flag: "kr", company: "LG에너지솔루션" },
    { date: "2026-10-01", category: "stock", type: "공시", title: "두산에너빌리티, 대규모 발전소 공사 수주", meta: "034020", status: null, flag: "kr", company: "두산에너빌리티" },
    { date: "2026-10-01", category: "stock", type: "공시", title: "한국콜마, 자회사 채무보증 결정", meta: "161890", status: null, flag: "kr", company: "한국콜마" },
    { date: "2026-10-01", category: "stock", type: "공시", title: "현대건설, 중대재해 발생", meta: "000720", status: null, flag: "kr", company: "현대건설" },
    { date: "2026-10-01", category: "stock", type: "배당", title: "브리스톨 마이어스 스퀴브 배당락일", meta: "BMY · 13:00", status: null, flag: "us", company: "브리스톨 마이어스 스퀴브", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "시스코 배당락일", meta: "SYY · 13:00", status: null, flag: "us", company: "시스코", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "로퍼 테크놀로지스 배당락일", meta: "ROP · 13:00", status: null, flag: "us", company: "로퍼 테크놀로지스", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "엔비디아 배당지급일", meta: "NVDA · 13:00", status: null, flag: "us", company: "엔비디아", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "코카콜라 배당지급일", meta: "KO · 13:00", status: null, flag: "us", company: "코카콜라", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "오토매틱 데이터 프로세싱 배당지급일", meta: "ADP · 13:00", status: null, flag: "us", company: "ADP", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "리전스 파이낸셜 배당지급일", meta: "RF · 13:00", status: null, flag: "us", company: "리전스 파이낸셜", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "알버말 배당지급일", meta: "ALB · 13:00", status: null, flag: "us", company: "알버말", logo: null },
    { date: "2026-10-01", category: "stock", type: "배당", title: "메이시스 배당지급일", meta: "M · 13:00", status: null, flag: "us", company: "메이시스", logo: null },
    { date: "2026-10-01", category: "tax", type: "세무", title: "2026년 2기 부가가치세 예정신고 납부 시작일", meta: "", status: null, flag: "kr" },
    { date: "2026-10-02", category: "economy", type: "경제지표", title: "미국 9월 비농업고용", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-02", category: "economy", type: "경제지표", title: "미국 9월 실업률", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-02", category: "stock", type: "실적", title: "미국 나이키 2026년 10월 실적발표", meta: "NKE · 05:00", status: "예정", flag: "us", company: "나이키", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "이리 인뎀너티 배당락일", meta: "ERIE · 13:00", status: null, flag: "us", company: "이리 인뎀너티", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "프리퍼드 뱅크 로스앤젤리스 배당락일", meta: "PFBC · 13:00", status: null, flag: "us", company: "프리퍼드 뱅크", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "처브 배당지급일", meta: "CB · 13:00", status: null, flag: "us", company: "처브", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "켄뷰 배당지급일", meta: "KVUE · 13:00", status: null, flag: "us", company: "켄뷰", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "킴벌리클라크 배당지급일", meta: "KMB · 13:00", status: null, flag: "us", company: "킴벌리클라크", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "CH 로빈슨 월드와이드 배당지급일", meta: "CHRW · 13:00", status: null, flag: "us", company: "CH 로빈슨", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "노드슨 배당지급일", meta: "NDSN · 13:00", status: null, flag: "us", company: "노드슨", logo: null },
    { date: "2026-10-02", category: "stock", type: "배당", title: "제뉴인 파츠 배당지급일", meta: "GPC · 13:00", status: null, flag: "us", company: "제뉴인 파츠", logo: null },
    { date: "2026-10-05", category: "economy", type: "경제지표", title: "미국 9월 ISM 비제조업 구매관리자지수(PMI)", meta: "23:00", status: "예정", flag: "us" },
    { date: "2026-10-05", category: "stock", type: "배당", title: "JP모간 체이스 배당락일", meta: "JPM · 13:00", status: null, flag: "us", company: "JP모간 체이스", logo: null },
    { date: "2026-10-05", category: "stock", type: "배당", title: "브로드리지 파이낸셜 솔루션 배당지급일", meta: "BR · 13:00", status: null, flag: "us", company: "브로드리지", logo: null },
    { date: "2026-10-06", category: "stock", type: "실적", title: "미국 램 웨스턴 홀딩스 2026년 10월 실적발표", meta: "LW · 21:00", status: "예정", flag: "us", company: "램 웨스턴", logo: null },
    { date: "2026-10-06", category: "stock", type: "배당", title: "컴캐스트 배당락일", meta: "CMCSA · 13:00", status: null, flag: "us", company: "컴캐스트", logo: null },
    { date: "2026-10-06", category: "economy", type: "경제지표", title: "미국 8월 무역수지", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-07", category: "ipo", type: "공모청약", title: "엘리스그룹 공모주 청약", meta: "미래에셋증권 · 10:00", status: "예정", flag: "kr", company: "엘리스그룹" },
    { date: "2026-10-07", category: "stock", type: "실적", title: "미국 컨스털레이션 브랜즈 2026년 10월 실적발표", meta: "STZ · 05:00", status: "예정", flag: "us", company: "컨스털레이션 브랜즈", logo: null },
    { date: "2026-10-07", category: "stock", type: "배당", title: "베일 리조츠 배당락일", meta: "MTN · 13:00", status: null, flag: "us", company: "베일 리조츠", logo: null },
    { date: "2026-10-07", category: "stock", type: "배당", title: "머크 배당지급일", meta: "MRK · 13:00", status: null, flag: "us", company: "머크", logo: null },
    { date: "2026-10-08", category: "economy", type: "경제지표", title: "미국 10월 1주차 신규 실업수당청구건수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-08", category: "stock", type: "배당", title: "버라이즌 커뮤니케이션스 배당락일", meta: "VZ · 13:00", status: null, flag: "us", company: "버라이즌", logo: null },
    { date: "2026-10-08", category: "stock", type: "배당", title: "제너럴 다이내믹스 배당락일", meta: "GD · 13:00", status: null, flag: "us", company: "제너럴 다이내믹스", logo: null },
    { date: "2026-10-08", category: "stock", type: "배당", title: "다든 레스토랑 배당락일", meta: "DRI · 13:00", status: null, flag: "us", company: "다든 레스토랑", logo: null },
    { date: "2026-10-08", category: "stock", type: "배당", title: "에니스 배당락일", meta: "EBF · 13:00", status: null, flag: "us", company: "에니스", logo: null },
    { date: "2026-10-08", category: "stock", type: "배당", title: "슐럼버거 배당지급일", meta: "SLB · 13:00", status: null, flag: "us", company: "슐럼버거", logo: null },
    { date: "2026-10-08", category: "stock", type: "배당", title: "베스트 바이 배당지급일", meta: "BBY · 13:00", status: null, flag: "us", company: "베스트 바이", logo: null },
    { date: "2026-10-09", category: "economy", type: "경제지표", title: "미국 10월 미시간 소비자심리지수", meta: "23:00", status: "예정", flag: "us" },
    { date: "2026-10-09", category: "stock", type: "배당", title: "맥코믹 앤드 컴퍼니 배당락일", meta: "MKC · 13:00", status: null, flag: "us", company: "맥코믹", logo: null },
    { date: "2026-10-09", category: "stock", type: "배당", title: "호멜 푸즈 배당락일", meta: "HRL · 13:00", status: null, flag: "us", company: "호멜 푸즈", logo: null },
    { date: "2026-10-09", category: "stock", type: "배당", title: "알트리아 그룹 배당지급일", meta: "MO · 13:00", status: null, flag: "us", company: "알트리아", logo: null },
    { date: "2026-10-09", category: "stock", type: "배당", title: "일리노이 툴 웍스 배당지급일", meta: "ITW · 13:00", status: null, flag: "us", company: "일리노이 툴 웍스", logo: null },
    { date: "2026-10-09", category: "stock", type: "배당", title: "프랭클린 리소시스 배당지급일", meta: "BEN · 13:00", status: null, flag: "us", company: "프랭클린 리소시스", logo: null },
    { date: "2026-10-12", category: "ipo", type: "공모청약", title: "엠에스바이오 공모주 청약", meta: "KB증권 · 10:00", status: "예정", flag: "kr", company: "엠에스바이오" },
    { date: "2026-10-13", category: "ipo", type: "공모청약", title: "디티에스 공모주 청약", meta: "대신증권 · 10:00", status: "예정", flag: "kr", company: "디티에스" },
    { date: "2026-10-14", category: "economy", type: "경제지표", title: "미국 9월 CPI 소비자물가지수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-14", category: "stock", type: "배당", title: "애브비 배당락일", meta: "ABBV · 13:00", status: null, flag: "us", company: "애브비", logo: null },
    { date: "2026-10-14", category: "stock", type: "배당", title: "애보트 래보라토리 배당락일", meta: "ABT · 13:00", status: null, flag: "us", company: "애보트", logo: null },
    { date: "2026-10-14", category: "stock", type: "배당", title: "버클 배당락일", meta: "BKE · 13:00", status: null, flag: "us", company: "버클", logo: null },
    { date: "2026-10-15", category: "economy", type: "경제지표", title: "미국 9월 PPI 생산자물가지수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-15", category: "economy", type: "경제지표", title: "미국 10월 2주차 신규 실업수당청구건수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-15", category: "economy", type: "경제지표", title: "미국 9월 소매판매", meta: "22:30", status: "예정", flag: "us" },
    { date: "2026-10-15", category: "stock", type: "실적", title: "미국 TSMC 2026년 10월 실적발표", meta: "TSM · 21:00", status: "예정", flag: "us", company: "TSMC", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "EOG 리소시스 배당락일", meta: "EOG · 13:00", status: null, flag: "us", company: "EOG 리소시스", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "옥스포드 인더스트리스 배당락일", meta: "OXM · 13:00", status: null, flag: "us", company: "옥스포드 인더스트리스", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "이콜랩 배당지급일", meta: "ECL · 13:00", status: null, flag: "us", company: "이콜랩", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "리얼티 인컴 배당지급일", meta: "O · 13:00", status: null, flag: "us", company: "리얼티 인컴", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "카디널 헬스 배당지급일", meta: "CAH · 13:00", status: null, flag: "us", company: "카디널 헬스", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "피프스 서드 뱅코프 배당지급일", meta: "FITB · 13:00", status: null, flag: "us", company: "피프스 서드 뱅코프", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "신시내티 파이낸셜 배당지급일", meta: "CINF · 13:00", status: null, flag: "us", company: "신시내티 파이낸셜", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "에섹스 프라퍼티 트러스트 배당지급일", meta: "ESS · 13:00", status: null, flag: "us", company: "에섹스 프라퍼티", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "페더럴 리얼티 인베스트먼트 배당지급일", meta: "FRT · 13:00", status: null, flag: "us", company: "페더럴 리얼티", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "콘 페리 배당지급일", meta: "KFY · 13:00", status: null, flag: "us", company: "콘 페리", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "CVB 파이낸셜 배당지급일", meta: "CVBF · 13:00", status: null, flag: "us", company: "CVB 파이낸셜", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "OFG 뱅코프 배당지급일", meta: "OFG · 13:00", status: null, flag: "us", company: "OFG 뱅코프", logo: null },
    { date: "2026-10-15", category: "stock", type: "배당", title: "퍼스트 파이낸셜 배당지급일", meta: "THFF · 13:00", status: null, flag: "us", company: "퍼스트 파이낸셜", logo: null },
    { date: "2026-10-16", category: "stock", type: "배당", title: "메드트로닉 배당지급일", meta: "MDT · 13:00", status: null, flag: "us", company: "메드트로닉", logo: null },
    { date: "2026-10-19", category: "ipo", type: "공모청약", title: "다비오 공모주 청약", meta: "대신증권 · 10:00", status: "예정", flag: "kr", company: "다비오" },
    { date: "2026-10-19", category: "ipo", type: "공모청약", title: "유캐스트 공모주 청약", meta: "유진투자증권 · 10:00", status: "예정", flag: "kr", company: "유캐스트" },
    { date: "2026-10-19", category: "stock", type: "배당", title: "콜게이트 팜올리브 배당락일", meta: "CL · 13:00", status: null, flag: "us", company: "콜게이트 팜올리브", logo: null },
    { date: "2026-10-19", category: "stock", type: "배당", title: "프리퍼드 뱅크 로스앤젤리스 배당지급일", meta: "PFBC · 13:00", status: null, flag: "us", company: "프리퍼드 뱅크", logo: null },
    { date: "2026-10-19", category: "realestate", type: "청약", title: "인천계양 A17블록 신혼희망타운(공공분양) 본청약", meta: "09:00", status: "예정", flag: "kr" },
    { date: "2026-10-20", category: "ipo", type: "공모청약", title: "크리에이츠 공모주 청약", meta: "삼성증권 · 10:00", status: "예정", flag: "kr", company: "크리에이츠" },
    { date: "2026-10-20", category: "ipo", type: "공모청약", title: "티앤이코리아 공모주 청약", meta: "신한투자증권 · 10:00", status: "예정", flag: "kr", company: "티앤이코리아" },
    { date: "2026-10-20", category: "stock", type: "배당", title: "로우스 배당락일", meta: "LOW · 13:00", status: null, flag: "us", company: "로우스", logo: null },
    { date: "2026-10-20", category: "stock", type: "배당", title: "이리 인뎀너티 배당지급일", meta: "ERIE · 13:00", status: null, flag: "us", company: "이리 인뎀너티", logo: null },
    { date: "2026-10-21", category: "ipo", type: "공모청약", title: "인텔리빅스 공모주 청약", meta: "미래에셋증권 · 10:00", status: "예정", flag: "kr", company: "인텔리빅스" },
    { date: "2026-10-21", category: "stock", type: "배당", title: "APA 배당락일", meta: "APA · 13:00", status: null, flag: "us", company: "APA", logo: null },
    { date: "2026-10-21", category: "stock", type: "배당", title: "로퍼 테크놀로지스 배당지급일", meta: "ROP · 13:00", status: null, flag: "us", company: "로퍼 테크놀로지스", logo: null },
    { date: "2026-10-22", category: "ipo", type: "공모청약", title: "래블업 공모주 청약", meta: "NH투자증권 · 10:00", status: "예정", flag: "kr", company: "래블업" },
    { date: "2026-10-22", category: "ipo", type: "공모청약", title: "영광 공모주 청약", meta: "한국투자증권 · 10:00", status: "예정", flag: "kr", company: "영광" },
    { date: "2026-10-22", category: "ipo", type: "공모청약", title: "이에스티 공모주 청약", meta: "대신증권 · 10:00", status: "예정", flag: "kr", company: "이에스티" },
    { date: "2026-10-22", category: "economy", type: "경제지표", title: "미국 10월 3주차 신규 실업수당청구건수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-22", category: "stock", type: "실적", title: "현대차 2026년 3분기 실적발표", meta: "005380 · 16:00", status: "예정", flag: "kr", company: "현대차", logo: null },
    { date: "2026-10-22", category: "stock", type: "배당", title: "펜테어 배당락일", meta: "PNR · 13:00", status: null, flag: "us", company: "펜테어", logo: null },
    { date: "2026-10-23", category: "stock", type: "배당", title: "시스코 배당지급일", meta: "SYY · 13:00", status: null, flag: "us", company: "시스코", logo: null },
    { date: "2026-10-26", category: "ipo", type: "공모청약", title: "에이엘로봇 공모주 청약", meta: "대신증권 · 10:00", status: "예정", flag: "kr", company: "에이엘로봇" },
    { date: "2026-10-26", category: "stock", type: "배당", title: "맥코믹 앤드 컴퍼니 배당지급일", meta: "MKC · 13:00", status: null, flag: "us", company: "맥코믹", logo: null },
    { date: "2026-10-26", category: "tax", type: "세무", title: "2026년 2기 부가가치세 예정신고 납부 마감일", meta: "", status: null, flag: "kr" },
    { date: "2026-10-27", category: "stock", type: "실적", title: "SK하이닉스 2026년 3분기 실적발표", meta: "000660 · 08:00", status: "예정", flag: "kr", company: "SK하이닉스", logo: null },
    { date: "2026-10-27", category: "stock", type: "배당", title: "크로락스 배당락일", meta: "CLX · 13:00", status: null, flag: "us", company: "크로락스", logo: null },
    { date: "2026-10-27", category: "stock", type: "배당", title: "베일 리조츠 배당지급일", meta: "MTN · 13:00", status: null, flag: "us", company: "베일 리조츠", logo: null },
    { date: "2026-10-28", category: "ipo", type: "공모청약", title: "엠비디 공모주 청약", meta: "하나증권 · 10:00", status: "예정", flag: "kr", company: "엠비디" },
    { date: "2026-10-28", category: "stock", type: "배당", title: "컴캐스트 배당지급일", meta: "CMCSA · 13:00", status: null, flag: "us", company: "컴캐스트", logo: null },
    { date: "2026-10-29", category: "economy", type: "경제지표", title: "미국 9월 근원 PCE 물가지수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-29", category: "economy", type: "경제지표", title: "미국 10월 4주차 신규 실업수당청구건수", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-29", category: "economy", type: "경제지표", title: "미국 3분기 GDP 성장률", meta: "21:30", status: "예정", flag: "us" },
    { date: "2026-10-29", category: "economy", type: "경제지표", title: "미국 금리결정", meta: "FOMC · 03:00", status: "예정", flag: "us" },
    { date: "2026-10-29", category: "stock", type: "실적", title: "미국 알파벳 A 2026년 11월 실적발표", meta: "GOOGL · 05:00", status: "예정", flag: "us", company: "알파벳", logo: null },
    { date: "2026-10-29", category: "stock", type: "실적", title: "미국 마이크로소프트 2026년 10월 실적발표", meta: "MSFT · 05:00", status: "예정", flag: "us", company: "마이크로소프트", logo: null },
    { date: "2026-10-29", category: "stock", type: "실적", title: "미국 테슬라 2026년 10월 실적발표", meta: "TSLA · 05:00", status: "예정", flag: "us", company: "테슬라", logo: null },
    { date: "2026-10-29", category: "stock", type: "실적", title: "미국 메타 2026년 10월 실적발표", meta: "META · 05:00", status: "예정", flag: "us", company: "메타", logo: null },
    { date: "2026-10-29", category: "stock", type: "실적", title: "미국 페덱스 2026년 10월 실적발표", meta: "FDX · 05:00", status: "예정", flag: "us", company: "페덱스", logo: null },
    { date: "2026-10-29", category: "stock", type: "실적", title: "삼성전자 2026년 3분기 실적발표", meta: "005930 · 08:00", status: "예정", flag: "kr", company: "삼성전자", logo: null },
    { date: "2026-10-29", category: "stock", type: "배당", title: "텍사스 인스트루먼트 배당락일", meta: "TXN · 13:00", status: null, flag: "us", company: "텍사스 인스트루먼트", logo: null },
    { date: "2026-10-29", category: "stock", type: "배당", title: "버투스 인베스트먼트 파트너스 배당락일", meta: "VRTS · 13:00", status: null, flag: "us", company: "버투스", logo: null },
    { date: "2026-10-29", category: "stock", type: "배당", title: "버클 배당지급일", meta: "BKE · 13:00", status: null, flag: "us", company: "버클", logo: null },
    { date: "2026-10-30", category: "stock", type: "실적", title: "미국 애플 2026년 10월 실적발표", meta: "AAPL · 05:00", status: "예정", flag: "us", company: "애플", logo: null },
    { date: "2026-10-30", category: "stock", type: "실적", title: "미국 아마존 2026년 10월 실적발표", meta: "AMZN · 05:00", status: "예정", flag: "us", company: "아마존", logo: null },
    { date: "2026-10-30", category: "stock", type: "배당", title: "EOG 리소시스 배당지급일", meta: "EOG · 13:00", status: null, flag: "us", company: "EOG 리소시스", logo: null },
    { date: "2026-10-30", category: "stock", type: "배당", title: "옥스포드 인더스트리스 배당지급일", meta: "OXM · 13:00", status: null, flag: "us", company: "옥스포드 인더스트리스", logo: null },
    { date: "2026-10-31", category: "stock", type: "배당", title: "JP모간 체이스 배당지급일", meta: "JPM · 13:00", status: null, flag: "us", company: "JP모간 체이스", logo: null }
  ];

  var CALENDAR_EVENTS = MANUAL_CALENDAR_EVENTS.slice();
  var sharedCalendarEventsCache = [];
  var personalCalendarEventsCache = [];

  function rebuildCalendarEvents(){
    // hidden:true는 관리자가 "숨김" 처리한 자동 수집 일정 — 삭제하지 않고 그대로 Firestore에 남겨두되
    // 사용자 화면에서만 걸러낸다(관리자 화면의 "검수 필요 일정" 등에서는 계속 조회 가능).
    CALENDAR_EVENTS = MANUAL_CALENDAR_EVENTS.concat(sharedCalendarEventsCache).concat(personalCalendarEventsCache)
      .filter(function(ev){ return !ev.hidden; });
    renderCalendarGrid();
    renderCalendarTimeline();
    if (typeof renderCalendarActiveMode === "function") renderCalendarActiveMode();
  }

  function loadCalendarEventsFromFirestore(){
    var today = new Date();
    var rangeStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    var rangeEnd = new Date(today.getFullYear(), today.getMonth() + 6, 0);
    var startStr = rangeStart.getFullYear() + "-" + pad2(rangeStart.getMonth() + 1) + "-" + pad2(rangeStart.getDate());
    var endStr = rangeEnd.getFullYear() + "-" + pad2(rangeEnd.getMonth() + 1) + "-" + pad2(rangeEnd.getDate());

    return db.collection("calendarEvents")
      .where("date", ">=", startStr)
      .where("date", "<=", endStr)
      .get()
      .then(function(snapshot){
        if (snapshot.empty) return;
        sharedCalendarEventsCache = snapshot.docs.map(function(doc){
          var data = doc.data();
          data.id = doc.id;
          return data;
        });
        rebuildCalendarEvents();
        scrollToTodayInCalendar(false);
      })
      .catch(function(error){
        console.error("금융 캘린더 자동 수집 데이터 로드 실패:", error);
      });
  }

  var CALENDAR_CATEGORY_META = {
    "economy":    { label: "경제",     color: "#3182f6", bg: "rgba(49,130,246,0.10)", icon: "ph-chart-line-up" },
    "stock":      { label: "주식",     color: "#585CE5", bg: "rgba(88,92,229,0.10)", icon: "ph-chart-bar" },
    "tax":        { label: "세무",     color: "#f59e0b", bg: "rgba(245,158,11,0.14)", icon: "ph-receipt" },
    "realestate": { label: "부동산",   color: "#059669", bg: "rgba(5,150,105,0.10)", icon: "ph-buildings" },
    "subsidy":    { label: "정부지원금", color: "#db2777", bg: "rgba(219,39,119,0.10)", icon: "ph-gift" },
    "ipo":        { label: "공모주",   color: "#0891b2", bg: "rgba(8,145,178,0.10)", icon: "ph-rocket-launch" },
    "personal":   { label: "개인일정", color: "#6b7280", bg: "rgba(107,114,128,0.12)", icon: "ph-user" }
  };

  var CALENDAR_TYPE_COLORS = {
    "배당":     { color: "#e11d48", bg: "rgba(225,29,72,0.10)" },
    "세무":     { color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    "실적":     { color: "#3182f6", bg: "rgba(49,130,246,0.10)" },
    "청약":     { color: "#059669", bg: "rgba(5,150,105,0.10)" },
    "경제지표": { color: "#f59e0b", bg: "rgba(245,158,11,0.14)" }
  };

  var CALENDAR_FILTER_OPTIONS = [
    { key: "all", label: "전체", categories: null, icon: "ph-squares-four" },
    { key: "economy", label: "경제지표", categories: ["economy"], icon: "ph-chart-line-up" },
    { key: "ipo", label: "공모주", categories: ["ipo"], icon: "ph-rocket-launch" },
    { key: "realestate", label: "부동산·청약", categories: ["realestate"], icon: "ph-buildings" },
    { key: "subsidy-tax", label: "지원금·세금", categories: ["subsidy", "tax"], icon: "ph-gift" },
    { key: "stock", label: "주식", categories: ["stock"], icon: "ph-chart-bar" },
    { key: "personal", label: "내 일정", categories: ["personal"], icon: "ph-user" }
  ];

  function calendarFilterMatches(ev, filterKey){
    if (filterKey === "all") return true;
    var opt = CALENDAR_FILTER_OPTIONS.filter(function(o){ return o.key === filterKey; })[0];
    if (!opt || !opt.categories) return true;
    return opt.categories.indexOf(ev.category) > -1;
  }

  var CALENDAR_WEEKDAY_FULL_KO = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];

  var CALENDAR_IMPORTANCE_META = {
    "매우중요": { label: "매우 중요", icon: "ph-fill ph-warning-circle", weight: 3 },
    "중요":    { label: "중요",      icon: "ph-fill ph-star",           weight: 2 },
    "일반":    { label: "일반",      icon: "ph-fill ph-info",           weight: 1 }
  };

  function getEventImportance(ev){
    return ev.importanceOverride || ev.autoImportance || "일반";
  }

  var CALENDAR_DESC_TEMPLATES = {
    "economy":    "금리·물가 관련 발표로, 예금·대출 금리나 시장 분위기에 영향을 줄 수 있는 일정이에요.",
    "stock":      "기업이 공시한 배당·실적 관련 일정이에요. 보유 종목이라면 확인해두면 좋아요.",
    "ipo":        "공모주 청약 관련 일정이에요. 신청 기간 안에 접수해야 배정을 받을 수 있어요.",
    "realestate": "부동산 청약 관련 일정이에요. 접수 기간과 자격 요건을 미리 확인해보세요.",
    "subsidy":    "신청 조건에 해당한다면 기한 안에 접수해야 받을 수 있는 지원금 일정이에요.",
    "tax":        "세금 신고·납부와 관련된 일정이에요. 기한을 놓치면 가산세가 붙을 수 있어요.",
    "personal":   "직접 등록한 개인 일정이에요."
  };

  function getEventDescription(ev){
    if (ev.descriptionOverride) return ev.descriptionOverride;
    return CALENDAR_DESC_TEMPLATES[ev.category] || null;
  }

  var CALENDAR_IMPACT_TEMPLATES = {
    "economy":    "금리·물가 지표는 예금/대출 금리, 환율, 투자 심리 전반에 영향을 줄 수 있어요. 구체적인 방향이나 폭은 예측하지 않아요.",
    "stock":      "보유하거나 관심 있는 종목이라면 주가·배당 정책에 참고가 될 수 있는 공시예요. 투자 판단은 다양한 정보를 함께 확인한 뒤 신중히 결정하세요.",
    "ipo":        "청약에 참여하려면 기간 안에 신청해야 하고, 배정 수량과 상장 후 주가는 신청만으로 확정되지 않아요.",
    "realestate": "청약 자격과 가점에 따라 결과가 달라져요. 접수 전 자격 요건을 꼭 확인하세요.",
    "subsidy":    "자격 요건에 해당하는 경우에만 받을 수 있는 지원금이에요. 기한 안에 신청 여부를 결정해야 해요.",
    "tax":        "납부·신고 대상이라면 기한을 지키는 게 중요해요. 대상 여부는 개인 상황에 따라 달라질 수 있어요.",
    "personal":   ""
  };

  function getEventImpactText(ev){
    return CALENDAR_IMPACT_TEMPLATES[ev.category] || "";
  }

  var CALENDAR_BADGE_PALETTE = ["#585CE5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0369a1", "#be185d", "#4d7c0f", "#c2410c"];

  var calendarCompanyTickerMap = null;

  function getEventTicker(ev){
    if (ev.stockCode) return ev.stockCode;
    var meta = ev.meta || "";
    var usMatch = meta.match(/^([A-Z]{1,5})\s*·/);
    if (usMatch) return usMatch[1];
    var krMatch = meta.match(/\b(\d{6})\b/);
    if (krMatch) return krMatch[1];
    // 같은 회사의 다른 일정(예: 배당지급일)엔 종목코드가 있는데 이 일정(예: 배당락일)엔 없는 경우,
    // 전체 캘린더 데이터에서 같은 회사명으로 한 번이라도 코드가 확인된 값을 재사용한다.
    if (ev.company) return lookupCompanyTicker(ev.company);
    return null;
  }

  function lookupCompanyTicker(company){
    if (!calendarCompanyTickerMap) {
      calendarCompanyTickerMap = {};
      CALENDAR_EVENTS.forEach(function(e){
        if (!e.company) return;
        var meta = e.meta || "";
        var m = meta.match(/^([A-Z]{1,5})\s*·/) || meta.match(/\b(\d{6})\b/);
        if (m && !calendarCompanyTickerMap[e.company]) calendarCompanyTickerMap[e.company] = m[1];
      });
    }
    return calendarCompanyTickerMap[company] || null;
  }

  function getStableBadgeColor(key){
    var hash = 0;
    for (var i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return CALENDAR_BADGE_PALETTE[hash % CALENDAR_BADGE_PALETTE.length];
  }

  var brandfetchClientId = null;
  var brandfetchConfigLoaded = false;

  function loadBrandfetchConfig(){
    return fetch("/api/brandfetch-config")
      .then(function(res){ return res.ok ? res.json() : {}; })
      .then(function(data){ brandfetchClientId = data.clientId || null; })
      .catch(function(){ brandfetchClientId = null; })
      .then(function(){
        brandfetchConfigLoaded = true;
        if (!brandfetchClientId) return;
        // 첫 렌더 때는 아직 클라이언트ID가 없어 티커/중립 아이콘으로 보이다가, 로드가 끝나면
        // 실제 로고로 "업그레이드"되도록 다시 그린다. 이 시점에 사용자가 어느 모드를 보고 있는지
        // (혹은 아직 모드 탭 초기화가 안 끝났는지) 추측하지 않고, 로고가 나타날 수 있는 화면을
        // 전부 다시 그려서 어떤 경우에도 최신 상태가 반영되게 한다.
        if (typeof renderCalendarGrid === "function") renderCalendarGrid();
        if (typeof renderCalendarSelectedDayPanel === "function") renderCalendarSelectedDayPanel();
        if (typeof renderCalendarTimeline === "function") renderCalendarTimeline();
        if (typeof renderCalendarWeekMode === "function") renderCalendarWeekMode();
        if (typeof renderCalendarMineMode === "function") renderCalendarMineMode();
      });
  }

  var CALENDAR_LOGO_DOMAINS = {
    "맥코믹": "mccormick.com",
    "마이크론": "micron.com",
    "SK하이닉스": "skhynix.com",
    "알파벳": "abc.xyz",
    "테슬라": "tesla.com",
    "현대차": "hyundai.com",
    "삼성전자": "samsung.com",
    "마이크로소프트": "microsoft.com",
    "메타": "meta.com",
    "배너": "bannerbank.com",
    "오스타운 파이낸셜": "orrstown.com",
    "인디펜던트 뱅코프": "independentbank.com",
    "팔란티어": "palantir.com",
    "AMD": "amd.com",
    "웨스트 파마슈티컬": "westpharma.com",
    "레이크랜드 파이낸셜": "lakecitybank.com",
    "JB금융지주": "jbfg.com",
    "KB금융": "kbfg.com",
    "두산밥캣": "doosanbobcat.com",
    "우리금융지주": "woorifg.com",
    "하나금융지주": "hanafn.com",
    "현대모비스": "mobis.co.kr",
    "IBM": "ibm.com",
    "PPG": "ppg.com",
    "텍사스 인스트루먼트": "ti.com",
    "스머커": "jmsmucker.com",
    "리얼티 인컴": "realtyincome.com",
    "원오크": "oneok.com",
    "노스웨스트 내추럴": "nwnatural.com",
    "버투스": "virtus.com",
    "P&G": "pg.com",
    "이스트 웨스트 뱅코프": "eastwestbank.com",
    "A O 스미스": "aosmith.com",
    "콘솔리데이티드 에디슨": "coned.com",
    "APA": "apacorp.com",
    "존슨앤드존슨": "jnj.com",
    "패스널": "fastenal.com",
    "엔비디아": "nvidia.com",
    "알리바바": "alibaba.com",
    "SK텔레콤": "sktelecom.com",
    "신한지주": "shinhangroup.com",
    "페이첵스": "paychex.com",
    "록히드 마틴": "lockheedmartin.com",
    "리전스 파이낸셜": "regions.com",
    "기아": "kia.com",
    "현대자동차": "hyundai.com",
    "슐럼버거": "slb.com",
    "인스페리티": "insperity.com",
    "비자": "visa.com",
    "코노코필립스": "conocophillips.com",
    "WW 그레인저": "grainger.com",
    "포드 모터": "ford.com",
    "애플랙": "aflac.com",
    "처치 앤드 드와이트": "churchdwight.com",
    "펜스케 오토모티브": "penskeautomotive.com",
    "머피 오일": "murphyoilcorp.com",
    "델 테크놀로지스": "dell.com",
    "홈디포": "homedepot.com",
    "린드": "linde.com",
    "퀄컴": "qualcomm.com",
    "프린서플 파이낸셜": "principal.com",
    "브로드리지": "broadridge.com",
    "이선 알렌": "ethanallen.com",
    "HF 싱클레어": "hfsinclair.com",
    "브로드컴": "broadcom.com",
    "펩시코": "pepsico.com",
    "킴벌리클라크": "kimberly-clark.com",
    "CH 로빈슨": "chrobinson.com",
    "앰코": "amcor.com",
    "제뉴인 파츠": "genpt.com",
    "올드 리퍼블릭": "oldrepublic.com",
    "UPS": "ups.com",
    "CNA 파이낸셜": "cna.com",
    "룰루레몬": "lululemon.com",
    "스탠리 블랙 앤 데커": "stanleyblackanddecker.com",
    "케이티앤지": "ktng.com",
    "벡턴 디킨슨": "bd.com",
    "애트모스 에너지": "atmosenergy.com",
    "노드슨": "nordson.com",
    "아처 대니얼스 미들랜드": "adm.com",
    "처브": "chubb.com",
    "ADP": "adp.com",
    "알버말": "albemarle.com",
    "플라워스 푸즈": "flowersfoods.com",
    "일라이 릴리": "lilly.com",
    "엑슨 모빌": "exxonmobil.com",
    "셰브론": "chevron.com",
    "에머슨 일렉트릭": "emerson.com",
    "스냅 온": "snapon.com",
    "오라클": "oracle.com",
    "어도비": "adobe.com",
    "크로거": "kroger.com",
    "유나이티드헬스": "unitedhealthgroup.com",
    "암젠": "amgen.com",
    "셔윈-윌리엄즈": "sherwin-williams.com",
    "코카콜라": "coca-colacompany.com",
    "머크": "merck.com",
    "알트리아": "altria.com",
    "이콜랩": "ecolab.com",
    "데번 에너지": "devonenergy.com",
    "티 로 프라이스": "troweprice.com",
    "메이시스": "macys.com",
    "아레스 매니지먼트": "aresmgmt.com",
    "피델리티 내셔널 파이낸셜": "fnf.com",
    "웨스턴 유니언": "westernunion.com",
    "넥스트에라 에너지": "nexteraenergy.com",
    "신타스": "cintas.com",
    "허쉬": "thehersheycompany.com",
    "도버": "dovercorporation.com",
    "오토리브": "autoliv.com",
    "로버트 하프": "roberthalf.com",
    "웬디스": "wendys.com",
    "베스트 바이": "bestbuy.com",
    "맥도날드": "mcdonalds.com",
    "팩트셋": "factset.com",
    "모엘리스": "moelis.com",
    "페덱스": "fedex.com",
    "현대엘리베이터": "hyundaielevator.co.kr",
    "신시내티 파이낸셜": "cinfin.com",
    "다든 레스토랑": "darden.com",
    "메드트로닉": "medtronic.com",
    "코스트코": "costco.com",
    "일리노이 툴 웍스": "itw.com",
    "프랭클린 리소시스": "franklinresources.com",
    "에어 프로덕츠": "airproducts.com",
    "카디널 헬스": "cardinalhealth.com",
    "CVB 파이낸셜": "cvbf.com",
    "EOG 리소시스": "eogresources.com",
    "JP모간 체이스": "jpmorganchase.com",
    "LG에너지솔루션": "lgensol.com",
    "OFG 뱅코프": "ofgbancorp.com",
    "TSMC": "tsmc.com",
    "나이키": "nike.com",
    "두산에너빌리티": "doosanenerbility.com",
    "램 웨스턴": "lambweston.com",
    "로우스": "lowes.com",
    "로퍼 테크놀로지스": "ropertech.com",
    "버라이즌": "verizon.com",
    "버클": "buckle.com",
    "베일 리조츠": "vailresorts.com",
    "브리스톨 마이어스 스퀴브": "bms.com",
    "시스코": "sysco.com",
    "아마존": "amazon.com",
    "애보트": "abbott.com",
    "애브비": "abbvie.com",
    "애플": "apple.com",
    "에니스": "ennis.com",
    "에섹스 프라퍼티": "essexapartmenthomes.com",
    "옥스포드 인더스트리스": "oxfordinc.com",
    "이리 인뎀너티": "erieinsurance.com",
    "제너럴 다이내믹스": "gd.com",
    "컨스털레이션 브랜즈": "cbrands.com",
    "컴캐스트": "comcast.com",
    "켄뷰": "kenvue.com",
    "콘 페리": "kornferry.com",
    "콜게이트 팜올리브": "colgatepalmolive.com",
    "크로락스": "thecloroxcompany.com",
    "퍼스트 파이낸셜": "first-online.bank",
    "페더럴 리얼티": "federalrealty.com",
    "펜테어": "pentair.com",
    "프리퍼드 뱅크": "preferredbank.com",
    "피프스 서드 뱅코프": "53.com",
    "한국콜마": "kolmar.co.kr",
    "현대건설": "hdec.kr",
    "호멜 푸즈": "hormelfoods.com"
  };

  function getCompanyDomain(ev){
    return (ev.company && CALENDAR_LOGO_DOMAINS[ev.company]) || null;
  }

  function buildStockFallbackHtml(ev, ticker, hidden){
    var hiddenStyle = hidden ? "display:none;" : "";
    if (ev.flag === "us" && ticker) {
      var color = getStableBadgeColor(ticker);
      return '<span class="calendar-event-logo-fallback ticker-badge" style="' + hiddenStyle + 'background:' + color + ';">' + ticker + '</span>';
    }
    return '<span class="calendar-event-logo-fallback neutral-icon" style="' + hiddenStyle + '"><i class="ph-duotone ph-briefcase"></i></span>';
  }

  function wrapLogoImgHtml(src, alt, fallbackHtml){
    return '' +
      '<span class="calendar-event-icon-circle has-logo">' +
        '<img class="calendar-event-logo-img" src="' + src + '" alt="' + (alt || "") + '" ' +
          'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">' +
        fallbackHtml +
      '</span>';
  }

  function resolveStockIconHtml(ev){
    var ticker = getEventTicker(ev);
    var fallbackHtml = buildStockFallbackHtml(ev, ticker, false);

    if (ev.logo) {
      return wrapLogoImgHtml(ev.logo, ev.company, buildStockFallbackHtml(ev, ticker, true));
    }
    var domain = getCompanyDomain(ev);
    if (domain && brandfetchClientId) {
      var src = "https://cdn.brandfetch.io/" + domain + "?c=" + encodeURIComponent(brandfetchClientId);
      return wrapLogoImgHtml(src, ev.company, buildStockFallbackHtml(ev, ticker, true));
    }
    return '<span class="calendar-event-icon-circle">' + fallbackHtml + '</span>';
  }

  function resolveEventIconHtml(ev){
    var flagEmoji = ev.flag === "us" ? "🇺🇸" : "🇰🇷";

    if (ev.category === "stock") {
      return resolveStockIconHtml(ev);
    }
    if (ev.category === "realestate") {
      return '<span class="calendar-event-icon-circle realestate-icon"><i class="ph-duotone ph-buildings"></i></span>';
    }
    if (ev.category === "tax") {
      return '<span class="calendar-event-icon-circle tax-icon"><i class="ph-duotone ph-receipt"></i></span>';
    }
    if (ev.category === "subsidy") {
      return '<span class="calendar-event-icon-circle subsidy-icon"><i class="ph-duotone ph-gift"></i></span>';
    }
    if (ev.category === "ipo") {
      return '' +
        '<span class="calendar-event-icon-circle ipo-icon">' +
          '<span class="calendar-event-ipo-mark">IPO</span>' +
          '<span class="calendar-event-flag-badge">' + flagEmoji + '</span>' +
        '</span>';
    }
    if (ev.category === "personal") {
      return '<span class="calendar-event-icon-circle personal-icon"><i class="ph-duotone ph-user"></i></span>';
    }
    // economy(경제·경제지표) 등 그 외 카테고리는 국기 이모지 유지 — 특정 기업이 아니라 국가 단위 지표라서.
    return '<span class="calendar-event-icon-circle economy-icon">' + flagEmoji + '</span>';
  }

  var calendarViewYear = new Date().getFullYear();
  var calendarViewMonth = new Date().getMonth();
  var calendarActiveFilterFromUrl = getCalendarUrlParam("calFilter");
  var calendarActiveFilter = (calendarActiveFilterFromUrl && CALENDAR_FILTER_OPTIONS.some(function(o){ return o.key === calendarActiveFilterFromUrl; }))
    ? calendarActiveFilterFromUrl : "all";
  var calendarSelectedDay = null;
  var calendarSelectedDayExpanded = false;
  var CALENDAR_VIEW_MODE_KEY = "fincalc_calendar_view_mode";
  var calendarViewModeFromUrl = getCalendarUrlParam("calMode");
  var CALENDAR_VIEW_MODES = ["week", "month"];
  var calendarViewMode = CALENDAR_VIEW_MODES.indexOf(calendarViewModeFromUrl) > -1
    ? calendarViewModeFromUrl
    : (function(){
        try { var saved = localStorage.getItem(CALENDAR_VIEW_MODE_KEY); return CALENDAR_VIEW_MODES.indexOf(saved) > -1 ? saved : "week"; }
        catch (e) { return "week"; }
      })();
  var calendarExpandedPastDates = {};

  function renderCalendarGrid(){
    var grid = document.getElementById("calendarGrid");
    var label = document.getElementById("calendarMonthLabel");
    if (!grid || !label) return;

    var year = calendarViewYear;
    var month = calendarViewMonth;
    var numDays = new Date(year, month + 1, 0).getDate();
    var firstDow = new Date(year, month, 1).getDay();
    var prevMonthDays = new Date(year, month, 0).getDate();

    // 날짜 칸에는 일정 제목을 여러 개 늘어놓지 않고 카테고리별 작은 점(최대 3개, 색+아이콘은 없이
    // 색상 자체는 CALENDAR_CATEGORY_META와 동일)과 "+N", 매우중요 일정이 있으면 강조 점을 함께 보여준다.
    // 색상만으로 구분하지 않기 위해 실제 카테고리 구분은 날짜를 눌렀을 때 열리는 카드 목록(아이콘+텍스트)에서 한다.
    var eventsByDay = {};
    CALENDAR_EVENTS.forEach(function(ev){
      if (!calendarFilterMatches(ev, calendarActiveFilter)) return;
      var d = new Date(ev.date + "T00:00:00");
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      var day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(ev);
    });

    var today = new Date();
    var cellsHtml = "";

    for (var i = 0; i < firstDow; i++) {
      var prevDay = prevMonthDays - firstDow + 1 + i;
      cellsHtml += '<div class="calendar-day-cell other-month"><span class="calendar-day-num">' + prevDay + '</span></div>';
    }
    for (var day = 1; day <= numDays; day++) {
      var isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
      var isSelected = calendarSelectedDay === day;
      var dayEvents = eventsByDay[day] || [];
      var hasImportant = dayEvents.some(function(ev){ return getEventImportance(ev) === "매우중요"; });
      var seenCats = [];
      dayEvents.forEach(function(ev){ if (seenCats.indexOf(ev.category) === -1) seenCats.push(ev.category); });
      var dotsHtml = seenCats.slice(0, 3).map(function(cat){
        var meta = CALENDAR_CATEGORY_META[cat];
        return '<span class="calendar-day-dot" style="background:' + (meta ? meta.color : "#585CE5") + '"></span>';
      }).join("");
      var extraCount = dayEvents.length > 3 ? dayEvents.length - 3 : (seenCats.length > 3 ? dayEvents.length - 3 : 0);
      cellsHtml +=
        '<div class="calendar-day-cell' + (isToday ? ' is-today' : '') + (isSelected ? ' is-selected' : '') + (hasImportant ? ' has-important' : '') + '" data-day="' + day + '">' +
          '<span class="calendar-day-num">' + day + '</span>' +
          (dayEvents.length ? '<span class="calendar-day-dots">' + dotsHtml + (extraCount > 0 ? '<span class="calendar-day-extra">+' + extraCount + '</span>' : '') + '</span>' : '') +
        '</div>';
    }
    var totalCells = firstDow + numDays;
    var remainCells = (7 - (totalCells % 7)) % 7;
    for (var n = 1; n <= remainCells; n++) {
      cellsHtml += '<div class="calendar-day-cell other-month"><span class="calendar-day-num">' + n + '</span></div>';
    }

    grid.innerHTML = cellsHtml;
    label.textContent = year + "년 " + (month + 1) + "월";

    grid.querySelectorAll(".calendar-day-cell[data-day]").forEach(function(cell){
      cell.addEventListener("click", function(){
        var clickedDay = Number(cell.dataset.day);
        calendarSelectedDay = calendarSelectedDay === clickedDay ? null : clickedDay;
        calendarSelectedDayExpanded = false;
        renderCalendarGrid();
        renderCalendarSelectedDayPanel();
        if (calendarSelectedDay !== null && typeof gtag === "function") gtag("event", "calendar_date_selected", { view_mode: calendarViewMode });
      });
    });
  }

  function scrollToTodayInCalendar(smooth){
    var today = new Date();
    if (calendarViewYear !== today.getFullYear() || calendarViewMonth !== today.getMonth()) return;

    var todayStr = formatDateYMD(today);
    var groupEl = document.getElementById("calDate-" + todayStr);

    if (!groupEl) {
      var groups = document.querySelectorAll(".calendar-date-group");
      for (var i = 0; i < groups.length; i++) {
        var ds = groups[i].id.slice("calDate-".length);
        if (ds >= todayStr) { groupEl = groups[i]; break; }
      }
    }
    if (!groupEl) return;
    groupEl.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }

  function renderCalendarFilters(){
    var pillsHtml = CALENDAR_FILTER_OPTIONS.map(function(opt){
      return '<button type="button" class="calendar-filter-pill' + (opt.key === calendarActiveFilter ? ' active' : '') + '" data-cat="' + opt.key + '" aria-pressed="' + (opt.key === calendarActiveFilter) + '">' +
        '<i class="ph-duotone ' + opt.icon + '"></i>' + opt.label +
      '</button>';
    }).join("");

    ["calendarFilterPills", "calendarFilterPillsWeek"].forEach(function(wrapId){
      var wrap = document.getElementById(wrapId);
      if (!wrap) return;
      wrap.innerHTML = pillsHtml;
      wrap.querySelectorAll(".calendar-filter-pill").forEach(function(btn){
        btn.addEventListener("click", function(){
          calendarActiveFilter = btn.getAttribute("data-cat");
          setCalendarUrlState({ calFilter: calendarActiveFilter === "all" ? null : calendarActiveFilter });
          renderCalendarFilters();
          renderCalendarSelectedDayPanel();
          renderCalendarTimeline();
          renderCalendarActiveMode();
          if (typeof gtag === "function") gtag("event", "calendar_filter_selected", { filter: calendarActiveFilter });
        });
      });
    });
  }

  function setCalendarUrlState(patch){
    try {
      var url = new URL(window.location.href);
      Object.keys(patch).forEach(function(key){
        if (patch[key] == null) url.searchParams.delete(key);
        else url.searchParams.set(key, patch[key]);
      });
      window.history.replaceState(null, "", url.toString());
    } catch (e) { /* URL API 미지원 환경은 조용히 무시 */ }
  }

  function getCalendarUrlParam(key){
    try { return new URL(window.location.href).searchParams.get(key); }
    catch (e) { return null; }
  }

  function buildCalendarEventRowHtml(ev, todayStr){
    var catMeta = CALENDAR_CATEGORY_META[ev.category];
    var tagColors = CALENDAR_TYPE_COLORS[ev.type] || catMeta;
    var globalIdx = CALENDAR_EVENTS.indexOf(ev);
    var dDayLabel = calendarDDayLabel(ev.date, todayStr);
    return '' +
      '<div class="calendar-event-row" id="calendarEvent-' + globalIdx + '" data-event-idx="' + globalIdx + '">' +
        resolveEventIconHtml(ev) +
        '<div class="calendar-event-body">' +
          '<span class="calendar-event-cat" style="color:' + tagColors.color + ';background:' + tagColors.bg + '">' + catMeta.label + ' · ' + ev.type + '</span>' +
          '<p class="calendar-event-title">' + ev.title + '</p>' +
          (ev.meta ? '<p class="calendar-event-meta">' + ev.meta + '</p>' : '') +
        '</div>' +
        (dDayLabel ? '<span class="calendar-event-dday' + (dDayLabel === "D-DAY" ? " is-today" : "") + '">' + dDayLabel + '</span>' : '') +
        (ev.status ? '<span class="calendar-event-status ' + calendarStatusClass(ev.status) + '">' + ev.status + '</span>' : '') +
        (ev.needsReview ? '<span class="calendar-event-status calendar-event-status--review">검수 필요</span>' : '') +
      '</div>';
  }

  function calendarStatusClass(status){
    if (status === "취소") return "calendar-event-status--cancel";
    if (status === "연기") return "calendar-event-status--delay";
    if (status === "변경") return "calendar-event-status--change";
    if (status === "종료") return "calendar-event-status--closed";
    return "";
  }

  function renderCalendarSelectedDayPanel(){
    var panel = document.getElementById("calendarSelectedDayPanel");
    if (!panel) return;

    if (calendarSelectedDay === null) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }

    var year = calendarViewYear;
    var month = calendarViewMonth;
    var dateStr = year + "-" + pad2(month + 1) + "-" + pad2(calendarSelectedDay);
    var todayStr = formatDateYMD(new Date());
    var d = new Date(dateStr + "T00:00:00");
    var weekday = CALENDAR_WEEKDAY_FULL_KO[d.getDay()];

    var dayEvents = CALENDAR_EVENTS.filter(function(ev){
      return ev.date === dateStr && calendarFilterMatches(ev, calendarActiveFilter);
    });

    var SHOW_LIMIT = 3;
    var isExpanded = !!calendarSelectedDayExpanded;
    var visibleEvents = isExpanded ? dayEvents : dayEvents.slice(0, SHOW_LIMIT);
    var rowsHtml = dayEvents.length
      ? visibleEvents.map(function(ev){ return buildCalendarEventRowHtml(ev, todayStr); }).join("")
      : '<p class="calendar-selected-day-empty">이 날짜엔 일정이 없어요</p>';
    var moreHtml = (!isExpanded && dayEvents.length > SHOW_LIMIT)
      ? '<button type="button" class="calendar-selected-day-more" id="calendarSelectedDayMoreBtn">일정 ' + dayEvents.length + '개 모두 보기</button>'
      : "";

    panel.innerHTML =
      '<div class="calendar-selected-day-heading">' +
        '<span>' + (month + 1) + '월 ' + calendarSelectedDay + '일 · ' + weekday + (dateStr === todayStr ? ' · 오늘' : '') + '</span>' +
        '<button type="button" class="calendar-selected-day-close" id="calendarSelectedDayCloseBtn" aria-label="닫기"><i class="ph-duotone ph-x"></i></button>' +
      '</div>' +
      '<div class="calendar-selected-day-events">' + rowsHtml + '</div>' + moreHtml;
    panel.hidden = false;

    var moreBtn = document.getElementById("calendarSelectedDayMoreBtn");
    if (moreBtn) moreBtn.addEventListener("click", function(){ calendarSelectedDayExpanded = true; renderCalendarSelectedDayPanel(); });

    var closeBtn = document.getElementById("calendarSelectedDayCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", function(){
        calendarSelectedDay = null;
        renderCalendarGrid();
        renderCalendarSelectedDayPanel();
      });
    }
    panel.querySelectorAll(".calendar-event-row[data-event-idx]").forEach(function(row){
      row.addEventListener("click", function(){
        var ev = CALENDAR_EVENTS[Number(row.getAttribute("data-event-idx"))];
        if (ev) { trackCalendarEventViewed(ev); openCalendarDetail(ev); }
      });
    });
  }

  function renderCalendarTimeline(){
    var wrap = document.getElementById("calendarTimeline");
    if (!wrap) return;

    var year = calendarViewYear;
    var month = calendarViewMonth;

    var monthEvents = CALENDAR_EVENTS.filter(function(ev){
      var d = new Date(ev.date + "T00:00:00");
      return d.getFullYear() === year && d.getMonth() === month &&
        calendarFilterMatches(ev, calendarActiveFilter);
    });

    if (monthEvents.length === 0) {
      wrap.innerHTML =
        '<div class="calendar-empty">' +
          '<span class="calendar-empty-icon"><i class="ph-duotone ph-calendar-x"></i></span>' +
          '<p>이 달에는 해당 조건의 일정이 없어요</p>' +
        '</div>';
      return;
    }

    var grouped = {};
    var order = [];
    monthEvents.forEach(function(ev){
      if (!grouped[ev.date]) { grouped[ev.date] = []; order.push(ev.date); }
      grouped[ev.date].push(ev);
    });

    // 오늘 → 다가올 일정(오름차순) → 지난 일정(내림차순, 접힘) 순서로 재배열한다.
    // "최신 날짜가 위"가 아니라 "오늘이 항상 최상단"이 되도록, 오늘을 기준으로 미래/과거를 따로 나눠 붙인다.
    var todayStr = formatDateYMD(new Date());
    var todayGroup = [], futureDates = [], pastDates = [];
    order.forEach(function(dateStr){
      if (dateStr === todayStr) todayGroup.push(dateStr);
      else if (dateStr > todayStr) futureDates.push(dateStr);
      else pastDates.push(dateStr);
    });
    futureDates.sort();
    pastDates.sort();
    pastDates.reverse(); // 가장 최근 과거가 먼저 오도록
    var finalOrder = todayGroup.concat(futureDates).concat(pastDates);

    wrap.innerHTML = finalOrder.map(function(dateStr){
      var d = new Date(dateStr + "T00:00:00");
      var dayNum = d.getDate();
      var weekday = CALENDAR_WEEKDAY_FULL_KO[d.getDay()];
      var isToday = dateStr === todayStr;
      var isPast = dateStr < todayStr;
      var isExpanded = !isPast || !!calendarExpandedPastDates[dateStr];

      var rowsHtml = grouped[dateStr].map(function(ev){ return buildCalendarEventRowHtml(ev, todayStr); }).join("");

      var groupClass = "calendar-date-group" + (isPast ? " is-past" : "") + (isPast && !isExpanded ? " is-collapsed" : "");
      var headingExtra =
        (isToday ? '<span class="calendar-date-today-badge">오늘</span>' : "") +
        (isPast ? '<span class="calendar-date-count">' + grouped[dateStr].length + '건</span><i class="ph-duotone ph-caret-down calendar-date-chevron"></i>' : "");

      return '' +
        '<div class="' + groupClass + '" id="calDate-' + dateStr + '" data-date="' + dateStr + '">' +
          '<div class="calendar-date-heading">' +
            '<span class="calendar-date-num">' + dayNum + '</span>' +
            '<span class="calendar-date-weekday">' + weekday + '</span>' +
            headingExtra +
          '</div>' +
          '<div class="calendar-date-events">' + rowsHtml + '</div>' +
        '</div>';
    }).join("");

    // 지난 날짜 헤딩만 클릭해서 펼치고/접을 수 있게 한다 (오늘·미래는 항상 펼쳐진 상태).
    wrap.querySelectorAll(".calendar-date-group.is-past .calendar-date-heading").forEach(function(heading){
      heading.addEventListener("click", function(){
        var group = heading.parentElement;
        var ds = group.getAttribute("data-date");
        var nowExpanded = !calendarExpandedPastDates[ds];
        calendarExpandedPastDates[ds] = nowExpanded;
        group.classList.toggle("is-collapsed", !nowExpanded);
      });
    });

    wrap.querySelectorAll(".calendar-event-row[data-event-idx]").forEach(function(row){
      row.addEventListener("click", function(){
        var ev = CALENDAR_EVENTS[Number(row.getAttribute("data-event-idx"))];
        if (ev) { trackCalendarEventViewed(ev); openCalendarDetail(ev); }
      });
    });
  }

  function trackCalendarEventViewed(ev){
    if (typeof gtag !== "function") return;
    gtag("event", "calendar_event_viewed", { category: ev.category || "", is_personal: !!ev.isPersonal });
    if (ev.category === "ipo") gtag("event", "ipo_detail_viewed", { category: ev.category });
    if (ev.category === "realestate") gtag("event", "housing_subscription_viewed", { category: ev.category });
  }

  function getCalendarActionButtons(ev){
    var list = [];
    if (ev.category === "economy") {
      list.push({ label: "관련 뉴스 보기", icon: "ph-newspaper", action: "news" });
      list.push({ label: "예금 계산하기", icon: "ph-bank", action: "calc:deposit" });
      list.push({ label: "대출이자 계산하기", icon: "ph-percent", action: "calc:loan" });
    } else if (ev.category === "stock") {
      if (ev.type === "배당") list.push({ label: "배당금 계산기", icon: "ph-money", action: "calc:dividend" });
      if (ev.sourceUrl) list.push({ label: "DART 원문 보기", icon: "ph-file-text", action: "source", external: true });
    } else if (ev.category === "ipo") {
      if (ev.sourceUrl) list.push({ label: "DART 원문 보기", icon: "ph-file-text", action: "source", external: true });
    } else if (ev.category === "realestate") {
      list.push({ label: "청약가점 계산기", icon: "ph-medal", action: "calc:subscription" });
      if (ev.sourceUrl) list.push({ label: "청약홈 원문 보기", icon: "ph-file-text", action: "source", external: true });
    } else if (ev.category === "subsidy") {
      if (ev.sourceUrl) list.push({ label: "공식 신청 페이지", icon: "ph-arrow-square-out", action: "source", external: true });
    } else if (ev.category === "tax") {
      list.push({ label: "관련 계산기 보기", icon: "ph-calculator", action: "view:taxpilot" });
    }
    return list;
  }

  // 원본(index.html:6728)과 다른 점: activateView("news")/activateView("taxpilot") 대신 실제
  // 페이지 이동을 쓴다 — 이 독립 페이지엔 다른 화면을 켜는 activateView 자체가 없기 때문("전체 앱
  // 화면은 별도 진입 경로에서만 로드"). 계산기(calc:)·외부 출처(source) 분기는 원본과 동일.
  function runCalendarAction(action, ev) {
    if (typeof gtag === "function") gtag("event", "calendar_action_clicked", { category: ev.category || "", action_type: action });
    if (action === "news") { location.href = "/news/"; return; }
    if (action === "view:taxpilot") { location.href = "/taxpilot/"; return; }
    if (action.indexOf("calc:") === 0) { closeCalendarDetail(); if (window.openFinCalc) openFinCalc(action.slice(5)); return; }
    if (action === "source" && ev.sourceUrl) {
      if (typeof gtag === "function") gtag("event", "official_source_clicked", { category: ev.category || "" });
      window.open(ev.sourceUrl, "_blank", "noopener,noreferrer");
    }
  }

  function getReminderTypesForEvent(ev){
    if (!ev.id) return [];
    if (ev.category === "ipo") {
      var types = [];
      if (ev.date) types.push({ key: "start", docId: ev.id + "__start", label: "청약 시작 알림", date: ev.date });
      if (ev.endDate) types.push({ key: "end", docId: ev.id + "__end", label: "청약 마감 알림", date: String(ev.endDate).slice(0, 10) });
      if (ev.refundDate) types.push({ key: "refund", docId: ev.id + "__refund", label: "환불일 알림", date: String(ev.refundDate).slice(0, 10) });
      return types;
    }
    return ev.date ? [{ key: "default", docId: ev.id, label: "알림 받기", date: ev.date }] : [];
  }

  function renderCalDetailReminders(ev){
    var group = document.getElementById("calDetailRemindGroup");
    if (!group) return;
    var types = getReminderTypesForEvent(ev);
    var currentUser = firebaseAuth.currentUser;
    if (!types.length) { group.innerHTML = ""; return; }
    if (!currentUser) {
      group.innerHTML = types.map(function(t){
        return '<button type="button" class="calendar-detail-remind-btn-v2" data-need-login="1"><i class="ph-duotone ph-bell"></i>' + t.label + '</button>';
      }).join("");
      group.querySelectorAll("[data-need-login]").forEach(function(btn){
        btn.addEventListener("click", function(){ showToast("로그인 후 알림을 켤 수 있어요", "ph-lock-simple"); });
      });
      return;
    }
    group.innerHTML = types.map(function(t){
      return '<button type="button" class="calendar-detail-remind-btn-v2" data-doc-id="' + t.docId + '"><i class="ph-duotone ph-bell"></i><span>' + t.label + '</span></button>';
    }).join("");
    types.forEach(function(t){
      var btn = group.querySelector('[data-doc-id="' + t.docId + '"]');
      if (!btn) return;
      var reminderRef = db.collection("users").doc(currentUser.uid).collection("eventReminders").doc(t.docId);
      reminderRef.get().then(function(docSnap){
        var isOn = docSnap.exists;
        btn.classList.toggle("is-on", isOn);
        btn.querySelector("span").textContent = isOn ? t.label.replace("알림", "알림 취소") : t.label;
        btn.onclick = function(){
          if (isOn) {
            reminderRef.delete().then(function(){ renderCalDetailReminders(ev); });
          } else {
            reminderRef.set({
              eventId: t.docId,
              eventTitle: ev.title || "",
              eventMeta: t.label,
              eventDate: t.date,
              createdAt: new Date()
            }).then(function(){
              renderCalDetailReminders(ev);
              showToast("알림을 켰어요 (D-1, D-Day 오전에 발송)", "ph-bell-ringing");
              if (typeof gtag === "function") gtag("event", "calendar_alert_enabled", { category: ev.category || "" });
            });
          }
        };
      });
    });
  }

  function openCalendarDetail(ev){
    var catMeta = CALENDAR_CATEGORY_META[ev.category] || { label: ev.category || "", color: "#585CE5", bg: "rgba(88,92,229,0.10)" };
    var catEl = document.getElementById("calDetailCat");
    catEl.textContent = catMeta.label;
    catEl.style.color = catMeta.color;
    catEl.style.background = catMeta.bg;

    // 1. 일정명과 상태
    document.getElementById("calDetailTitle").textContent = ev.title || "";
    var statusEl = document.getElementById("calDetailStatus");
    if (ev.status) {
      statusEl.hidden = false;
      statusEl.textContent = ev.status;
      statusEl.className = "calendar-detail-status-v2 " + calendarStatusClass(ev.status);
    } else {
      statusEl.hidden = true;
    }
    var importance = getEventImportance(ev);
    var impMeta = CALENDAR_IMPORTANCE_META[importance];
    var impEl = document.getElementById("calDetailImportance");
    if (impMeta && importance !== "일반") {
      impEl.hidden = false;
      impEl.className = "calendar-detail-importance-v2 importance-" + importance;
      impEl.innerHTML = '<i class="' + impMeta.icon + '"></i>' + impMeta.label;
    } else {
      impEl.hidden = true;
    }

    // 2. 날짜와 시간(한국 시간 기준)
    var d = new Date(ev.date + "T00:00:00+09:00");
    document.getElementById("calDetailDate").textContent =
      d.getFullYear() + "년 " + (d.getMonth() + 1) + "월 " + d.getDate() + "일 (" + CALENDAR_WEEKDAY_FULL_KO[d.getDay()].charAt(0) + ")" +
      (ev.meta ? " · " + ev.meta : "");

    // 3. 쉬운 설명
    var descEl = document.getElementById("calDetailDesc");
    var descText = getEventDescription(ev);
    if (descText) { descEl.hidden = false; descEl.textContent = descText; } else { descEl.hidden = true; }

    // 4. 나에게 미칠 수 있는 영향(일반적 설명, 확정적 전망 아님)
    var impactEl = document.getElementById("calDetailImpact");
    var impactText = getEventImpactText(ev);
    if (impactText) {
      impactEl.hidden = false;
      document.getElementById("calDetailImpactText").textContent = impactText;
    } else {
      impactEl.hidden = true;
    }

    // 5. 세부 데이터
    var labels = window.CALENDAR_DETAIL_LABELS || {};
    var details = ev.details || {};
    var fieldsEl = document.getElementById("calDetailFields");
    fieldsEl.innerHTML = Object.keys(details).filter(function(k){ return details[k]; }).map(function(k){
      return '<div class="calendar-detail-field-row"><span class="calendar-detail-field-label">' + (labels[k] || k) +
        '</span><span class="calendar-detail-field-value">' + escapeMyPageHtml(details[k]) + '</span></div>';
    }).join("");

    // 6. 관련 계산기 또는 기능 — 실제 존재하는 라우트만 연결
    var actionsEl = document.getElementById("calDetailActions");
    var actions = getCalendarActionButtons(ev);
    if (actions.length) {
      actionsEl.hidden = false;
      actionsEl.innerHTML = actions.map(function(a, i){
        return '<button type="button" class="calendar-detail-action-btn" data-action-idx="' + i + '">' +
          '<i class="ph-duotone ' + a.icon + '"></i>' + a.label + (a.external ? '<i class="ph-duotone ph-arrow-square-out calendar-detail-action-ext"></i>' : "") +
        '</button>';
      }).join("");
      actionsEl.querySelectorAll("[data-action-idx]").forEach(function(btn, i){
        btn.addEventListener("click", function(){ runCalendarAction(actions[i].action, ev); });
      });
    } else {
      actionsEl.hidden = true;
    }

    // 7. 알림 설정(공모주 등은 여러 유형)
    renderCalDetailReminders(ev);

    // 8. 공식 출처와 원문 — 외부 사이트 이동임을 명확히 표시
    var linkEl = document.getElementById("calDetailLink");
    var linkUrl = ev.link || ev.sourceUrl || "";
    if (linkUrl) {
      linkEl.href = linkUrl;
      linkEl.hidden = false;
      document.getElementById("calDetailLinkLabel").textContent = getEventSourceLabel(ev) + "에서 원문 보기(외부 사이트로 이동)";
      linkEl.onclick = function(){
        if (typeof gtag === "function") gtag("event", "official_source_clicked", { category: ev.category || "" });
      };
    } else {
      linkEl.hidden = true;
    }

    // 9. 최종 업데이트 시각
    var updatedEl = document.getElementById("calDetailUpdatedAt");
    var updatedText = formatCalendarTimestamp(ev.lastSeenAt || ev.updatedAt);
    if (updatedText) {
      updatedEl.hidden = false;
      updatedEl.textContent = "출처: " + getEventSourceLabel(ev) + " · 마지막 업데이트 " + updatedText + " (KST)";
    } else {
      updatedEl.hidden = true;
    }

    // 10. 면책 문구는 정적 텍스트라 HTML에 고정돼 있음(위에서 별도 처리 없음)

    var deleteBtn = document.getElementById("calDetailDeleteBtn");
    var currentUser = firebaseAuth.currentUser;
    deleteBtn.hidden = !ev.isPersonal;
    deleteBtn.onclick = function(){
      if (!ev.isPersonal || !currentUser) return;
      if (!confirm("이 개인 일정을 삭제할까요?")) return;
      db.collection("users").doc(currentUser.uid).collection("personalEvents").doc(ev.id).delete().then(function(){
        closeCalendarDetail();
      });
    };

    document.getElementById("calDetailOverlay").hidden = false;
  }

  function closeCalendarDetail(){
    document.getElementById("calDetailOverlay").hidden = true;
  }

  (function initCalendarDetailModal(){
    var overlay = document.getElementById("calDetailOverlay");
    var closeBtn = document.getElementById("calDetailCloseBtn");
    if (!overlay || !closeBtn) return;
    closeBtn.addEventListener("click", closeCalendarDetail);
    overlay.addEventListener("click", function(e){
      if (e.target === overlay) closeCalendarDetail();
    });
  })();

  function changeCalendarMonth(delta){
    calendarViewMonth += delta;
    if (calendarViewMonth < 0) { calendarViewMonth = 11; calendarViewYear -= 1; }
    if (calendarViewMonth > 11) { calendarViewMonth = 0; calendarViewYear += 1; }
    calendarSelectedDay = null;
    renderCalendarGrid();
    renderCalendarSelectedDayPanel();
    renderCalendarTimeline();
  }

  var calendarPrevBtn = document.getElementById("calendarPrevBtn");
  var calendarNextBtn = document.getElementById("calendarNextBtn");
  if (calendarPrevBtn) calendarPrevBtn.addEventListener("click", function(){ changeCalendarMonth(-1); });
  if (calendarNextBtn) calendarNextBtn.addEventListener("click", function(){ changeCalendarMonth(1); });

  function calendarDDayLabel(dateStr, todayStr){
    var diffDays = Math.round((new Date(dateStr + "T00:00:00") - new Date(todayStr + "T00:00:00")) / 86400000);
    if (diffDays < 0) return null;
    if (diffDays === 0) return "D-DAY";
    return "D-" + diffDays;
  }

  function persistCalendarViewMode(mode){
    try { localStorage.setItem(CALENDAR_VIEW_MODE_KEY, mode); } catch (e) { /* 저장 실패는 무시(동작엔 지장 없음) */ }
  }

  function activateCalendarMode(mode, skipTrack){
    calendarViewMode = mode;
    persistCalendarViewMode(mode);
    setCalendarUrlState({ calMode: mode === "week" ? null : mode });

    document.querySelectorAll(".calendar-mode-tab").forEach(function(tab){
      var isActive = tab.getAttribute("data-mode") === mode;
      tab.classList.toggle("active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    var wraps = { week: "calendarWeekModeWrap", month: "calendarMonthModeWrap", mine: "calendarMineModeWrap" };
    Object.keys(wraps).forEach(function(key){
      var el = document.getElementById(wraps[key]);
      if (el) el.hidden = key !== mode;
    });

    renderCalendarActiveMode();
    if (!skipTrack && typeof gtag === "function") gtag("event", "calendar_mode_selected", { view_mode: mode });
  }

  function renderCalendarActiveMode(){
    if (calendarViewMode === "week") renderCalendarWeekMode();
    else if (calendarViewMode === "mine") renderCalendarMineMode();
    else { renderCalendarGrid(); renderCalendarSelectedDayPanel(); renderCalendarTimeline(); }
  }

  function initCalendarModeTabs(){
    document.querySelectorAll(".calendar-mode-tab").forEach(function(tab){
      tab.addEventListener("click", function(){
        activateCalendarMode(tab.getAttribute("data-mode"));
      });
    });
    activateCalendarMode(calendarViewMode, true);
  }

  function buildCalendarWeekCardHtml(ev, todayStr){
    var catMeta = CALENDAR_CATEGORY_META[ev.category] || { label: ev.category || "", color: "#585CE5", bg: "rgba(88,92,229,0.10)", icon: "ph-calendar" };
    var importance = getEventImportance(ev);
    var impMeta = CALENDAR_IMPORTANCE_META[importance];
    var dDayLabel = calendarDDayLabel(ev.date, todayStr);
    var globalIdx = CALENDAR_EVENTS.indexOf(ev);
    var statusHtml = ev.status ? '<span class="calendar-event-status ' + calendarStatusClass(ev.status) + '">' + ev.status + '</span>' : "";
    var rangeText = "";
    if (ev.startDate && ev.endDate) {
      rangeText = String(ev.startDate).slice(0, 10) + " ~ " + String(ev.endDate).slice(0, 10);
    }
    return '' +
      '<button type="button" class="calendar-week-card" data-event-idx="' + globalIdx + '">' +
        '<div class="calendar-week-card-row">' +
          resolveEventIconHtml(ev) +
          '<div class="calendar-week-card-body">' +
            '<div class="calendar-week-card-top">' +
              '<span class="calendar-week-card-cat" style="color:' + catMeta.color + ';background:' + catMeta.bg + '"><i class="ph-duotone ' + catMeta.icon + '"></i>' + catMeta.label + '</span>' +
              (impMeta ? '<span class="calendar-week-card-importance importance-' + importance + '"><i class="' + impMeta.icon + '"></i>' + impMeta.label + '</span>' : "") +
            '</div>' +
            '<p class="calendar-week-card-title">' + (ev.title || "") + '</p>' +
            (rangeText ? '<p class="calendar-week-card-range">' + rangeText + '</p>' : "") +
            '<div class="calendar-week-card-foot">' +
              '<span>' + (ev.date || "") + (ev.meta ? " · " + ev.meta : "") + '</span>' +
              statusHtml +
            '</div>' +
          '</div>' +
          (dDayLabel ? '<span class="calendar-event-dday calendar-week-card-dday' + (dDayLabel === "D-DAY" ? " is-today" : "") + '">' + dDayLabel + '</span>' : "") +
        '</div>' +
      '</button>';
  }

  function renderCalendarWeekSection(containerId, titleText, events, todayStr){
    var el = document.getElementById(containerId);
    if (!el) return;
    if (!events.length) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML =
      '<p class="calendar-week-section-title">' + titleText + ' <span class="calendar-week-section-count">' + events.length + '</span></p>' +
      '<div class="calendar-week-section-cards">' + events.map(function(ev){ return buildCalendarWeekCardHtml(ev, todayStr); }).join("") + '</div>';
    el.querySelectorAll("[data-event-idx]").forEach(function(card){
      card.addEventListener("click", function(){
        var ev = CALENDAR_EVENTS[Number(card.getAttribute("data-event-idx"))];
        if (ev) { trackCalendarEventViewed(ev); openCalendarDetail(ev); }
      });
    });
  }

  function renderCalendarWeekMode(){
    var body = document.getElementById("calendarWeekBody");
    if (!body) return;
    var today = new Date();
    var todayStr = formatDateYMD(today);
    var tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = formatDateYMD(tomorrow);
    var weekEnd = new Date(today); weekEnd.setDate(weekEnd.getDate() + (6 - today.getDay()));
    var weekEndStr = formatDateYMD(weekEnd);

    var relevant = CALENDAR_EVENTS.filter(function(ev){
      return ev.date >= todayStr && ev.date <= weekEndStr && calendarFilterMatches(ev, calendarActiveFilter);
    });

    if (!relevant.length) {
      body.innerHTML =
        '<div class="calendar-empty">' +
          '<span class="calendar-empty-icon"><i class="ph-duotone ph-calendar-x"></i></span>' +
          '<p>이번 주 등록된 금융 일정이 없어요</p>' +
          '<div class="calendar-empty-actions">' +
            '<button type="button" class="calendar-empty-btn" id="calendarEmptyGoMonth">월간으로 보기</button>' +
            '<button type="button" class="calendar-empty-btn" id="calendarEmptyGoAll">전체 일정 보기</button>' +
          '</div>' +
        '</div>';
      var goMonth = document.getElementById("calendarEmptyGoMonth");
      if (goMonth) goMonth.addEventListener("click", function(){ activateCalendarMode("month"); });
      var goAll = document.getElementById("calendarEmptyGoAll");
      if (goAll) goAll.addEventListener("click", function(){
        calendarActiveFilter = "all";
        setCalendarUrlState({ calFilter: null });
        renderCalendarFilters();
        activateCalendarMode("month");
      });
      return;
    }

    var urgent = relevant.filter(function(ev){ return getEventImportance(ev) === "매우중요"; });
    var urgentIds = {};
    urgent.forEach(function(ev){ urgentIds[CALENDAR_EVENTS.indexOf(ev)] = true; });
    var remaining = relevant.filter(function(ev){ return !urgentIds[CALENDAR_EVENTS.indexOf(ev)]; });
    var todays = remaining.filter(function(ev){ return ev.date === todayStr; });
    var tomorrows = remaining.filter(function(ev){ return ev.date === tomorrowStr; });
    var rest = remaining.filter(function(ev){ return ev.date !== todayStr && ev.date !== tomorrowStr; });

    body.innerHTML =
      '<div id="calWeekSecUrgent"></div>' +
      '<div id="calWeekSecToday"></div>' +
      '<div id="calWeekSecTomorrow"></div>' +
      '<div id="calWeekSecRest"></div>';
    renderCalendarWeekSection("calWeekSecUrgent", "놓치면 안 되는 일정", urgent, todayStr);
    renderCalendarWeekSection("calWeekSecToday", "오늘", todays, todayStr);
    renderCalendarWeekSection("calWeekSecTomorrow", "내일", tomorrows, todayStr);
    renderCalendarWeekSection("calWeekSecRest", "이번 주 나머지 일정", rest, todayStr);
  }

  function initCalendarSearch(){
    var input = document.getElementById("calendarSearchInput");
    var resultEl = document.getElementById("calendarSearchResult");
    if (!input || !resultEl) return;
    var debounceTimer = null;
    input.addEventListener("input", function(){
      clearTimeout(debounceTimer);
      var q = input.value.trim();
      debounceTimer = setTimeout(function(){
        if (!q) { resultEl.hidden = true; resultEl.innerHTML = ""; return; }
        var qLower = q.toLowerCase();
        var matches = CALENDAR_EVENTS.filter(function(ev){
          return calendarFilterMatches(ev, calendarActiveFilter) && (
            (ev.title || "").toLowerCase().indexOf(qLower) > -1 ||
            (ev.company || "").toLowerCase().indexOf(qLower) > -1 ||
            (ev.region || "").toLowerCase().indexOf(qLower) > -1 ||
            (ev.meta || "").toLowerCase().indexOf(qLower) > -1
          );
        }).slice(0, 30);
        var todayStr = formatDateYMD(new Date());
        resultEl.hidden = false;
        resultEl.innerHTML = matches.length
          ? '<p class="calendar-search-count">검색 결과 ' + matches.length + '건</p>' +
            '<div class="calendar-week-section-cards">' + matches.map(function(ev){ return buildCalendarWeekCardHtml(ev, todayStr); }).join("") + '</div>'
          : '<p class="calendar-search-count">검색 결과가 없어요</p>';
        resultEl.querySelectorAll("[data-event-idx]").forEach(function(card){
          card.addEventListener("click", function(){
            var ev = CALENDAR_EVENTS[Number(card.getAttribute("data-event-idx"))];
            if (ev) { trackCalendarEventViewed(ev); openCalendarDetail(ev); }
          });
        });
      }, 250);
    });
  }

  function initCalendarQuickJump(){
    var row = document.getElementById("calendarQuickJumpRow");
    if (!row) return;
    row.querySelectorAll("[data-jump]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var jump = btn.getAttribute("data-jump");
        var now = new Date();
        if (jump === "today" || jump === "week") {
          activateCalendarMode("week");
        } else if (jump === "nextmonth") {
          var next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
          calendarViewYear = next.getFullYear();
          calendarViewMonth = next.getMonth();
          calendarSelectedDay = null;
          activateCalendarMode("month");
        }
      });
    });
  }

  function checkCalendarDateRollover(){
    var now = new Date();
    var nowStr = formatDateYMD(now);
    if (nowStr === calendarLastKnownDateStr) return;

    var prevDate = new Date(calendarLastKnownDateStr + "T00:00:00");
    var wasViewingPrevTodayMonth =
      calendarViewYear === prevDate.getFullYear() && calendarViewMonth === prevDate.getMonth();
    calendarLastKnownDateStr = nowStr;

    if (wasViewingPrevTodayMonth) {
      calendarViewYear = now.getFullYear();
      calendarViewMonth = now.getMonth();
      calendarSelectedDay = null;
    }
    renderCalendarGrid();
    renderCalendarSelectedDayPanel();
    renderCalendarTimeline();
    if (wasViewingPrevTodayMonth) scrollToTodayInCalendar(true);
  }

  function initCalendarDailyRefresh(){
    setInterval(checkCalendarDateRollover, 60000);
  }

  var CALENDAR_SOURCE_LABELS = {
    "dart": "OpenDART(금융감독원)",
    "dart-ipo": "OpenDART(금융감독원)",
    "cheongyakhome": "청약홈(한국부동산원·공공데이터포털)",
    "gov24": "정부24(공공데이터포털)",
    "admin": "자산파일럿"
  };

  function getEventSourceLabel(ev){
    return CALENDAR_SOURCE_LABELS[ev.source] || "자산파일럿";
  }

  function formatCalendarTimestamp(ts){
    if (!ts) return "";
    var d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    if (isNaN(d.getTime())) return "";
    // 한국 시간 기준으로 일관되게 표시
    return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // 원본(index.html:7068-7082)과 다른 점: initCalendarCheckin()/initRewardEcosystem() 호출을
  // 뺐다 — 출석체크·포인트·미션은 로그인 기반 개인화 기능이라 이 페이지 범위 밖(사용자 승인).
  function initFinanceCalendar() {
    loadBrandfetchConfig();
    renderCalendarFilters();
    renderCalendarGrid();
    renderCalendarTimeline();
    scrollToTodayInCalendar(false);
    initCalendarDailyRefresh();
    initCalendarModeTabs();
    initCalendarSearch();
    initCalendarQuickJump();
    return loadCalendarEventsFromFirestore();
  }

  initFinanceCalendar();
})();
