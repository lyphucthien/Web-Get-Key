const test = require("node:test");
const assert = require("node:assert");
const { KEY_RE, HWID_RE, MC_NAME_RE, DISCORD_ID_RE, safeEqual, getClientIp, rateLimit } = require("../lib/security");

test("input validators accept good values and reject bad ones", () => {
  assert.ok(KEY_RE.test("LPT-A1B2C3D4E5F6"));
  assert.ok(!KEY_RE.test("x".repeat(65)));
  assert.ok(!KEY_RE.test("LPT-<script>"));
  assert.ok(HWID_RE.test("abc-123_DEF.9"));
  assert.ok(!HWID_RE.test("a b"));
  assert.ok(MC_NAME_RE.test("Steve_01"));
  assert.ok(!MC_NAME_RE.test("ab"));
  assert.ok(DISCORD_ID_RE.test("123456789012345678"));
  assert.ok(!DISCORD_ID_RE.test("abc"));
});

test("safeEqual compares in constant time and handles different lengths", () => {
  assert.ok(safeEqual("secret", "secret"));
  assert.ok(!safeEqual("secret", "secrets"));
});

test("getClientIp prefers Vercel headers and ignores a spoofed first x-forwarded-for entry", () => {
  assert.equal(getClientIp({ headers: { "x-vercel-forwarded-for": "1.1.1.1", "x-forwarded-for": "9.9.9.9, 2.2.2.2" } }), "1.1.1.1");
  assert.equal(getClientIp({ headers: { "x-forwarded-for": "9.9.9.9, 2.2.2.2" } }), "2.2.2.2");
});

test("rateLimit blocks after the limit and fails open on KV errors", async () => {
  const store = new Map();
  const kv = { incr: async k => { const n = (store.get(k) || 0) + 1; store.set(k, n); return n; }, expire: async () => {} };
  assert.equal(await rateLimit(kv, "t", "ip", 2, 60), true);
  assert.equal(await rateLimit(kv, "t", "ip", 2, 60), true);
  assert.equal(await rateLimit(kv, "t", "ip", 2, 60), false);
  assert.equal(await rateLimit({ incr: async () => { throw new Error("down"); } }, "t", "ip", 1, 60), true);
});
