const { createServer, request } = require("./emulator");

async function withServer(fn) {
  const server = createServer();
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  try { return await fn(server, opts => request(server, opts)); }
  finally { await new Promise(r => server.close(r)); }
}
module.exports = { withServer };
