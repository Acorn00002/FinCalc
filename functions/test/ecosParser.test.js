const test = require("node:test");
const assert = require("node:assert/strict");
const { computeEcosPeriod, parseEcosResponse } = require("../helpers/ecosParser");

const BASE_RATE_INDICATOR = {
  key: "base-rate",
  label: "한국은행 기준금리",
  statCode: "722Y001",
  itemCode1: "0101000",
  unit: "%"
};

test("parseEcosResponse: 정상 응답이면 시간(TIME) 기준 가장 최근 값을 고른다", () => {
  const fixture = {
    StatisticSearch: {
      row: [
        { TIME: "202606", DATA_VALUE: "3.00", UNIT_NAME: "%" },
        { TIME: "202608", DATA_VALUE: "2.75", UNIT_NAME: "%" },
        { TIME: "202607", DATA_VALUE: "2.75", UNIT_NAME: "%" }
      ]
    }
  };
  const parsed = parseEcosResponse(BASE_RATE_INDICATOR, fixture);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.value.period, "202608");
  assert.equal(parsed.value.value, 2.75);
  assert.equal(parsed.value.unit, "%");
  assert.equal(parsed.value.key, "base-rate");
});

test("parseEcosResponse: 응답 row가 뒤섞여 와도(비정렬) 최신값을 정확히 고른다", () => {
  const fixture = {
    StatisticSearch: {
      row: [
        { TIME: "20260910", DATA_VALUE: "1391.50", UNIT_NAME: "원" },
        { TIME: "20260905", DATA_VALUE: "1380.20", UNIT_NAME: "원" },
        { TIME: "20260908", DATA_VALUE: "1385.00", UNIT_NAME: "원" }
      ]
    }
  };
  const parsed = parseEcosResponse({ key: "usd-krw", unit: "원" }, fixture);
  assert.equal(parsed.value.period, "20260910");
  assert.equal(parsed.value.value, 1391.50);
});

test("parseEcosResponse: ECOS가 에러 코드를 반환하면 error를 돌려준다(값을 추측하지 않는다)", () => {
  const fixture = { RESULT: { CODE: "ERROR-100", MESSAGE: "필수 값이 누락되어 있습니다" } };
  const parsed = parseEcosResponse(BASE_RATE_INDICATOR, fixture);
  assert.equal(parsed.error.code, "ERROR-100");
  assert.equal(parsed.value, undefined);
});

test("parseEcosResponse: row가 비어 있으면 value가 null이다(추측 금지)", () => {
  const fixture = { StatisticSearch: { row: [] } };
  const parsed = parseEcosResponse(BASE_RATE_INDICATOR, fixture);
  assert.equal(parsed.value, null);
});

test("parseEcosResponse: StatisticSearch 자체가 없는 응답도 안전하게 처리한다", () => {
  const parsed = parseEcosResponse(BASE_RATE_INDICATOR, {});
  assert.equal(parsed.value, null);
});

test("parseEcosResponse: DATA_VALUE가 숫자로 변환 불가능하면 null을 돌려준다", () => {
  const fixture = { StatisticSearch: { row: [{ TIME: "202608", DATA_VALUE: "-", UNIT_NAME: "%" }] } };
  const parsed = parseEcosResponse(BASE_RATE_INDICATOR, fixture);
  assert.equal(parsed.value, null);
});

test("computeEcosPeriod: 월별(M) 주기는 YYYYMM 형식을 돌려준다", () => {
  const base = new Date("2026-09-15T00:00:00+09:00");
  assert.equal(computeEcosPeriod("M", 0, base), "202609");
  assert.equal(computeEcosPeriod("M", -12, base), "202509");
});

test("computeEcosPeriod: 일별(D) 주기는 YYYYMMDD 형식을 돌려주고 월 경계를 넘어가도 올바르다", () => {
  const base = new Date("2026-09-02T00:00:00+09:00");
  assert.equal(computeEcosPeriod("D", 0, base), "20260902");
  assert.equal(computeEcosPeriod("D", -14, base), "20260819");
});
