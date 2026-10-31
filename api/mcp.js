const { SUPPORTED_VERSIONS, handleMessage, serverCard, rpcError } = require("../lib/mcp");

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString("utf8");
  if (typeof body === "string") {
    if (!body.trim()) return { empty: true };
    try { return { value: JSON.parse(body) }; } catch (e) { return { invalid: true }; }
  }
  if (body === undefined || body === null) return { empty: true };
  return { value: body };
}

module.exports = (req, res) => {
  cors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const accept = String((req.headers && req.headers.accept) || "").toLowerCase();
    if (accept.includes("text/event-stream")) {
      res.setHeader("Allow", "POST, OPTIONS");
      return json(res, 405, rpcError(null, -32000, "Server này không mở luồng SSE. Hãy dùng POST."));
    }
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300");
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(req.method === "HEAD" ? undefined : JSON.stringify(serverCard()));
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return json(res, 405, rpcError(null, -32000, "Method not allowed"));
  }

  const parsed = readBody(req);
  if (parsed.invalid) return json(res, 400, rpcError(null, -32700, "Parse error"));
  if (parsed.empty) return json(res, 400, rpcError(null, -32600, "Invalid Request"));

  const message = parsed.value;
  const isInit = (m) => m && m.method === "initialize";
  const headerVersion = req.headers && req.headers["mcp-protocol-version"];
  const hasInit = Array.isArray(message) ? message.some(isInit) : isInit(message);
  if (headerVersion && !hasInit && !SUPPORTED_VERSIONS.includes(String(headerVersion))) {
    return json(res, 400, rpcError(null, -32600, `Unsupported MCP-Protocol-Version: ${String(headerVersion).slice(0, 40)}`));
  }

  if (Array.isArray(message)) {
    if (message.length === 0) return json(res, 400, rpcError(null, -32600, "Invalid Request"));
    const out = message.map(handleMessage).filter(Boolean);
    if (!out.length) { res.statusCode = 202; return res.end(); }
    return json(res, 200, out);
  }

  const out = handleMessage(message);
  if (!out) { res.statusCode = 202; return res.end(); }
  const invalid = out.error && out.error.code === -32600;
  return json(res, invalid ? 400 : 200, out);
};
