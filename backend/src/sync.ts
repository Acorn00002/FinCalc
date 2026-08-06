import { fetchAllSavingsProducts } from './fss/fetchSavings.js';
import { upsertSavingsProducts } from './db/upsertSavingsProducts.js';
import { prisma } from './db/prisma.js';

// `npm run sync`로 직접 실행하는 1회성 스크립트 — 금감원 API에서 적금 상품을 전부 받아와 DB에
// upsert한다. 나중에 스케줄러(cron 등)로 주기 실행하고 싶으면 이 함수를 그대로 불러 쓰면 된다.
async function main() {
  console.log('[sync] 금융감독원 적금 상품 조회 시작...');
  const data = await fetchAllSavingsProducts();
  console.log(`[sync] 조회 완료 — 상품 ${data.baseList.length}건, 옵션 ${data.optionList.length}건`);

  const { productCount, optionCount } = await upsertSavingsProducts(data);
  console.log(`[sync] DB 저장 완료 — 상품 ${productCount}건, 옵션 ${optionCount}건`);
}

main()
  .catch((error) => {
    console.error('[sync] 실패:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
