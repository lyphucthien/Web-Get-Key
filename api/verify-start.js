const crypto = require("crypto");
const { kv } = require("@vercel/kv");

const SECRET = process.env.VERIFY_SECRET;

if (!SECRET) {
    throw new Error("VERIFY_SECRET is not configured");
}

const MIN_MS = (Number(process.env.START_MIN_SECONDS) || 15) * 1000;
const MAX_MS = 30 * 60 * 1000;

function getCookie(req, name) {
    const header = req.headers.cookie;

    if (!header) {
        return null;
    }

    for (const part of header.split(";")) {
        const [key, ...rest] = part.trim().split("=");

        if (key === name) {
            return rest.join("=");
        }
    }

    return null;
}

function checkStart(raw) {
    if (!raw) {
        return "missing";
    }

    const parts = raw.split(".");

    if (parts.length !== 3) {
        return "missing";
    }

    const [provider, ts, sig] = parts;
    const timestamp = Number(ts);

    if (!provider || !/^\d{10,16}$/.test(ts) || !/^[0-9a-f]{64}$/.test(sig)) {
        return "missing";
    }

    const expected = crypto
        .createHmac("sha256", SECRET)
        .update(`start:${provider}:${ts}`)
        .digest("hex");

    const sigBuf = Buffer.from(sig, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");

    if (
        sigBuf.length !== expectedBuf.length ||
        !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
        return "missing";
    }

    const age = Date.now() - timestamp;

    if (age < 0 || age > MAX_MS) {
        return "expired";
    }

    if (age < MIN_MS) {
        return "fast";
    }

    return { ok: true, sig };
}

const CLEAR_START =
    "lpt_start=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax";

module.exports = async (req, res) => {
    try {
        const result = checkStart(getCookie(req, "lpt_start"));

        // Make the start cookie single-use so a captured value cannot be replayed.
        let replayed = false;

        if (result && result.ok) {
            const claimed = await kv.set(`used-start:${result.sig}`, 1, { nx: true, ex: 1800 });
            replayed = !claimed;
        }

        if (replayed || !(result && result.ok)) {
            res.writeHead(302, {
                "Set-Cookie": CLEAR_START,
                "Cache-Control": "no-store",
                "Location": `/get-key?error=${replayed ? "expired" : result}`
            });

            return res.end();
        }

        const ts = Date.now().toString();

        const sig = crypto
            .createHmac("sha256", SECRET)
            .update(ts)
            .digest("hex");

        const token = `${ts}.${sig}`;

        const tokenCookie = [
            `verify_token=${encodeURIComponent(token)}`,
            "Max-Age=900",
            "Path=/",
            "HttpOnly",
            "Secure",
            "SameSite=Lax"
        ].join("; ");

        res.writeHead(302, {
            "Set-Cookie": [tokenCookie, CLEAR_START],
            "Cache-Control": "no-store",
            "Location": "/get-key?claim=1"
        });

        res.end();

    } catch (error) {
        console.error("Verify start error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to create verification token"
        });
    }
};
