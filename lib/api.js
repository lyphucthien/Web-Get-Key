const { getClientIp, rateLimit } = require("./security");

const API_VERSION = "1";

// Every API response carries the API version so clients can pin to it.
function versionHeader(res) {
  res.setHeader("API-Version", API_VERSION);
}

// Structured JSON error: `error` stays a human-readable string (existing clients
// read it), `code` is a stable machine-readable identifier and `hint` says how to fix it.
function sendError(res, status, code, message, hint, extra) {
  versionHeader(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({ success: false, error: message, code, hint, status, ...(extra || {}) }));
}

// RateLimit-Limit/-Remaining/-Reset (IETF draft, widely deployed) plus the newer
// structured RateLimit and RateLimit-Policy fields.
function rateLimitHeaders(res, info) {
  res.setHeader("RateLimit-Limit", String(info.limit));
  res.setHeader("RateLimit-Remaining", String(info.remaining));
  res.setHeader("RateLimit-Reset", String(info.reset));
  res.setHeader("RateLimit-Policy", `"default";q=${info.limit};w=${info.window}`);
  res.setHeader("RateLimit", `"default";r=${info.remaining};t=${info.reset}`);
}

// KV is only used when it is configured (the Vercel KV integration sets these variables).
function defaultKv() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try { return require("@vercel/kv").kv; } catch { return null; }
}

// Counts the request against a per-IP limit and sets the RateLimit headers.
// Does not answer the request; returns the limit info (info.allowed tells the caller what to do).
async function checkRateLimit(req, res, { name, limit, window, kv }) {
  const store = kv || defaultKv();
  const info = store
    ? await rateLimit(store, name, getClientIp(req), limit, window)
    : { allowed: true, limit, remaining: limit, reset: window, window };

  rateLimitHeaders(res, info);
  if (!info.allowed) res.setHeader("Retry-After", String(info.reset));
  return info;
}

// REST helper: returns true if the request may continue; otherwise it has already
// answered with 429 + Retry-After and a JSON error.
async function applyRateLimit(req, res, opts) {
  versionHeader(res);
  const info = await checkRateLimit(req, res, opts);
  if (info.allowed) return true;

  sendError(res, 429, "RATE_LIMITED", "Too many requests", `Wait ${info.reset} seconds, then retry. Limit: ${info.limit} requests per ${info.window} seconds.`, { retryAfter: info.reset });
  return false;
}

const STATUS_ERRORS = {
  400: ["INVALID_REQUEST", "Check the request parameters and try again."],
  403: ["FORBIDDEN", "You are not allowed to call this endpoint."],
  404: ["NOT_FOUND", "Check the address. See /docs for the available endpoints."],
  405: ["METHOD_NOT_ALLOWED", "Check the Allow response header for the supported methods."],
  409: ["CONFLICT", "The resource is already in use."],
  429: ["RATE_LIMITED", "Wait for the Retry-After period, then retry."],
  500: ["SERVER_ERROR", "Retry in a moment. If it keeps failing, contact support on Discord."]
};

// Wraps res.json so every `{ success: false, error }` response also carries a stable
// `code`, a `hint` and the HTTP `status`. The existing `error` string is unchanged.
function enrichErrors(res) {
  versionHeader(res);
  const original = res.json.bind(res);
  res.json = (body) => {
    if (body && body.success === false && typeof body.error === "string" && !body.code) {
      const [code, hint] = STATUS_ERRORS[res.statusCode] || ["ERROR", "See /docs for details."];
      body = { ...body, code, hint, status: res.statusCode };
    }
    return original(body);
  };
}

module.exports = { checkRateLimit, enrichErrors, API_VERSION, versionHeader, sendError, rateLimitHeaders, applyRateLimit };
