const { SITE_URL, DISCORD, STEPS } = require("./content");
const { loadGames } = require("./games");

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const LATEST_VERSION = SUPPORTED_VERSIONS[0];
const SERVER_INFO = { name: "lpt-hub", title: "LPT Hub", version: "1.0.0" };
const INSTRUCTIONS =
  "LPT Hub cấp key miễn phí cho server Minecraft và script LPT Hub qua link rút gọn. " +
  "Dùng list_games để xem game được hỗ trợ và get_key_instructions để biết cách lấy key. " +
  "Key chỉ được cấp trên trình duyệt của người dùng, agent không thể tự lấy key thay họ.";

const TOOLS = [
  {
    name: "list_games",
    title: "Danh sách game hỗ trợ",
    description: "Liệt kê các game LPT Hub đang hỗ trợ hoặc sắp hỗ trợ, kèm mô tả và nhóm chức năng. Chỉ đọc.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "on", "soon"], description: "Lọc theo trạng thái: on = đang hỗ trợ, soon = sắp có. Mặc định all." },
        query: { type: "string", description: "Từ khóa tìm trong tên hoặc mô tả game." }
      },
      additionalProperties: false
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: "get_key_instructions",
    title: "Hướng dẫn lấy key",
    description: "Trả về các bước lấy key miễn phí, thời gian chờ giữa hai lần lấy và đường dẫn trang lấy key để đưa cho người dùng. Chỉ đọc.",
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
      return textResult("status phải là all, on hoặc soon.", true);
    }
    if (args.query !== undefined && typeof args.query !== "string") {
      return textResult("query phải là chuỗi.", true);
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
      cooldown: "Mỗi thiết bị nhận 1 key sau mỗi 3 giờ.",
      validity: "Với script LPT Hub, key gắn với một thiết bị và hết hạn sau 3 giờ kể từ lần dùng đầu tiên.",
      scope: "Một key dùng được cho cả server Minecraft và script LPT Hub.",
      note: "Người dùng phải tự hoàn thành link rút gọn trên trình duyệt của họ. Agent không thể lấy key thay người dùng.",
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
    // response từ client: server này không gửi request nên bỏ qua
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
        return rpcError(id, -32602, "Thiếu tên tool");
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
    description: "Danh sách game LPT Hub hỗ trợ và hướng dẫn lấy key miễn phí cho Minecraft và LPT Hub.",
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
