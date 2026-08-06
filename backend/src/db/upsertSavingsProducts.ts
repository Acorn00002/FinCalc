import { prisma } from './prisma.js';
import type { FssSavingsResult } from '../fss/fetchSavings.js';

function toNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function toNullableFloat(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function productKey(finCoNo: string, finPrdtCd: string): string {
  return `${finCoNo}_${finPrdtCd}`;
}

// 상품(Product)은 [finCoNo, finPrdtCd] 기준으로 upsert하고, 그 상품에 딸린 옵션(ProductOption,
// 저축기간별 금리)은 매번 통째로 지우고 새로 넣는다 — 옵션은 개수도 적고(보통 상품당 1~7개) 기간별
// 구성이 공시 갱신마다 바뀔 수 있어서, 부분 diff보다 delete-and-recreate가 더 단순하고 안전하다.
export async function upsertSavingsProducts(data: FssSavingsResult): Promise<{ productCount: number; optionCount: number }> {
  const optionsByProduct = new Map<string, FssSavingsResult['optionList']>();
  for (const opt of data.optionList) {
    const key = productKey(opt.fin_co_no, opt.fin_prdt_cd);
    const list = optionsByProduct.get(key) ?? [];
    list.push(opt);
    optionsByProduct.set(key, list);
  }

  let productCount = 0;
  let optionCount = 0;

  for (const base of data.baseList) {
    const key = productKey(base.fin_co_no, base.fin_prdt_cd);
    const options = optionsByProduct.get(key) ?? [];

    const product = await prisma.product.upsert({
      where: { finCoNo_finPrdtCd: { finCoNo: base.fin_co_no, finPrdtCd: base.fin_prdt_cd } },
      update: {
        korCoNm: base.kor_co_nm,
        finPrdtNm: base.fin_prdt_nm,
        joinWay: toNullableString(base.join_way),
        mtrtInt: toNullableString(base.mtrt_int),
        spclCnd: toNullableString(base.spcl_cnd),
        joinDeny: toNullableString(base.join_deny),
        joinMember: toNullableString(base.join_member),
        etcNote: toNullableString(base.etc_note),
        maxLimit: toNullableString(base.max_limit),
        dclsMonth: toNullableString(base.dcls_month),
        dclsStrtDay: toNullableString(base.dcls_strt_day),
        dclsEndDay: toNullableString(base.dcls_end_day),
      },
      create: {
        finCoNo: base.fin_co_no,
        finPrdtCd: base.fin_prdt_cd,
        korCoNm: base.kor_co_nm,
        finPrdtNm: base.fin_prdt_nm,
        joinWay: toNullableString(base.join_way),
        mtrtInt: toNullableString(base.mtrt_int),
        spclCnd: toNullableString(base.spcl_cnd),
        joinDeny: toNullableString(base.join_deny),
        joinMember: toNullableString(base.join_member),
        etcNote: toNullableString(base.etc_note),
        maxLimit: toNullableString(base.max_limit),
        dclsMonth: toNullableString(base.dcls_month),
        dclsStrtDay: toNullableString(base.dcls_strt_day),
        dclsEndDay: toNullableString(base.dcls_end_day),
      },
    });
    productCount += 1;

    // 금감원 응답에 같은 (저축기간, 금리유형) 조합이 중복으로 내려오는 경우가 있어(마지막 값으로
    // 덮어씀), DB의 유니크 제약과 충돌하지 않도록 createMany 전에 한 번 정리한다.
    const dedupedOptions = new Map<string, (typeof options)[number]>();
    for (const opt of options) {
      dedupedOptions.set(`${opt.save_trm ?? ''}_${opt.intr_rate_type ?? ''}`, opt);
    }

    await prisma.productOption.deleteMany({ where: { productId: product.id } });
    if (dedupedOptions.size) {
      const optionRows = [...dedupedOptions.values()];
      await prisma.productOption.createMany({
        data: optionRows.map((opt) => ({
          productId: product.id,
          intrRateType: toNullableString(opt.intr_rate_type),
          intrRateTypeNm: toNullableString(opt.intr_rate_type_nm),
          saveTrm: toNullableString(opt.save_trm),
          intrRate: toNullableFloat(opt.intr_rate),
          intrRate2: toNullableFloat(opt.intr_rate2),
        })),
      });
      optionCount += optionRows.length;
    }
  }

  return { productCount, optionCount };
}
