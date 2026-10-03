#!/usr/bin/env node
"use strict";
// 로컬 dry-run 실행기: 보조금24 API를 읽기 전용으로 호출해 청년·취업·주거·교육 사업 20~50개의
// 변환 결과(기존 필드 + eligibility)를 JSON 파일로만 저장한다. Firestore에는 연결하지 않는다.
//
//   node functions/scripts/gov24-staging-dryrun.js [--limit 40] [--out <파일>] [--compare-live]
//
// - API 키는 functions/.env의 EXPO_PUBLIC_GOV24_API_KEY에서 읽고, 출력·로그·결과 파일 어디에도 남기지 않는다.
// - --compare-live: 공개 읽기 규칙으로 현재 supportPrograms 문서를 읽어(쓰기 없음) 겹치는 사업의 기존 필드가
//   dry-run 결과와 같은지 비교한다.
const fs = require("fs");
const os = require("os");
const path = require("path");
const H = require("../helpers/gov24Eligibility");

function arg(name, fallback) {
  const i = process.argv.indexOf("--" + name);
  return i === -1 ? fallback : (process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true);
}

function readKey() {
  const envPath = path.join(__dirname, "..", ".env");
  const line = fs.readFileSync(envPath, "utf8").split(/\r?\n/).find((l) => l.startsWith("EXPO_PUBLIC_GOV24_API_KEY="));
  if (!line) throw new Error("functions/.env에 EXPO_PUBLIC_GOV24_API_KEY가 없습니다.");
  return line.slice("EXPO_PUBLIC_GOV24_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
}

const BASE = "https://api.odcloud.kr/api/gov24/v3";

async function main() {
  const key = readKey();
  const limit = Number(arg("limit", 40));
  const out = String(arg("out", path.join(os.tmpdir(), "gov24-staging-dryrun.json")));

  async function call(pathName, params) {
    const u = new URLSearchParams(Object.assign({ serviceKey: key }, params));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(BASE + pathName + "?" + u.toString(), { signal: controller.signal });
      const json = await res.json();
      if (!json || !Array.isArray(json.data)) throw new Error(pathName + " 응답 형식 오류(HTTP " + res.status + ")");
      return json;
    } finally { clearTimeout(timer); }
  }
  const api = {
    list: (page, perPage) => call("/serviceList", { page: String(page), perPage: String(perPage) }),
    detail: async (id) => (await call("/serviceDetail", { page: "1", perPage: "1", "cond[서비스ID::EQ]": id })).data[0] || null,
    conditions: async (id) => (await call("/supportConditions", { page: "1", perPage: "1", "cond[서비스ID::EQ]": id })).data[0] || null
  };

  // --ids a,b,c : 서비스ID를 직접 지정한 검증용 수집(선정 로직 대신 사용)
  const idsArg = arg("ids", null);
  const onlyIds = typeof idsArg === "string" ? idsArg.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  const result = await H.runStagingSync({ api, write: false, limit, secrets: [key], onlyIds: onlyIds });

  // 점검: 스키마 문제, 공식 URL, 기준일
  const problems = [];
  result.docs.forEach((d) => H.validateEligibility(d.doc.eligibility).forEach((p) => problems.push(d.id + ": " + p)));
  const check = {
    docs: result.docs.length,
    schemaProblems: problems,
    withOfficialUrl: result.docs.filter((d) => d.doc.eligibility.sourceUrl.indexOf(H.OFFICIAL_DETAIL_URL_PREFIX) === 0).length,
    withSourceModifiedAt: result.docs.filter((d) => d.doc.eligibility.sourceModifiedAt).length,
    audience: {},
    region: {},
    ageKnown: result.docs.filter((d) => d.doc.eligibility.ageRange && (d.doc.eligibility.ageRange.min !== null || d.doc.eligibility.ageRange.max !== null)).length,
    fetchFailed: result.docs.filter((d) => d.doc.eligibility.fetchStatus.detail === "failed" || d.doc.eligibility.fetchStatus.conditions === "failed").length
  };
  result.docs.forEach((d) => {
    check.audience[d.doc.eligibility.audienceType] = (check.audience[d.doc.eligibility.audienceType] || 0) + 1;
    check.region[d.doc.eligibility.regionName] = (check.region[d.doc.eligibility.regionName] || 0) + 1;
  });

  // 현재 supportPrograms(공개 읽기)와 기존 필드 비교 — 읽기 전용
  let compare = null;
  if (arg("compare-live", false)) {
    const live = new Map();
    let pageToken;
    do {
      const url = "https://firestore.googleapis.com/v1/projects/asset-filot/databases/(default)/documents/supportPrograms?pageSize=300" + (pageToken ? "&pageToken=" + encodeURIComponent(pageToken) : "");
      const j = await (await fetch(url)).json();
      (j.documents || []).forEach((doc) => live.set(doc.name.split("/").pop(), doc.fields || {}));
      pageToken = j.nextPageToken;
    } while (pageToken);
    const parse = (v) => {
      if (v == null) return null;
      if ("stringValue" in v) return v.stringValue;
      if ("integerValue" in v) return parseInt(v.integerValue, 10);
      if ("nullValue" in v) return null;
      if ("arrayValue" in v) return (v.arrayValue.values || []).map(parse);
      if ("mapValue" in v) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, parse(x)]));
      return null;
    };
    const fields = ["title", "category", "summary", "targetAge", "targetRegions", "targetEmployment", "benefits", "deadlineText", "endDate", "applyUrl", "checklist", "source"];
    const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === "object" && !Array.isArray(x)) ? Object.fromEntries(Object.entries(x).sort()) : x);
    let overlap = 0, identical = 0;
    const differing = [];
    result.docs.forEach((d) => {
      const stored = live.get(String(d.id));
      if (!stored) return;
      overlap += 1;
      const diff = fields.filter((f) => canon(d.doc[f]) !== canon(parse(stored[f])));
      if (!diff.length) identical += 1; else differing.push({ id: d.id, title: d.doc.title, fields: diff });
    });
    compare = { liveDocs: live.size, overlap: overlap, identical: identical, differing: differing };
  }

  const payload = { generatedAt: new Date().toISOString(), summary: result.summary, check: check, compare: compare, docs: result.docs.map((d) => Object.assign({ id: d.id }, d.doc)) };
  const text = JSON.stringify(payload, null, 1);
  if (text.indexOf(key) !== -1) throw new Error("결과에 API 키가 포함되어 저장을 중단했습니다.");
  fs.writeFileSync(out, text);

  console.log("모드:", result.summary.mode, "| 컬렉션(미사용):", result.summary.collection, "| 쓰기:", result.summary.written);
  console.log("목록 순회:", JSON.stringify(result.summary.listStats));
  console.log("선정:", result.summary.selected, "| 중복 ID:", result.summary.duplicateIds, "| 대표 사업 포함:", result.summary.selection.seedsFound.length, "/ 미발견:", result.summary.selection.seedsMissing.join(", ") || "없음");
  console.log("주제 분포:", JSON.stringify(result.summary.selection.topicCounts));
  console.log("API 호출:", JSON.stringify(result.summary.apiCalls), "| API 응답시간 합:", result.summary.apiMsSum + "ms", "| 전체 소요:", result.summary.wallMs + "ms");
  console.log("오류:", result.summary.errors.length);
  console.log("점검:", JSON.stringify(Object.assign({}, check, { schemaProblems: check.schemaProblems.length })));
  if (compare) console.log("현재 supportPrograms와 비교:", JSON.stringify({ liveDocs: compare.liveDocs, overlap: compare.overlap, identical: compare.identical, differing: compare.differing.length }));
  console.log("결과 파일:", out);
}

main().catch((error) => {
  console.error("실패:", String(error && error.message || error).replace(/serviceKey=[^&\s]+/g, "serviceKey=***"));
  process.exit(1);
});
