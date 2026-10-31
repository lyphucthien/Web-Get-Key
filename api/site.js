const { homeMarkdown, notFoundMarkdown, notFoundHtml } = require("../lib/site");
const { prefersMarkdown } = require("../lib/negotiate");

const MD = "text/markdown; charset=utf-8";
const HTML = "text/html; charset=utf-8";

function send(req, res, status, type, body, cache) {
  res.statusCode = status;
  res.setHeader("Content-Type", type);
  res.setHeader("Vary", "Accept");
  res.setHeader("Cache-Control", cache);
  res.end(req.method === "HEAD" ? undefined : body);
}

module.exports = (req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, HEAD");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Method not allowed");
  }

  const kind = String((req.query && req.query.kind) || "");

  if (kind === "home") {
    return send(req, res, 200, MD, homeMarkdown(), "public, s-maxage=300, stale-while-revalidate=600");
  }

  const wantsMd = prefersMarkdown(req.headers && req.headers.accept);
  return send(
    req, res, 404,
    wantsMd ? MD : HTML,
    wantsMd ? notFoundMarkdown() : notFoundHtml(),
    "public, max-age=0, s-maxage=60"
  );
};
