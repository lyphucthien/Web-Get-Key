const BASE = process.env.LPTHUB_BASE_URL || "https://lyphucthien.vercel.app";
const VERSION = require("../package.json").version;

const HELP = `lpthub ${VERSION}: LPT Hub command-line client

Usage:
  lpthub games [--status all|on|soon] [--query <text>] [--json]
  lpthub key-info [--json]
  lpthub --help | --version

Commands:
  games      List the games LPT Hub supports (GET /api/v1/games).
  key-info   Show how to get a free key. Keys are only issued in the browser.

Options:
  --status   Filter games by status (default: all).
  --query    Keyword to search in game names and descriptions.
  --json     Print machine-readable JSON instead of text.

Exit codes: 0 success, 1 request or API error, 2 invalid usage.
Docs: ${BASE}/docs`;

const KEY_INFO = {
  url: `${BASE}/get-key`,
  waitHours: 3,
  steps: [
    "Pick a link (Work.ink, Link 4m or Link 4 Sub).",
    "Finish the link; you are sent back to the key page.",
    "Copy the key and paste it into the Minecraft server or the LPT Hub script."
  ],
  notes: [
    "Each device gets 1 key every 3 hours.",
    "One key works for both the Minecraft server and the LPT Hub script.",
    "Keys can only be issued in your own browser."
  ]
};

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json" || a === "--help" || a === "-h" || a === "--version" || a === "-v") out.flags[a.replace(/^-+/, "")] = true;
    else if (a === "--status" || a === "--query") {
      if (i + 1 >= argv.length) return { error: `${a} needs a value` };
      out.flags[a.slice(2)] = argv[++i];
    } else if (a.startsWith("-")) return { error: `Unknown option: ${a}` };
    else out._.push(a);
  }
  return out;
}

function formatGames(games) {
  if (!games.length) return "No games found.";
  return games.map(g => {
    const total = g.features.reduce((n, grp) => n + grp.items.length, 0);
    const label = g.status === "on" ? "supported" : "coming soon";
    return `${g.name} [${label}] (${total} features)${g.description ? "\n  " + g.description : ""}`;
  }).join("\n");
}

async function run(argv, io = {}) {
  const out = io.out || (s => process.stdout.write(s + "\n"));
  const err = io.err || (s => process.stderr.write(s + "\n"));
  const fetchImpl = io.fetch || globalThis.fetch;

  const args = parseArgs(argv);
  if (args.error) { err(args.error + "\n\n" + HELP); return 2; }
  const { flags } = args;
  const [command] = args._;

  if (flags.version || flags.v) { out(VERSION); return 0; }
  if (flags.help || flags.h || !command) { out(HELP); return command || flags.help || flags.h ? 0 : 2; }

  if (command === "key-info") {
    out(flags.json ? JSON.stringify(KEY_INFO, null, 2) : [`Get a key: ${KEY_INFO.url}`, ...KEY_INFO.steps.map((s, i) => `${i + 1}. ${s}`), ...KEY_INFO.notes.map(n => `- ${n}`)].join("\n"));
    return 0;
  }

  if (command !== "games") { err(`Unknown command: ${command}\n\n${HELP}`); return 2; }

  const status = flags.status || "all";
  if (!["all", "on", "soon"].includes(status)) { err("--status must be all, on or soon"); return 2; }

  const url = new URL("/api/v1/games", BASE);
  url.searchParams.set("status", status);
  if (flags.query) url.searchParams.set("query", flags.query);

  try {
    const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": `lpthub-cli/${VERSION}` } });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.success === false) {
      const retry = res.headers && res.headers.get && res.headers.get("retry-after");
      err(`Error ${res.status}: ${body && body.error ? body.error : "unexpected response"}` +
        (body && body.hint ? `\nHint: ${body.hint}` : "") + (retry ? `\nRetry after ${retry}s` : ""));
      return 1;
    }
    out(flags.json ? JSON.stringify(body, null, 2) : formatGames(body.games));
    return 0;
  } catch (e) {
    err(`Request failed: ${e.message}`);
    return 1;
  }
}

module.exports = { run, parseArgs, formatGames, KEY_INFO };
