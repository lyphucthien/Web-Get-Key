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

test("trang chủ: >=500 ký tự trong HTML thô, một H1, heading tuần tự", () => {
  const html = read("HTML/index.html");
  const len = textOf(main(html)).length;
  assert.ok(len >= 500, "chỉ có " + len);
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, "nhảy cấp heading: " + levels.join(","));
});

test("trang chủ khớp nội dung dùng cho Markdown", () => {
  const html = read("HTML/index.html");
  for (const f of C.FAQ) { assert.ok(html.includes(f.q)); assert.ok(html.includes(f.a)); }
  for (const s of C.STEPS) assert.ok(html.includes(s.title) && html.includes(s.text));
  assert.ok(html.includes(C.ABOUT));
  assert.ok(html.includes(C.TITLE));
});

test("metadata: canonical, lang, og:image, og:type trên mọi trang", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "HTML"))) {
    const html = read("HTML/" + f);
    assert.match(html, /<html lang="vi">/, f);
    assert.match(html, /<link rel="canonical" href="https:\/\/lyphucthien\.vercel\.app\/[^"]*">/, f);
    assert.match(html, /<meta property="og:image" content="https:\/\//, f);
    assert.match(html, /<meta property="og:type" content="website">/, f);
    assert.match(html, /<meta name="description" content="[^"]{20,}">/, f);
  }
});

test("JSON-LD trang chủ hợp lệ: Organization (contactPoint), SoftwareApplication, WebSite", () => {
  const html = read("HTML/index.html");
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(m);
  const ld = JSON.parse(m[1]);
  assert.equal(ld["@context"], "https://schema.org");
  const types = ld["@graph"].map(x => x["@type"]);
  assert.deepEqual(types.sort(), ["Organization", "SoftwareApplication", "WebSite"]);
  const org = ld["@graph"].find(x => x["@type"] === "Organization");
  assert.equal(org.contactPoint.contactType, "customer support");
  const app = ld["@graph"].find(x => x["@type"] === "SoftwareApplication");
  assert.ok(app.name && app.description && app.url && app.offers);
});

test("trang tin cậy có >=500 ký tự nội dung thật", () => {
  for (const f of ["about", "contact", "privacy"]) {
    const len = textOf(main(read(`HTML/${f}.html`))).length;
    assert.ok(len >= 500, f + " chỉ có " + len);
  }
});

test("footer có liên kết trust pages ở mọi trang", () => {
  for (const f of fs.readdirSync(path.join(ROOT, "HTML"))) {
    const html = read("HTML/" + f);
    for (const p of ["/about", "/contact", "/privacy"]) assert.ok(html.includes(`href="${p}"`), f + " thiếu " + p);
  }
});

test("sitemap.xml hợp lệ, đủ trang, có lastmod, không trùng", () => {
  const xml = read("sitemap.xml");
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(new Set(locs).size, locs.length);
  assert.equal(locs.length, [...xml.matchAll(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)].length);
  assert.deepEqual(locs.sort(), C.PAGES.map(p => C.SITE_URL + (p.path === "/" ? "/" : p.path)).sort());
  assert.ok(Buffer.byteLength(xml) < 50 * 1024 * 1024);
});

test("robots.txt trỏ tới sitemap", () => {
  assert.match(read("robots.txt"), /^Sitemap: https:\/\/lyphucthien\.vercel\.app\/sitemap\.xml$/m);
});

test("llms.txt theo định dạng llmstxt.org + có mục when-to-use", () => {
  const t = read("llms.txt");
  const lines = t.split("\n");
  assert.equal(lines[0], "# LPT Hub");
  assert.match(lines[2], /^> /);
  assert.match(t, /^## Khi nào nên dùng LPT Hub \(when to use\)$/m);
  assert.match(t, /^## Tài liệu cho nhà phát triển$/m);
  // mọi link đều là URL tuyệt đối tới site hoặc Discord
  for (const m of t.matchAll(/\]\((https?:[^)]+)\)/g)) assert.match(m[1], /^https:\/\/(lyphucthien\.vercel\.app|discord\.gg)\//);
  assert.ok(t.includes("/mcp") && t.includes("/openapi.json") && t.includes("/docs"));
});

test("openapi.json hợp lệ và khớp phản hồi thật của /api/games", () => withServer(async (_s, get) => {
  const spec = JSON.parse(read("openapi.json"));
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(spec.paths["/api/games"].get);
  const game = spec.components.schemas.Game;
  const live = JSON.parse((await get({ pathname: "/api/games" })).body);
  for (const g of live.games) {
    for (const key of game.required) assert.ok(key in g, key);
    for (const key of Object.keys(g)) assert.ok(key in game.properties, "schema thiếu " + key);
  }
  for (const key of spec.components.schemas.GamesResponse.required) assert.ok(key in live);
}));

test("tệp tĩnh được phục vụ đúng Content-Type", () => withServer(async (_s, get) => {
  const cases = [["/llms.txt", /text\/plain; charset=utf-8/], ["/sitemap.xml", /application\/xml/], ["/openapi.json", /application\/json/], ["/robots.txt", /text\/plain/]];
  for (const [p, re] of cases) {
    const r = await get({ pathname: p });
    assert.equal(r.status, 200, p);
    assert.match(r.headers["content-type"], re, p);
  }
}));
