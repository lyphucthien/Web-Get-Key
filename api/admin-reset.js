const { kv } = require("@vercel/kv");
const { enrichErrors, applyRateLimit } = require("../lib/api");
const { safeEqual, getClientIp, rateLimit } = require("../lib/security");

const ADMIN_SECRET = process.env.ADMIN_SECRET;

const RESET_TARGETS = {
    lpt:       { kvDel: ["issued-set-lpt"],                          ipPattern: "ip-lpt:*" },
    minecraft: { kvDel: ["issued-set-minecraft", "remaining-keys"],  ipPattern: "ip:*" },
    lpthub:    { kvDel: ["issued-set-lpthub"],                       ipPattern: "ip-lpthub:*" }
};

async function deleteByPattern(pattern) {
    let cursor = 0;
    let deleted = 0;

    for (let i = 0; i < 200; i++) {
        const [next, keys] = await kv.scan(cursor, {
            match: pattern,
            count: 200
        });

        if (keys.length) {
            await kv.del(...keys);
            deleted += keys.length;
        }

        cursor = Number(next);

        if (cursor === 0) {
            break;
        }
    }

    return deleted;
}

module.exports = async (req, res) => {
    try {
        enrichErrors(res);
        res.setHeader("Cache-Control", "no-store");

        // Refuse to run with a missing or weak secret.
        if (!ADMIN_SECRET || ADMIN_SECRET.length < 24) {
            return res.status(500).json({
                success: false,
                error: "Server is not configured"
            });
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");

            return res.status(405).json({
                success: false,
                error: "POST only"
            });
        }

        const ip = getClientIp(req);

        // Brute-force protection: 5 attempts per 15 minutes per IP.
        const allowed = (await rateLimit(kv, "admin", ip, 5, 15 * 60)).allowed;

        if (!allowed) {
            res.setHeader("Retry-After", "900");

            return res.status(429).json({
                success: false,
                error: "Too many attempts"
            });
        }

        const secret = req.headers["x-admin-secret"];

        if (!secret || !safeEqual(secret, ADMIN_SECRET)) {
            return res.status(403).json({
                success: false,
                error: "Forbidden"
            });
        }

        const typeParam = (req.query?.type || "").toString().toLowerCase();
        const target = Object.prototype.hasOwnProperty.call(RESET_TARGETS, typeParam)
            ? RESET_TARGETS[typeParam]
            : null;

        if (!target) {
            return res.status(400).json({
                success: false,
                error: "type must be 'lpt', 'minecraft' or 'lpthub'"
            });
        }

        if (req.query?.confirm !== "1") {
            return res.status(400).json({
                success: false,
                error: `This will delete: ${target.kvDel.join(", ")}. Add confirm=1 to confirm.`
            });
        }

        for (const name of target.kvDel) {
            await kv.del(name);
        }

        let ipNote = "IP locks were not touched (add resetIp=1 to delete them too)";

        if (req.query?.resetIp === "1") {
            const removed = await deleteByPattern(target.ipPattern);
            ipNote = `Deleted ${removed} IP locks (${target.ipPattern})`;
        }

        // Audit trail (no secrets).
        console.warn(`[admin-reset] type=${typeParam} ip=${ip} resetIp=${req.query?.resetIp === "1"}`);

        return res.status(200).json({
            success: true,
            message: `Key data reset for type "${typeParam}"`,
            ipNote
        });

    } catch (error) {
        console.error("Admin reset error:", error);

        return res.status(500).json({
            success: false,
            error: "Server error"
        });
    }
};
