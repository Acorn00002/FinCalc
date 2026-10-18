(function () {
  "use strict";
  // 관리자 화면 — Firebase 로그인 후 ID Token(Bearer)으로만 관리자 API를 호출한다.
  // 서버 데이터는 모두 textContent / setAttribute 로만 DOM에 넣는다(innerHTML 사용 금지: 저장형 XSS 방지).
  var FIREBASE_CONFIG = {
    apiKey: "AIzaSyCiADiWiH434SNRR85_VDNf9NnZM0Ozxww",
    authDomain: "asset-filot.firebaseapp.com",
    projectId: "asset-filot",
    appId: "1:862512786797:web:7ee42935258c645a2fbe64"
  };
  var FN_BASE = "https://asia-northeast3-asset-filot.cloudfunctions.net/";
  var authEmulator = null;

  // 로컬 개발·에뮬레이터 검증 전용 오버라이드(localhost 에서만 동작)
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  if (isLocal) {
    var qs = new URLSearchParams(location.search);
    if (qs.get("fn")) FN_BASE = qs.get("fn").replace(/\/?$/, "/");
    if (qs.get("auth")) authEmulator = "http://" + qs.get("auth");
  }

  firebase.initializeApp(FIREBASE_CONFIG);
  var auth = firebase.auth();
  if (authEmulator) auth.useEmulator(authEmulator, { disableWarnings: true });

  function $(id) { return document.getElementById(id); }
  function el(tag, opts, kids) {
    var n = document.createElement(tag);
    opts = opts || {};
    if (opts.cls) n.className = opts.cls;
    if (opts.text !== undefined) n.textContent = String(opts.text);
    if (opts.attrs) Object.keys(opts.attrs).forEach(function (k) { n.setAttribute(k, opts.attrs[k]); });
    (kids || []).forEach(function (k) { if (k) n.appendChild(k); });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function safeHttpUrl(u) {
    try { var x = new URL(u); return x.protocol === "https:" || x.protocol === "http:" ? x.href : ""; } catch (e) { return ""; }
  }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d.getTime()) ? "" : d.toLocaleString("ko-KR");
  }

  var currentUser = null;

  // ---------- API ----------
  function api(fn, opts) {
    opts = opts || {};
    var user = auth.currentUser;
    if (!user) return Promise.reject(new Error("로그인이 필요합니다."));
    return user.getIdToken().then(function (token) {
      var url = FN_BASE + fn;
      if (opts.query) url += "?" + new URLSearchParams(opts.query).toString();
      var init = { method: opts.method || "GET", headers: { Authorization: "Bearer " + token } };
      if (opts.body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(opts.body); }
      return fetch(url, init);
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var msg = data && data.error ? data.error : "오류 " + res.status;
          if (res.status === 401) msg += " (다시 로그인하세요)";
          throw new Error(msg);
        }
        return data;
      });
    });
  }
  function busy(btn, p) {
    btn.disabled = true;
    return p.then(function (v) { btn.disabled = false; return v; }, function (e) { btn.disabled = false; throw e; });
  }

  // ---------- 로그인 / 권한 ----------
  function showGate(msg) {
    $("admGate").hidden = false; $("admApp").hidden = true;
    $("admUser").hidden = true; $("admSignOut").hidden = !auth.currentUser;
    $("admGateMsg").textContent = msg || "";
  }
  function showApp(user) {
    $("admGate").hidden = true; $("admApp").hidden = false;
    $("admUser").hidden = false; $("admUser").textContent = user.email || "관리자";
    $("admSignOut").hidden = false;
    loadCalendarList();
  }
  $("admSignIn").addEventListener("click", function () {
    $("admGateMsg").textContent = "로그인 중...";
    var provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(function (e) {
      $("admGateMsg").textContent = "로그인 실패: " + (e && e.code ? e.code : "알 수 없는 오류");
    });
  });
  $("admSignOut").addEventListener("click", function () { auth.signOut(); });
  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    if (!user) { showGate(""); return; }
    // 서버가 발급한 토큰의 custom claim 으로만 관리자 여부를 판단한다(화면 표시용; 실제 권한은 모든 API 에서 서버가 다시 검증).
    user.getIdTokenResult(true).then(function (r) {
      if (r.claims && r.claims.admin === true) showApp(user);
      else showGate("이 계정에는 관리자 권한이 없습니다. 권한이 있는 계정으로 로그인하세요.");
    }).catch(function () { showGate("권한 확인에 실패했습니다. 다시 로그인하세요."); });
  });

  // ---------- 탭 ----------
  $("admTabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-tab]");
    if (!b) return;
    var name = b.getAttribute("data-tab");
    document.querySelectorAll(".adm-tab").forEach(function (t) { t.classList.toggle("is-active", t === b); });
    document.querySelectorAll("[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    if (name === "system") loadSystem();
  });

  // ---------- 푸시 ----------
  $("pushSubmit").addEventListener("click", function () {
    var out = $("pushResult");
    var title = $("pushTitle").value.trim(), body = $("pushBody").value.trim(), link = $("pushLink").value.trim();
    var sched = $("pushSchedule").value;
    if (!title || !body) { out.textContent = "제목과 내용은 필수예요."; return; }
    if (!window.confirm("푸시 알림을 " + (sched ? "예약" : "지금 전체 발송") + "할까요?")) return;
    out.textContent = "처리 중...";
    busy($("pushSubmit"), api("sendPushNotification", { method: "POST", body: { title: title, body: body, link: link ? "#" + link.replace(/^#/, "") : "", scheduledFor: sched ? new Date(sched).toISOString() : null } }))
      .then(function (d) {
        out.textContent = d.scheduled ? "예약 완료 (" + d.scheduledFor + ")" : "발송 완료: 성공 " + d.successCount + "건 / 실패 " + d.failureCount + "건";
      }).catch(function (e) { out.textContent = "실패: " + e.message; });
  });

  // ---------- 캘린더 ----------
  var DETAIL_IDS = { eligibility: "calEligibility", applyPeriod: "calApplyPeriod", supplyType: "calSupplyType", winnerDate: "calWinnerDate", underwriter: "calUnderwriter", offerPrice: "calOfferPrice", refundDate: "calRefundDate", listingDate: "calListingDate" };
  function resetCalForm() {
    $("calEditId").value = "";
    ["calDate", "calTitle", "calMeta", "calLink", "calDescription"].forEach(function (i) { $(i).value = ""; });
    Object.keys(DETAIL_IDS).forEach(function (k) { $(DETAIL_IDS[k]).value = ""; });
    $("calCategory").value = "subsidy"; $("calStatus").value = ""; $("calFlag").value = "kr"; $("calImportance").value = "";
    $("calHidden").checked = false;
    $("calSubmit").textContent = "등록하기"; $("calCancel").hidden = true; $("calFormTitle").textContent = "캘린더 일정 등록";
  }
  function fillCalForm(ev) {
    $("calEditId").value = ev.id;
    $("calCategory").value = ev.category || "subsidy"; $("calDate").value = ev.date || ""; $("calTitle").value = ev.title || "";
    $("calMeta").value = ev.meta || ""; $("calStatus").value = ev.status || ""; $("calFlag").value = ev.flag || "kr"; $("calLink").value = ev.link || "";
    var d = ev.details || {};
    Object.keys(DETAIL_IDS).forEach(function (k) { $(DETAIL_IDS[k]).value = typeof d[k] === "string" ? d[k] : ""; });
    $("calImportance").value = ev.importanceOverride || ""; $("calDescription").value = ev.descriptionOverride || ""; $("calHidden").checked = !!ev.hidden;
    $("calSubmit").textContent = "수정 저장"; $("calCancel").hidden = false; $("calFormTitle").textContent = "일정 수정";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  $("calCancel").addEventListener("click", resetCalForm);
  $("calSubmit").addEventListener("click", function () {
    var out = $("calResult");
    var date = $("calDate").value, title = $("calTitle").value.trim();
    if (!date || !title) { out.textContent = "날짜와 제목은 필수예요."; return; }
    var details = {};
    Object.keys(DETAIL_IDS).forEach(function (k) { var v = $(DETAIL_IDS[k]).value.trim(); if (v) details[k] = v; });
    var id = $("calEditId").value;
    var payload = {
      date: date, category: $("calCategory").value, title: title, meta: $("calMeta").value.trim(),
      status: $("calStatus").value || null, flag: $("calFlag").value, link: $("calLink").value.trim(),
      details: Object.keys(details).length ? details : null, importanceOverride: $("calImportance").value || null,
      descriptionOverride: $("calDescription").value.trim() || null, hidden: $("calHidden").checked
    };
    if (id) payload.id = id;
    out.textContent = "저장 중...";
    busy($("calSubmit"), api("upsertCalendarEvent", { method: id ? "PUT" : "POST", body: payload })).then(function () {
      out.textContent = "저장 완료!"; resetCalForm(); loadCalendarList();
    }).catch(function (e) { out.textContent = "실패: " + e.message; });
  });
  function loadCalendarList() {
    var box = $("calList"); clear(box);
    api("adminData", { query: { kind: "calendar" } }).then(function (d) {
      var items = d.items || [];
      if (!items.length) { box.appendChild(el("p", { cls: "adm-result", text: "등록된 일정이 없어요." })); return; }
      items.forEach(function (ev) {
        var edit = el("button", { cls: "adm-btn adm-btn-ghost adm-btn-sm", text: "수정", attrs: { type: "button" } });
        var del = el("button", { cls: "adm-btn adm-btn-danger adm-btn-sm", text: "삭제", attrs: { type: "button" } });
        edit.addEventListener("click", function () {
          api("adminData", { query: { kind: "calendarEvent", id: ev.id } }).then(function (r) { fillCalForm(r.item); }).catch(function (e) { $("calResult").textContent = "실패: " + e.message; });
        });
        del.addEventListener("click", function () {
          if (!window.confirm("정말 삭제할까요?")) return;
          busy(del, api("deleteCalendarEvent", { method: "DELETE", query: { id: ev.id } })).then(loadCalendarList).catch(function (e) { $("calResult").textContent = "삭제 실패: " + e.message; });
        });
        box.appendChild(el("div", { cls: "adm-item" }, [
          el("p", { cls: "adm-item-title", text: "[" + ev.category + "] " + ev.title }),
          el("p", { cls: "adm-item-meta", text: ev.date + (ev.source ? " · " + ev.source : "") }),
          el("div", { cls: "adm-row" }, [edit, del])
        ]));
      });
    }).catch(function (e) { box.appendChild(el("p", { cls: "adm-result", text: "목록을 불러오지 못했어요: " + e.message })); });
  }

  // ---------- 동기화·로그 ----------
  function listInto(boxId, kind, render, emptyMsg) {
    var box = $(boxId); clear(box);
    return api("adminData", { query: { kind: kind } }).then(function (d) {
      var items = d.items || [];
      if (!items.length) { box.appendChild(el("p", { cls: "adm-result", text: emptyMsg })); return; }
      items.forEach(function (it) { box.appendChild(render(it)); });
    }).catch(function (e) { box.appendChild(el("p", { cls: "adm-result", text: "불러오지 못했어요: " + e.message })); });
  }
  function loadSystem() {
    listInto("reviewList", "needsReview", function (ev) {
      var meta = el("p", { cls: "adm-item-meta", text: ev.date });
      var url = safeHttpUrl(ev.sourceUrl);
      if (url) { meta.appendChild(document.createTextNode(" · ")); meta.appendChild(el("a", { text: "원문 확인", attrs: { href: url, target: "_blank", rel: "noopener noreferrer" } })); }
      return el("div", { cls: "adm-item" }, [el("p", { cls: "adm-item-title", text: "[" + ev.category + "] " + ev.title }), meta]);
    }, "검수가 필요한 일정이 없어요.");
    listInto("logList", "syncLogs", function (l) {
      return el("div", { cls: "adm-item" }, [
        el("p", { cls: "adm-item-title", text: "[" + (l.error ? "실패" : "성공") + "] " + l.job }),
        el("p", { cls: "adm-item-meta", text: fmtDate(l.ranAt) + (l.result ? " · " + l.result : "") + (l.error ? " · " + l.error : "") })
      ]);
    }, "아직 실행 기록이 없어요.");
    listInto("indicatorList", "indicators", function (i) {
      return el("div", { cls: "adm-item" }, [
        el("p", { cls: "adm-item-title", text: (i.label || i.id) + ": " + i.value + (i.unit ? " " + i.unit : "") }),
        el("p", { cls: "adm-item-meta", text: "기준시점 " + i.period + " · 수집시각 " + fmtDate(i.collectedAt) })
      ]);
    }, "아직 수집된 지표가 없어요.");
  }
  function bindSync(btnId, fn, method, noAuth) {
    $(btnId).addEventListener("click", function () {
      var out = $("syncResult"); out.textContent = "실행 중...";
      var p = noAuth ? fetch(FN_BASE + fn).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "오류 " + r.status); return d; }); })
        : api(fn, { method: method });
      busy($(btnId), p).then(function (d) { out.textContent = "완료: " + JSON.stringify(d).slice(0, 300); loadSystem(); loadCalendarList(); })
        .catch(function (e) { out.textContent = "실패: " + e.message; });
    });
  }
  bindSync("syncCalendarBtn", "syncFinancialCalendarManual", "POST");
  bindSync("syncEconBtn", "syncEconomicIndicatorsManual", "POST");
  bindSync("syncIpoBtn", "ipoSchedulesLive", "GET", true); // 공개 캐시 갱신 API(관리자 인증 불필요)

  // ---------- 세무 상담 ----------
  $("taxLoad").addEventListener("click", function () {
    var out = $("taxResult"), box = $("taxList"); clear(box); out.textContent = "불러오는 중...";
    busy($("taxLoad"), api("getTaxConsultLeads")).then(function (d) {
      var leads = d.leads || []; out.textContent = leads.length + "건";
      if (!leads.length) { box.appendChild(el("p", { cls: "adm-result", text: "신청 내역이 없어요." })); return; }
      leads.forEach(function (l) {
        box.appendChild(el("div", { cls: "adm-item" }, [
          el("p", { cls: "adm-item-title", text: "[" + l.category + "] " + l.contact }),
          el("p", { cls: "adm-item-meta", text: l.message || "(내용 없음)" }),
          el("p", { cls: "adm-item-meta", text: fmtDate(l.createdAt) })
        ]));
      });
    }).catch(function (e) { out.textContent = "실패: " + e.message; });
  });

  // ---------- 라운지 ----------
  function modCall(payload) { return api("moderateLounge", { method: "POST", body: payload }); }
  function loadLounge() {
    var out = $("loungeResult"), box = $("loungeList"); clear(box); out.textContent = "불러오는 중...";
    modCall({ action: "list" }).then(function (d) {
      var items = d.items || []; out.textContent = "신고된 항목 " + items.length + "건";
      items.forEach(function (it) {
        var mk = function (label, act, danger) {
          var b = el("button", { cls: "adm-btn adm-btn-sm " + (danger ? "adm-btn-danger" : "adm-btn-ghost"), text: label, attrs: { type: "button" } });
          b.addEventListener("click", function () {
            var msg = act === "delete" ? "이 항목을 삭제할까요? (글이면 댓글도 함께 삭제됩니다)" : act === "ban" ? "작성자를 차단하고 작성한 글·댓글을 모두 삭제할까요?" : "신고를 해제할까요?";
            if (!window.confirm(msg)) return;
            var payload = act === "ban" ? { action: "ban", uid: it.uid, reason: "신고 누적", deleteContent: true } : { action: act, type: it.type, id: it.id };
            busy(b, modCall(payload)).then(loadLounge).catch(function (e) { out.textContent = "실패: " + e.message; });
          });
          return b;
        };
        box.appendChild(el("div", { cls: "adm-item" }, [
          el("p", { cls: "adm-item-title", text: "[" + (it.type === "post" ? "글" : "댓글") + "] " + (it.title || it.content) + (it.blinded ? " (블라인드됨)" : "") }),
          el("p", { cls: "adm-item-meta", text: it.title ? it.content : "" }),
          el("p", { cls: "adm-item-meta", text: "신고 " + it.reportCount + "건 · 작성자 " + it.uid }),
          el("div", { cls: "adm-row" }, [mk("삭제", "delete", true), mk("신고 해제", "dismiss", false), mk("작성자 차단(+글 삭제)", "ban", true)])
        ]));
      });
    }).catch(function (e) { out.textContent = "실패: " + e.message; });
  }
  $("loungeLoad").addEventListener("click", loadLounge);
  function manualBan(action) {
    var uid = $("loungeUid").value.trim(), out = $("loungeResult");
    if (!uid) { out.textContent = "uid를 입력하세요."; return; }
    if (!window.confirm(uid + " 계정을 " + (action === "ban" ? "차단" : "차단 해제") + "할까요?")) return;
    modCall({ action: action, uid: uid, reason: "관리자 수동 처리" }).then(function () { out.textContent = (action === "ban" ? "차단" : "차단 해제") + " 완료"; }).catch(function (e) { out.textContent = "실패: " + e.message; });
  }
  $("loungeBan").addEventListener("click", function () { manualBan("ban"); });
  $("loungeUnban").addEventListener("click", function () { manualBan("unban"); });
})();
