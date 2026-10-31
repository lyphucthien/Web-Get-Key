// Giả lập đơn giản cách Vercel xử lý: file tĩnh -> headers -> rewrites -> function.
// Chỉ phục vụ kiểm thử cục bộ, không phải Vercel thật.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".txt": "text/plain", ".xml": "application/xml", ".png": "image/png" };

function compile(source) {
  // hỗ trợ đúng các dạng đang dùng: "/path" và "/((?!x).*)"
  const re = source.includes("(") ? source : source.replace(/[.*+?^${}|[\]\\]/g, "\\$&");
  return new RegExp("^" + re + "$");
}

function headerMatches(cond, headers) {
  const v = headers[cond.key.toLowerCase()];
  return v !== undefined && new RegExp("^" + cond.value + "$").test(String(v));
}

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);
    const query = Object.fromEntries(url.searchParams);

    const finish = (apiName, extraQuery) => {
      const handler = require(path.join(ROOT, "api", apiName));
      const chunks = [];
      req.on("data", c => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let body = raw;
        if ((req.headers["content-type"] || "").includes("application/json") && raw) {
          try { body = JSON.parse(raw); } catch (e) { body = raw; }
        }
        req.query = { ...query, ...extraQuery };
        req.body = raw ? body : undefined;
        res.status = c => { res.statusCode = c; return res; };
        res.json = b => { res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(b)); };
        applyHeaders(pathname, res);
        handler(req, res);
      });
    };

    const applyHeaders = (p, response) => {
      for (const h of CONFIG.headers || []) {
        if (compile(h.source).test(p)) for (const kv of h.headers) response.setHeader(kv.key, kv.value);
      }
    };

    // 1. file tĩnh
    const file = path.join(ROOT, pathname);
    if (pathname !== "/" && file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile()
        && !pathname.startsWith("/api/")) {
      applyHeaders(pathname, res);
      if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
      return res.end(fs.readFileSync(file));
    }
    if (/^\/api\/[^/]+$/.test(pathname) && fs.existsSync(path.join(ROOT, pathname + ".js"))) {
      return finish(pathname.slice(5) + ".js");
    }

    // 2. rewrites theo thứ tự
    for (const r of CONFIG.rewrites) {
      if (!compile(r.source).test(pathname)) continue;
      if (r.has && !r.has.every(c => headerMatches(c, req.headers))) continue;
      const dest = new URL(r.destination, "http://localhost");
      const destPath = dest.pathname;
      const extra = Object.fromEntries(dest.searchParams);
      if (destPath.startsWith("/api/")) return finish(destPath.slice(5) + ".js", extra);
      applyHeaders(pathname, res);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(fs.readFileSync(path.join(ROOT, destPath)));
    }
    res.statusCode = 404;
    res.end("platform 404");
  });
}

function request(server, { method = "GET", pathname = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const req = http.request({ host: "127.0.0.1", port, method, path: pathname, headers }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

module.exports = { createServer, request };
