const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { DICT, translate, norm } = require("../JS/i18n");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const decode = s => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

function textNodes(html) {
  const cleaned = html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "");
  return cleaned.split(/<[^>]+>/).map(t => norm(decode(t))).filter(Boolean);
}
function attrValues(html) {
  const out = [];
  for (const m of html.matchAll(/\b(placeholder|aria-label|alt)="([^"]+)"/g)) out.push(norm(decode(m[2])));
  for (const m of html.matchAll(/<meta[^>]+(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"[^>]*content="([^"]+)"/g)) out.push(norm(decode(m[1])));
  for (const m of html.matchAll(/<meta[^>]+content="([^"]+)"[^>]*(?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)"/g)) out.push(norm(decode(m[1])));
  return out;
}

// Strings that are the same in both languages (names, symbols) or are filled in by the page at run time.
const SAME = /^(LPT Hub|Discord|Work\.ink|Link 4m|Link 4 Sub|Minecraft|Vercel|Vercel KV|Free|Link4m|Link4Sub|Key|©.*|https?:\/\/\S+|[a-z]+(_[a-z]+)+|&\w+;|[\W\d_]+|\d{1,2}:\d{2}(:\d{2})?)$/;

test("switch pages: every English text node and attribute has a Vietnamese translation", () => {
  const missing = [];
  for (const f of ["index", "getkey", "games", "about", "contact", "privacy"]) {
    const html = read(`HTML/${f}.html`);
    for (const t of [...textNodes(html), ...attrValues(html)]) {
      if (t.length < 3 || SAME.test(t)) continue;
      if (!DICT[t]) missing.push(`${f}: ${t.slice(0, 70)}`);
    }
  }
  assert.deepEqual(missing, []);
});

test("dictionary: no empty values, Vietnamese differs from English, key UI strings are covered", () => {
  for (const [en, vi] of Object.entries(DICT)) {
    assert.ok(vi && vi.trim(), en);
    assert.notEqual(vi, en);
    assert.equal(en, norm(en), "keys are normalised: " + en);
  }
  const vietnamese = /[ạảãấầẩẫậắằẳẵặẹẻẽếềểễệịỉĩọỏõốồổỗộớờởỡợụủũứừửữựỳỵỷỹđ]|[àáâăèéêìíòóôõơùúưý]/i;
  const vi = Object.values(DICT).filter(v => vietnamese.test(v)).length;
  assert.ok(vi / Object.keys(DICT).length > 0.9);
  for (const k of ["Home", "Games", "Get key", "Supported", "Coming soon", "Language", "Getting your KEY...", "Verification failed. Please redo the link."]) assert.ok(DICT[k], k);
});

test("translate(): Vietnamese only for vi, keeps surrounding whitespace, passes unknown text through", () => {
  assert.equal(translate("  Home \n", "vi"), "  Trang chủ \n");
  assert.equal(translate("Home", "en"), "Home");
  assert.equal(translate("Not in the dictionary", "vi"), "Not in the dictionary");
  assert.equal(translate("Get\n   key", "vi"), "Lấy key");
});

test("header has the EN/VI switch next to Discord, and every page loads i18n.js after layout.js", () => {
  const layout = read("JS/layout.js");
  const discord = layout.indexOf('aria-label="Discord"');
  const sw = layout.indexOf('class="lang-switch"');
  const key = layout.indexOf('class="cta cta-key"');
  assert.ok(discord > 0 && sw > discord && key > sw, "order: Discord, language switch, Get Key");
  assert.match(layout, /data-lang="en"/);
  assert.match(layout, /data-lang="vi"/);
  for (const f of fs.readdirSync(path.join(ROOT, "HTML"))) {
    const html = read("HTML/" + f);
    const a = html.indexOf('src="/JS/layout.js"'), b = html.indexOf('src="/JS/i18n.js"');
    assert.ok(a > 0 && b > a, f);
  }
});

test("i18n.js is served as JavaScript", async () => {
  const { withServer } = require("./helpers");
  await withServer(async (_s, get) => {
    const r = await get({ pathname: "/JS/i18n.js" });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /javascript/);
  });
});
