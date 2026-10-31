const { loadGames } = require("../lib/games");

module.exports = (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const { games, errors, missingDir } = loadGames();
  if (missingDir) return res.status(200).json({ success: true, games: [], errors });

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ success: true, games, errors });
};
