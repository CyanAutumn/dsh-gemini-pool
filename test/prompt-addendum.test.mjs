// Verifies the per-model delegation addendum that the adapter appends to
// systemInstruction (ANTIGRAVITY_PROMPT_ADDENDUM=0 disables it at runtime).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildPromptAddendum } from "../lib/models.js";

const source = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");

test("every Antigravity family gets delegation guidance", () => {
  for (const id of [
    "gemini-4-argon-low",
    "gemini-4-argon-high",
    "gemini-3.8-flash-high",
    "claude-opus-5-5-high",
    "claude-sonnet-5-5-medium",
    "gpt-oss-120b-medium",
  ]) {
    const text = buildPromptAddendum(id);
    assert.ok(text && text.length > 100, `${id} gets an addendum`);
    assert.match(text, /subagent/);
    assert.match(text, /subagent_fork/);
    assert.match(text, /notif/i, "must tell the model it will be notified instead of polling");
  }
});

test("family wording differs where it matters", () => {
  assert.match(buildPromptAddendum("claude-opus-5-5-high"), /decomposition/);
  for (const id of ["claude-opus-5-5-high", "gemini-4-argon-low", "gemini-3.8-flash-high"]) {
    assert.match(buildPromptAddendum(id), /justification` to write\/edit\/pwsh unless you also pass `sandbox_permissions/);
    assert.match(buildPromptAddendum(id), /copy `old_string` verbatim/);
    assert.match(buildPromptAddendum(id), /read the file again instead of retrying with a guessed string/);
  }
  assert.match(buildPromptAddendum("gemini-4-argon-low"), /Gemini tends to solve tasks serially/);
  const geminiBase = buildPromptAddendum("gemini-3.8-flash-high");
  assert.ok(!/Gemini tends to solve tasks serially/.test(geminiBase), "older Gemini gets the shared text");
});

test("unknown families get nothing", () => {
  assert.equal(buildPromptAddendum("some-other-model"), undefined);
  assert.equal(buildPromptAddendum(""), undefined);
});

test("the adapter gates the addendum behind ANTIGRAVITY_PROMPT_ADDENDUM=0", () => {
  assert.match(source, /antigravityEnv\("PROMPT_ADDENDUM"\) === "0"/);
  assert.match(source, /const promptAddendum =/);
});
