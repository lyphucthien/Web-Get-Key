const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const REPO = "lyphucthien/LPT-Hub";
const BRANCH = "main";
const LPTHUB_KEY_DURATION_MS = 3 * 60 * 60 * 1000;

const SCRIPTS = {
    "universal": "Script Cho Game Ko Hỗ Trợ/Script.lua",
    "+1 Speed Keyboard Escape": "+1 Speed Keyboard Escape/MainUI.lua",
    "Blox Fruits": "Blox Fruits/Main.lua"
};

function parseActivationRecord(value) {
    if (typeof value === "string") {
        try { value = JSON.parse(value); } catch { return null; }
    }
    return value && typeof value === "object" ? value : null;
}

async function getRemainingSeconds(key) {
    const keyHash = crypto.createHash("sha256").update(key).digest("hex");
    const activationKey = `lpthub:activation:${keyHash}`;

    let stored = await kv.get(activationKey);

    if (stored === null || stored === undefined) {
        const activatedAt = Date.now();
        await kv.set(
            activationKey,
            { activatedAt, expiresAt: activatedAt + LPTHUB_KEY_DURATION_MS },
            { nx: true }
        );
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
        return 0;
    }

    return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
}

module.exports = async (req, res) => {
    try {
        const key = String(req.query?.key || "").trim();
        const hwid = String(req.query?.hwid || "").trim();
        const script = String(req.query?.script || "");

        if (!key || !hwid || hwid.length > 200 || !Object.prototype.hasOwnProperty.call(SCRIPTS, script)) {
            return res.status(400).send("bad request");
        }

        const issued = await kv.sismember("issued-set-lpthub", key);
        if (!issued) {
            return res.status(403).send("invalid key");
        }

        const remaining = await getRemainingSeconds(key);
        if (remaining <= 0) {
            return res.status(403).send("key expired");
        }

        const keyHash = crypto.createHash("sha256").update(key).digest("hex");
        const bindKey = `lpthub:hwid:${keyHash}`;

        await kv.set(bindKey, hwid, { nx: true, ex: remaining });
        const bound = await kv.get(bindKey);

        if (String(bound) !== hwid) {
            return res.status(403).send("key bound to another device");
        }

        if (!process.env.GITHUB_TOKEN) {
            console.error("GITHUB_TOKEN is not configured");
            return res.status(500).send("server error");
        }

        const filePath = SCRIPTS[script].split("/").map(encodeURIComponent).join("/");
        const r = await fetch(
            `https://api.github.com/repos/${REPO}/contents/${filePath}?ref=${BRANCH}`,
            {
                headers: {
                    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
                    Accept: "application/vnd.github.raw+json",
                    "User-Agent": "lpt-hub"
                }
            }
        );

        if (!r.ok) {
            console.error("GitHub fetch failed:", r.status, filePath);
            return res.status(502).send("upstream error");
        }

        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).send(await r.text());
    } catch (error) {
        console.error("Get script error:", error);
        return res.status(500).send("server error");
    }
};