(function () {
  const LOGO = "https://res.cloudinary.com/dkui88bcf/image/upload/v1786939501/Logo_LPT_vnq390.png";
  const DISCORD = "https://discord.gg/gyZ27Hw9qu";
  const current = document.body.dataset.page;

  const LINKS = [
    { text: "Home", href: "/",        page: "home" },
    { text: "Games",     href: "/games",   page: "games" },
    { text: "Get key",   href: "/get-key", page: "getkey" }
  ];
  const nav = LINKS.map(l =>
    `<a href="${l.href}"${l.page && l.page === current ? ' aria-current="page"' : ""}>${l.text}</a>`
  ).join("");

  document.body.insertAdjacentHTML("afterbegin", `
    <style>
      .site-header .cta.cta-key{background:#fff;color:#111;border-color:#fff}
      .site-header .cta.cta-key:hover{background:#e6e6e6;color:#111;border-color:#e6e6e6}
      .lang-switch{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:9px;overflow:hidden;background:var(--panel2)}
      .lang-switch button{font:600 12px var(--sans);padding:8px 9px;color:var(--dim);background:transparent;border:0;cursor:pointer;line-height:1}
      .lang-switch button:hover{color:var(--text)}
      .lang-switch button[aria-pressed="true"]{background:#fff;color:#111}
      @media (max-width:640px){
        .site-header .crumbs a{white-space:nowrap;padding:6px 8px}
        .site-header .nav-actions{gap:6px!important}
        .lang-switch button{padding:7px 7px}
        .site-header .cta.cta-key{display:none}
      }
      @media (max-width:400px){.site-header .crumbs a{padding:6px 5px}.site-header .nav{gap:4px}}
    </style>
    <canvas id="bg-canvas"></canvas>
    <header class="site-header">
      <div class="wrap nav">
        <a class="brand" href="/"><img src="${LOGO}" alt=""><span>LPT Hub</span></a>
        <nav class="crumbs" aria-label="Navigation">${nav}</nav>
        <div class="nav-actions" style="display:flex;align-items:center;gap:8px;margin-left:auto;flex-shrink:0">
          <div class="lang-switch" role="group" aria-label="Language">
            <button type="button" data-lang="en" aria-pressed="true" title="English">EN</button>
            <button type="button" data-lang="vi" aria-pressed="false" title="Tiếng Việt">VI</button>
          </div>
          <a class="cta" aria-label="Discord" href="${DISCORD}" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18 18 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 -.3 13.5.1 18a20 20 0 0 0 6 3l1-1.7a13 13 0 0 1-1.6-.8l.4-.3a14.2 14.2 0 0 0 12.2 0l.4.3c-.5.3-1 .6-1.6.8l1 1.7a20 20 0 0 0 6-3c.5-5.200-.8-9.600-3.600-13.600zM8.500 15.300c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.100 1.100 2.100 2.400-.9 2.400-2.100 2.400zm7 0c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.100 1.100 2.100 2.400-.9 2.400-2.100 2.400z"/></svg><span>Discord</span>
          </a>
          <a class="cta cta-key" aria-label="Get Key" href="/get-key"${current === "getkey" ? ' aria-current="page"' : ""}>
            <span>Get Key</span>
          </a>
        </div>
      </div>
    </header>`);

  document.addEventListener("DOMContentLoaded", function () {
    if (window.LPT_I18N) return;
    const s = document.createElement("script");
    s.src = "/JS/i18n.js";
    document.body.appendChild(s);
  });

  const canvas = document.getElementById("bg-canvas"), ctx = canvas.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GAP = 18, DOT = 1.3, MAX_ALPHA = 0.5;
  let W = 0, H = 0;
  function resizeCanvas() {
    const r = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = W * r; canvas.height = H * r;
    ctx.setTransform(r, 0, 0, r, 0, 0);
  }
  const smooth = (a, b, x) => { x = Math.min(Math.max((x - a) / (b - a), 0), 1); return x * x * (3 - 2 * x); };
  function draw(time) {
    const t = time / 1000;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    for (let y = GAP / 2; y < H; y += GAP) {
      for (let x = GAP / 2; x < W; x += GAP) {
        const n = (Math.sin(x * .0105 + t * .22) + Math.sin(y * .0125 - t * .17)
                + Math.sin((x + y) * .0072 + t * .13) + Math.sin(Math.hypot(x - W / 2, y - H / 2) * .0095 - t * .19)) / 4;
        const a = smooth(.12, .62, n) * MAX_ALPHA;
        if (a < .015) continue;
        ctx.globalAlpha = a;
        ctx.fillRect(x - DOT / 2, y - DOT / 2, DOT, DOT);
      }
    }
    if (!still) requestAnimationFrame(draw);
  }
  addEventListener("resize", () => { resizeCanvas(); if (still) draw(0); });
  resizeCanvas(); requestAnimationFrame(draw);
})();
