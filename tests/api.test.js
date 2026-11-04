const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
process.env.VERIFY_SECRET = process.env.VERIFY_SECRET || "test-secret-for-unit-tests";
const { withServer } = require("./helpers");
const { applyRateLimit, enrichErrors } = require("../lib/api");
const { renderGamesPage } = require("../lib/games-page");
const { prefersJson } = require("../lib/negotiate");

const json = r => JSON.parse(r.body);
const visibleText = html => html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

test("/api/v1/games is an alias of /api/games and carries API-Version + rate-limit headers", () => withServer(async (_s, get) => {
  const v1 = await get({ pathname: "/api/v1/games" });
  const legacy = await get({ pathname: "/api/games" });
  assert.equal(v1.status, 200);
  assert.deepEqual(json(v1), json(legacy));
  assert.equal(v1.headers["api-version"], "1");
  for (const h of ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "ratelimit-policy", "ratelimit"]) {
    assert.ok(v1.headers[h], h);
  }
  assert.equal(v1.headers["ratelimit-limit"], "120");
  assert.match(v1.headers["ratelimit-policy"], /^"default";q=120;w=60$/);
}));

test("/api/v1/games filters by status and query, and matches the MCP list_games result", () => withServer(async (_s, get) => {
  const all = json(await get({ pathname: "/api/v1/games" })).games;
  const on = json(await get({ pathname: "/api/v1/games?status=on" })).games;
  const soon = json(await get({ pathname: "/api/v1/games?status=soon" })).games;
  assert.deepEqual(on.map(g => g.id), all.filter(g => g.status === "on").map(g => g.id));
  assert.deepEqual(soon.map(g => g.id), all.filter(g => g.status === "soon").map(g => g.id));
  const hit = json(await get({ pathname: "/api/v1/games?query=" + encodeURIComponent(all[0].name.slice(0, 4).toUpperCase()) })).games;
  assert.ok(hit.some(g => g.id === all[0].id));
  assert.deepEqual(json(await get({ pathname: "/api/v1/games?query=zzzz-no-match" })).games, []);

  const rpc = await get({ method: "POST", pathname: "/mcp", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "list_games", arguments: { status: "on" } } }) });
  const mcpIds = JSON.parse(json(rpc).result.content[0].text).games.map(g => g.id);
  assert.deepEqual(mcpIds, on.map(g => g.id));
}));

test("invalid parameters return a JSON error with code, hint and the parameter name", () => withServer(async (_s, get) => {
  const r = await get({ pathname: "/api/v1/games?status=nope" });
  assert.equal(r.status, 400);
  assert.match(r.headers["content-type"], /^application\/json/);
  const b = json(r);
  assert.deepEqual([b.success, b.code, b.status, b.parameter], [false, "INVALID_PARAMETER", 400, "status"]);
  assert.ok(b.error && b.hint);
  const long = await get({ pathname: "/api/v1/games?query=" + "a".repeat(101) });
  assert.equal(long.status, 400);
  assert.equal(json(long).parameter, "query");
}));

test("unknown /api paths and JSON-preferring clients get JSON 404; browsers keep the HTML page", () => withServer(async (_s, get) => {
  const api = await get({ pathname: "/api/v1/nope", headers: { Accept: "text/html" } });
  assert.equal(api.status, 404);
  assert.match(api.headers["content-type"], /^application\/json/);
  assert.equal(json(api).code, "NOT_FOUND");
  assert.equal(api.headers["api-version"], "1");
  const asJson = await get({ pathname: "/nothing-here", headers: { Accept: "application/json" } });
  assert.equal(asJson.status, 404);
  assert.equal(json(asJson).code, "NOT_FOUND");
  const html = await get({ pathname: "/nothing-here", headers: { Accept: "text/html" } });
  assert.match(html.headers["content-type"], /^text\/html/);
  const post = await get({ method: "POST", pathname: "/api/v1/nope" });
  assert.equal(post.status, 405);
  assert.equal(json(post).code, "METHOD_NOT_ALLOWED");
}));

test("prefersJson only fires when JSON is wanted and HTML/Markdown are not", () => {
  assert.equal(prefersJson("application/json"), true);
  assert.equal(prefersJson("application/json, text/plain, */*"), true);
  assert.equal(prefersJson("text/html,application/json;q=0.9"), false);
  assert.equal(prefersJson("text/markdown, application/json"), false);
  assert.equal(prefersJson("*/*"), false);
  assert.equal(prefersJson(undefined), false);
});

test("key APIs add code/hint to errors without changing the error string", () => withServer(async (_s, get) => {
  const r = await get({ method: "POST", pathname: "/api/get-key" });
  assert.equal(r.status, 405);
  const b = json(r);
  assert.equal(b.error, "Method not allowed");
  assert.equal(b.code, "METHOD_NOT_ALLOWED");
  assert.ok(b.hint);
  assert.equal(r.headers["api-version"], "1");
  assert.ok(r.headers["ratelimit-limit"]);
}));

test("enrichErrors leaves success bodies and existing codes alone", () => {
  const sent = [];
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, json(b) { sent.push(b); } };
  enrichErrors(res);
  res.json({ success: true, x: 1 });
  res.statusCode = 429;
  res.json({ success: false, error: "slow down" });
  res.json({ success: false, error: "x", code: "CUSTOM" });
  assert.deepEqual(sent[0], { success: true, x: 1 });
  assert.equal(sent[1].code, "RATE_LIMITED");
  assert.equal(sent[1].status, 429);
  assert.equal(sent[2].code, "CUSTOM");
  assert.equal(res.headers["API-Version"], "1");
});

test("applyRateLimit sets RateLimit headers and answers 429 with Retry-After when exhausted", async () => {
  const store = new Map();
  const kv = { incr: async k => { const n = (store.get(k) || 0) + 1; store.set(k, n); return n; }, expire: async () => {} };
  const mk = () => {
    const r = { statusCode: 200, headers: {}, body: "", setHeader(k, v) { this.headers[k] = v; }, getHeader(k) { return this.headers[k]; }, end(b) { this.body = b; } };
    return r;
  };
  const req = { headers: { "x-vercel-forwarded-for": "9.9.9.9" } };
  const opts = { name: "t", limit: 2, window: 60, kv };
  const a = mk(); assert.equal(await applyRateLimit(req, a, opts), true);
  assert.equal(a.headers["RateLimit-Remaining"], "1");
  const b = mk(); assert.equal(await applyRateLimit(req, b, opts), true);
  assert.equal(b.headers["RateLimit-Remaining"], "0");
  const c = mk(); assert.equal(await applyRateLimit(req, c, opts), false);
  assert.equal(c.statusCode, 429);
  assert.ok(Number(c.headers["Retry-After"]) >= 1);
  const body = JSON.parse(c.body);
  assert.deepEqual([body.success, body.code, body.status], [false, "RATE_LIMITED", 429]);
  assert.equal(body.retryAfter, Number(c.headers["Retry-After"]));
  // a different client has its own budget
  const d = mk(); assert.equal(await applyRateLimit({ headers: { "x-vercel-forwarded-for": "8.8.8.8" } }, d, opts), true);
});

test("MCP responses advertise RateLimit headers and expose them to browsers", () => withServer(async (_s, get) => {
  const r = await get({ method: "POST", pathname: "/mcp", headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }) });
  assert.equal(r.status, 200);
  assert.ok(r.headers["ratelimit-limit"] && r.headers["ratelimit-remaining"]);
  assert.match(r.headers["access-control-expose-headers"], /RateLimit-Remaining/);
}));

test("/games has its content in the raw HTML (no JavaScript needed)", () => withServer(async (_s, get) => {
  const r = await get({ pathname: "/games" });
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /^text\/html/);
  const text = visibleText(r.body);
  assert.ok(text.length >= 500, "only " + text.length + " chars");
  const games = json(await get({ pathname: "/api/v1/games" })).games;
  for (const g of games) {
    assert.ok(r.body.includes("<h2>" + g.name + "</h2>"), g.name);
    assert.ok(text.includes(g.description), g.name + " description");
    for (const grp of g.features) for (const i of grp.items) assert.ok(text.includes(i), i);
  }
  assert.equal((r.body.match(/<h1>/g) || []).length, 1);
  // JavaScript users still get the interactive UI: the plain list is hidden, the grid script is intact
  assert.match(r.body, /\.js \.gl-ssr\{display:none\}/);
  assert.match(r.body, /id="grid"/);
  assert.match(r.body, /fetch\("\/api\/games"/);
}));

test("renderGamesPage escapes game data and fills the supported counter", () => {
  const tpl = '<b id="totalNum">0</b><!--GAMES_SSR-->';
  const html = renderGamesPage(tpl, [
    { id: "x", name: "<b>X</b>", status: "on", description: "a & b", features: [{ category: "C<", items: ["<i>"] }] },
    { id: "y", name: "Y", status: "soon", description: "", features: [] }
  ]);
  assert.ok(!html.includes("<b>X</b>"));
  assert.ok(html.includes("&lt;b&gt;X&lt;/b&gt;") && html.includes("a &amp; b") && html.includes("&lt;i&gt;"));
  assert.ok(html.includes('<b id="totalNum">1</b>'));
  assert.ok(html.includes("No description yet."));
  assert.equal(renderGamesPage(tpl, []), '<b id="totalNum">0</b>');
});

test("discovery: Link header on the home page and an RFC 9727 api-catalog", () => withServer(async (_s, get) => {
  const home = await get({ pathname: "/" });
  assert.match(home.headers.link, /<\/openapi\.json>; rel="service-desc"/);
  assert.match(home.headers.link, /<\/docs>; rel="service-doc"/);
  assert.match(home.headers.link, /rel="api-catalog"/);
  const cat = await get({ pathname: "/.well-known/api-catalog" });
  assert.equal(cat.status, 200);
  assert.match(cat.headers["content-type"], /^application\/linkset\+json; profile="https:\/\/www\.rfc-editor\.org\/info\/rfc9727"$/);
  const set = json(cat).linkset;
  assert.ok(Array.isArray(set) && set.length >= 1);
  for (const e of set) {
    assert.match(e.anchor, /^https:\/\/lyphucthien\.vercel\.app\//);
    for (const rel of ["service-desc", "service-doc"]) assert.ok(e[rel][0].href.startsWith("https://lyphucthien.vercel.app/"), rel);
  }
}));

test("vercel.json routes the new paths before the catch-all, and function config is complete", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "vercel.json"), "utf8"));
  const src = cfg.rewrites.map(r => r.source);
  const catchAll = src.findIndex(s => s.startsWith("/((?!_vercel)"));
  for (const s of ["/api/v1/games", "/api/(.*)", "/.well-known/api-catalog", "/games"]) {
    const i = src.indexOf(s);
    assert.ok(i >= 0 && i < catchAll, s);
  }
  assert.ok(src.indexOf("/api/v1/games") < src.indexOf("/api/(.*)"));
  assert.match(cfg.functions["api/site.js"].includeFiles, /Games\/\*\*/);
  assert.match(cfg.functions["api/site.js"].includeFiles, /HTML\/games\.html/);
});
