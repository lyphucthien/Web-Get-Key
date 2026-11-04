const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const C = require("../lib/content");
const { withServer } = require("./helpers");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const textOf = html => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const main = html => (/<main[\s\S]*?<\/main>/.exec(html) || [""])[0];

test("home page: >=500 characters in raw HTML, one H1, sequential headings", () => {
  const html = read("HTML/index.html");
  const len = textOf(main(html)).length;
  assert.ok(len >= 500, "only " + len);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, "heading level jump: " + levels.join(","));
});

test("home page matches the content used for Markdown", () => {
  const html = read("HTML/index.html");
  for (const f of C.FAQ) { assert.ok(html.includes(f.q)); assert.ok(html.includes(f.a)); }
  for (const s of C.STEPS) assert.ok(html.includes(s.title) && html.includes(s.text));
  assert.ok(html.includes(C.ABOUT));
  assert.ok(html.includes(C.TITLE));
});

test("metadata: canonical, lang, og:image, og:type on every page", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "HTML"))) {
    const html = read("HTML/" + f);
    assert.match(html, /<html lang="en">/, f);
    assert.match(html, /<link rel="canonical" href="https:\/\/lyphucthien\.vercel\.app\/[^"]*">/, f);
    assert.match(html, /<meta property="og:image" content="https:\/\//, f);
    assert.match(html, /<meta property="og:type" content="website">/, f);
    assert.match(html, /<meta name="description" content="[^"]{20,}">/, f);
  }
});

test("home page JSON-LD is valid: Organization (contactPoint), SoftwareApplication, WebSite", () => {
  const html = read("HTML/index.html");
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m);
  const ld = JSON.parse(m[1]);
  assert.equal(ld["@context"], "https://schema.org");
  const types = ld["@graph"].map(x => x["@type"]);
  assert.deepEqual(types.sort(), ["Organization", "SoftwareApplication", "WebSite"]);
  const org = ld["@graph"].find(x => x["@type"] === "Organization");
  assert.equal(org.contactPoint.contactType, "customer support");
  assert.equal(org.address["@type"], "PostalAddress");
  assert.ok(org.address.addressCountry);
  const app = ld["@graph"].find(x => x["@type"] === "SoftwareApplication");
  assert.ok(app.name && app.description && app.url && app.offers);
});

test("trust pages have >=500 characters of real content", () => {
  for (const f of ["about", "contact", "privacy"]) {
    const len = textOf(main(read(`HTML/${f}.html`))).length;
    assert.ok(len >= 500, f + " only has " + len);
  }
});

test("footer has trust page links on every page", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "HTML"))) {
    const html = read("HTML/" + f);
    for (const p of ["/about", "/contact", "/privacy"]) assert.ok(html.includes(`href="${p}"`), f + " missing " + p);
  }
});

test("sitemap.xml is valid, complete, has lastmod, no duplicates", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  assert.equal(locs.length, [...xml.matchAll(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)].length);
  assert.deepEqual(locs.sort(), C.PAGES.map(p => C.SITE_URL + (p.path === "/" ? "/" : p.path)).sort());
  assert.ok(Buffer.byteLength(xml) < 50 * 1024 * 1024);
});

test("robots.txt points to the sitemap", () => {
  assert.match(read("robots.txt"), /^Sitemap: https:\/\/lyphucthien\.vercel\.app\/sitemap\.xml$/m);
});

test("llms.txt follows the llmstxt.org format + has a when-to-use section", () => {
  const t = read("llms.txt");
  const lines = t.split("\n");
  assert.equal(lines[0], "# LPT Hub");
  assert.match(lines[2], /^> /);
  assert.match(t, /^## When to use LPT Hub \(when to use\)$/m);
  assert.match(t, /^## Developer documentation$/m);
  // every link is an absolute URL to the site or Discord
  for (const m of t.matchAll(/\]\((https?:[^)]+)\)/g)) assert.match(m[1], /^https:\/\/(lyphucthien\.vercel\.app|discord\.gg)\//);
  assert.ok(t.includes("/mcp") && t.includes("/openapi.json") && t.includes("/docs"));
});

test("openapi.json is valid, typed, and matches the real /api/v1/games response", () => withServer(async (_s, get) => {
  const spec = JSON.parse(read("openapi.json"));
  assert.equal(spec.openapi, "3.1.0");
  const op = spec.paths["/api/v1/games"].get;
  assert.equal(op.operationId, "listGames");
  assert.ok(op.description && op.summary);
  // every operation has a unique operationId and typed parameters
  const ids = Object.values(spec.paths).flatMap(p => Object.values(p).map(o => o.operationId));
  assert.equal(new Set(ids).size, ids.length);
  for (const p of op.parameters) assert.ok(p.name && p.schema && p.schema.type && p.description, p.name);
  for (const status of ["200", "400", "404", "405", "429"]) assert.ok(op.responses[status], status);
  assert.ok(op.responses["200"].headers["RateLimit-Limit"] && op.responses["429"].headers["Retry-After"]);
  assert.ok(spec.info["x-api-versioning"].deprecation);
  const game = spec.components.schemas.Game;
  const live = JSON.parse((await get({ pathname: "/api/v1/games" })).body);
  for (const g of live.games) {
    for (const key of game.required) assert.ok(key in g, key);
    for (const key of Object.keys(g)) assert.ok(key in game.properties, "schema missing " + key);
  }
  for (const key of spec.components.schemas.GamesResponse.required) assert.ok(key in live);
  const error = spec.components.schemas.Error;
  const bad = JSON.parse((await get({ pathname: "/api/v1/games?status=nope" })).body);
  for (const key of error.required) assert.ok(key in bad, key);
  assert.ok(error.properties.code.enum.includes(bad.code));
}));

test("docs page covers auth, endpoints, examples, errors, rate limits, versioning and the CLI", () => {
  const text = textOf(main(read("HTML/docs.html")));
  assert.ok(text.length >= 1500, "only " + text.length);
  for (const word of ["Authentication", "curl", "INVALID_PARAMETER", "Retry-After", "RateLimit-Remaining", "Deprecation", "Sunset", "/api/v1", "lpthub-cli"]) {
    assert.ok(text.includes(word), word);
  }
});

test("llms.txt lists the developer resources with the product name", () => {
  const t = read("llms.txt");
  assert.match(t, /\[LPT Hub API and MCP docs\]/);
  assert.match(t, /\[LPT Hub OpenAPI 3.1 spec\]/);
  assert.match(t, /\.well-known\/api-catalog/);
  assert.match(t, /\/api\/v1\/games/);
});

test("static files are served with the correct Content-Type", () => withServer(async (_s, get) => {
  const cases = [["/llms.txt", /text\/plain; charset=utf-8/], ["/sitemap.xml", /application\/xml/], ["/openapi.json", /application\/json/], ["/robots.txt", /text\/plain/]];
  for (const [p, re] of cases) {
    const r = await get({ pathname: p });
    assert.equal(r.status, 200, p);
    assert.match(r.headers["content-type"], re, p);
  }
}));
