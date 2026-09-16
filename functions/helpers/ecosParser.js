// 한국은행 ECOS 응답을 순수 함수로 파싱하는 로직만 모아둔 모듈.
// Firebase Admin/Functions에 의존하지 않아 별도 초기화 없이 테스트할 수 있다.

function pad2(n) {
  return String(n).padStart(2, "0");
}

// cycle: "D"(일별) | "M"(월별) | "A"(연별). offsetUnits는 오늘 기준 +/- 오프셋.
function computeEcosPeriod(cycle, offsetUnits, baseDate) {
  const d = baseDate ? new Date(baseDate.getTime()) : new Date();
  if (cycle === "D") {
    d.setDate(d.getDate() + offsetUnits);
    return "" + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }
  if (cycle === "M") {
    d.setMonth(d.getMonth() + offsetUnits);
    return "" + d.getFullYear() + pad2(d.getMonth() + 1);
  }
  d.setFullYear(d.getFullYear() + offsetUnits);
  return "" + d.getFullYear();
}

// ECOS StatisticSearch 응답 하나를 받아 가장 최근 관측치를 돌려준다.
// 에러 응답이거나 관측치가 비어 있으면 null(추측해서 값을 만들어내지 않는다).
function parseEcosResponse(indicator, data) {
  if (data.RESULT && data.RESULT.CODE && data.RESULT.CODE !== "INFO-000") {
    return { error: { code: data.RESULT.CODE, message: data.RESULT.MESSAGE } };
  }
  const rows = (data.StatisticSearch && data.StatisticSearch.row) || [];
  if (!rows.length) return { value: null };

  // 오름차순(과거→최근)으로 온다고 문서화되어 있으나, 방어적으로 TIME 기준 정렬 후 마지막 값을 사용.
  const sorted = rows.slice().sort((a, b) => String(a.TIME).localeCompare(String(b.TIME)));
  const latest = sorted[sorted.length - 1];
  const value = latest.DATA_VALUE != null ? parseFloat(latest.DATA_VALUE) : null;
  if (value == null || Number.isNaN(value)) return { value: null };

  return {
    value: {
      key: indicator.key,
      label: indicator.label,
      value,
      unit: latest.UNIT_NAME || indicator.unit,
      period: String(latest.TIME),
      statCode: indicator.statCode,
      itemCode1: indicator.itemCode1,
      sourceUrl: "https://ecos.bok.or.kr/#/Short/" + indicator.statCode
    }
  };
}

module.exports = { pad2, computeEcosPeriod, parseEcosResponse };
