const test = require("node:test");
const assert = require("node:assert");
const { withServer } = require("./helpers");
const C = require("../lib/content");

test("home page: Accept text/markdown returns Markdown + Vary: Accept", () => withServer(async (_s, get) => {
  const r = await get({ pathname: "/", headers: { Accept: "text/markdown" } });
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /^text\/markdown/);
  assert.match(r.headers["vary"], /Accept/i);
  assert.ok(r.body.startsWith("# " + C.TITLE));
  for (const f of C.FAQ) assert.ok(r.body.includes(f.q));
  assert.ok(r.body.includes(C.SITE_URL + "/sitemap.xml"));
}));

test("home page: Accept text/html and */* still return HTML + Vary: Accept", () => withServer(async (_s, get) => {
  for (const accept of ["text/html", "*/*", undefined]) {
    const r = await get({ pathname: "/", headers: accept ? { Accept: accept } : {} });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /^text\/html/);
    assert.match(r.headers["vary"], /Accept/i);
    assert.match(r.body, /<h1>/);
  }
}));

test("404: correct status, Markdown on request, has llms.txt/sitemap/docs links", () => withServer(async (_s, get) => {
  const r = await get({ pathname: "/khong-ton-tai-abc", headers: { Accept: "text/markdown" } });
  assert.equal(r.status, 404);
  assert.match(r.headers["content-type"], /^text\/markdown/);
  assert.match(r.headers["vary"], /Accept/i);
  assert.ok(r.body.length > 20);
  assert.match(r.body, /llms\.txt/);
  assert.match(r.body, /sitemap\.xml/);
  assert.match(r.body, /\/docs/);
}));

test("404: HTML for browsers, does not reflect the path", () => withServer(async (_s, get) => {
  const r = await get({ pathname: "/%3Cscript%3Ealert(1)%3C/script%3E", headers: { Accept: "text/html" } });
  assert.equal(r.status, 404);
  assert.match(r.headers["content-type"], /^text\/html/);
  assert.ok(!r.body.includes("alert(1)"));
  assert.match(r.body, /404/);
}));

test("404 also applies to nested paths and a non-existent /api", () => withServer(async (_s, get) => {
  for (const p of ["/a/b/c", "/api/khong-co"]) {
    const r = await get({ pathname: p, headers: { Accept: "text/markdown" } });
    assert.equal(r.status, 404, p);
    assert.match(r.headers["content-type"], /^text\/markdown/);
  }
}));

test("existing pages are not swallowed by the catch-all", () => withServer(async (_s, get) => {
  for (const p of ["/get-key", "/games", "/about", "/contact", "/privacy", "/docs"]) {
    const r = await get({ pathname: p });
    assert.equal(r.status, 200, p);
    assert.match(r.headers["content-type"], /^text\/html/, p);
  }
  const css = await get({ pathname: "/CSS/style.css" });
  assert.equal(css.status, 200);
  assert.match(css.headers["content-type"], /css/);
  const games = await get({ pathname: "/api/games" });
  assert.equal(games.status, 200);
  assert.equal(JSON.parse(games.body).success, true);
}));

test("/verify still goes to verify-start (not caught by the catch-all)", () => {
  const cfg = require("../vercel.json");
  const order = cfg.rewrites.map(r => r.source);
  assert.ok(order.indexOf("/verify") < order.indexOf("/((?!_vercel).*)"));
  assert.equal(order[order.length - 1], "/((?!_vercel).*)");
  assert.equal(cfg.rewrites.find(r => r.source === "/verify").destination, "/api/verify-start");
});

test("function count stays within the Hobby plan limit of 12", () => {
  const n = require("fs").readdirSync(require("path").join(__dirname, "..", "api")).filter(f => f.endsWith(".js")).length;
  assert.ok(n <= 12, "found " + n + " functions");
});
