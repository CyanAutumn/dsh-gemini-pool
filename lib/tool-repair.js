/**
 * Repair model-authored tool-call arguments before DSH validates and executes
 * them.
 *
 * Why this exists: the Antigravity models (Gemini 4 Argon was measured) produce
 * three repeatable "process" failures that are not model *reasoning* mistakes
 * but argument-shape mistakes the adapter can see and fix for free:
 *
 * 1. `invalid escalation: justification is only valid together with
 *    sandbox_permissions` — `justification` is filled alone. 9 hits in one
 *    audit session, 44 in another.
 * 2. `old_string was not found in "<file>"` — `edit` retypes the target text
 *    from memory, so CRLF/LF, trailing whitespace or indentation do not match
 *    the bytes on disk. 10 hits in the same session.
 * 3. `sandbox_permissions` spellings/lone escalation leftovers that fail the
 *    enum check before the tool ever runs.
 *
 * The repairs are only applied when they are provably intent-preserving:
 * - a lone `justification` has no meaning without the escalation mode, so it is
 *   dropped (DSH would reject the call otherwise);
 * - an `old_string` is replaced only by a *unique* literal span of the same
 *   file, matched after normalising line endings / trailing whitespace /
 *   indentation. When no unique span exists, the arguments are returned
 *   untouched so the model still gets the original error and can re-read.
 *
 * No network, no heuristic rewriting of `new_string`, no silent path invention.
 */
import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const MAX_REPAIR_FILE_BYTES = 4 * 1024 * 1024;
const MAX_OLD_STRING_CHARS = 200 * 1024;
const MAX_BASE_DIRS = 64;
const MAX_SCAN_CHARS = 2 * 1024 * 1024;
const MAX_SCAN_MESSAGES = 80;

export const SANDBOX_MODES = ["workspace-write", "danger-full-access"];

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isBlank(value) {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * Gemini occasionally returns `functionCall.args` as a JSON string. Parse it
 * instead of dropping every argument (the old code fell back to `{}`).
 */
export function parseToolArguments(raw) {
  if (isRecord(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (isRecord(parsed)) return parsed;
    } catch {
      // leave the malformed payload alone: the host will report it
    }
  }
  return {};
}

function normalizeSandboxMode(value) {
  const normalized = String(value).trim().toLowerCase().replace(/[\s_]+/g, "-");
  return SANDBOX_MODES.includes(normalized) ? normalized : undefined;
}

/** Drop `justification` when the call does not request an escalation mode. */
function dropLoneJustification(args, toolName, repairs) {
  if (!hasOwn(args, "justification") || isBlank(args.justification)) return args;
  if (!isBlank(args.sandbox_permissions)) return args;
  const { justification, ...rest } = args;
  repairs.push({ kind: "drop-lone-justification", tool: toolName });
  return rest;
}

/**
 * Normalise the escalation pair: alias spellings become the enum value, a
 * leftover empty/unknown mode is removed together with its justification, and
 * an escalation without the required sentence is dropped instead of being sent
 * for the host to reject.
 */
function normalizeEscalation(args, toolName, repairs) {
  if (!hasOwn(args, "sandbox_permissions")) return args;
  const raw = args.sandbox_permissions;

  if (isBlank(raw)) {
    const { sandbox_permissions, justification, ...rest } = args;
    repairs.push({ kind: "drop-empty-escalation", tool: toolName });
    return rest;
  }

  const mode = typeof raw === "string" ? normalizeSandboxMode(raw) : undefined;
  if (!mode) {
    const { sandbox_permissions, justification, ...rest } = args;
    repairs.push({ kind: "drop-unknown-escalation", tool: toolName });
    return rest;
  }

  if (isBlank(args.justification)) {
    const { sandbox_permissions, ...rest } = args;
    repairs.push({ kind: "drop-escalation-without-justification", tool: toolName });
    return rest;
  }

  if (mode !== raw) {
    repairs.push({ kind: "normalize-sandbox-mode", tool: toolName });
    return { ...args, sandbox_permissions: mode };
  }
  return args;
}

function readTextFile(path) {
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > MAX_REPAIR_FILE_BYTES) return undefined;
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

/** Resolve an absolute or relative `file_path` to an existing file. */
export function resolveExistingFile(filePath, baseDirs = []) {
  if (typeof filePath !== "string" || !filePath.trim()) return undefined;
  const candidates = [filePath];
  const native = filePath.replace(/\//g, "\\");
  if (native !== filePath) candidates.push(native);
  if (!isAbsolute(filePath)) {
    for (const base of Array.isArray(baseDirs) ? baseDirs : []) {
      if (typeof base === "string" && base.trim()) candidates.push(resolve(base, filePath));
    }
  }
  const seen = new Set();
  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      const stat = statSync(candidate);
      if (stat.isFile() && stat.size <= MAX_REPAIR_FILE_BYTES) return candidate;
    } catch {
      // try the next candidate
    }
  }
  return undefined;
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

const LINE_NORMALIZERS = [
  // CRLF leftovers from splitting on "\n"
  (line) => line.replace(/\r$/, ""),
  // trailing spaces/tabs
  (line) => line.replace(/[ \t\r]+$/, ""),
  // indentation (tabs vs spaces, wrong depth)
  (line) => line.trim(),
  // inner whitespace runs
  (line) => line.trim().replace(/[ \t]+/g, " "),
];

function findLineRun(file, old, allowMultiple) {
  const fileLines = file.split("\n");
  const oldLines = old.split("\n");
  if (oldLines.length === 0 || oldLines.length > fileLines.length) return undefined;
  if (oldLines.every((line) => line.trim() === "")) return undefined;

  for (const normalize of LINE_NORMALIZERS) {
    const targets = oldLines.map(normalize);
    if (targets.every((line) => line === "")) continue;
    const hits = [];
    for (let start = 0; start + targets.length <= fileLines.length; start += 1) {
      let matched = true;
      for (let offset = 0; offset < targets.length; offset += 1) {
        if (normalize(fileLines[start + offset]) !== targets[offset]) {
          matched = false;
          break;
        }
      }
      if (matched) hits.push(start);
      if (hits.length > 1 && !allowMultiple) break;
    }
    if (hits.length === 1) {
      return fileLines.slice(hits[0], hits[0] + targets.length).join("\n");
    }
  }
  return undefined;
}

/**
 * Find the literal file text an `old_string` was meant to identify.
 * Returns `undefined` when no unique, intent-preserving alternative exists.
 */
export function findLiteralMatch(file, old, allowMultiple = false) {
  if (typeof file !== "string" || typeof old !== "string" || old.length === 0) return undefined;
  if (old.length > MAX_OLD_STRING_CHARS) return undefined;
  if (file.includes(old)) return old;

  // Line-ending mismatch first: the model often turns CRLF into LF (or back).
  const variants = [];
  if (old.includes("\r\n")) variants.push(old.replace(/\r\n/g, "\n"));
  else if (old.includes("\n")) variants.push(old.replace(/\n/g, "\r\n"));
  for (const variant of variants) {
    if (variant === old) continue;
    if (file.includes(variant)) {
      if (allowMultiple || countOccurrences(file, variant) === 1) return variant;
    }
  }

  return findLineRun(file, old, allowMultiple);
}

function repairEditArguments(args, context, repairs) {
  const filePath = typeof args.file_path === "string" ? args.file_path : undefined;
  const oldString = args.old_string;
  if (!filePath || typeof oldString !== "string" || oldString.length === 0) return args;

  const resolved = resolveExistingFile(filePath, context.baseDirs);
  if (!resolved) return args;
  const file = readTextFile(resolved);
  if (file === undefined) return args;

  const fixed = findLiteralMatch(file, oldString, args.replace_all === true);
  if (!fixed || fixed === oldString) return args;

  repairs.push({ kind: "edit-old-string", tool: "edit" });
  return {
    ...args,
    old_string: fixed,
    ...(resolved !== filePath ? { file_path: resolved } : {}),
  };
}

/**
 * Repair one tool call. Returns the (possibly same) argument object plus a
 * list of applied repairs for diagnostics.
 */
export function repairToolArguments(toolName, args, context = {}) {
  if (!isRecord(args)) return { args, repairs: [] };
  const repairs = [];
  let out = dropLoneJustification(args, toolName, repairs);
  out = normalizeEscalation(out, toolName, repairs);
  if (toolName === "edit") out = repairEditArguments(out, context, repairs);
  return { args: out, repairs };
}

function collectStrings(value, sink, budget) {
  if (budget.left <= 0 || value === undefined || value === null) return;
  if (typeof value === "string") {
    const slice = value.slice(0, budget.left);
    sink.push(slice);
    budget.left -= slice.length;
    return;
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, sink, budget);
    return;
  }
  if (isRecord(value)) {
    for (const entry of Object.values(value)) collectStrings(entry, sink, budget);
  }
}

const ABSOLUTE_PATH_PATTERN = /[A-Za-z]:[\\/][^\s"'`<>|?*\r\n]+/g;
const FILE_EXTENSION_PATTERN = /\.[A-Za-z0-9]{1,8}$/;

/**
 * Derive candidate base directories from the conversation so relative
 * `file_path` values can still be repaired. Absolute paths the model already
 * used (or read results reported) are the best signal for the workspace root;
 * the most recent messages win.
 */
export function guessBaseDirs(messages, limit = MAX_BASE_DIRS) {
  if (!Array.isArray(messages) || messages.length === 0) return [];
  const sink = [];
  const budget = { left: MAX_SCAN_CHARS };
  for (let index = messages.length - 1; index >= 0 && messages.length - index <= MAX_SCAN_MESSAGES; index -= 1) {
    collectStrings(messages[index]?.content, sink, budget);
    if (budget.left <= 0) break;
  }
  const dirs = new Set();
  for (const text of sink) {
    for (const match of text.matchAll(ABSOLUTE_PATH_PATTERN)) {
      // Tool-call arguments are JSON text in the transcript, so a Windows path
      // may arrive with doubled separators ("C:\\\\Users\\\\...").
      const found = match[0].replace(/\\{2,}/g, "\\").replace(/[.,;:)\]}]+$/, "");
      if (!FILE_EXTENSION_PATTERN.test(found)) continue;
      let directory = dirname(found);
      for (let depth = 0; depth < 4 && directory; depth += 1) {
        const parent = dirname(directory);
        if (parent === directory) break;
        dirs.add(directory);
        directory = parent;
        if (dirs.size >= limit) break;
      }
      if (dirs.size >= limit) break;
    }
    if (dirs.size >= limit) break;
  }
  return [...dirs];
}
