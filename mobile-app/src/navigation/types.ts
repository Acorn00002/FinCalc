import type { CalcId } from '../screens/calculators/registry';
import type { FinanceCategory } from '../data/financeProducts';

// 네이티브 화면과 WebView 화면이 같은 스택 안에 공존하기 위한 라우트 파라미터 정의.
// menu.ts가 이 타입을 참조하고 RootNavigator.tsx도 참조하므로, 순환 참조를 피하려고
// 별도 파일로 뺐다.
export type RootStackParamList = {
  WebViewRoute: { url: string; injectOnLoad?: string };
  Home: undefined;
  Calendar: undefined;
  Settings: undefined;
  Dictionary: undefined;
  Notice: undefined;
  Faq: undefined;
  CalculatorList: undefined;
  /** loanType은 대출이자 계산기(loan)에서만 쓰인다 — 금융 그룹의 주택담보/전월세/신용 3개 메뉴가 같은
   *  계산기를 초기 탭만 다르게 열 때 사용. */
  Calculator: { calcId: CalcId; loanType?: 'mortgage' | 'jeonse' | 'credit' };
  TaxPilot: undefined;
  News: undefined;
  NewsArticle: { url: string };
  Subsidy: undefined;
  FinanceProducts: { category: FinanceCategory };
  Mypage: undefined;
  Lounge: undefined;
  PersonalEvents: undefined;
  FutureSimulator: undefined;
  AssetScore: undefined;
  Notifications: undefined;
};
