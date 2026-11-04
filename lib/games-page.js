const fs = require("fs");
const path = require("path");

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Plain, semantic HTML for the games list. Shown only when JavaScript is off:
// with JavaScript the page script hides it and draws the interactive cards instead.
function renderGamesSection(games) {
  if (!games.length) return "";
  const items = games.map(g => {
    const status = g.status === "on" ? "Supported" : "Coming soon";
    const groups = g.features.map(grp =>
      (grp.category ? `<h3>${esc(grp.category)}</h3>` : "") +
      `<ul>${grp.items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`
    ).join("");
    return `<article><h2>${esc(g.name)}</h2><p><b>${status}.</b> ${esc(g.description || "No description yet.")}</p>${groups}</article>`;
  }).join("\n");
  const on = games.filter(g => g.status === "on").length;
  const soon = games.length - on;
  const intro = `<p>LPT Hub currently lists ${on} supported and ${soon} upcoming ${games.length === 1 ? "game" : "games"}. Each section below describes the game and the features it offers. One free key works for the Minecraft server and the LPT Hub script: <a href="/get-key">get your key</a>.</p>`;
  return `<section class="gl-ssr prose" id="gamesText" aria-label="Games and features">\n${intro}\n${items}\n</section>`;
}

function renderGamesPage(template, games) {
  const section = renderGamesSection(games);
  const count = games.filter(g => g.status === "on").length;
  return template
    .replace("<!--GAMES_SSR-->", section)
    .replace('<b id="totalNum">0</b>', `<b id="totalNum">${count}</b>`);
}

function readTemplate() {
  return fs.readFileSync(path.join(__dirname, "..", "HTML", "games.html"), "utf8");
}

module.exports = { renderGamesSection, renderGamesPage, readTemplate };
