// 통계청(국가데이터처) "2025년 가계금융복지조사 결과" 부록 통계표(2025.12 발표) 원자료를 그대로 쓴다.
// - 40대/50대/60세 이상/전국평균은 표1 "가구주 연령대별" 순자산 평균(2025년) 그대로.
// - 20대/30대는 표1에서 "39세 이하"로 뭉뚱그려지지만, 같은 표 안에 세부 항목으로
//   "· 29세이하"(20대에 해당)와 "· 30~39세"(30대에 해당) 순자산 평균이 별도로 발표돼 있어
//   더 이상 근사 추정치가 아니라 실측치를 그대로 쓴다.
// 백분위(estimateTopPercentile)도 더 이상 로그정규분포로 "추정"하지 않는다 — 표12
// "순자산 분위별 평균, 점유율 및 경계값"에 실제 발표된 P10~P90 순자산 경계값 사이를 그대로
// 선형 보간한다. 연령대별 경계값은 발표되지 않아, 전국 구간표를 그 연령대 평균/전국 평균 비율만큼
// 스케일링해서 쓴다("분포 모양은 전국과 같고 중심만 연령대 평균으로 이동한다"는 가정, 기존과 동일).
// 표에 없는 구간(하위 10% 미만/상위 10% 초과)만 부득이하게 선형·로그 보간으로 연장한다.
export type AgeBracketId = '20s' | '30s' | '40s' | '50s' | '60plus';

export const AGE_BRACKETS: { id: AgeBracketId; label: string; averageNetWorth: number }[] = [
  { id: '20s', label: '20대', averageNetWorth: 107_960_000 },
  { id: '30s', label: '30대', averageNetWorth: 250_600_000 },
  { id: '40s', label: '40대', averageNetWorth: 483_890_000 },
  { id: '50s', label: '50대', averageNetWorth: 551_610_000 },
  { id: '60plus', label: '60대 이상', averageNetWorth: 535_910_000 },
];

const NATIONAL_MEAN_NET_WORTH = 471_440_000;

const NATIONAL_PERCENTILE_BOUNDARIES: { p: number; value: number }[] = [
  { p: 10, value: 12_100_000 },
  { p: 20, value: 51_080_000 },
  { p: 30, value: 102_960_000 },
  { p: 40, value: 164_720_000 },
  { p: 50, value: 238_600_000 },
  { p: 60, value: 330_500_000 },
  { p: 70, value: 461_800_000 },
  { p: 80, value: 693_800_000 },
  { p: 90, value: 1_100_200_000 },
];

function bracketPercentileBoundaries(bracket: AgeBracketId): { p: number; value: number }[] {
  const b = AGE_BRACKETS.find((x) => x.id === bracket)!;
  const ratio = b.averageNetWorth / NATIONAL_MEAN_NET_WORTH;
  return NATIONAL_PERCENTILE_BOUNDARIES.map((pt) => ({ p: pt.p, value: pt.value * ratio }));
}

/** 해당 연령대 안에서 이 순자산이 상위 몇 %에 해당하는지 추정한다(0~100, 낮을수록 상위). */
export function estimateTopPercentile(bracket: AgeBracketId, netWorth: number): number {
  if (netWorth <= 0) return 99;
  const pts = bracketPercentileBoundaries(bracket);
  let percentileFromBottom: number;

  if (netWorth <= pts[0].value) {
    percentileFromBottom = (netWorth / pts[0].value) * 10;
  } else if (netWorth >= pts[pts.length - 1].value) {
    const p80 = pts[pts.length - 2];
    const p90 = pts[pts.length - 1];
    const logSlope = 10 / (Math.log(p90.value) - Math.log(p80.value));
    percentileFromBottom = 90 + (Math.log(netWorth) - Math.log(p90.value)) * logSlope;
  } else {
    let found = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      if (netWorth >= pts[i].value && netWorth <= pts[i + 1].value) {
        const ratio = (netWorth - pts[i].value) / (pts[i + 1].value - pts[i].value);
        found = pts[i].p + ratio * (pts[i + 1].p - pts[i].p);
        break;
      }
    }
    percentileFromBottom = found;
  }

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
