function parseAccept(header) {
  return String(header || "")
    .split(",")
    .map((part, index) => {
      const [type, ...params] = part.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = /^\s*q\s*=\s*([0-9.]+)\s*$/i.exec(p);
        if (m) q = Math.max(0, Math.min(1, Number(m[1]) || 0));
      }
      return { type: type.trim().toLowerCase(), q, index };
    })
    .filter(e => e.type);
}

function prefersMarkdown(header) {
  const entries = parseAccept(header);
  const md = entries.find(e => e.type === "text/markdown");
  if (!md || md.q <= 0) return false;
  const html = entries.find(e => e.type === "text/html");
  const wild = entries.find(e => e.type === "text/*" || e.type === "*/*");
  const htmlQ = html ? html.q : wild ? wild.q : 0;
  if (md.q !== htmlQ) return md.q > htmlQ;
  return !html || md.index < html.index;
}

// True when the client asks for JSON and does not also accept HTML or Markdown,
// so browsers and Markdown clients keep their current 404 page.
function prefersJson(header) {
  const entries = parseAccept(header);
  const json = entries.find(e => e.type === "application/json" || e.type === "application/*" || e.type.endsWith("+json"));
  if (!json || json.q <= 0) return false;
  return !entries.some(e => (e.type === "text/html" || e.type === "text/markdown") && e.q > 0);
}

module.exports = { parseAccept, prefersMarkdown, prefersJson };
