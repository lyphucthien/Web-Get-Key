const test = require("node:test");
const assert = require("node:assert");
const { withServer } = require("./helpers");

const H = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
const rpc = (get, body, pathname = "/mcp", headers = H) =>
  get({ method: "POST", pathname, headers, body: JSON.stringify(body) });

test("initialize thương lượng phiên bản và trả capabilities.tools", () => withServer(async (_s, get) => {
  let r = await rpc(get, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
  assert.equal(r.status, 200);
  assert.match(r.headers["content-type"], /application\/json/);
  const j = JSON.parse(r.body);
  assert.equal(j.jsonrpc, "2.0");
  assert.equal(j.id, 1);
  assert.equal(j.result.protocolVersion, "2025-03-26");
  assert.ok(j.result.capabilities.tools);
  assert.equal(j.result.serverInfo.name, "lpt-hub");

  r = await rpc(get, { jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "1999-01-01" } });
  assert.equal(JSON.parse(r.body).result.protocolVersion, "2025-06-18");
}));

test("hoạt động qua /.well-known/mcp", () => withServer(async (_s, get) => {
  const r = await rpc(get, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }, "/.well-known/mcp");
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).result.serverInfo.title, "LPT Hub");
}));

test("notification trả 202 không body", () => withServer(async (_s, get) => {
  const r = await rpc(get, { jsonrpc: "2.0", method: "notifications/initialized" });
  assert.equal(r.status, 202);
  assert.equal(r.body, "");
}));

test("tools/list có list_games và get_key_instructions với inputSchema", () => withServer(async (_s, get) => {
  const r = await rpc(get, { jsonrpc: "2.0", id: 3, method: "tools/list" });
  const tools = JSON.parse(r.body).result.tools;
  assert.deepEqual(tools.map(t => t.name).sort(), ["get_key_instructions", "list_games"]);
  for (const t of tools) { assert.equal(t.inputSchema.type, "object"); assert.ok(t.description.length > 10); }
}));

test("tools/call list_games trả dữ liệu khớp /api/games và lọc được", () => withServer(async (_s, get) => {
  const api = JSON.parse((await get({ pathname: "/api/games" })).body);
  let r = await rpc(get, { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "list_games", arguments: {} } });
  let res = JSON.parse(r.body).result;
  assert.ok(!res.isError);
  assert.equal(res.structuredContent.count, api.games.length);
  assert.equal(JSON.parse(res.content[0].text).count, api.games.length);

  r = await rpc(get, { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "list_games", arguments: { status: "soon" } } });
  assert.equal(JSON.parse(r.body).result.structuredContent.count, api.games.filter(g => g.status === "soon").length);

  r = await rpc(get, { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "list_games", arguments: { status: "bad" } } });
  assert.equal(JSON.parse(r.body).result.isError, true);
}));

test("tools/call get_key_instructions và tool lạ", () => withServer(async (_s, get) => {
  let r = await rpc(get, { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "get_key_instructions" } });
  const sc = JSON.parse(r.body).result.structuredContent;
  assert.equal(sc.getKeyUrl, "https://lyphucthien.vercel.app/get-key");
  assert.equal(sc.providers.length, 3);

  r = await rpc(get, { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "nope" } });
  assert.equal(JSON.parse(r.body).error.code, -32602);
}));

test("ping, method lạ, JSON hỏng, batch", () => withServer(async (_s, get) => {
  let r = await rpc(get, { jsonrpc: "2.0", id: 9, method: "ping" });
  assert.deepEqual(JSON.parse(r.body).result, {});

  r = await rpc(get, { jsonrpc: "2.0", id: 10, method: "resources/list" });
  assert.equal(JSON.parse(r.body).error.code, -32601);

  r = await get({ method: "POST", pathname: "/mcp", headers: H, body: "{oops" });
  assert.equal(r.status, 400);
  assert.equal(JSON.parse(r.body).error.code, -32700);

  r = await rpc(get, { id: 1, method: "ping" });
  assert.equal(r.status, 400);
  assert.equal(JSON.parse(r.body).error.code, -32600);

  r = await rpc(get, [{ jsonrpc: "2.0", id: 1, method: "ping" }, { jsonrpc: "2.0", method: "notifications/initialized" }, { jsonrpc: "2.0", id: 2, method: "tools/list" }]);
  const arr = JSON.parse(r.body);
  assert.equal(arr.length, 2);
  assert.deepEqual(arr.map(x => x.id), [1, 2]);

  r = await rpc(get, []);
  assert.equal(r.status, 400);
}));

test("MCP-Protocol-Version không hỗ trợ bị từ chối, hợp lệ thì qua", () => withServer(async (_s, get) => {
  let r = await rpc(get, { jsonrpc: "2.0", id: 1, method: "ping" }, "/mcp", { ...H, "MCP-Protocol-Version": "1999-01-01" });
  assert.equal(r.status, 400);
  r = await rpc(get, { jsonrpc: "2.0", id: 1, method: "ping" }, "/mcp", { ...H, "MCP-Protocol-Version": "2025-06-18" });
  assert.equal(r.status, 200);
}));

test("GET trả server card; GET với text/event-stream trả 405; OPTIONS có CORS; DELETE 405", () => withServer(async (_s, get) => {
  for (const p of ["/mcp", "/.well-known/mcp", "/.well-known/mcp/server-card.json"]) {
    const r = await get({ pathname: p, headers: { Accept: "application/json" } });
    assert.equal(r.status, 200, p);
    const card = JSON.parse(r.body);
    assert.equal(card.transport.type, "streamable-http");
    assert.equal(card.transport.endpoint, "https://lyphucthien.vercel.app/mcp");
    assert.equal(card.tools.length, 2);
  }
  let r = await get({ pathname: "/mcp", headers: { Accept: "text/event-stream" } });
  assert.equal(r.status, 405);
  r = await get({ method: "OPTIONS", pathname: "/mcp" });
  assert.equal(r.status, 204);
  assert.equal(r.headers["access-control-allow-origin"], "*");
  assert.match(r.headers["access-control-allow-headers"], /MCP-Protocol-Version/i);
  r = await get({ method: "DELETE", pathname: "/mcp" });
  assert.equal(r.status, 405);
}));
