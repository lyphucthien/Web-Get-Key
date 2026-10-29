const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const SECRET = process.env.VERIFY_SECRET;
const TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const IP_LOCK_SECONDS = 3 * 60 * 60;
const LPTHUB_KEY_DURATION_MS = 3 * 60 * 60 * 1000;

if (!SECRET) {
    throw new Error("VERIFY_SECRET is not configured");
}

// =====================================
// KEY CHUNG
// =====================================

const KEY_SET = "issued-set-lpt";
const IP_PREFIX = "ip-lpt";

const LEGACY_SETS = {
    minecraft: "issued-set-minecraft",
    lpthub: "issued-set-lpthub"
};

const VERIFY_TYPES = ["minecraft", "lpthub"];

function generateKey() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    let part1 = "";
    let part2 = "";

    for (let i = 0; i < 8; i++) {
        part1 += letters[crypto.randomInt(letters.length)];
    }

    for (let i = 0; i < 8; i++) {
        part2 += digits[crypto.randomInt(digits.length)];
    }

    return `LPT-${part1}-${part2}`;
}

async function isIssuedKey(key, type) {
    if (await kv.sismember(KEY_SET, key)) {
        return true;
    }

    return !!(await kv.sismember(LEGACY_SETS[type], key));
}

// =====================================
// KIỂM TRA TOKEN
// =====================================

function isValidToken(token) {
    if (!token || typeof token !== "string") {
        return false;
    }

    const parts = token.split(".");

    if (parts.length !== 2) {
        return false;
    }

    const [ts, sig] = parts;
    const timestamp = Number(ts);

    if (!Number.isFinite(timestamp)) {
        return false;
    }

    const expectedSig = crypto
        .createHmac("sha256", SECRET)
        .update(ts)
        .digest("hex");

    const sigBuf = Buffer.from(sig, "utf8");
    const expectedBuf = Buffer.from(expectedSig, "utf8");

    if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
        return false;
    }

    const age = Date.now() - timestamp;

    return age >= 0 && age <= TOKEN_MAX_AGE_MS;
}

// =====================================
// IP VÀ COOKIE
// =====================================

function getClientIp(req) {
    const forwarded = req.headers["x-forwarded-for"] || "";

    return (
        forwarded.split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        "unknown"
    );
}

function getCookie(req, name) {
    const cookieHeader = req.headers.cookie;

    if (!cookieHeader) {
        return null;
    }

    for (const cookie of cookieHeader.split(";")) {
        const [key, ...valueParts] = cookie.trim().split("=");

        if (key === name) {
            try {
                return decodeURIComponent(valueParts.join("="));
            } catch {
                return null;
            }
        }
    }

    return null;
}

// =====================================
// LPTHUB: KIỂM TRA THỜI HẠN KEY
// =====================================

function parseActivationRecord(value) {
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }

    return value && typeof value === "object" ? value : null;
}

async function getLptHubKeyLifetime(key) {
    const keyHash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex");

    const activationKey = `lpthub:activation:${keyHash}`;

    let stored = await kv.get(activationKey);

    if (stored === null || stored === undefined) {
        const activatedAt = Date.now();

        const newRecord = {
            activatedAt,
            expiresAt: activatedAt + LPTHUB_KEY_DURATION_MS
        };

        await kv.set(activationKey, newRecord, {
            nx: true
        });

        stored = await kv.get(activationKey);
    }

    const record = parseActivationRecord(stored);
    const activatedAt = Number(record?.activatedAt);
    const expiresAt = Number(record?.expiresAt);

    if (
        !Number.isFinite(activatedAt) ||
        !Number.isFinite(expiresAt) ||
        expiresAt - activatedAt !== LPTHUB_KEY_DURATION_MS
    ) {
        return {
            valid: false,
            expired: false,
            expiresAt: null,
            remainingSeconds: 0
        };
    }

    const remainingMs = expiresAt - Date.now();

    return {
        valid: remainingMs > 0,
        expired: remainingMs <= 0,
        expiresAt,
        remainingSeconds: Math.max(
            0,
            Math.ceil(remainingMs / 1000)
        )
    };
}

// =====================================
// LPTHUB: XÁC THỰC VÀ LIÊN KẾT HWID
// =====================================

async function verifyLptHubHwid(key, hwid, remainingSeconds) {
    const keyHash = crypto
        .createHash("sha256")
        .update(key)
        .digest("hex");

    const bindKey = `lpthub:hwid:${keyHash}`;

    await kv.set(bindKey, hwid, {
        nx: true,
        ex: remainingSeconds
    });

    const boundHwid = await kv.get(bindKey);

    if (String(boundHwid) !== hwid) {
        return {
            valid: false,
            hwidBound: false,
            error: "Key đã được liên kết với thiết bị khác"
        };
    }

    return {
        valid: true,
        hwidBound: true
    };
}

// =====================================
// API
// =====================================

module.exports = async (req, res) => {
    try {
        if (req.method !== "GET") {
            res.setHeader("Allow", "GET");

            return res.status(405).json({
                success: false,
                error: "Method not allowed"
            });
        }

        // =====================================
        // 1. KIỂM TRA KEY
        // =====================================

        if (typeof req.query?.key !== "undefined") {
            const typeParam = String(
                req.query?.type ||
                (typeof req.query?.hwid !== "undefined" ? "lpthub" : "minecraft")
            ).toLowerCase();

            if (!VERIFY_TYPES.includes(typeParam)) {
                return res.status(400).json({
                    success: false,
                    error: "Loại key không hợp lệ"
                });
            }

            const cleanKey = String(req.query.key).trim();

            if (!cleanKey) {
                return res.status(400).json({
                    success: false,
                    valid: false,
                    error: "Thiếu key"
                });
            }

            const exists = await isIssuedKey(cleanKey, typeParam);

            if (!exists) {
                return res.status(200).json({
                    success: true,
                    valid: false
                });
            }

            if (typeParam !== "lpthub") {
                return res.status(200).json({
                    success: true,
                    valid: true
                });
            }

            const lifetime = await getLptHubKeyLifetime(cleanKey);

            res.setHeader("Cache-Control", "no-store");

            const lifetimeResult = {
                success: true,
                valid: lifetime.valid,
                expired: lifetime.expired,
                expiresAt: lifetime.expiresAt,
                remainingSeconds: lifetime.remainingSeconds
            };

            if (!lifetime.valid) {
                return res.status(200).json(lifetimeResult);
            }

            if (typeof req.query?.hwid === "undefined") {
                return res.status(200).json(lifetimeResult);
            }

            const hwid = String(req.query.hwid || "").trim();

            if (!hwid || hwid.length > 200) {
                return res.status(400).json({
                    success: false,
                    valid: false,
                    error: "HWID không hợp lệ"
                });
            }

            const hwidResult = await verifyLptHubHwid(
                cleanKey,
                hwid,
                lifetime.remainingSeconds
            );

            if (!hwidResult.valid) {
                return res.status(403).json({...lifetimeResult,valid: false,hwidBound: false,error: hwidResult.error});
            }

            return res.status(200).json({...lifetimeResult,valid: true,hwidBound: true});
        }

        // =====================================
        // 2. CẤP KEY: KIỂM TRA TOKEN
        // =====================================

        res.setHeader("Cache-Control", "no-store");

        let token = req.query?.token;

        if (!token) {
            token = getCookie(req, "verify_token");
        }

        if (!isValidToken(token)) {
            return res.status(403).json({
                success: false,
                error: "Token không hợp lệ hoặc đã hết hạn"
            });
        }

        const ip = getClientIp(req);
        const tokenKey = `used-token:${token}`;
        const ipKey = `${IP_PREFIX}:${ip}`;

        const gotToken = await kv.set(tokenKey, true, {
            nx: true,
            ex: 15 * 60
        });

        if (!gotToken) {
            return res.status(403).json({
                success: false,
                error: "Token này đã được sử dụng"
            });
        }

        const gotIp = await kv.set(ipKey, "pending", {
            nx: true,
            ex: IP_LOCK_SECONDS
        });

        if (!gotIp) {
            await kv.del(tokenKey);

            return res.status(200).json({
                success: false,
                error: "Bạn này đã nhận KEY rồi"
            });
        }

        // =====================================
        // 3. CẤP KEY CHUNG
        // =====================================

        let issuedKey = null;

        try {
            for (let attempt = 0; attempt < 10; attempt++) {
                const candidate = generateKey();

                const added = await kv.sadd(KEY_SET, candidate);

                if (added === 1) {
                    issuedKey = candidate;
                    break;
                }
            }

            if (!issuedKey) {
                await kv.del(tokenKey);
                await kv.del(ipKey);

                return res.status(503).json({
                    success: false,
                    error: "Server is busy, please try again"
                });
            }

            await kv.set(ipKey, issuedKey, {
                ex: IP_LOCK_SECONDS
            });
        } catch (error) {
            await kv.del(tokenKey).catch(() => {});
            await kv.del(ipKey).catch(() => {});
            throw error;
        }

        res.setHeader(
            "Set-Cookie",
            "verify_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
        );

        return res.status(200).json({
            success: true,
            key: issuedKey
        });

    } catch (error) {
        console.error("Get key error:", error);

        return res.status(500).json({
            success: false,
            error: "Lỗi máy chủ khi xử lý KEY"
        });
    }
};
