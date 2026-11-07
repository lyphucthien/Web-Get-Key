const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { withServer } = require("./helpers");
const { DEFAULT_LANG, countryFromRequest, langFromCountry } = require("../lib/lang");
const i18n = require("../JS/i18n");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

test("the web default language is Vietnamese", () => {
  assert.equal(DEFAULT_LANG, "vi");
  assert.equal(i18n.DEFAULT_LANG, "vi");
});

test("langFromCountry: only Vietnam gets Vietnamese, unknown falls back to the default", () => {
  assert.equal(langFromCountry("VN"), "vi");
  for (const c of ["US", "GB", "DE", "JP", "SG", "TH", "CN"]) assert.equal(langFromCountry(c), "en", c);
  assert.equal(langFromCountry(null), "vi");
});

test("countryFromRequest: normalises the Vercel header and rejects unusable values", () => {
  const c = v => countryFromRequest({ headers: v === undefined ? {} : { "x-vercel-ip-country": v } });
  assert.equal(c("VN"), "VN");
  assert.equal(c(" vn "), "VN");
  assert.equal(c("US"), "US");
  for (const bad of [undefined, "", "XX", "T1", "VNM", "<script>", "1", "V N"]) assert.equal(c(bad), null, String(bad));
});

test("GET /api/lang answers from the visitor's country and is never cached", () => withServer(async (_s, get) => {
  const ask = async country => {
    const r = await get({ pathname: "/api/lang", headers: country === undefined ? {} : { "x-vercel-ip-country": country } });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /^application\/json/);
    assert.equal(r.headers["cache-control"], "private, no-store");
    return JSON.parse(r.body);
  };
  assert.deepEqual(await ask("VN"), { success: true, country: "VN", lang: "vi" });
  assert.deepEqual(await ask("vn"), { success: true, country: "VN", lang: "vi" });
  assert.deepEqual(await ask("US"), { success: true, country: "US", lang: "en" });
  assert.deepEqual(await ask("DE"), { success: true, country: "DE", lang: "en" });
  assert.deepEqual(await ask(undefined), { success: true, country: null, lang: "vi" });
  assert.deepEqual(await ask("XX"), { success: true, country: null, lang: "vi" });
  const post = await get({ method: "POST", pathname: "/api/lang" });
  assert.equal(post.status, 405);
  assert.equal(JSON.parse(post.body).code, "METHOD_NOT_ALLOWED");
}));

test("/api/lang is routed before the /api catch-all and does not add a function file", () => {
  const cfg = JSON.parse(read("vercel.json"));
  const src = cfg.rewrites.map(r => r.source);
  assert.ok(src.indexOf("/api/lang") >= 0 && src.indexOf("/api/lang") < src.indexOf("/api/(.*)"));
  assert.equal(cfg.rewrites.find(r => r.source === "/api/lang").destination, "/api/site?kind=lang");
  assert.ok(!fs.existsSync(path.join(ROOT, "api", "lang.js")));
});

test("every page hides the body only until the language is known, and i18n.js reveals it", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "HTML"))) {
    const html = read("HTML/" + f);
    assert.match(html, /html\.lang-pending body\{visibility:hidden\}/, f);
    // the class is added only by script, with a timeout as a safety net, so no-JS visitors always see the page
    assert.match(html, /classList\.add\("lang-pending"\);setTimeout\(function\(\)\{document\.documentElement\.classList\.remove\("lang-pending"\)\},2500\)/, f);
    assert.ok(!/<html[^>]*lang-pending/.test(html), f);
  }
  const js = read("JS/i18n.js");
  assert.match(js, /classList\.remove\("lang-pending"\)/);
  assert.match(js, /fetch\("\/api\/lang"/);
});

test("a saved choice always beats the detected country (storage keys)", () => {
  const js = read("JS/i18n.js");
  assert.match(js, /function detect\(\) \{ return stored\(\) \|\| cachedGeo\(\) \|\| DEFAULT_LANG; \}/);
  // the geo answer is only applied when the visitor has not chosen a language
  assert.match(js, /if \(next && !stored\(\)\)/);
  // only the switch writes the saved choice
  assert.equal((js.match(/localStorage\.setItem/g) || []).length, 1);
});

test("privacy page explains the IP-based language choice", () => {
  const html = read("HTML/privacy.html");
  assert.match(html, /<b>Language:<\/b> detected once from your IP address/);
  assert.ok(i18n.DICT["Language:"]);
});
