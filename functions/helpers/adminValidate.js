"use strict";
// 관리자 API 입력값의 서버 측 길이·형식 검증. 통과하면 정제된 값을, 실패하면 { error } 를 돌려준다.
const CATEGORIES = ["subsidy", "realestate", "ipo", "stock", "tax", "economy"];
const STATUSES = ["예정", "확정", "변경", "연기", "취소", "종료"];
const FLAGS = ["kr", "us"];
const IMPORTANCE_VALUES = ["매우중요", "중요", "일반"];
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(v, max) {
  if (v === undefined || v === null) return "";
  if (typeof v !== "string") return null;
  return v.length > max ? null : v.trim();
}
function isHttpUrl(v) {
  if (!v) return true;
  try { const u = new URL(v); return u.protocol === "https:" || u.protocol === "http:"; } catch (e) { return false; }
}
function validDate(v) {
  if (!DATE_RE.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function validatePush(b) {
  b = b || {};
  const title = str(b.title, 60), body = str(b.body, 200), icon = str(b.icon, 40), link = str(b.link, 100);
  if (title === null || body === null || icon === null || link === null) return { error: "입력값의 형식 또는 길이가 올바르지 않습니다." };
  if (!title || !body) return { error: "title, body가 필요합니다." };
  if (icon && !/^[a-z0-9-]+$/.test(icon)) return { error: "icon 형식이 올바르지 않습니다." };
  if (link && !/^#?[A-Za-z0-9_-]{1,60}$/.test(link)) return { error: "link 형식이 올바르지 않습니다." };
  let scheduledFor = null;
  if (b.scheduledFor) {
    if (typeof b.scheduledFor !== "string" || b.scheduledFor.length > 40) return { error: "scheduledFor 형식이 올바르지 않습니다." };
    const d = new Date(b.scheduledFor);
    if (isNaN(d.getTime())) return { error: "scheduledFor 형식이 올바르지 않습니다." };
    scheduledFor = d;
  }
  return { value: { title: title, body: body, icon: icon || "ph-bell", link: link, scheduledFor: scheduledFor } };
}

function validateCalendarEvent(b, requireId) {
  b = b || {};
  const id = b.id === undefined || b.id === null || b.id === "" ? "" : b.id;
  if (id !== "" && (typeof id !== "string" || !ID_RE.test(id))) return { error: "id 형식이 올바르지 않습니다." };
  if (requireId && !id) return { error: "수정에는 id가 필요합니다." };
  const date = str(b.date, 10), title = str(b.title, 80), meta = str(b.meta, 120), type = str(b.type, 40);
  const link = str(b.link, 500), descriptionOverride = str(b.descriptionOverride, 200);
  if ([date, title, meta, type, link, descriptionOverride].some((x) => x === null)) return { error: "입력값의 형식 또는 길이가 올바르지 않습니다." };
  if (!date || !b.category || !title) return { error: "date, category, title은 필수입니다." };
  if (!validDate(date)) return { error: "date 형식이 올바르지 않습니다." };
  if (CATEGORIES.indexOf(b.category) === -1) return { error: "category 값이 올바르지 않습니다." };
  if (b.status && STATUSES.indexOf(b.status) === -1) return { error: "status 값이 올바르지 않습니다." };
  const flag = b.flag || "kr";
  if (FLAGS.indexOf(flag) === -1) return { error: "flag 값이 올바르지 않습니다." };
  if (!isHttpUrl(link)) return { error: "link는 http(s) 주소여야 합니다." };
  let details = null;
  if (b.details !== undefined && b.details !== null) {
    if (typeof b.details !== "object" || Array.isArray(b.details)) return { error: "details 형식이 올바르지 않습니다." };
    details = {};
    const keys = Object.keys(b.details);
    if (keys.length > 20) return { error: "details 항목이 너무 많습니다." };
    for (const k of keys) {
      const v = b.details[k];
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k) || (v !== null && typeof v !== "string") || (v && v.length > 300)) return { error: "details 형식이 올바르지 않습니다." };
      details[k] = v;
    }
  }
  if (b.importanceOverride && IMPORTANCE_VALUES.indexOf(b.importanceOverride) === -1) return { error: "importanceOverride 값이 올바르지 않습니다." };
  return {
    value: {
      id: id, date: date, category: b.category, type: type, title: title, meta: meta, status: b.status || null,
      flag: flag, link: link, details: details, importanceOverride: b.importanceOverride || null,
      descriptionOverride: descriptionOverride || null, hidden: !!b.hidden
    }
  };
}

function validateDeleteId(id) {
  if (typeof id !== "string" || !ID_RE.test(id)) return { error: "id가 필요합니다." };
  return { value: id };
}

module.exports = { validatePush, validateCalendarEvent, validateDeleteId, CATEGORIES, STATUSES, ID_RE };
