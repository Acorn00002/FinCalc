// 금융감독원 Open API 응답(kor_co_nm)엔 은행 홈페이지 URL이 포함돼 있지 않아,
// "공식 은행 사이트로 이동" 버튼을 위해 주요 은행만 직접 정리해 둔 보조 데이터.
// 목록에 없는 은행은 링크 버튼을 숨기거나 네이버 검색으로 대체한다(FinanceProductsScreen 참고).
export const BANK_HOMEPAGES: Record<string, string> = {
  'KB국민은행': 'https://www.kbstar.com',
  '신한은행': 'https://www.shinhan.com',
  '우리은행': 'https://www.wooribank.com',
  '하나은행': 'https://www.kebhana.com',
  'NH농협은행': 'https://www.nonghyup.com',
  'IBK기업은행': 'https://www.ibk.co.kr',
  'KDB산업은행': 'https://www.kdb.co.kr',
  'SC제일은행': 'https://www.standardchartered.co.kr',
  '한국씨티은행': 'https://www.citibank.co.kr',
  '케이뱅크': 'https://www.kbanknow.com',
  '카카오뱅크': 'https://www.kakaobank.com',
  '토스뱅크': 'https://www.tossbank.com',
  'Sh수협은행': 'https://www.suhyup-bank.com',
  '수협은행': 'https://www.suhyup-bank.com',
  'iM뱅크': 'https://www.imbank.co.kr',
  '대구은행': 'https://www.imbank.co.kr',
  '부산은행': 'https://www.busanbank.co.kr',
  '광주은행': 'https://www.kjbank.com',
  '전북은행': 'https://www.jbbank.co.kr',
  '경남은행': 'https://www.knbank.co.kr',
  '제주은행': 'https://www.e-jejubank.com',
};

export function getBankHomepage(bankName: string): string | null {
  return BANK_HOMEPAGES[bankName] || null;
}
