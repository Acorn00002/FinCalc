// 통계청 가계금융복지조사(가구주 연령대별 평균 자산/부채) 실측치를 기준 데이터로 쓴다.
// 40대/50대/60세 이상은 "2024년 가계금융복지조사 결과"(2024.12) 순자산 발표치를 그대로 쓰고,
// 20대(29세 이하)/30대는 그 발표에선 "39세 이하"로 뭉뚱그려져 있어, 세부 연령대별 자산·부채가
// 함께 보도된 별도 통계(2024~2025년 조사 결과 보도)를 근거로 다음과 같이 구성했다:
//   - 30대: 자산 3억 6,175만 원 - 부채 9,425만 원 = 순자산 2억 6,750만 원 (2024년 실측)
//   - 40대: 순자산 4억 5,064만 원 (2024년 실측)
//   - 50대: 순자산 5억 1,131만 원 (2024년 실측)
//   - 60세 이상: 순자산 5억 1,922만 원 (2024년 실측)
//   - 20대(29세 이하): 자산 1억 4,918만 원(2024년 실측)에 30대와 같은 부채비율(약 26%)을 적용해
//     순자산 약 1억 1,032만 원으로 추정 — 29세 이하 부채 실측치를 별도로 찾지 못해 근사한 값이다.
// "39세 이하 순자산 2억 2,158만 원"(20대+30대를 합친 값)과 비교하면 위 20대/30대 추정치의
// 가중평균이 그 범위 안에 들어와(약 20~24% 가중치일 때 근접) 대략적인 정합성을 확인했다.
// 아직 앱 내 실사용자 데이터를 모을 만큼 가입자가 쌓이지 않아, "가입 유저 데이터 종합"은 이후
// 버전에서 이 기준치에 실사용자 분포를 섞어 넣는 방식으로 확장할 수 있도록 남겨둔다.
export type AgeBracketId = '20s' | '30s' | '40s' | '50s' | '60plus';

export const AGE_BRACKETS: { id: AgeBracketId; label: string; averageNetWorth: number }[] = [
  { id: '20s', label: '20대', averageNetWorth: 110_320_000 },
  { id: '30s', label: '30대', averageNetWorth: 267_500_000 },
  { id: '40s', label: '40대', averageNetWorth: 450_640_000 },
  { id: '50s', label: '50대', averageNetWorth: 511_310_000 },
  { id: '60plus', label: '60대 이상', averageNetWorth: 519_220_000 },
];

const NATIONAL_MEAN_NET_WORTH = 448_940_000;

// 전국 순자산 분포에서 실제 공표된 두 지점 — "3억 미만 56.9%", "10억 이상 10.9%"(통계청 2024)를
// 로그정규분포로 근사 적합한 값. 연령대별 분포의 "모양"(불평등도)은 전국과 같다고 가정하고,
// 중앙값만 연령대 평균 비율만큼 이동시켜 연령대별 퍼센타일을 추정한다.
const LOGNORMAL_SIGMA = 1.1374;
const LOGNORMAL_MU = 19.3212;

function normalCdf(z: number): number {
  // Abramowitz-Stegun 근사 — 표준정규 CDF를 오차함수(erf)로 계산한다.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const poly = t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  const p = 1 - d * poly;
  return z >= 0 ? p : 1 - p;
}

function bracketMedian(bracket: AgeBracketId): number {
  const b = AGE_BRACKETS.find((x) => x.id === bracket)!;
  const nationalMedian = Math.exp(LOGNORMAL_MU);
  return nationalMedian * (b.averageNetWorth / NATIONAL_MEAN_NET_WORTH);
}

/** 해당 연령대 안에서 이 순자산이 상위 몇 %에 해당하는지 추정한다(0~100, 낮을수록 상위). */
export function estimateTopPercentile(bracket: AgeBracketId, netWorth: number): number {
  if (netWorth <= 0) return 99;
  const median = bracketMedian(bracket);
  const z = (Math.log(netWorth) - Math.log(median)) / LOGNORMAL_SIGMA;
  const percentileFromBottom = normalCdf(z) * 100;
  const topPercentile = 100 - percentileFromBottom;
  return Math.min(99, Math.max(1, Math.round(topPercentile)));
}

/**
 * 자산 체력 점수(100점 만점) = 연령대 내 순자산 위치(70%) + 부채 건전성(30%).
 * 부채비율(부채/자산)이 낮을수록 건전성 점수가 높다 — 자산 규모만이 아니라 "체력"(안정성)까지 반영.
 */
export function computeAssetHealthScore(bracket: AgeBracketId, totalAssets: number, totalDebt: number): number {
  const netWorth = totalAssets - totalDebt;
  const topPercentile = estimateTopPercentile(bracket, netWorth);
  const percentileScore = 100 - topPercentile;
  const debtRatio = totalAssets > 0 ? Math.min(1, Math.max(0, totalDebt / totalAssets)) : 1;
  const debtHealthScore = (1 - debtRatio) * 100;
  const score = percentileScore * 0.7 + debtHealthScore * 0.3;
  return Math.min(100, Math.max(1, Math.round(score)));
}
