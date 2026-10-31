const { SITE_URL, DISCORD, TITLE, LEAD, STEPS, ABOUT, FAQ, PAGES } = require("./content");

function homeMarkdown() {
  const steps = STEPS.map((s, i) => `${i + 1}. **${s.title}**: ${s.text}`).join("\n");
  const faq = FAQ.map(f => `### ${f.q}\n\n${f.a}`).join("\n\n");
  const links = PAGES.filter(p => p.path !== "/")
    .map(p => `- [${p.title}](${SITE_URL}${p.path})`).join("\n");
  return `# ${TITLE}

${LEAD}

## Cách lấy key

${steps}

## LPT Hub là gì

${ABOUT}

## Câu hỏi thường gặp

${faq}

## Liên kết

${links}
- [Discord hỗ trợ](${DISCORD})
- [llms.txt](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
- [MCP server](${SITE_URL}/mcp)
`;
}

function notFoundMarkdown() {
  return `# 404: Không tìm thấy trang

Trang bạn yêu cầu không tồn tại trên LPT Hub (${SITE_URL}). Hãy kiểm tra lại đường dẫn hoặc bắt đầu từ các trang bên dưới.

## Trang có thể dùng

- [Trang chủ](${SITE_URL}/)
- [Lấy key](${SITE_URL}/get-key)
- [Game hỗ trợ](${SITE_URL}/games)
- [Tài liệu API và MCP](${SITE_URL}/docs)
- [llms.txt](${SITE_URL}/llms.txt)
- [Sitemap](${SITE_URL}/sitemap.xml)
`;
}

function notFoundHtml() {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>404: Không tìm thấy trang – LPT Hub</title>
<link rel="icon" type="image/png" href="https://res.cloudinary.com/dkui88bcf/image/upload/v1786939501/Logo_LPT_vnq390.png">
<link rel="stylesheet" href="/CSS/style.css">
</head>
<body data-page="notfound">
<main>
  <div class="wrap prose">
    <h1>404: Không tìm thấy trang</h1>
    <p>Trang bạn yêu cầu không tồn tại. Hãy kiểm tra lại đường dẫn hoặc quay về một trong các trang dưới đây.</p>
    <div class="btns">
      <a class="btn primary" href="/">Về trang chủ</a>
      <a class="btn" href="/get-key">Lấy key</a>
      <a class="btn" href="/games">Game hỗ trợ</a>
    </div>
    <p class="muted">Dành cho công cụ tự động: <a href="/llms.txt">llms.txt</a> · <a href="/sitemap.xml">sitemap.xml</a> · <a href="/docs">tài liệu</a></p>
  </div>
</main>
<script src="/JS/layout.js"></script>
</body>
</html>
`;
}

module.exports = { homeMarkdown, notFoundMarkdown, notFoundHtml };
