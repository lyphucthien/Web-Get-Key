const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

test("api/games giữ nguyên kết quả như trước khi tách lib", () => {
  const handler = require("../api/games");
  let body, status; const headers = {};
  const res = { setHeader(k, v) { headers[k] = v; }, status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  handler({ method: "GET" }, res);
  const expected = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "games-expected.json"), "utf8"));
  assert.equal(status, 200);
  assert.deepEqual(body, expected);
  assert.match(headers["Cache-Control"], /s-maxage=60/);
});

test("api/games: POST bị từ chối 405", () => {
  const handler = require("../api/games");
  let status; const headers = {};
  const res = { setHeader(k, v) { headers[k] = v; }, status(c) { status = c; return this; }, json() { return this; } };
  handler({ method: "POST" }, res);
  assert.equal(status, 405);
  assert.equal(headers.Allow, "GET, HEAD");
});

test("loadGames: thư mục thiếu, JSON hỏng, sắp xếp, ảnh", () => {
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
