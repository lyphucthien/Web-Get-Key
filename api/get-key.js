const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const SECRET = process.env.VERIFY_SECRET;
const TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const IP_LOCK_SECONDS = 3 * 60 * 60;
const LPTHUB_KEY_DURATION_MS = 3 * 60 * 60 * 1000;

// =====================================
// CẤU HÌNH CÁC LOẠI KEY
// =====================================

const KEY_TYPES = {
    minecraft: {
        file: "keys.json",
        kvList: "remaining-keys",
        ipPrefix: "ip"
    },

    lpthub: {
        generated: true,
        kvIssuedSet: "issued-set-lpthub",
        ipPrefix: "ip-lpthub"
    }
};

if (!SECRET) {
    throw new Error("VERIFY_SECRET is not configured");
}

// =====================================
// TẠO KEY LPTHUB
// =====================================

function generateLptHubKey() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const chars = [];

    for (let i = 0; i < 8; i++) {
        chars.push(letters[crypto.randomInt(letters.length)]);
    }

    for (let i = 0; i < 7; i++) {
        chars.push(digits[crypto.randomInt(digits.length)]);
    }

    for (let i = chars.length - 1; i > 0; i--) {
        const j = crypto.randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return "LPTHUB-" + chars.join("");
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

    return value && typeof value === "object"
        ? value
        : null;
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

        const typeParam = String(
            req.query?.type || "minecraft"
        ).toLowerCase();

        const typeConfig = KEY_TYPES[typeParam];

        if (!typeConfig) {
            return res.status(400).json({
                success: false,
                error: "Loại key không hợp lệ"
            });
        }

        // =====================================
        // 1. KIỂM TRA KEY VÀ HWID
        // =====================================

        if (typeof req.query?.key !== "undefined") {
            const cleanKey = String(req.query.key).trim();

            if (!cleanKey) {
                return res.status(400).json({
                    success: false,
                    valid: false,
                    error: "Thiếu key"
                });
            }

            const setName = typeParam === "minecraft" ? "issued-set-minecraft" : "issued-set-lpthub";
            const exists = await kv.sismember(setName,cleanKey);

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
                res.setHeader("Cache-Control", "no-store");

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

            const hwidResult = await verifyLptHubHwid(cleanKey,hwid,lifetime.remainingSeconds);

            res.setHeader("Cache-Control", "no-store");

            if (!hwidResult.valid) {
                return res.status(403).json({
                    ...lifetimeResult,
                    valid: false,
                    hwidBound: false,
                    error: hwidResult.error
                });
            }

            return res.status(200).json({
                ...lifetimeResult,
                valid: true,
                hwidBound: true
            });
        }

        // =====================================
        // 2. CẤP KEY: KIỂM TRA TOKEN
        // =====================================

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

        const tokenKey = `used-token:${typeParam}:${token}`;

        const alreadyUsed = await kv.get(tokenKey);

        if (alreadyUsed) {
            return res.status(403).json({
                success: false,
                error: "Token này đã được sử dụng"
            });
        }

        const ipKey = `${typeConfig.ipPrefix}:${ip}`;

        const alreadyClaimedByIp = await kv.get(ipKey);

        if (alreadyClaimedByIp) {
            return res.status(200).json({
                success: false,
                error: "Bạn này đã nhận KEY rồi"
            });
        }

        // =====================================
        // 3. CẤP KEY LPTHUB
        // =====================================

        if (typeConfig.generated) {
            let issuedKey = null;

            for (let attempt = 0; attempt < 10; attempt++) {
                const candidate = generateLptHubKey();

                const added = await kv.sadd(
                    typeConfig.kvIssuedSet,
                    candidate
                );

                if (added === 1) {
                    issuedKey = candidate;
                    break;
                }
            }

            if (!issuedKey) {
                return res.status(503).json({
                    success: false,
                    error: "Server is busy, please try again"
                });
            }

            await kv.set(ipKey, issuedKey, {
                ex: IP_LOCK_SECONDS
            });

            await kv.set(tokenKey, true, {
                ex: 15 * 60
            });

            res.setHeader(
                "Set-Cookie",
                "verify_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
            );

            return res.status(200).json({
                success: true,
                key: issuedKey
            });
        }

        // =====================================
        // 4. CẤP KEY MINECRAFT
        // =====================================

        let keys = await kv.get(typeConfig.kvList);

        if (!keys) {
            const keysPath = path.join(
                process.cwd(),
                typeConfig.file
            );

            const keysData = JSON.parse(
                fs.readFileSync(keysPath, "utf8")
            );

            if (!Array.isArray(keysData)) {
                throw new Error(
                    `${typeConfig.file} must contain an array of keys`
                );
            }

            keys = keysData
                .map(key => String(key).trim())
                .filter(Boolean);

            await kv.set(typeConfig.kvList, keys);
        }

        if (keys.length === 0) {
            return res.status(404).json({
                success: false,
                error: "All keys have been claimed"
            });
        }

        for (let attempt = 0; attempt < 10; attempt++) {
            const currentKeys =
                (await kv.get(typeConfig.kvList)) || [];

            const availableKey = currentKeys[0];

            if (!availableKey) {
                return res.status(404).json({
                    success: false,
                    error: "All keys have been claimed"
                });
            }

            const updatedKeys = currentKeys.slice(1);

            await kv.set(
                typeConfig.kvList,
                updatedKeys
            );

            await kv.sadd(
                "issued-set-minecraft",
                availableKey
            );

            await kv.set(ipKey, availableKey, {
                ex: IP_LOCK_SECONDS
            });

            await kv.set(tokenKey, true, {
                ex: 15 * 60
            });

            res.setHeader(
                "Set-Cookie",
                "verify_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
            );

            return res.status(200).json({
                success: true,
                key: availableKey
            });
        }

        return res.status(503).json({
            success: false,
            error: "Server is busy, please try again"
        });

    } catch (error) {
        console.error("Get key error:", error);

        return res.status(500).json({
            success: false,
            error: "Lỗi máy chủ khi xử lý KEY"
        });
    }
};
