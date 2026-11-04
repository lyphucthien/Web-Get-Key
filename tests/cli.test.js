const test = require("node:test");
const assert = require("node:assert");
const { run, parseArgs, formatGames } = require("../cli/src/index");

function io(fetchImpl) {
  const out = [], err = [];
  return { out, err, io: { out: s => out.push(s), err: s => err.push(s), fetch: fetchImpl } };
}
const response = (status, body, headers = {}) => ({ ok: status < 400, status, headers: { get: k => headers[k.toLowerCase()] }, json: async () => body });
const GAME = { id: "A", name: "A", status: "on", type: "", description: "Desc", image: "", order: 1, features: [{ category: "", items: ["x", "y"] }] };

test("cli: --help, --version, no command and unknown input", async () => {
  let t = io(); assert.equal(await run(["--help"], t.io), 0); assert.match(t.out[0], /Usage:/);
  t = io(); assert.equal(await run(["--version"], t.io), 0); assert.match(t.out[0], /^\d+\.\d+\.\d+$/);
  t = io(); assert.equal(await run([], t.io), 2);
  t = io(); assert.equal(await run(["nope"], t.io), 2); assert.match(t.err[0], /Unknown command/);
  t = io(); assert.equal(await run(["games", "--bad"], t.io), 2);
  t = io(); assert.equal(await run(["games", "--status", "x"], t.io), 2);
  t = io(); assert.equal(await run(["games", "--query"], t.io), 2);
});

test("cli games: calls the versioned endpoint with filters and prints text or JSON", async () => {
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url: String(url), opts }; return response(200, { success: true, games: [GAME], errors: [] }); };
  let t = io(fetchImpl);
  assert.equal(await run(["games", "--status", "on", "--query", "mine craft"], t.io), 0);
  const u = new URL(seen.url);
  assert.equal(u.pathname, "/api/v1/games");
  assert.equal(u.searchParams.get("status"), "on");
  assert.equal(u.searchParams.get("query"), "mine craft");
  assert.equal(seen.opts.headers.Accept, "application/json");
  assert.match(t.out[0], /A \[supported\] \(2 features\)/);
  t = io(fetchImpl);
  assert.equal(await run(["games", "--json"], t.io), 0);
  assert.equal(JSON.parse(t.out[0]).games[0].id, "A");
});

test("cli games: API errors print message + hint and exit 1; network errors exit 1", async () => {
  let t = io(async () => response(429, { success: false, error: "Too many requests", hint: "Wait.", code: "RATE_LIMITED" }, { "retry-after": "30" }));
  assert.equal(await run(["games"], t.io), 1);
  assert.match(t.err[0], /Error 429: Too many requests/);
  assert.match(t.err[0], /Hint: Wait\./);
  assert.match(t.err[0], /Retry after 30s/);
  t = io(async () => { throw new Error("offline"); });
  assert.equal(await run(["games"], t.io), 1);
  assert.match(t.err[0], /Request failed: offline/);
});

test("cli key-info works offline, in text and JSON", async () => {
  let t = io(); assert.equal(await run(["key-info"], t.io), 0); assert.match(t.out[0], /get-key/);
  t = io(); assert.equal(await run(["key-info", "--json"], t.io), 0);
  assert.equal(JSON.parse(t.out[0]).waitHours, 3);
});

test("cli helpers", () => {
  assert.deepEqual(parseArgs(["games", "--json"]).flags, { json: true });
  assert.equal(formatGames([]), "No games found.");
});
