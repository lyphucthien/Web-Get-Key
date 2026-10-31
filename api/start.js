const crypto = require("crypto");

const SECRET = process.env.VERIFY_SECRET;

if (!SECRET) {
    throw new Error("VERIFY_SECRET is not configured");
}

const PROVIDERS = {
    workink: "https://work.ink/34tV/lpt-hub-script-key-mission",
    link4m: "https://link4m.net/UMaxDw",
    link4sub: "https://link4sub.com/owycAYxKdu"
};

function signStart(provider, ts) {
    return crypto
        .createHmac("sha256", SECRET)
        .update(`start:${provider}:${ts}`)
        .digest("hex");
}

module.exports = (req, res) => {
    const provider = String(req.query?.p || "").toLowerCase();

    if (!Object.prototype.hasOwnProperty.call(PROVIDERS, provider)) {
        res.writeHead(302, { Location: "/get-key" });
        return res.end();
    }

    const ts = Date.now().toString();
    const value = `${provider}.${ts}.${signStart(provider, ts)}`;

    res.writeHead(302, {
        "Set-Cookie": `lpt_start=${value}; Max-Age=1800; Path=/; HttpOnly; Secure; SameSite=Lax`,
        "Cache-Control": "no-store",
        "Location": PROVIDERS[provider]
    });

    res.end();
};
