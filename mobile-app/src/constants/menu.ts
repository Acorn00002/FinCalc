import { SITE_ORIGIN } from './theme';
import type { RootStackParamList } from '../navigation/types';

export type MenuLeaf = {
  label: string;
  icon: string;
  url: string;
  /** #finance 하위 5종처럼 URL만으로 구분이 안 되는 화면 — 로드 완료 후 이 스크립트를 주입해 정확한 하위 상태로 전환한다. */
  injectOnLoad?: string;
  badge?: string;
  /** 네이티브로 이식된 화면의 라우트 이름. 있으면 WebView 대신 이 네이티브 화면으로 이동한다. */
  screen?: Exclude<keyof RootStackParamList, 'WebViewRoute'>;
  /** screen이 파라미터를 받는 라우트(예: Calculator)일 때 전달할 값. */
  screenParams?: Record<string, unknown>;
};

export type MenuGroup = {
  label: string;
  icon: string;
  children: MenuLeaf[];
};

export type MenuEntry = MenuLeaf | MenuGroup;

export function isMenuGroup(entry: MenuEntry): entry is MenuGroup {
  return Array.isArray((entry as MenuGroup).children);
}

// 사이드바 순서 그대로 (index.html의 <nav class="sidebar-nav"> 1~12번과 1:1 매핑).
export const SIDEBAR_MENU: MenuEntry[] = [
  {
    label: '금융',
    icon: 'business-outline',
    children: [
      { label: '정기예금', icon: 'cash-outline', url: `${SITE_ORIGIN}/#finance`, screen: 'FinanceProducts', screenParams: { category: 'deposit' } },
      { label: '정기적금', icon: 'save-outline', url: `${SITE_ORIGIN}/#finance`, screen: 'FinanceProducts', screenParams: { category: 'savings' } },
      { label: '주택담보대출', icon: 'home-outline', url: `${SITE_ORIGIN}/#finance`, screen: 'FinanceProducts', screenParams: { category: 'mortgage' } },
      { label: '전월세보증금대출', icon: 'key-outline', url: `${SITE_ORIGIN}/#finance`, screen: 'FinanceProducts', screenParams: { category: 'jeonse' } },
      { label: '신용담보대출', icon: 'card-outline', url: `${SITE_ORIGIN}/#finance`, screen: 'FinanceProducts', screenParams: { category: 'credit' } },
    ],
  },
  { label: '정부 지원금', icon: 'gift-outline', url: `${SITE_ORIGIN}/#subsidy`, screen: 'Subsidy' },
  { label: '청약·공모주', icon: 'bar-chart-outline', url: `${SITE_ORIGIN}/#ipo` },
  {
    label: '금융 계산기',
    icon: 'calculator-outline',
    children: [
      { label: '전체 계산기 보기', icon: 'grid-outline', url: `${SITE_ORIGIN}/#finpilot`, screen: 'CalculatorList' },
      { label: '해외주식 절세계산기', icon: 'receipt-outline', url: `${SITE_ORIGIN}/#taxpilot`, screen: 'TaxPilot' },
      { label: '미래 자산 시뮬레이터', icon: 'trending-up-outline', url: `${SITE_ORIGIN}/#finpilot`, screen: 'FutureSimulator' },
      { label: '자산 비교 & 점수', icon: 'medal-outline', url: `${SITE_ORIGIN}/#finpilot`, screen: 'AssetScore' },
    ],
  },
  { label: '뉴스 · 금융소식', icon: 'newspaper-outline', url: `${SITE_ORIGIN}/#news`, screen: 'News' },
  { label: '증권시장', icon: 'trending-up-outline', url: `${SITE_ORIGIN}/#market` },
  { label: '경제사전', icon: 'book-outline', url: `${SITE_ORIGIN}/#dictionary`, screen: 'Dictionary' },
  { label: '자산 라운지', icon: 'chatbubbles-outline', url: `${SITE_ORIGIN}/#lounge`, screen: 'Lounge' },
  { label: '금융 캘린더', icon: 'calendar-outline', url: `${SITE_ORIGIN}/#calendar`, screen: 'Calendar' },
  { label: '마이페이지', icon: 'person-circle-outline', url: `${SITE_ORIGIN}/#mypage`, screen: 'Mypage' },
  { label: '설정', icon: 'settings-outline', url: `${SITE_ORIGIN}/#settings`, screen: 'Settings' },
  {
    label: '정보',
    icon: 'document-text-outline',
    children: [
      { label: '공지사항', icon: 'notifications-outline', url: `${SITE_ORIGIN}/#notice`, badge: '준비중', screen: 'Notice' },
      { label: '자주 묻는 질문', icon: 'help-circle-outline', url: `${SITE_ORIGIN}/#faq`, badge: '준비중', screen: 'Faq' },
    ],
  },
];

// 기존 웹 하단바(index.html .bottom-nav)와 동일한 5개 핵심 메뉴 — 네이티브 하단 탭 행에 그대로 사용.
export const BOTTOM_TABS: MenuLeaf[] = [
  { label: '홈', icon: 'home-outline', url: `${SITE_ORIGIN}/#home`, screen: 'Home' },
  { label: '계산기', icon: 'calculator-outline', url: `${SITE_ORIGIN}/#finpilot`, screen: 'CalculatorList' },
  { label: '캘린더', icon: 'calendar-outline', url: `${SITE_ORIGIN}/#calendar`, screen: 'Calendar' },
  { label: '자산 라운지', icon: 'chatbubbles-outline', url: `${SITE_ORIGIN}/#lounge`, screen: 'Lounge' },
  { label: '마이페이지', icon: 'person-circle-outline', url: `${SITE_ORIGIN}/#mypage`, screen: 'Mypage' },
];

export const MYPAGE_URL = `${SITE_ORIGIN}/#mypage`;
export const HOME_URL = `${SITE_ORIGIN}/#home`;
