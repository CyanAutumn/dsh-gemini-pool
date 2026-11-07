// Integration check for the argument-repair hook: processStreamLine must hand
// DSH repaired arguments (never a lone `justification`), and must still accept
// `functionCall.args` delivered as a JSON string.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { parseToolArguments, repairToolArguments } from "../lib/tool-repair.js";

const src = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");
const start = src.indexOf("const PREAMBLE_AS_REASONING");
const end = src.indexOf("async function* streamResponseToChunks");
assert.ok(start >= 0 && end > start, "parser markers found");
const parser = src.slice(start, end);

const stubs = `
  const LlmError = class extends Error { constructor(message, code) { super(message); this.code = code; } };
  const ToolCallId = (value) => value;
  const sanitizeText = (value) => String(value ?? "");
  const asString = (value) => (typeof value === "string" ? value : undefined);
  const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
  const safeJsonParse = (text) => { try { return JSON.parse(text); } catch { return undefined; } };
  const classifyAntigravityError = () => "ANTIGRAVITY_ERROR";
  const thoughtSignatureOf = (part) => part?.thoughtSignature || part?.thought_signature;
  const sanitizeToolCallId = (id, fallback) => String(id || fallback || "tool").replace(/[^a-zA-Z0-9_-]/g, "_");
  function antigravityEnv(name) { return process.env["ANTIGRAVITY_" + name]; }
`;

function build(recordRepairs) {
  return new Function(
    "repairToolArguments",
    "parseToolArguments",
    "recordToolRepairs",
    `${stubs}\n${parser}\nreturn processStreamLine;`,
  )(repairToolArguments, parseToolArguments, recordRepairs);
}

function newState() {
  return {
    blocks: [],
    replayBlocks: [],
    currentBlock: null,
    hasContent: false,
    hasToolCall: false,
    finishReason: undefined,
    usage: undefined,
    baseDirs: [],
  };
}

function line(payload) {
  return `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [payload] } }] } })}`;
}

function toolCallBlock(chunks) {
  return chunks.filter((chunk) => chunk.type === "block-end").map((chunk) => chunk.block).find((block) => block.type === "tool-call");
}

test("a lone justification never reaches the host", () => {
  const seen = [];
  const processStreamLine = build((entries) => seen.push(...entries));
  const state = newState();
  const chunks = processStreamLine(
    line({
      functionCall: {
        name: "edit",
        args: { file_path: "C:/tmp/x.gd", old_string: "a", new_string: "b", justification: "because" },
      },
    }),
    state,
  );
  const block = toolCallBlock(chunks);
  const args = JSON.parse(block.arguments);
  assert.equal("justification" in args, false);
  assert.equal(args.old_string, "a");
  assert.deepEqual(
    seen.map((entry) => entry.kind),
    ["drop-lone-justification"],
  );
});

test("JSON-string arguments are parsed instead of dropped", () => {
  const processStreamLine = build(() => {});
  const state = newState();
  const chunks = processStreamLine(
    line({ functionCall: { name: "read", args: '{"file_path":"C:/tmp/x.gd"}' } }),
    state,
  );
  const args = JSON.parse(toolCallBlock(chunks).arguments);
  assert.equal(args.file_path, "C:/tmp/x.gd");
});
