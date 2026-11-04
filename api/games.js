const { loadGames, filterGames, STATUSES } = require("../lib/games");
const { sendError, applyRateLimit, versionHeader } = require("../lib/api");

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return sendError(res, 405, "METHOD_NOT_ALLOWED", "Method not allowed", "Use GET or HEAD.");
  }

  if (!(await applyRateLimit(req, res, { name: "games", limit: 120, window: 60 }))) return;

  const q = req.query || {};
  const status = q.status === undefined || q.status === "" ? "all" : String(q.status);
  if (!STATUSES.includes(status)) {
    return sendError(res, 400, "INVALID_PARAMETER", "status must be all, on or soon", "Send ?status=on, ?status=soon or omit it.", { parameter: "status" });
  }
  if (Array.isArray(q.query) || (q.query !== undefined && String(q.query).length > 100)) {
    return sendError(res, 400, "INVALID_PARAMETER", "query must be a single string of at most 100 characters", "Send one short keyword, for example ?query=minecraft.", { parameter: "query" });
  }

  const { games, errors, missingDir } = loadGames();
  versionHeader(res);
  if (missingDir) return res.status(200).json({ success: true, games: [], errors });

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ success: true, games: filterGames(games, { status, query: q.query }), errors });
};
