// Transport failures must land on a retryable code. A dropped response body is
// surfaced by undici as the bare message "terminated"; before this mapping it
// escaped as the host's UNKNOWN code, which is not in the retry policy, so one
// broken connection ended the whole turn (audit: session-45e733d0, 15:39:55).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");
const start = src.indexOf("function classifyAntigravityError");
const end = src.indexOf("function friendlyAntigravityError");
assert.ok(start >= 0 && end > start, "classifier markers found");

const classify = new Function(
  "isQuotaExceededError",
  `${src.slice(start, end)}\nreturn classifyAntigravityError;`,
)(() => false);

test("socket-level truncations are retryable TRANSPORT", () => {
  for (const message of [
    "terminated",
    "TypeError: terminated",
    "fetch failed",
    "other side closed",
    "socket hang up",
    "read ECONNRESET",
    "premature close",
    "stream ended before a completion event; this turn may be incomplete",
  ]) {
    assert.equal(classify(message), "TRANSPORT", message);
  }
});

test("existing classifications are unchanged", () => {
  assert.equal(classify("HTTP 429 rate limit"), "RATE_LIMIT");
  assert.equal(classify("HTTP 401 unauthorized"), "AUTH");
  assert.equal(classify("HTTP 503 unavailable"), "SERVER");
  assert.equal(classify("request timeout"), "TIMEOUT");
  assert.equal(classify("something odd happened"), "ANTIGRAVITY_ERROR");
});

test("the stream reader wraps its errors", () => {
  const readerStart = src.indexOf("async function* streamResponseToChunks");
  const readerEnd = src.indexOf("function createStreamState");
  const body = src.slice(readerStart, readerEnd);
  assert.match(body, /catch \(error\)/);
  assert.match(body, /Antigravity stream read failed/);
  assert.match(body, /"ABORTED"/);
});

test("the no-body guard stays TRANSPORT", () => {
  const guard = src.slice(src.indexOf("async function* streamResponseToChunks"), src.indexOf("function createStreamState"));
  assert.match(guard, /Antigravity response has no body", "TRANSPORT"/);
});
