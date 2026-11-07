// Offline test for the preamble->reasoning reclassification in processStreamLine.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const src = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");
const start = src.indexOf("const PREAMBLE_AS_REASONING");
const end = src.indexOf("async function* streamResponseToChunks");
if (start < 0 || end < 0) throw new Error("parser markers not found");
const parser = src.slice(start, end);

function build(enabled) {
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
  const parseToolArguments = (raw) => (isRecord(raw) ? raw : {});
  const repairToolArguments = (name, args) => ({ args, repairs: [] });
  const recordToolRepairs = () => {};
  function antigravityEnv(name) { return name === "PREAMBLE_AS_REASONING" ? ${JSON.stringify(enabled ? "1" : "0")} : process.env["ANTIGRAVITY_" + name]; }
  `;
  return new Function(`${stubs}\n${parser}\nreturn processStreamLine;`)();
}

const enabled = build(true);
const disabled = build(false);

function newState() {
  return { blocks: [], replayBlocks: [], currentBlock: null, hasContent: false, hasToolCall: false, finishReason: undefined, usage: undefined };
}
const textLine = (text) => `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text }] } }] } })}`;
const thoughtLine = (text) => `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text, thought: true }] } }] } })}`;
const toolLine = (name) => `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ functionCall: { name, args: {} } }] } }] } })}`;

let failures = 0;
const check = (label, ok, detail) => {
  if (ok) return;
  failures += 1;
  console.log("FAIL:", label, detail ?? "");
};
const blockEnds = (chunks) => chunks.filter((c) => c.type === "block-end").map((c) => c.block);

// 1) preamble then tool call in a later chunk -> the closing block is reasoning
{
  const s = newState();
  const a = enabled(textLine("Let me read the weapon base class."), s);
  const b = enabled(toolLine("read"), s);
  check("split preamble closes as reasoning", blockEnds(b)[0]?.type === "reasoning", JSON.stringify(blockEnds(b)));
  check("replay block relabelled", s.replayBlocks[0]?.type === "reasoning");
  check("live streaming still starts as text", a[0]?.blockType === "text");
  check("tool block still emitted", blockEnds(b).some((x) => x.type === "tool-call"));
}

// 2) preamble and tool call in the SAME chunk -> reasoning
{
  const s = newState();
  const both = `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ text: "Checking the file." }, { functionCall: { name: "read", args: {} } }] } }] } })}`;
  const out = enabled(both, s);
  const ends = blockEnds(out);
  check("same-chunk preamble is reasoning", ends[0]?.type === "reasoning", JSON.stringify(ends));
  check("same-chunk tool call preserved", ends.some((x) => x.type === "tool-call"));
}

// 3) text closed by another non-tool part (e.g. thinking) stays text
{
  const s = newState();
  enabled(textLine("Answer paragraph."), s);
  const out = enabled(thoughtLine("some thinking"), s);
  check("text before thinking stays text", blockEnds(out)[0]?.type === "text", JSON.stringify(blockEnds(out)));
}

// 4) thinking then plain text before tool call: thinking stays reasoning, plain text becomes reasoning
{
  const s = newState();
  enabled(thoughtLine("weighing options"), s);
  const out1 = enabled(textLine("Reading the file now."), s);
  const out2 = enabled(toolLine("read"), s);
  const ends = blockEnds([...out1, ...out2]);
  check("thinking block stays reasoning", ends[0]?.type === "reasoning", JSON.stringify(ends));
  check("plain text before tool becomes reasoning", ends[1]?.type === "reasoning", JSON.stringify(ends));
}

// 5) switch off: old behaviour (text stays text)
{
  const s = newState();
  disabled(textLine("Let me read the file."), s);
  const out = disabled(toolLine("read"), s);
  check("disabled keeps text", blockEnds(out)[0]?.type === "text", JSON.stringify(blockEnds(out)));
}

// 6) image markdown block is never relabelled
{
  const s = newState();
  const img = `data: ${JSON.stringify({ response: { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: "AAA" } }] } }] } })}`;
  const out = enabled(img, s);
  check("image block stays text", blockEnds(out).every((b) => b.type === "text"), JSON.stringify(blockEnds(out)));
}

console.log(failures === 0 ? "PREAMBLE REASONING TESTS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
