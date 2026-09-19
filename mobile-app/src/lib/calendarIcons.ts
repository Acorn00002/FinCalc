// 웹(index.html)의 금융캘린더 기업 아이콘 로직을 네이티브로 이식한 버전.
// 원본: index.html의 CALENDAR_LOGO_DOMAINS / getEventTicker / lookupCompanyTicker /
// getStableBadgeColor / resolveEventIconHtml / resolveStockIconHtml (검증된 도메인 매핑만
// 사용하고, Google favicon 같은 미검증 핫링크는 쓰지 않는다는 원칙을 그대로 따른다).
//
// 네이티브 calendarEvents 데이터는 DART(배당·실적) 기반이라 stock 카테고리는 전부 flag:"kr"이지만,
// 나중에 해외 데이터가 추가돼도 그대로 동작하도록 flag(kr/us) 분기는 웹과 동일하게 유지했다.

// 회사명 → 검증된 공식 도메인 매핑 (index.html과 동일한 126개 항목).
export const CALENDAR_LOGO_DOMAINS: Record<string, string> = {
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
};

const BADGE_PALETTE = ["#585CE5", "#0891b2", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0369a1", "#be185d", "#4d7c0f", "#c2410c"];

export function getStableBadgeColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return BADGE_PALETTE[hash % BADGE_PALETTE.length];
}

export function getCompanyDomain(company: string | null | undefined): string | null {
  if (!company) return null;
  return CALENDAR_LOGO_DOMAINS[company] || null;
}

type TickerSourceEvent = { company?: string | null; meta?: string | null };

/** 같은 회사의 다른 일정엔 종목코드가 있는데 이 일정엔 없는 경우를 위해, 전체 이벤트 목록에서
 *  한 번이라도 확인된 코드를 재사용한다. 화면에 로드된 이벤트 배열을 그대로 넘기면 된다. */
export function lookupCompanyTicker(company: string, allEvents: TickerSourceEvent[]): string | null {
  for (const e of allEvents) {
    if (e.company !== company) continue;
    const meta = e.meta || "";
    const usMatch = meta.match(/^([A-Z]{1,5})\s*·/);
    if (usMatch) return usMatch[1];
    const krMatch = meta.match(/\b(\d{6})\b/);
    if (krMatch) return krMatch[1];
  }
  return null;
}

export function getEventTicker(ev: TickerSourceEvent, allEvents: TickerSourceEvent[]): string | null {
  const meta = ev.meta || "";
  const usMatch = meta.match(/^([A-Z]{1,5})\s*·/);
  if (usMatch) return usMatch[1];
  const krMatch = meta.match(/\b(\d{6})\b/);
  if (krMatch) return krMatch[1];
  if (ev.company) return lookupCompanyTicker(ev.company, allEvents);
  return null;
}

export type IconResolution =
  | { kind: "logo"; uri: string; company: string | null; fallbackTicker: string | null; flag: "kr" | "us" }
  | { kind: "ticker"; ticker: string; color: string }
  | { kind: "neutral-stock" }
  | { kind: "ipo"; flag: "kr" | "us" }
  | { kind: "category"; category: "realestate" | "subsidy" | "personal" | "economy" };

export type CalendarIconEvent = {
  category: string;
  company?: string | null;
  meta?: string | null;
  flag?: string | null;
  logo?: string | null;
};

/** 기업 일정 아이콘 우선순위: 1) 관리자 검증 로고(ev.logo) → 2) Brandfetch 공식 로고(도메인 매핑
 *  있을 때만) → 3) 미국 주식 ticker 뱃지 → 4) 중립 아이콘. 검증 안 된 이미지는 쓰지 않는다. */
export function resolveCalendarIcon(
  ev: CalendarIconEvent,
  allEvents: CalendarIconEvent[],
  brandfetchClientId: string | null
): IconResolution {
  const flag: "kr" | "us" = ev.flag === "us" ? "us" : "kr";

  if (ev.category === "ipo") return { kind: "ipo", flag };
  if (ev.category === "realestate") return { kind: "category", category: "realestate" };
  if (ev.category === "subsidy") return { kind: "category", category: "subsidy" };
  if (ev.category === "personal") return { kind: "category", category: "personal" };
  if (ev.category !== "stock") return { kind: "category", category: "economy" };

  const ticker = getEventTicker(ev, allEvents);

  if (ev.logo) {
    return { kind: "logo", uri: ev.logo, company: ev.company ?? null, fallbackTicker: ticker, flag };
  }
  const domain = getCompanyDomain(ev.company);
  if (domain && brandfetchClientId) {
    const uri = `https://cdn.brandfetch.io/${domain}?c=${encodeURIComponent(brandfetchClientId)}`;
    return { kind: "logo", uri, company: ev.company ?? null, fallbackTicker: ticker, flag };
  }
  if (flag === "us" && ticker) {
    return { kind: "ticker", ticker, color: getStableBadgeColor(ticker) };
  }
  return { kind: "neutral-stock" };
}
