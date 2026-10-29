const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const SECRET = process.env.VERIFY_SECRET;

if (!SECRET) {
    throw new Error("VERIFY_SECRET is not configured");
}

const RESET_TARGETS = {
    lpt: {kvDel: ["issued-set-lpt"]},
    minecraft: {kvDel: ["issued-set-minecraft", "remaining-keys"]},
    lpthub: {kvDel: ["issued-set-lpthub"]}
};

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));

    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async (req, res) => {
    try {

        const secret = req.query?.secret;

        if (!secret || !safeEqual(secret, SECRET)) {
            return res.status(403).json({
                success: false,
                error: "Sai mật khẩu admin"
            });
        }

        const typeParam = (req.query?.type || "").toString().toLowerCase();
        const target = RESET_TARGETS[typeParam];

        if (!target) {
            return res.status(400).json({
                success: false,
                error: "type phải là 'lpt', 'minecraft' hoặc 'lpthub'"
            });
        }

        const resetIp = req.query?.resetIp === "1";

        for (const name of target.kvDel) {
            await kv.del(name);
        }

        let ipNote = "Không đụng tới khoá IP";

        if (resetIp) {
            ipNote =
                "Muốn xoá khoá IP, vào Upstash Data Browser " +
                "tìm theo prefix ip-lpt: (key chung) hoặc ip: / ip-lpthub: (key cũ) và xoá thủ công " +
                "(hoặc đợi tự hết hạn).";
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
            error: error.message
        });
    }
};
