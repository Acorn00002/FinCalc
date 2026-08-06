import { Router } from 'express';
import { prisma } from '../db/prisma.js';

export const savingsRouter = Router();

// GET /api/v1/savings — DB에 저장된 적금 상품을 옵션(저축기간별 금리)과 함께 내려준다.
// 앱/웹이 매번 금감원 API를 직접 호출하지 않고 이 엔드포인트만 부르면 되도록 하는 게 목적이라,
// 여기서는 순수 DB 조회만 하고 외부 API 호출은 절대 하지 않는다(느려지고 API 쿼터도 깎임).
savingsRouter.get('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { options: true },
      orderBy: [{ korCoNm: 'asc' }, { finPrdtNm: 'asc' }],
    });

    res.json({
      count: products.length,
      products: products.map((p) => ({
        bank: p.korCoNm,
        name: p.finPrdtNm,
        joinWay: p.joinWay,
        maturityInterest: p.mtrtInt,
        specialCondition: p.spclCnd,
        joinDeny: p.joinDeny,
        joinMember: p.joinMember,
        etcNote: p.etcNote,
        maxLimit: p.maxLimit,
        disclosedMonth: p.dclsMonth,
        options: p.options.map((o) => ({
          termMonths: o.saveTrm,
          rateType: o.intrRateTypeNm,
          baseRate: o.intrRate,
          maxRate: o.intrRate2,
        })),
        updatedAt: p.updatedAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/v1/savings 실패:', error);
    res.status(500).json({ error: 'DB 조회 중 오류가 발생했습니다.' });
  }
});
