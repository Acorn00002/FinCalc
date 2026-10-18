"use strict";
// 관리자 전용 HTTP 함수의 공통 인증·접근 제어.
// - Firebase ID Token(Authorization: Bearer ...)을 Admin SDK verifyIdToken()으로 검증하고
//   토큰의 custom claim `admin === true` 인 계정만 통과시킨다. 클라이언트가 보내는 이메일·UID는 신뢰하지 않는다.
// - 401: 토큰 없음/검증 실패, 403: 로그인했지만 admin claim 없음(또는 허용되지 않은 Origin), 405: 허용되지 않은 method, 429: 요청 제한.
// - 감사 로그에는 시각·endpoint·상태코드·해시된 행위자(UID 또는 IP)만 남긴다(토큰·헤더·본문·연락처는 절대 남기지 않음).
const crypto = require("crypto");

const ALLOWED_ORIGINS = [
  "https://www.gofincalc.com",
  "https://gofincalc.com",
  "https://asset-filot.web.app",
  "https://asset-filot.firebaseapp.com"
];
// Vercel Preview(이 프로젝트 계정의 fin-calc-* 배포)만 허용한다.
const PREVIEW_ORIGIN_RE = /^https:\/\/fin-calc-[a-z0-9-]+-wnstjd20620-2295s-projects\.vercel\.app$/;
// onRequest({ cors: ADMIN_CORS }) 에 그대로 전달한다.
// 로컬 에뮬레이터에서만 localhost 를 허용한다(배포 환경에서는 FUNCTIONS_EMULATOR 가 설정되지 않는다).
const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const IS_EMULATOR = process.env.FUNCTIONS_EMULATOR === "true";
const ADMIN_CORS = ALLOWED_ORIGINS.concat([PREVIEW_ORIGIN_RE]).concat(IS_EMULATOR ? [LOCAL_ORIGIN_RE] : []);

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.indexOf(origin) > -1 || PREVIEW_ORIGIN_RE.test(origin || "") || (IS_EMULATOR && LOCAL_ORIGIN_RE.test(origin || ""));
}

// 인스턴스 메모리 기반 슬라이딩 윈도우 제한기(함수 인스턴스별로 적용됨 — 단일 인스턴스 남용과 무차별 대입을 막는 용도).
class RateLimiter {
  constructor(max, windowMs, now) {
    this.max = max;
    this.windowMs = windowMs;
    this.now = now || Date.now;
    this.hits = new Map();
  }
  _prune(key) {
    const t = this.now() - this.windowMs;
    const arr = (this.hits.get(key) || []).filter((x) => x > t);
    if (arr.length) this.hits.set(key, arr); else this.hits.delete(key);
    return arr;
  }
  count(key) { return this._prune(key).length; }
  exceeded(key) { return this.count(key) >= this.max; }
  hit(key) {
    const arr = this._prune(key);
    arr.push(this.now());
    this.hits.set(key, arr);
    if (this.hits.size > 5000) { // 메모리 상한
      const first = this.hits.keys().next().value;
      this.hits.delete(first);
    }
  }
}

function clientIp(req) {
  // 클라이언트가 임의로 앞쪽 값을 채울 수 있으므로 플랫폼(프록시)이 덧붙이는 마지막 값을 사용한다.
  const fwd = req.headers && req.headers["x-forwarded-for"];
  if (fwd) { const parts = String(fwd).split(",").map((x) => x.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  return (req.ip || (req.socket && req.socket.remoteAddress) || "unknown");
}

function anon(kind, value, salt) {
  return kind + ":" + crypto.createHash("sha256").update(String(salt || "") + String(value)).digest("hex").slice(0, 12);
}

/**
 * @param {object} opts
 * @param {(token:string)=>Promise<object>} opts.verifyIdToken  admin.auth().verifyIdToken 래퍼
 * @param {{info:Function, warn:Function}} opts.logger
 * @param {number} [opts.failMax=10]       IP당 실패 허용 횟수(failWindowMs 안)
 * @param {number} [opts.failWindowMs=600000]
 * @param {number} [opts.uidMax=60]        UID당 허용 요청 수(uidWindowMs 안)
 * @param {number} [opts.uidWindowMs=60000]
 * @param {string} [opts.logSalt]
 * @param {()=>number} [opts.now]
 */
function createAdminGuard(opts) {
  const now = opts.now || Date.now;
  const failLimiter = new RateLimiter(opts.failMax || 10, opts.failWindowMs || 600000, now);
  const uidLimiter = new RateLimiter(opts.uidMax || 60, opts.uidWindowMs || 60000, now);
  const logger = opts.logger || console;
  const salt = opts.logSalt || "";

  function audit(endpoint, status, actor) {
    // 최소 정보만 기록한다.
    logger.info("admin_access", { ts: new Date(now()).toISOString(), endpoint: endpoint, status: status, actor: actor });
  }

  function deny(res, endpoint, status, actor, message, extraHeaders) {
    audit(endpoint, status, actor);
    if (extraHeaders) Object.keys(extraHeaders).forEach((k) => res.set(k, extraHeaders[k]));
    res.status(status).json({ error: message });
    return null;
  }

  /**
   * 허용되면 { uid } 를 반환하고, 거부하면 응답을 직접 보낸 뒤 null 을 반환한다.
   * @param {{endpoint:string, methods:string[]}} cfg
   */
  return async function guard(req, res, cfg) {
    const endpoint = cfg.endpoint;
    const ipActor = anon("ip", clientIp(req), salt);
    const ipKey = ipActor;

    if (cfg.methods.indexOf(req.method) === -1) {
      return deny(res, endpoint, 405, ipActor, "허용되지 않는 요청 방식입니다.", { Allow: cfg.methods.join(", ") });
    }
    const origin = req.headers && req.headers.origin;
    if (origin && !isAllowedOrigin(origin)) {
      failLimiter.hit(ipKey);
      return deny(res, endpoint, 403, ipActor, "허용되지 않은 출처입니다.");
    }

    // 실패가 많은 IP 에서 오는 "인증되지 않은" 요청만 429 로 막는다. 유효한 관리자 토큰은 서명 검증이 끝난 뒤 통과시켜,
    // 공격 트래픽이 같은 IP(공유 NAT 등)에 있어도 정상 관리자가 잠기지 않게 한다.
    const blocked = failLimiter.exceeded(ipKey);
    const reject = (status, actor, message) => {
      if (blocked) return deny(res, endpoint, 429, actor, "요청이 너무 많습니다. 잠시 후 다시 시도하세요.", { "Retry-After": "600" });
      failLimiter.hit(ipKey);
      return deny(res, endpoint, status, actor, message);
    };

    const header = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
    const m = /^Bearer\s+(\S+)$/i.exec(String(header));
    if (!m) return reject(401, ipActor, "인증이 필요합니다.");

    let decoded;
    try {
      decoded = await opts.verifyIdToken(m[1]);
    } catch (e) {
      return reject(401, ipActor, "인증에 실패했습니다.");
    }
    const uidActor = anon("uid", decoded.uid, salt);
    if (decoded.admin !== true) return reject(403, uidActor, "관리자 권한이 없습니다.");
    if (uidLimiter.exceeded(decoded.uid)) {
      return deny(res, endpoint, 429, uidActor, "요청이 너무 많습니다. 잠시 후 다시 시도하세요.", { "Retry-After": "60" });
    }
    uidLimiter.hit(decoded.uid);
    audit(endpoint, 200, uidActor);
    return { uid: decoded.uid };
  };
}

module.exports = { createAdminGuard, RateLimiter, ADMIN_CORS, ALLOWED_ORIGINS, PREVIEW_ORIGIN_RE, isAllowedOrigin, clientIp };
