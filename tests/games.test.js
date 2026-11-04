const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const { withServer } = require("./helpers");

test("api/games returns the same result as before the lib split", () => withServer(async (_s, get) => {
  const r = await get({ pathname: "/api/games" });
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "games-expected.json"), "utf8"));
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.body), expected);
  assert.match(r.headers["cache-control"], /s-maxage=60/);
}));

test("api/games: POST is rejected with 405 and a structured JSON error", () => withServer(async (_s, get) => {
  const r = await get({ method: "POST", pathname: "/api/games" });
  assert.equal(r.status, 405);
  assert.equal(r.headers.allow, "GET, HEAD");
  const body = JSON.parse(r.body);
  assert.equal(body.success, false);
  assert.equal(body.code, "METHOD_NOT_ALLOWED");
  assert.ok(body.error && body.hint);
}));

test("loadGames: missing folder, broken JSON, sorting, images", () => {
  const { loadGames } = require("../lib/games");
  assert.equal(loadGames("/khong/ton/tai").missingDir, true);
  const os = require("os");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "games-"));
  fs.writeFileSync(path.join(dir, "B.json"), JSON.stringify({ status: "soon", order: 1 }));
  fs.writeFileSync(path.join(dir, "A.json"), JSON.stringify({ status: "on", order: 5, features: ["x"] }));
  fs.writeFileSync(path.join(dir, "bad.json"), "{oops");
  fs.writeFileSync(path.join(dir, "A.png"), "");
  const { games, errors } = loadGames(dir);
  assert.deepEqual(games.map(g => g.id), ["A", "B"]);
  assert.equal(games[0].image, "/Games/A.png");
  assert.equal(errors.length, 1);
});
