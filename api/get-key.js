const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const SECRET = process.env.VERIFY_SECRET;
const TOKEN_MAX_AGE_MS = 15 * 60 * 1000;

const IP_LOCK_SECONDS = (3 * 60 * 60);

// =====================================
// CẤU HÌNH TỪNG LOẠI KEY
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

function generateLpthubKey() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";

    const chars = [];

    for (let i = 0; i < 8; i++) {
        chars.push(
            letters[Math.floor(Math.random() * letters.length)]
        );
    }

    for (let i = 0; i < 7; i++) {
        chars.push(
            digits[Math.floor(Math.random() * digits.length)]
        );
    }

    for (let i = chars.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    return "LPTHUB-" + chars.join("");
}

if (!SECRET) {
    throw new Error("VERIFY_SECRET is not configured");
}

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

function getClientIp(req) {
    const forwarded =
        req.headers["x-forwarded-for"] || "";

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

    const cookies = cookieHeader.split(";");

    for (const cookie of cookies) {
        const [key, ...valueParts] = cookie.trim().split("=");

        if (key === name) {
            return decodeURIComponent(valueParts.join("="));
        }
    }

    return null;
}

module.exports = async (req, res) => {
    try {

        const typeParam =
            (req.query?.type || "minecraft")
                .toString()
                .toLowerCase();

        const typeConfig = KEY_TYPES[typeParam];

        if (!typeConfig) {
            return res.status(400).json({
                success: false,
                error: "Loại key không hợp lệ"
            });
        }

        if (req.query?.key) {
            const cleanKey = String(req.query.key).trim();

            const setName =
                typeParam === "minecraft"
                    ? "issued-set-minecraft"
                    : "issued-set-lpthub";

            const exists = await kv.sismember(setName, cleanKey);

            return res.status(200).json({
                success: true,
                valid: !!exists
            });
        }

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
                error: "IP này đã nhận KEY rồi"
            });
        }

        if (typeConfig.generated) {

            let issuedKey = null;

            for (let attempt = 0; attempt < 10; attempt++) {

                const candidate = generateLpthubKey();

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

            await kv.set(
                ipKey,
                issuedKey,
                {ex: IP_LOCK_SECONDS}
            );

            await kv.set(
                tokenKey,
                true,
                {ex: 15 * 60}
            );

            res.setHeader(
                "Set-Cookie",
                "verify_token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax"
            );

            return res.status(200).json({
                success: true,
                key: issuedKey
            });
        }

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
                    typeConfig.file + " must contain an array of keys"
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

            await kv.set(
                ipKey,
                availableKey,
                {
                    ex: IP_LOCK_SECONDS
                }
            );

            await kv.set(
                tokenKey,
                true,
                {
                    ex: 15 * 60
                }
            );

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

        console.error(
            "Get key error:",
            error
        );

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
