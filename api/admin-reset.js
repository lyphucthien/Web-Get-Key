const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const ADMIN_SECRET = process.env.ADMIN_SECRET;

const RESET_TARGETS = {
    lpt:       { kvDel: ["issued-set-lpt"],                          ipPattern: "ip-lpt:*" },
    minecraft: { kvDel: ["issued-set-minecraft", "remaining-keys"],  ipPattern: "ip:*" },
    lpthub:    { kvDel: ["issued-set-lpthub"],                       ipPattern: "ip-lpthub:*" }
};

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));

    if (bufA.length !== bufB.length) {
        return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
}

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
        res.setHeader("Cache-Control", "no-store");

        if (!ADMIN_SECRET) {
            return res.status(500).json({
                success: false,
                error: "ADMIN_SECRET chưa được cấu hình trên server"
            });
        }

        if (req.method !== "POST") {
            res.setHeader("Allow", "POST");

            return res.status(405).json({
                success: false,
                error: "Chỉ chấp nhận POST"
            });
        }

        const secret = req.headers["x-admin-secret"];

        if (!secret || !safeEqual(secret, ADMIN_SECRET)) {
            return res.status(403).json({
                success: false,
                error: "Sai mật khẩu admin"
            });
        }

        const typeParam = (req.query?.type || "").toString().toLowerCase();
        const target = Object.prototype.hasOwnProperty.call(RESET_TARGETS, typeParam)
            ? RESET_TARGETS[typeParam]
            : null;

        if (!target) {
            return res.status(400).json({
                success: false,
                error: "type phải là 'lpt', 'minecraft' hoặc 'lpthub'"
            });
        }

        if (req.query?.confirm !== "1") {
            return res.status(400).json({
                success: false,
                error: `Sẽ xoá: ${target.kvDel.join(", ")}. Thêm confirm=1 để xác nhận.`
            });
        }

        for (const name of target.kvDel) {
            await kv.del(name);
        }

        let ipNote = "Không đụng tới khoá IP (thêm resetIp=1 để xoá luôn)";

        if (req.query?.resetIp === "1") {
            const removed = await deleteByPattern(target.ipPattern);
            ipNote = `Đã xoá ${removed} khoá IP (${target.ipPattern})`;
        }

        return res.status(200).json({
            success: true,
            message: `Đã reset dữ liệu key cho loại "${typeParam}"`,
            ipNote
        });

    } catch (error) {
        console.error("Admin reset error:", error);

        return res.status(500).json({
            success: false,
            error: "Lỗi máy chủ"
        });
    }
};
