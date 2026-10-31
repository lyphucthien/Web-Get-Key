const test = require("node:test");
const assert = require("node:assert");
const { prefersMarkdown } = require("../lib/negotiate");

test("prefersMarkdown", () => {
  assert.equal(prefersMarkdown("text/markdown"), true);
  assert.equal(prefersMarkdown("text/markdown, text/html;q=0.5"), true);
  assert.equal(prefersMarkdown("text/html, text/markdown;q=0.5"), false);
  assert.equal(prefersMarkdown("text/markdown, text/html"), true);
  assert.equal(prefersMarkdown("text/html, text/markdown"), false);
  assert.equal(prefersMarkdown("*/*"), false);
  assert.equal(prefersMarkdown("text/html"), false);
  assert.equal(prefersMarkdown(""), false);
  assert.equal(prefersMarkdown(undefined), false);
  assert.equal(prefersMarkdown("text/markdown;q=0"), false);
  assert.equal(prefersMarkdown("TEXT/Markdown"), true);
});
