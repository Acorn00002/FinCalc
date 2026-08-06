import { SITE_ORIGIN } from '../constants/theme';
import type { FinanceCategory } from '../data/financeProducts';

export type LiveFinanceProduct = {
  bank: string;
  name: string;
  joinWay: string;
  maturityInterest: string;
  specialCondition: string;
  joinDeny: string;
  joinMember: string;
  etcNote: string;
  maxLimit: string;
  baseRate: number | null;
  maxRate: number | null;
  term: string;
  disclosedMonth: string;
};

// Firebase Hosting의 /api/finance-products 리라이트를 거쳐 financeProductsLive 함수로 간다 —
// 금융감독원 API 키는 서버(functions/.env)에만 있고 앱에는 절대 내려오지 않는다.
export async function fetchLiveFinanceProducts(
  category: FinanceCategory
): Promise<{ products: LiveFinanceProduct[]; asOf: string }> {
  const res = await fetch(`${SITE_ORIGIN}/api/finance-products?type=${category}`);
  if (!res.ok) throw new Error(`실시간 상품 정보를 불러오지 못했습니다 (${res.status})`);
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return { products: data.products || [], asOf: data.asOf || '' };
}
