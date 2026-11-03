const { SITE_URL, DISCORD, TITLE, LEAD, STEPS, ABOUT, FAQ, PAGES } = require("./content");

function homeMarkdown() {
  const steps = STEPS.map((s, i) => `${i + 1}. **${s.title}**: ${s.text}`).join("\n");
  const faq = FAQ.map(f => `### ${f.q}\n\n${f.a}`).join("\n\n");
  const links = PAGES.filter(p => p.path !== "/")
    .map(p => `- [${p.title}](${SITE_URL}${p.path})`).join("\n");
  return `# ${TITLE}

${LEAD}

## How to get a key

${steps}

## What is LPT Hub

${ABOUT}

## FAQ

${faq}

## Links

${links}
- [Support Discord](${DISCORD})
- [llms.txt](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [MCP server](${SITE_URL}/mcp)
`;
}

function notFoundMarkdown() {
  return `# 404: Page not found

The page you requested does not exist on LPT Hub (${SITE_URL}). Check the address or start from the pages below.

## Pages you can use

- [Home](${SITE_URL}/)
- [Get key](${SITE_URL}/get-key)
- [Supported games](${SITE_URL}/games)
- [API and MCP docs](${SITE_URL}/docs)
- [llms.txt](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
`;
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>404: Page not found – LPT Hub</title>
<link rel="icon" type="image/png" href="https://res.cloudinary.com/dkui88bcf/image/upload/v1786939501/Logo_LPT_vnq390.png">
<link rel="stylesheet" href="/CSS/style.css">
</head>
<body data-page="notfound">
<main>
  <div class="wrap prose">
    <h1>404: Page not found</h1>
    <p>The page you requested does not exist. Check the address or go back to one of the pages below.</p>
    <div class="btns">
      <a class="btn primary" href="/">Back to home</a>
      <a class="btn" href="/get-key">Get key</a>
      <a class="btn" href="/games">Supported games</a>
    </div>
    <p class="muted">For automated tools: <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">sitemap.xml</a> · <a href="/docs">docs</a></p>
  </div>
</main>
<script src="/JS/layout.js"></script>
</body>
</html>
`;
}

module.exports = { homeMarkdown, notFoundMarkdown, notFoundHtml };
