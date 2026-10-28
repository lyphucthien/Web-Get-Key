const fs = require("fs");
const path = require("path");

const GAMES_DIR = path.join(process.cwd(), "Games");

const str = v => (typeof v === "string" ? v.trim() : "");

function normalizeFeatures(raw) {
  const groups = [];
  const clean = list => (Array.isArray(list) ? list.map(str).filter(Boolean) : []);
  if (Array.isArray(raw)) {
    const loose = [];
    for (const f of raw) {
      if (typeof f === "string") { if (str(f)) loose.push(str(f)); }
      else if (f && typeof f === "object") {
        const items = clean(f.items);
        if (items.length) groups.push({ category: str(f.category), items });
      }
    }
    if (loose.length) groups.unshift({ category: "", items: loose });
  } else if (raw && typeof raw === "object") {
    for (const [category, list] of Object.entries(raw)) {
      const items = clean(list);
      if (items.length) groups.push({ category: str(category), items });
    }
  }
  return groups;
}

function normalizeGame(file, data) {
  const id = file.replace(/\.json$/i, "");
  const type = str(data.type).toLowerCase();
  return {
    id,
    name: id,
    status: str(data.status).toLowerCase() === "soon" ? "soon" : "on",
    type: type === "minecraft" || type === "lpthub" ? type : "",
    description: str(data.description),
    order: Number.isFinite(data.order) ? data.order : 9999,
    features: normalizeFeatures(data.features)
  };
}

module.exports = (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  let files = [];
  try {
    files = fs.readdirSync(GAMES_DIR).filter(f => /\.json$/i.test(f));
  } catch (e) {
    return res.status(200).json({ success: true, games: [], errors: ["Không tìm thấy thư mục Games"] });
  }

  const games = [], errors = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(GAMES_DIR, file), "utf8").replace(/^\uFEFF/, "");
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("không phải object JSON");
      games.push(normalizeGame(file, data));
    } catch (e) {
      errors.push(file + ": " + e.message);
    }
  }

  games.sort((a, b) =>
    (a.status === "soon") - (b.status === "soon") ||
    a.order - b.order ||
    a.name.localeCompare(b.name, "vi"));

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ success: true, games, errors });
};