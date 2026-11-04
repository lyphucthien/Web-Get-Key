const { homeMarkdown, notFoundMarkdown, notFoundHtml } = require("../lib/site");
const { prefersMarkdown, prefersJson } = require("../lib/negotiate");
const { loadGames } = require("../lib/games");
const { renderGamesPage, readTemplate } = require("../lib/games-page");
const { sendError } = require("../lib/api");

const MD = "text/markdown; charset=utf-8";
const HTML = "text/html; charset=utf-8";

function send(req, res, status, type, body, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.setHeader("Vary", "Accept");
  res.setHeader("Cache-Control", cache);
  res.end(req.method === "HEAD" ? undefined : body);
}

function notFoundJson(res) {
  res.setHeader("Vary", "Accept");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
  return sendError(res, 404, "NOT_FOUND", "Endpoint not found",
    "See https://lyphucthien.vercel.app/openapi.json for the available endpoints (GET /api/v1/games).");
}

module.exports = (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed", "Use GET or HEAD.");
  }

  const kind = String((req.query && req.query.kind) || "");
  const accept = req.headers && req.headers.accept;

  if (kind === "home") {
    return send(req, res, 200, MD, homeMarkdown(), "public, s-maxage=300, stale-while-revalidate=600");
  }

  if (kind === "games") {
    try {
      const { games } = loadGames();
      return send(req, res, 200, HTML, renderGamesPage(readTemplate(), games), "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
    } catch (e) {
      console.error("Games page error:", e);
      return sendError(res, 500, "SERVER_ERROR", "Could not render the games page", "Retry in a moment.");
    }
  }

  // Unknown API paths and clients that ask for JSON get a JSON error, never an HTML page.
  if (kind === "api404" || prefersJson(accept)) return notFoundJson(res);

  const wantsMd = prefersMarkdown(accept);
  return send(
    req, res, 404,
    wantsMd ? MD : HTML,
    wantsMd ? notFoundMarkdown() : notFoundHtml(),
    "public, max-age=0, s-maxage=60"
  );
};
