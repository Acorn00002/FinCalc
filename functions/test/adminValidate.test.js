"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { validatePush, validateCalendarEvent, validateDeleteId } = require("../helpers/adminValidate");

test("푸시: 정상 입력", () => {
  const r = validatePush({ title: "제목", body: "내용", link: "#calendar", scheduledFor: "2030-01-01T00:00:00Z" });
  assert.ok(r.value); assert.equal(r.value.icon, "ph-bell"); assert.ok(r.value.scheduledFor instanceof Date);
});
test("푸시: 필수값·길이·형식 위반은 거부", () => {
  assert.ok(validatePush({}).error);
  assert.ok(validatePush({ title: "a".repeat(61), body: "b" }).error);
  assert.ok(validatePush({ title: "a", body: "b".repeat(201) }).error);
  assert.ok(validatePush({ title: "a", body: "b", link: "javascript:alert(1)" }).error);
  assert.ok(validatePush({ title: "a", body: "b", scheduledFor: "not-a-date" }).error);
  assert.ok(validatePush({ title: { $gt: "" }, body: "b" }).error);
});
const okEvent = { date: "2026-10-18", category: "tax", title: "일정", link: "https://example.com/a" };
test("일정: 정상/수정(PUT은 id 필수)", () => {
  assert.ok(validateCalendarEvent(okEvent, false).value);
  assert.ok(validateCalendarEvent(okEvent, true).error);
  assert.ok(validateCalendarEvent(Object.assign({ id: "abc_123-X" }, okEvent), true).value);
});
test("일정: 날짜·카테고리·링크·id 경로 주입·details 검증", () => {
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { date: "2026-13-40" })).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { category: "evil" })).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { link: "javascript:alert(1)" })).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { id: "a/b" }), true).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { id: "../x" }), true).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { title: "x".repeat(81) })).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { details: ["a"] })).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { details: { "bad key!": "v" } })).error);
  assert.ok(validateCalendarEvent(Object.assign({}, okEvent, { status: "x" })).error);
});
test("삭제 id 검증", () => {
  assert.ok(validateDeleteId("abc123").value);
  for (const bad of ["", "a/b", "..", undefined, null, 5, "x".repeat(200)]) assert.ok(validateDeleteId(bad).error);
});
