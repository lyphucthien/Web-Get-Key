const crypto = require("crypto");

// Generic shape check (legacy keys may not use the LPT- format).
const KEY_RE = /^[A-Za-z0-9_-]{6,64}$/;
const HWID_RE = /^[A-Za-z0-9._:-]{1,200}$/;
const MC_NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const DISCORD_ID_RE = /^\d{15,25}$/;

// Constant-time string comparison (hashes first so length never leaks).
function safeEqual(a, b) {
    const ha = crypto.createHash("sha256").update(String(a)).digest();
    const hb = crypto.createHash("sha256").update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Prefer headers that Vercel sets itself; never trust the first
// x-forwarded-for entry, because a client can prepend its own value.
function getClientIp(req) {
    const h = req.headers || {};
    const vercel = String(h["x-vercel-forwarded-for"] || "").split(",")[0].trim();
    if (vercel) return vercel;
    const real = String(h["x-real-ip"] || "").trim();
    if (real) return real;
    const parts = String(h["x-forwarded-for"] || "").split(",").map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
    return (req.socket && req.socket.remoteAddress) || "unknown";
}

// Fixed-window rate limit backed by KV. Returns true when the request is allowed.
// Fails open if KV errors, so an outage does not lock everyone out.
async function rateLimit(kv, name, id, limit, windowSeconds) {
    try {
        const key = `rl:${name}:${id}`;
        const n = await kv.incr(key);
        if (n === 1) await kv.expire(key, windowSeconds);
        return n <= limit;
    } catch {
        return true;
    }
}

module.exports = { KEY_RE, HWID_RE, MC_NAME_RE, DISCORD_ID_RE, safeEqual, getClientIp, rateLimit };
