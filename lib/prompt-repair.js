/**
 * Failure-driven repair hints.
 *
 * Even with repaired arguments (lib/tool-repair.js) and the tool-schema
 * cautions, a model occasionally produces a call DSH has to reject — measured
 * on Gemini 4 Argon: `old_string was not found` (the model retypes the target
 * lines from memory, so the values are its *intended* ones instead of the file's
 * current bytes).
 *
 * Such a call costs a whole round trip, and the error text alone does not tell
 * the model what the file actually says. Because the adapter sees the outgoing
 * transcript, it can detect the rejected call on the *next* request and put the
 * file's real bytes in front of the model — the same request, no extra quota.
 *
 * The hint is ephemeral: it is appended to `systemInstruction` for that one
 * request and never written to the transcript. Nothing in the conversation is
 * rewritten, and a missing/unreadable file simply produces no hint.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

import { guessBaseDirs, resolveExistingFile } from "./tool-repair.js";

const MAX_HINT_CHARS = 12_000;
const MAX_EXCERPT_LINES = 160;
const MAX_EXCERPT_WINDOW = 80;
const MAX_LISTING_ENTRIES = 40;
const RECENT_MESSAGES = 8;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).join("");
  if (isRecord(value)) return typeof value.type === "string" ? textOf(value.text) : "";
  return "";
}

function blockText(block) {
  if (!isRecord(block)) return "";
  if (typeof block.text === "string") return block.text;
  if (Array.isArray(block.content)) return block.content.map((entry) => textOf(entry)).join("");
  return "";
}

function readText(path) {
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return undefined;
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Collect the error-ish tool results at the tail of the transcript. */
function recentFailures(messages) {
  const failures = [];
  const start = Math.max(0, messages.length - RECENT_MESSAGES);
  for (let index = messages.length - 1; index >= start; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (!isRecord(block) || block.type !== "tool-result" || block.isError !== true) continue;
      const text = blockText(block).trim();
      if (!text) continue;
      const call = findToolCall(messages, index, block.toolCallId);
      failures.push({ text, call, failedAt: index });
    }
  }
  return failures;
}

function findToolCall(messages, beforeIndex, toolCallId) {
  for (let index = beforeIndex; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || !Array.isArray(message.content)) continue;
    for (const block of message.content) {
      if (isRecord(block) && block.type === "tool-call" && String(block.id || "") === String(toolCallId || "")) {
        return block;
      }
    }
  }
  return undefined;
}

function callArguments(call) {
  if (!isRecord(call)) return undefined;
  const raw = call.arguments;
  if (isRecord(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return isRecord(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function normalizeLine(line) {
  return String(line).trim().replace(/[ \t]+/g, " ");
}

/**
 * Index of the line where the (wrong) `old_string` most plausibly starts.
 * Similarity is line-wise so differing values still locate the block.
 */
export function locateBlock(fileLines, oldLines) {
  if (!fileLines.length || !oldLines.length) return 0;
  let best = { start: 0, score: 0 };
  let second = 0;
  const limit = Math.max(0, fileLines.length - oldLines.length);
  for (let start = 0; start <= limit; start += 1) {
    let hits = 0;
    for (let offset = 0; offset < oldLines.length; offset += 1) {
      if (normalizeLine(fileLines[start + offset]) === normalizeLine(oldLines[offset])) hits += 1;
    }
    const score = hits / oldLines.length;
    if (score > best.score) {
      second = best.score;
      best = { start, score };
    } else if (score > second) {
      second = score;
    }
  }
  // Require a plausible block and a clearly better candidate than the runner-up,
  // otherwise point at the top of the file instead of a random region.
  if (best.score < 0.3 || (best.score - second < 0.1 && best.score < 0.9)) return 0;
  return best.start;
}

function numberedExcerpt(fileText, focusLine, context = MAX_EXCERPT_WINDOW) {
  const lines = fileText.split("\n");
  let start = 0;
  let end = lines.length;
  if (lines.length > MAX_EXCERPT_LINES) {
    start = Math.max(0, focusLine - Math.floor(context / 2));
    end = Math.min(lines.length, start + MAX_EXCERPT_LINES);
  }
  const numbered = [];
  for (let index = start; index < end; index += 1) {
    numbered.push(`${String(index + 1).padStart(4, " ")}\t${lines[index].replace(/\r$/, "")}`);
  }
  const truncatedBefore = start > 0 ? `… (lines 1-${start} omitted)\n` : "";
  const truncatedAfter = end < lines.length ? `\n… (lines ${end + 1}-${lines.length} omitted)` : "";
  return `${truncatedBefore}${numbered.join("\n")}${truncatedAfter}`;
}

function describeEditFailure(text, call, baseDirs) {
  const match = /old_string was not found in "([^"]+)"/.exec(text);
  if (!match) return undefined;
  const requestedPath = match[1];
  const args = callArguments(call) || {};
  const resolved = resolveExistingFile(requestedPath, baseDirs) || resolveExistingFile(args.file_path, baseDirs);
  if (!resolved) return undefined;
  const file = readText(resolved);
  if (file === undefined) return undefined;

  const oldLines = typeof args.old_string === "string" ? args.old_string.split(/\r?\n/) : [];
  const focus = locateBlock(file.split("\n"), oldLines);
  const excerpt = numberedExcerpt(file, focus);
  return [
    `A previous \`edit\` on ${resolved} was rejected: the \`old_string\` you sent does not exist in the file.`,
    "The file's current content (a slice of it when the file is long; the line numbers are not part of the text) is:",
    "```",
    excerpt,
    "```",
    "Call `edit` again with `old_string` copied character-for-character from the file's real content above, keeping your intended `new_string`.",
    "If the lines above are not the block you meant, call `read` on the file first — do not retype the old text from memory.",
  ].join("\n");
}

function describeMissingPath(text, call, baseDirs) {
  const match = /cannot read "([^"]+)": not found/.exec(text);
  if (!match) return undefined;
  const path = match[1];
  const args = callArguments(call) || {};
  let directory = dirname(path);
  while (directory && directory !== dirname(directory) && !existsSync(directory)) {
    directory = dirname(directory);
  }
  if (!directory || !existsSync(directory)) return undefined;
  let entries = [];
  try {
    entries = readdirSync(directory).slice(0, MAX_LISTING_ENTRIES);
  } catch {
    return undefined;
  }
  const requested = args.file_path || path;
  return [
    `A previous \`read\` failed: ${requested} does not exist.`,
    `Existing entries under ${directory}${entries.length >= MAX_LISTING_ENTRIES ? " (first 40)" : ""}:`,
    entries.map((entry) => `- ${entry}`).join("\n"),
    "Re-run `glob` or `grep` to find the real path, and pass a path that appears in that output.",
  ].join("\n");
}

function describeGoalFailure(text) {
  if (/stale goal ref/.test(text)) {
    return [
      "A previous `update_goal` was rejected: its `goal_id`/`revision` is stale.",
      "Call `get_goal` first and pass its exact `goal_id` and `revision`; a shortened ref such as `g-1234` is not accepted.",
    ].join("\n");
  }
  if (/requires a direct human turn/.test(text)) {
    return [
      "A previous `update_goal` was rejected: `pause` / `resume` need a direct human turn.",
      "Inside an autonomous goal round only `edit`, `complete` or `blocked` are accepted, and `blocked` requires a concrete blocking reason that persisted across rounds.",
    ].join("\n");
  }
  return undefined;
}

/**
 * Build the `<tool_repair>` system-instruction suffix for the upcoming request.
 * Returns `undefined` when nothing in the recent tail needs a hint.
 */
export function buildRepairHint(messages, options = {}) {
  if (!Array.isArray(messages) || messages.length === 0) return undefined;
  const failures = recentFailures(messages);
  if (failures.length === 0) return undefined;
  const baseDirs = Array.isArray(options.baseDirs) ? options.baseDirs : guessBaseDirs(messages);

  const sections = [];
  const seen = new Set();
  for (const failure of failures) {
    const section =
      describeEditFailure(failure.text, failure.call, baseDirs) ||
      describeMissingPath(failure.text, failure.call, baseDirs) ||
      describeGoalFailure(failure.text);
    if (!section || seen.has(section)) continue;
    seen.add(section);
    sections.push(section);
    if (sections.length >= 2) break;
  }
  if (sections.length === 0) return undefined;
  const body = sections.join("\n\n");
  return `<tool_repair>\n${body.slice(0, MAX_HINT_CHARS)}\n</tool_repair>`;
}
