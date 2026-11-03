const { SITE_URL, DISCORD, STEPS } = require("./content");
const { loadGames } = require("./games");

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0];
const SERVER_INFO = { name: "lpt-hub", title: "LPT Hub", version: "1.0.0" };
const INSTRUCTIONS =
  "LPT Hub gives out free keys for a Minecraft server and the LPT Hub script through short links. " +
  "Use list_games to see supported games and get_key_instructions to learn how to get a key. " +
  "Keys are only issued in the user's own browser, so an agent cannot get a key on their behalf.";

const TOOLS = [
  {
    name: "list_games",
    title: "Supported games list",
    description: "Lists the games LPT Hub supports or will support soon, with descriptions and feature groups. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "on", "soon"], description: "Filter by status: on = supported, soon = coming soon. Defaults to all." },
        query: { type: "string", description: "Keyword to search in the game name or description." }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "get_key_instructions",
    title: "Key instructions",
    description: "Returns the steps to get a free key, the wait time between two keys, and the key page link to give to the user. Read-only.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }
];

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } };
}

function textResult(data, isError = false) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const result = { content: [{ type: "text", text }] };
  if (isError) result.isError = true;
  else if (typeof data !== "string") result.structuredContent = data;
  return result;
}

function callTool(name, args) {
  args = args && typeof args === "object" && !Array.isArray(args) ? args : {};

  if (name === "list_games") {
    const status = args.status === undefined ? "all" : args.status;
    if (!["all", "on", "soon"].includes(status)) {
      return textResult("status must be all, on or soon.", true);
    }
    if (args.query !== undefined && typeof args.query !== "string") {
      return textResult("query must be a string.", true);
    }
    const q = (args.query || "").trim().toLowerCase();
    const { games } = loadGames();
    const list = games
      .filter(g => status === "all" || g.status === status)
      .filter(g => !q || g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q))
      .map(g => ({ id: g.id, name: g.name, status: g.status, type: g.type, description: g.description, features: g.features }));
    return textResult({ count: list.length, games: list, page: `${SITE_URL}/games` });
  }

  if (name === "get_key_instructions") {
    return textResult({
      getKeyUrl: `${SITE_URL}/get-key`,
      steps: STEPS.map(s => `${s.title}: ${s.text}`),
      providers: ["Work.ink", "Link 4m", "Link 4 Sub"],
      cooldown: "Each device gets 1 key every 3 hours.",
      validity: "For the LPT Hub script, a key is tied to one device and expires 3 hours after its first use.",
      scope: "One key works for both the Minecraft server and the LPT Hub script.",
      note: "The user must complete the short link in their own browser. An agent cannot get a key for them.",
      support: DISCORD
    });
  }

  return null;
}

function handleMessage(msg) {
  if (!msg || typeof msg !== "object" || Array.isArray(msg) || msg.jsonrpc !== "2.0") {
    return rpcError(msg && msg.id, -32600, "Invalid Request");
  }
  const isRequest = typeof msg.method === "string";
  const hasId = msg.id !== undefined && msg.id !== null;

  if (!isRequest) {
    // response from the client: this server sends no requests, so ignore it
    return null;
  }
  if (!hasId) return null; // notification

  const { id, method, params } = msg;

  switch (method) {
    case "initialize": {
      const asked = params && params.protocolVersion;
      const version = SUPPORTED_VERSIONS.includes(asked) ? asked : LATEST_VERSION;
      return {
        jsonrpc: "2.0", id,
        result: {
          protocolVersion: version,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS
        }
      };
    }
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };
    case "tools/call": {
      if (!params || typeof params.name !== "string") {
        return rpcError(id, -32602, "Missing tool name");
      }
      const result = callTool(params.name, params.arguments);
      if (!result) return rpcError(id, -32602, `Unknown tool: ${params.name}`);
      return { jsonrpc: "2.0", id, result };
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

function serverCard() {
  return {
    name: SERVER_INFO.name,
    title: SERVER_INFO.title,
    version: SERVER_INFO.version,
    description: "List of games LPT Hub supports and instructions for getting a free key for Minecraft and LPT Hub.",
    protocolVersion: LATEST_VERSION,
    supportedProtocolVersions: SUPPORTED_VERSIONS,
    transport: { type: "streamable-http", endpoint: `${SITE_URL}/mcp` },
    authentication: { required: false },
    capabilities: { tools: { listChanged: false } },
    tools: TOOLS.map(t => ({ name: t.name, title: t.title, description: t.description })),
    documentationUrl: `${SITE_URL}/docs`
  };
}

module.exports = {
  SUPPORTED_VERSIONS, LATEST_VERSION, SERVER_INFO, TOOLS,
  handleMessage, serverCard, rpcError
};
