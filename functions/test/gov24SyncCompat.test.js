"use strict";
// 기존 syncGov24Subsidies(수동 호출)가 supportPrograms 문서를 merge로만 쓰고 eligibility 필드를 건드리지 않는지 소스 수준에서 고정한다.
// (이 조건이 깨지면 정기·수동 동기화 후 eligibility가 사라질 수 있다.)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "index.js"), "utf8");
const start = src.indexOf("exports.syncGov24Subsidies = ");
const end = src.indexOf("// ---------- 보조금24 자격정보(eligibility) 테스트 수집");
const body = src.slice(start, end);

test("syncGov24Subsidies 본문을 찾았다", () => {
  assert.ok(start > 0 && end > start);
});

test("supportPrograms 쓰기는 merge:true 이고 문서 전체 교체(set without merge)·delete가 없다", () => {
  const writes = body.match(/collection\("supportPrograms"\)\.doc\([^)]*\)\.(set|update|delete)\([^;]*;/g) || [];
  assert.ok(writes.length >= 1, "supportPrograms 쓰기 코드를 찾지 못했어요");
  writes.forEach((w) => {
    assert.ok(/\.set\(/.test(w) && /merge:\s*true/.test(w), "merge가 아닌 쓰기: " + w);
  });
  assert.ok(!/collection\("supportPrograms"\)[^;]*\.delete\(/.test(body));
});

test("기존 동기화가 만드는 문서에는 eligibility 키가 없어 merge 시 기존 eligibility가 보존된다", () => {
  assert.ok(!/eligibility/.test(body), "syncGov24Subsidies가 eligibility를 건드리고 있어요");
});

test("스테이징 함수는 supportPrograms를 쓰지 않는다 (헬퍼가 보호 컬렉션을 거부)", () => {
  const H = require("../helpers/gov24Eligibility");
  assert.throws(() => H.assertStagingCollection("supportPrograms"));
  assert.throws(() => H.assertStagingCollection("calendarEvents"));
  assert.equal(H.assertStagingCollection("supportProgramsStaging"), "supportProgramsStaging");
});
