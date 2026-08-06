import { env } from '../config/env.js';

const FSS_BASE_URL = 'https://finlife.fss.or.kr/finlifeapi';
const TOP_FIN_GRP_NO = '020000'; // 은행권(시중은행)

// 금융감독원 오픈API 문서상으로는 결과 배열 이름이 종종 "resultList"로 소개되지만, 실제
// savingProductsSearch.json 응답은 result.baseList(상품 기본정보)/result.optionList(금리 옵션)
// 필드명으로 내려온다 — 이 프로젝트의 다른 프록시(functions/index.js, api/finance-products.js)에서
// 이미 실제 호출로 검증된 필드명이라 그대로 맞춰 파싱한다.
export type FssSavingBase = {
  fin_co_no: string;
  fin_prdt_cd: string;
  kor_co_nm: string;
  fin_prdt_nm: string;
  join_way?: string;
  mtrt_int?: string;
  spcl_cnd?: string;
  join_deny?: string;
  join_member?: string;
  etc_note?: string;
  max_limit?: string | number | null;
  dcls_month?: string;
  dcls_strt_day?: string;
  dcls_end_day?: string;
};

export type FssSavingOption = {
  fin_co_no: string;
  fin_prdt_cd: string;
  intr_rate_type?: string;
  intr_rate_type_nm?: string;
  save_trm?: string;
  intr_rate?: number | string | null;
  intr_rate2?: number | string | null;
};

export type FssSavingsResult = {
  baseList: FssSavingBase[];
  optionList: FssSavingOption[];
};

type FssApiResponse = {
  result: {
    err_cd: string;
    err_msg?: string;
    max_page_no?: number;
    now_page_no?: number;
    baseList?: FssSavingBase[];
    optionList?: FssSavingOption[];
  };
};

// pageNo=1부터 시작해 max_page_no까지 전부 순회한다 — 은행권 적금만 해도 페이지가 여러 장이라
// 1페이지만 받으면 상품이 누락된다.
export async function fetchAllSavingsProducts(): Promise<FssSavingsResult> {
  let pageNo = 1;
  const baseList: FssSavingBase[] = [];
  const optionList: FssSavingOption[] = [];

  for (;;) {
    const url =
      `${FSS_BASE_URL}/savingProductsSearch.json` +
      `?auth=${encodeURIComponent(env.fssApiKey)}` +
      `&topFinGrpNo=${TOP_FIN_GRP_NO}` +
      `&pageNo=${pageNo}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`FSS API 응답 오류: ${res.status}`);

    const data = (await res.json()) as FssApiResponse;
    const result = data.result;
    if (!result || result.err_cd !== '000') {
      throw new Error(`FSS API 오류: ${result?.err_cd ?? '알수없음'} ${result?.err_msg ?? ''}`);
    }

    baseList.push(...(result.baseList ?? []));
    optionList.push(...(result.optionList ?? []));

    if (!result.max_page_no || pageNo >= result.max_page_no) break;
    pageNo += 1;
  }

  return { baseList, optionList };
}
