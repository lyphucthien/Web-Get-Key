const fs = require("fs");
const path = require("path");

const DEFAULT_DIR = path.join(process.cwd(), "Games");

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

function safeImage(v) {
  const u = str(v);
  if (/^https:\/\//i.test(u)) return u;
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  return "";
}

function normalizeGame(file, data, imageFile) {
  const id = file.replace(/\.json$/i, "");
  const type = str(data.type).toLowerCase();
  return {
    id,
    name: id,
    status: str(data.status).toLowerCase() === "soon" ? "soon" : "on",
    type: type === "minecraft" || type === "lpthub" ? type : "",
    description: str(data.description),
    image: safeImage(data.image) || (imageFile ? "/Games/" + encodeURIComponent(imageFile) : ""),
    order: Number.isFinite(data.order) ? data.order : 9999,
    features: normalizeFeatures(data.features)
  };
}

function loadGames(dir = DEFAULT_DIR) {
  let files = [];
  const images = new Map();
  try {
    const all = fs.readdirSync(dir);
    files = all.filter(f => /\.json$/i.test(f));
    for (const f of all) {
      const m = /^(.*)\.(png|jpe?g|webp|gif|avif)$/i.exec(f);
      if (m && !images.has(m[1].toLowerCase())) images.set(m[1].toLowerCase(), f);
    }
  } catch (e) {
    return { games: [], errors: ["Không tìm thấy thư mục Games"], missingDir: true };
  }

  const games = [], errors = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8").replace(/^\uFEFF/, "");
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("không phải object JSON");
      games.push(normalizeGame(file, data, images.get(file.replace(/\.json$/i, "").toLowerCase())));
    } catch (e) {
      errors.push(file + ": " + e.message);
    }
  }

  games.sort((a, b) =>
    (a.status === "soon") - (b.status === "soon") ||
    a.order - b.order ||
    a.name.localeCompare(b.name, "vi"));

  return { games, errors, missingDir: false };
}

module.exports = { loadGames };
