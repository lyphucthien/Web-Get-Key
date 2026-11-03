const { kv } = require("@vercel/kv");
const {
    KEY_RE, MC_NAME_RE, DISCORD_ID_RE,
    safeEqual, getClientIp, rateLimit
} = require("../lib/security");

// Use a dedicated secret for the Minecraft plugin. Falling back to
// VERIFY_SECRET keeps old setups working, but a leaked plugin config
// would then also let someone forge verify tokens, so set REDEEM_SECRET.
const SECRET = process.env.REDEEM_SECRET || process.env.VERIFY_SECRET;

if (!SECRET) {
    throw new Error("REDEEM_SECRET (or VERIFY_SECRET) is not configured");
}

module.exports = async (req, res) => {
    try {
        res.setHeader("Cache-Control", "no-store");

        const ip = getClientIp(req);

        // Limit wrong-secret guesses: 10 per 15 minutes per IP.
        if (!(await rateLimit(kv, "redeem", ip, 10, 15 * 60))) {
            res.setHeader("Retry-After", "900");

            return res.status(429).json({
                success: false,
                error: "Too many requests"
            });
        }

        const callerSecret = req.headers["x-redeem-secret"];

        if (!callerSecret || !safeEqual(callerSecret, SECRET)) {
            return res.status(403).json({
                success: false,
                error: "Not allowed to call this API"
            });
        }

        if (req.method === "GET") {

            const username = String(req.query?.username || "").trim();

            if (!MC_NAME_RE.test(username)) {
                return res.status(400).json({
                    success: false,
                    error: "Invalid username"
                });
            }

            const record = await kv.get(`verified:${username.toLowerCase()}`);

            return res.status(200).json({
                success: true,
                verified: !!record
            });
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", "GET, POST");

            return res.status(405).json({
                success: false,
                error: "Method not allowed"
            });
        }

        const { key, minecraftUsername, discordId } = req.body || {};

        if (!key || !minecraftUsername) {
            return res.status(400).json({
                success: false,
                error: "Missing key or Minecraft username"
            });
        }

        const cleanKey = String(key).trim();
        const username = String(minecraftUsername).trim();
        const cleanDiscordId = discordId ? String(discordId).trim() : null;

        if (!KEY_RE.test(cleanKey)) {
            return res.status(400).json({
                success: false,
                error: "Invalid key"
            });
        }

        if (!MC_NAME_RE.test(username)) {
            return res.status(400).json({
                success: false,
                error: "Invalid Minecraft username"
            });
        }

        if (cleanDiscordId && !DISCORD_ID_RE.test(cleanDiscordId)) {
            return res.status(400).json({
                success: false,
                error: "Invalid Discord ID"
            });
        }

        const [isUnifiedKey, isMinecraftKey, isLpthubKey] = await Promise.all([
            kv.sismember("issued-set-lpt", cleanKey),
            kv.sismember("issued-set-minecraft", cleanKey),
            kv.sismember("issued-set-lpthub", cleanKey)
        ]);

        if (!isUnifiedKey && !isMinecraftKey && !isLpthubKey) {
            return res.status(400).json({
                success: false,
                error: "Invalid key"
            });
        }

        const redeemKey = `redeemed:${cleanKey}`;

        const record = {
            minecraftUsername: username,
            discordId: cleanDiscordId,
            redeemedAt: Date.now()
        };

        const claimed = await kv.set(redeemKey, record, { nx: true });

        if (!claimed) {
            return res.status(400).json({
                success: false,
                error: "This key has already been activated"
            });
        }

        try {
            await kv.set(`verified:${username.toLowerCase()}`, record);
        } catch (error) {
            await kv.del(redeemKey).catch(() => {});
            throw error;
        }

        return res.status(200).json({
            success: true
        });

    } catch (error) {

        console.error("Redeem key error:", error);

        return res.status(500).json({
            success: false,
            error: "Server error"
        });
    }
};
