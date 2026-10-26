(function () {
  const LOGO = "https://res.cloudinary.com/dkui88bcf/image/upload/v1786939501/Logo_LPT_vnq390.png";
  const DISCORD = "https://discord.gg/gyZ27Hw9qu";
  const current = document.body.dataset.page;

  const LINKS = [
    { text: "Home",   href: "/",         page: "home" },
    { text: "Games",  href: "/#games" },
    { text: "Getkey", href: "/get-key",  page: "getkey" },
    { text: "Buy",    href: "/#buy" }
  ];
  const nav = LINKS.map(l =>
    `<a href="${l.href}"${l.page && l.page === current ? ' aria-current="page"' : ""}>${l.text}</a>`
  ).join("");

  document.body.insertAdjacentHTML("afterbegin", `
    <canvas id="bg-canvas"></canvas>
    <header>
      <div class="wrap nav">
        <a class="brand" href="/"><img src="${LOGO}" alt="">LPT Hub</a>
        <nav class="crumbs" aria-label="Điều hướng">${nav}</nav>
        <a class="cta" href="${DISCORD}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="DÁN_NGUYÊN_PATH_LOGO_DISCORD_TỪ_FILE_CŨ"/></svg>Discord
        </a>
      </div>
    </header>`);

  document.body.insertAdjacentHTML("beforeend",
    `<footer><div class="wrap">© LPT Hub. Key chỉ dùng cho mục đích cá nhân.</div></footer>`);

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