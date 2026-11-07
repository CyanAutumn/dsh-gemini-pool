/**
 * Static model catalog and pure model helpers for the Antigravity adapter.
 * Extracted verbatim from lib/index.js (no behavior change).
 */
import { createHash } from "node:crypto";

export const ROUTING = {
  "gemini-3.8-flash": {
    off: "gemini-3.8-flash-tiered",
    routing: {
      minimal: "gemini-3.8-flash-tiered",
      low: "gemini-3.8-flash-tiered",
      medium: "gemini-3.8-flash-tiered",
      high: "gemini-3.8-flash-tiered",
      xhigh: "gemini-3.8-flash-tiered",
    },
    defaultRequestId: "gemini-3.8-flash-tiered",
  },
  "claude-opus-4-6": {
    off: "claude-opus-4-6-thinking",
    routing: {
      minimal: "claude-opus-4-6-thinking",
      low: "claude-opus-4-6-thinking",
      medium: "claude-opus-4-6-thinking",
      high: "claude-opus-4-6-thinking",
      xhigh: "claude-opus-4-6-thinking",
    },
    defaultRequestId: "claude-opus-4-6-thinking",
  },
  "claude-sonnet-4-6": {
    off: "claude-sonnet-4-6-thinking",
    routing: {
      minimal: "claude-sonnet-4-6-thinking",
      low: "claude-sonnet-4-6-thinking",
      medium: "claude-sonnet-4-6-thinking",
      high: "claude-sonnet-4-6-thinking",
      xhigh: "claude-sonnet-4-6-thinking",
    },
    defaultRequestId: "claude-sonnet-4-6-thinking",
  },
  "gemini-3.7-flash": {
    off: "gemini-3.7-flash-tiered",
    routing: {
      minimal: "gemini-3.7-flash-tiered",
      low: "gemini-3.7-flash-tiered",
      medium: "gemini-3.7-flash-tiered",
      high: "gemini-3.7-flash-tiered",
      xhigh: "gemini-3.7-flash-tiered",
    },
    defaultRequestId: "gemini-3.7-flash-tiered",
  },
  "gemini-3.6-flash": {
    off: "gemini-3.6-flash-low",
    routing: {
      minimal: "gemini-3.6-flash-low",
      low: "gemini-3.6-flash-low",
      medium: "gemini-3.6-flash-medium",
      high: "gemini-3.6-flash-high",
      xhigh: "gemini-3.6-flash-high",
    },
    defaultRequestId: "gemini-3.6-flash-high",
  },
  "gemini-3.5-flash": {
    off: "gemini-3.5-flash-extra-low",
    routing: {
      minimal: "gemini-3.5-flash-extra-low",
      low: "gemini-3.5-flash-low",
      medium: "gemini-3.5-flash-low",
      high: "gemini-3-flash-agent",
      xhigh: "gemini-3-flash-agent",
    },
    defaultRequestId: "gemini-3-flash-agent",
  },
  "gemini-3.1-pro": {
    off: "gemini-3.1-pro-low",
    routing: {
      minimal: "gemini-3.1-pro-low",
      low: "gemini-3.1-pro-low",
      medium: "gemini-pro-agent",
      high: "gemini-pro-agent",
      xhigh: "gemini-pro-agent",
    },
    defaultRequestId: "gemini-pro-agent",
  },
  "gemini-3.1-flash-image": {
    off: "gemini-3.1-flash-image",
    routing: {
      minimal: "gemini-3.1-flash-image",
      low: "gemini-3.1-flash-image",
      medium: "gemini-3.1-flash-image",
      high: "gemini-3.1-flash-image",
      xhigh: "gemini-3.1-flash-image",
    },
    defaultRequestId: "gemini-3.1-flash-image",
  },
  "gemini-3-flash": {
    off: "gemini-3-flash",
    routing: {
      minimal: "gemini-3-flash",
      low: "gemini-3-flash",
      medium: "gemini-3-flash",
      high: "gemini-3-flash",
      xhigh: "gemini-3-flash",
    },
    defaultRequestId: "gemini-3-flash",
  },
  "gemini-2.5-pro": {
    off: "gemini-2.5-pro",
    routing: {
      minimal: "gemini-2.5-pro",
      low: "gemini-2.5-pro",
      medium: "gemini-2.5-pro",
      high: "gemini-2.5-pro",
      xhigh: "gemini-2.5-pro",
    },
    defaultRequestId: "gemini-2.5-pro",
  },
  "gemini-2.5-flash": {
    off: "gemini-2.5-flash",
    routing: {
      minimal: "gemini-2.5-flash",
      low: "gemini-2.5-flash",
      medium: "gemini-2.5-flash",
      high: "gemini-2.5-flash",
      xhigh: "gemini-2.5-flash",
    },
    defaultRequestId: "gemini-2.5-flash",
  },
  "gpt-oss-120b": {
    off: "gpt-oss-120b-medium",
    routing: {
      minimal: "gpt-oss-120b-medium",
      low: "gpt-oss-120b-medium",
      medium: "gpt-oss-120b-medium",
      high: "gpt-oss-120b-medium",
      xhigh: "gpt-oss-120b-medium",
    },
    defaultRequestId: "gpt-oss-120b-medium",
  },
};
export const RUNTIME_MAX_OUTPUT_TOKENS = {
  "gemini-3.8-flash": 65536,
  "gemini-3.8-flash-tiered": 65536,
  "gemini-3.8-flash-low": 65536,
  "gemini-3.8-flash-medium": 65536,
  "gemini-3.8-flash-high": 65536,
  "gemini-3.7-flash": 65536,
  "gemini-3.7-flash-tiered": 65536,
  "gemini-3.7-flash-low": 65536,
  "gemini-3.7-flash-medium": 65536,
  "gemini-3.7-flash-high": 65536,
  "gemini-3.6-flash": 65536,
  "gemini-3.6-flash-low": 65536,
  "gemini-3.6-flash-medium": 65536,
  "gemini-3.6-flash-high": 65536,
  "gemini-3.5-flash": 65536,
  "gemini-3.5-flash-extra-low": 65536,
  "gemini-3.5-flash-low": 65536,
  "gemini-3-flash-agent": 65536,
  "gemini-3.1-pro": 65535,
  "gemini-3.1-pro-low": 65535,
  "gemini-3.1-pro-high": 65535,
  "gemini-pro-agent": 65535,
  "claude-opus-4-6": 64000,
  "claude-opus-4-6-thinking": 64000,
  "claude-sonnet-4-6": 64000,
  "gpt-oss-120b": 32768,
  "gpt-oss-120b-medium": 32768,
};
export const MODELS = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "gemini-3.1-pro",
    name: "Gemini 3.1 Pro",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65535,
    reasoningEfforts: ["low", "high"],
  },
  {
    id: "gemini-3.1-flash-image",
    name: "Gemini 3.1 Flash Image",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "gemini-3-flash",
    name: "Gemini 3 Flash",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "high"],
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    inputModalities: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 64000,
    reasoningEfforts: ["high"],
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    inputModalities: ["text", "image"],
    contextWindow: 250000,
    maxTokens: 64000,
    reasoningEfforts: ["high"],
  },
  {
    id: "gpt-oss-120b",
    name: "GPT-OSS 120B",
    inputModalities: ["text"],
    contextWindow: 131072,
    maxTokens: 32768,
    reasoningEfforts: ["medium"],
  },
];
function extractModelVersion(model) {
  const name = String(model?.name || "");
  const id = String(model?.id || model?.modelId || "");
  const idMatch = id.match(/(?:gemini|claude|gpt)[-_ ]*v?(\d+(?:\.\d+)*)/i)
    || id.match(/\b(\d+(?:\.\d+)+)\b/);
  if (idMatch) return idMatch[1].split(".").map((num) => parseInt(num, 10) || 0);

  const nameMatch = name.match(/(?:gemini|claude|gpt)[-_ ]*v?(\d+(?:\.\d+)*)/i)
    || name.match(/\b(\d+(?:\.\d+)+)\b/);
  if (nameMatch) return nameMatch[1].split(".").map((num) => parseInt(num, 10) || 0);

  return [0];
}

function compareVersionsDesc(v1, v2) {
  const len = Math.max(v1.length, v2.length);
  for (let i = 0; i < len; i++) {
    const num1 = v1[i] !== undefined ? v1[i] : 0;
    const num2 = v2[i] !== undefined ? v2[i] : 0;
    if (num1 !== num2) return num2 - num1;
  }
  return 0;
}

function getFamilyOrder(model) {
  const text = `${model?.id || ""} ${model?.name || ""}`.toLowerCase();
  if (text.includes("gemini")) return 1;
  if (text.includes("claude")) return 2;
  if (text.includes("gpt")) return 3;
  return 4;
}

function getVariantScore(model) {
  const text = `${model?.name || ""} ${model?.id || ""}`.toLowerCase();
  if (text.includes("ultra")) return 1;
  if (text.includes("pro") && !text.includes("lite")) return 2;
  if (text.includes("flash") && !text.includes("lite") && !text.includes("thinking") && !text.includes("image")) return 3;
  if (text.includes("flash") && text.includes("thinking") && !text.includes("lite")) return 4;
  if (text.includes("image")) return 5;
  if (text.includes("lite") && !text.includes("thinking")) return 6;
  if (text.includes("lite") && text.includes("thinking")) return 7;
  return 10;
}
export function compareAntigravityModels(a, b) {
  const famA = getFamilyOrder(a);
  const famB = getFamilyOrder(b);
  if (famA !== famB) return famA - famB;

  const verA = extractModelVersion(a);
  const verB = extractModelVersion(b);
  const verComp = compareVersionsDesc(verA, verB);
  if (verComp !== 0) return verComp;

  const variantA = getVariantScore(a);
  const variantB = getVariantScore(b);
  if (variantA !== variantB) return variantA - variantB;

  return (a.name || a.id || "").localeCompare(b.name || b.id || "") || (a.id || "").localeCompare(b.id || "");
}
export function modelNameFromId(id) {
  return String(id)
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bOss\b/g, "OSS");
}

export function inferModelShape(modelId, info = {}) {
  const id = String(modelId);
  const staticModel = modelById(id);
  if (staticModel) return staticModel;
  const lower = id.toLowerCase();
  const maxTokens = getMaxOutputTokens(id, id);
  const inputModalities = info.supportsImages || /gemini|claude/i.test(id) ? ["text", "image"] : ["text"];
  const reasoningEfforts = lower.includes("gpt-oss")
    ? ["medium"]
    : lower.includes("claude")
      ? ["high"]
      : lower.includes("pro")
        ? ["low", "high"]
        : lower.includes("gemini")
          ? ["low", "medium", "high"]
          : [];
  let name = info.displayName || info.label || info.modelName || modelNameFromId(id);
  if (id === "gemini-3.8-flash-tiered") {
    name = "Gemini 3.8 Flash";
  }
  if (id === "gemini-3.7-flash-tiered") {
    name = "Gemini 3.7 Flash";
  }
  const idVer = extractModelVersion({ id });
  const nameVer = extractModelVersion({ name });
  if (
    idVer[0] !== 0 &&
    nameVer[0] !== 0 &&
    (idVer[0] !== nameVer[0] || (idVer[1] !== undefined && nameVer[1] !== undefined && idVer[1] !== nameVer[1]))
  ) {
    name = modelNameFromId(id);
  }
  return {
    id,
    name,
    inputModalities,
    contextWindow: lower.includes("claude") ? 200000 : lower.includes("gpt-oss") ? 131072 : 1048576,
    maxTokens,
    reasoningEfforts,
  };
}
export function baseModelMatcher(baseId) {
  switch (baseId) {
    case "gemini-3.8-flash":
      return (text) => /gemini[- ]3\.8[- ]flash/i.test(text);
    case "gemini-3.7-flash":
      return (text) => /gemini[- ]3\.7[- ]flash/i.test(text);
    case "gemini-3.6-flash":
      return (text) => /gemini[- ]3\.6[- ]flash/i.test(text);
    case "gemini-3.5-flash":
      return (text) => /gemini[- ]3\.5[- ]flash|gemini[- ]3[- ]flash[- ]agent/i.test(text);
    case "gemini-3.1-pro":
      return (text) => /gemini[- ]3\.1[- ]pro|gemini[- ]pro[- ]agent/i.test(text);
    case "gemini-3.1-flash-image":
      return (text) => /gemini[- ]3\.1[- ]flash[- ]image/i.test(text);
    case "gemini-3-flash":
      return (text) => /^gemini[- ]3[- ]flash$/i.test(text);
    case "gemini-2.5-pro":
      return (text) => /gemini[- ]2\.5[- ]pro/i.test(text);
    case "gemini-2.5-flash":
      return (text) => /gemini[- ]2\.5[- ]flash|gemini[- ]3\.1[- ]flash[- ]lite/i.test(text);
    case "claude-sonnet-4-6":
      return (text) => /claude[- ]sonnet/i.test(text);
    case "claude-opus-4-6":
      return (text) => /claude[- ]opus/i.test(text);
    case "gpt-oss-120b":
      return (text) => /gpt[- ]oss/i.test(text);
    default:
      return (text) => String(text || "").toLowerCase().includes(baseId.toLowerCase());
  }
}
export function getMaxOutputTokens(modelId, runtimeModel) {
  if (runtimeModel && RUNTIME_MAX_OUTPUT_TOKENS[runtimeModel] !== undefined) {
    return RUNTIME_MAX_OUTPUT_TOKENS[runtimeModel];
  }
  if (RUNTIME_MAX_OUTPUT_TOKENS[modelId] !== undefined) return RUNTIME_MAX_OUTPUT_TOKENS[modelId];
  if (runtimeModel) {
    if (/^claude-.*5-5/i.test(runtimeModel)) return 128000;
    if (runtimeModel.startsWith("claude-")) return 64000;
    if (runtimeModel.startsWith("gpt-oss-")) return 32768;
    if (runtimeModel.startsWith("gemini-3.1-pro") || runtimeModel === "gemini-pro-agent") {
      return 65535;
    }
    if (runtimeModel.startsWith("gemini-")) return 65536;
  }
  return 8192;
}
export function modelById(modelId) {
  return MODELS.find((model) => model.id === modelId);
}

/**
 * The Antigravity CLI tags every request of one conversation with a signed
 * 64-bit `sessionId` (sent as a decimal string, may be negative) and a
 * conversation-level `cascade_id` UUID; the per-turn `trajectory_id` still
 * changes. Deriving the pair from the host session id keeps the same
 * conversation on one pair — including the wire shape the CLI uses
 * (captured 2026-11-06: sessionId "-3750763034362895579").
 */
// ── tool schema ─────────────────────────────────────────────────────────────
// The CLI sends tool declarations as `parameters` in Gemini Schema shape:
// uppercase type names, and only the keys its own declarations use (captured
// 2026-11-06: type/description/properties/required/items/enum/minLength/minItems).
// `nullable`/`anyOf` are kept too — they are real Gemini Schema fields and are
// what a nullable union / union type has to become.
const GEMINI_SCHEMA_TYPE = {
  object: "OBJECT",
  array: "ARRAY",
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  null: "NULL",
};
const GEMINI_SCHEMA_NUMERIC_KEYS = ["minLength", "maxLength", "minItems", "maxItems"];

function resolveLocalRef(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return undefined;
  let node = root;
  for (const rawPart of ref.slice(2).split("/")) {
    const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!node || typeof node !== "object") return undefined;
    node = node[part];
  }
  return node;
}

function geminiSchemaType(rawType) {
  if (typeof rawType === "string") {
    return GEMINI_SCHEMA_TYPE[rawType.toLowerCase()] || undefined;
  }
  if (Array.isArray(rawType)) {
    const named = rawType.filter((entry) => typeof entry === "string" && entry.toLowerCase() !== "null");
    return named.length ? GEMINI_SCHEMA_TYPE[named[0].toLowerCase()] : undefined;
  }
  return undefined;
}

/**
 * Convert one JSON Schema (what DSH tools declare) into the Gemini Schema shape
 * the Antigravity CLI sends as `functionDeclarations[].parameters`. Unknown
 * keywords are dropped instead of forwarded; `$ref` is resolved against the
 * root document so inlined definitions survive.
 */
export function toGeminiToolSchema(schema, root = schema, seenRefs = new Set()) {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "OBJECT", properties: {} };
  }
  if (schema.$ref) {
    if (seenRefs.has(schema.$ref)) return { type: "STRING" };
    const target = resolveLocalRef(root, schema.$ref);
    if (target) {
      const nextSeen = new Set(seenRefs);
      nextSeen.add(schema.$ref);
      return toGeminiToolSchema(target, root, nextSeen);
    }
  }

  const out = {};
  const type = geminiSchemaType(schema.type);
  if (type) out.type = type;
  if (typeof schema.description === "string" && schema.description) out.description = schema.description;

  const properties = schema.properties;
  if (properties && typeof properties === "object" && !Array.isArray(properties)) {
    const mapped = {};
    for (const [name, child] of Object.entries(properties)) {
      mapped[name] = toGeminiToolSchema(child, root, seenRefs);
    }
    out.properties = mapped;
    if (!out.type) out.type = "OBJECT";
  }

  if (Array.isArray(schema.required)) {
    const required = schema.required.filter((entry) => typeof entry === "string");
    if (required.length) out.required = required;
  }

  if (schema.items) {
    out.items = toGeminiToolSchema(schema.items, root, seenRefs);
    if (!out.type) out.type = "ARRAY";
  }

  if (Array.isArray(schema.enum)) {
    const values = schema.enum.filter((entry) => typeof entry === "string");
    if (values.length) out.enum = values;
  }
  if (out.enum === undefined && typeof schema.const === "string") out.enum = [schema.const];

  for (const key of GEMINI_SCHEMA_NUMERIC_KEYS) {
    if (typeof schema[key] === "number" && Number.isFinite(schema[key])) out[key] = schema[key];
  }

  const nullable =
    schema.nullable === true ||
    (Array.isArray(schema.type) && schema.type.some((entry) => String(entry).toLowerCase() === "null"));
  if (nullable) out.nullable = true;

  if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
    out.anyOf = schema.anyOf.map((child) => toGeminiToolSchema(child, root, seenRefs));
    delete out.type;
    delete out.properties;
    delete out.required;
  }

  if (!out.type && !out.anyOf) out.type = "STRING";
  return out;
}

export function antigravitySessionKeys(hostSessionId) {
  const seed = `antigravity:session:${String(hostSessionId ?? "")}`;
  const digest = createHash("sha1").update(seed).digest();
  const sessionId = digest.readBigInt64BE(0).toString();
  const uuidBytes = digest.subarray(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50; // version 5
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = uuidBytes.toString("hex");
  const cascadeId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  return { sessionId, cascadeId };
}

// ───────────────────────────── live model catalog ─────────────────────────────
// The MODELS table above is an *offline fallback* only. The authoritative list
// is whatever the account's Cloud Code Assist endpoint returns from
// `/v1internal:fetchAvailableModels`, so a freshly published model (a future
// Gemini release, a new Claude revision, ...) appears after a refresh with no
// code change. The helpers below turn that response into catalog entries and
// keep the base-id -> runtime-id mapping the request path needs.

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clampUnitFraction(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

const LIVE_MODEL_ID_PATTERN = /^(gemini|claude|gpt-oss)-/i;

function isLiveModelId(id) {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 200 &&
    LIVE_MODEL_ID_PATTERN.test(id) &&
    !/\s/.test(id) &&
    !/^MODEL_/i.test(id)
  );
}

// Variant suffixes the endpoint appends to a base model id. Order matters:
// longer suffixes must be tested before their own tail ("-extra-low" before
// "-low", "-tiered-preview" before "-tiered"). "-lite"/"-thinking" are *models*
// in their own right upstream, not effort levels, so they are deliberately
// absent here.
const RUNTIME_VARIANT_SUFFIXES = [
  ["-tiered-preview", undefined],
  ["-extra-low", "minimal"],
  ["-tiered", undefined],
  ["-agent", undefined],
  ["-low", "low"],
  ["-medium", "medium"],
  ["-high", "high"],
];

export function splitRuntimeVariant(modelId) {
  const id = String(modelId || "");
  const lower = id.toLowerCase();
  for (const [suffix, effort] of RUNTIME_VARIANT_SUFFIXES) {
    if (lower.endsWith(suffix) && id.length > suffix.length) {
      return { baseId: id.slice(0, id.length - suffix.length), effort };
    }
  }
  return { baseId: id, effort: undefined };
}

export function humanizeModelId(id) {
  const tokens = String(id || "").split(/[-_]+/).filter(Boolean);
  const words = [];
  for (const token of tokens) {
    const numeric = /^\d+(?:\.\d+)*$/;
    if (numeric.test(token) && words.length && numeric.test(words[words.length - 1])) {
      words[words.length - 1] = `${words[words.length - 1]}.${token}`;
      continue;
    }
    words.push(/^\d/.test(token) ? token.toUpperCase() : token.charAt(0).toUpperCase() + token.slice(1));
  }
  return words
    .join(" ")
    .replace(/\bGpt\b/g, "GPT")
    .replace(/\bOss\b/g, "OSS")
    .replace(/^GPT OSS\b/, "GPT-OSS");
}

function liveDisplayName(info) {
  const raw =
    (typeof info.displayName === "string" && info.displayName) ||
    (typeof info.label === "string" && info.label) ||
    (typeof info.modelName === "string" && info.modelName) ||
    "";
  return (
    String(raw)
      .replace(/\s*\((?:low|medium|high|extra[- ]low|thinking|tiered|preview)\)\s*$/i, "")
      .trim() || undefined
  );
}

function liveModelProvider(info) {
  if (typeof info.modelProvider === "string") return info.modelProvider;
  if (typeof info.apiProvider === "string") return info.apiProvider;
  return undefined;
}

/**
 * Build the model catalog straight from a `fetchAvailableModels` payload.
 * Returns `[]` when nothing usable was returned; callers keep the previously
 * stored catalog in that case (only a never-populated store falls back to the
 * static MODELS table, via `catalogModelsOf`).
 */
export function buildLiveCatalog(modelsMap) {
  const groups = new Map();
  for (const [modelId, infoRaw] of Object.entries(isPlainObject(modelsMap) ? modelsMap : {})) {
    if (!isLiveModelId(modelId)) continue;
    if (/^(chat_|tab_)/i.test(modelId)) continue;
    const info = isPlainObject(infoRaw) ? infoRaw : {};
    if (info.isInternal) continue;
    const { baseId, effort } = splitRuntimeVariant(modelId);
    if (!groups.has(baseId)) groups.set(baseId, []);
    groups.get(baseId).push({ modelId, effort: effort || "default", info });
  }

  const effortOrder = ["minimal", "low", "medium", "high"];
  const catalog = [];
  for (const [baseId, members] of groups) {
    const runtimeIds = {};
    for (const member of members) {
      if (runtimeIds[member.effort] === undefined) runtimeIds[member.effort] = member.modelId;
    }
    const efforts = [...new Set(members.map((member) => member.effort).filter((effort) => effort !== "default"))].sort(
      (left, right) => effortOrder.indexOf(left) - effortOrder.indexOf(right),
    );
    const primary =
      members.find(
        (member) => isPlainObject(member.info.quotaInfo) && typeof member.info.quotaInfo.remainingFraction === "number",
      ) || members[0];
    const quotaInfo = isPlainObject(primary.info.quotaInfo) ? primary.info.quotaInfo : {};
    // The endpoint names each runtime model (e.g. MODEL_PLACEHOLDER_M419); the CLI
    // echoes it in request.labels.model_enum, so keep the per-runtime mapping.
    const modelEnums = {};
    for (const member of members) {
      if (typeof member.info.model === "string" && member.info.model) {
        modelEnums[member.modelId] = member.info.model;
      }
    }
    const staticModel = modelById(baseId);
    const shape =
      staticModel ||
      inferModelShape(baseId, {
        displayName: liveDisplayName(primary.info),
        supportsImages: members.some((member) => member.info.supportsImages === true),
      });
    // The endpoint reports the real limits (`maxTokens` = context window,
    // `maxOutputTokens` = output cap); the static table is only a guess.
    const liveContext = typeof primary.info.maxTokens === "number" && primary.info.maxTokens > 0
      ? primary.info.maxTokens
      : undefined;
    const liveMaxOutput =
      typeof primary.info.maxOutputTokens === "number" && primary.info.maxOutputTokens > 0
        ? primary.info.maxOutputTokens
        : undefined;
    catalog.push({
      id: baseId,
      name: shape.name,
      inputModalities: Array.isArray(shape.inputModalities) ? shape.inputModalities : ["text"],
      contextWindow: liveContext ?? shape.contextWindow,
      maxTokens: liveMaxOutput ?? shape.maxTokens,
      // Only offer the effort levels that actually map to a distinct runtime
      // id (or the static table's verified levels); a cosmetic selector that
      // silently does nothing is worse than none.
      reasoningEfforts: staticModel ? staticModel.reasoningEfforts : efforts,
      available: true,
      remainingFraction: clampUnitFraction(quotaInfo.remainingFraction),
      resetTime: quotaInfo.resetTime ? String(quotaInfo.resetTime) : undefined,
      modelProvider: liveModelProvider(primary.info),
      // The endpoint marks thinking-capable models with a numeric thinkingLevel
      // (1=low, 2=medium, 3=high); only those accept generationConfig.thinkingConfig.
      thinkingLevels: members.some((member) => typeof member.info.thinkingLevel === "number"),
      ...(Object.keys(modelEnums).length ? { modelEnums } : {}),
      runtimeIds,
    });
  }
  catalog.sort(compareAntigravityModels);
  return catalog;
}

/** Runtime model id for a catalog entry at a given reasoning effort. */
export function runtimeModelIdFor(entry, effort) {
  const runtimeIds = entry && isPlainObject(entry.runtimeIds) ? entry.runtimeIds : undefined;
  if (!runtimeIds) return undefined;
  const pick = (key) => (typeof runtimeIds[key] === "string" && runtimeIds[key] ? runtimeIds[key] : undefined);
  if (typeof effort === "string" && effort) {
    const exact = pick(effort);
    if (exact) return exact;
    if (effort === "xhigh" || effort === "max") {
      return pick("high") ?? pick("medium") ?? pick("low") ?? pick("minimal");
    }
  }
  return pick("default") ?? pick("high") ?? pick("medium") ?? pick("low") ?? pick("minimal");
}

/**
 * Which catalog ids stay enabled after a refresh.
 * - the user's explicit choices are kept;
 * - models the account no longer serves are dropped (caller passes the new
 *   catalog only);
 * - anything discovered for the first time is auto-enabled, so a freshly
 *   released model reaches the DSH model list without manual tick boxes.
 * A never-populated catalog enables everything.
 */
export function mergeEnabledModelIds(previousCatalogModels, previousEnabledModelIds, catalogModels) {
  const previousIds = new Set(
    (Array.isArray(previousCatalogModels) ? previousCatalogModels : [])
      .map((model) => (model && typeof model.id === "string" ? model.id : undefined))
      .filter(Boolean),
  );
  const previouslyEnabled = new Set(Array.isArray(previousEnabledModelIds) ? previousEnabledModelIds : []);
  return (Array.isArray(catalogModels) ? catalogModels : [])
    .map((model) => (model && typeof model.id === "string" ? model.id : undefined))
    .filter(Boolean)
    .filter((id) => previouslyEnabled.has(id) || previousIds.size === 0 || !previousIds.has(id));
}

/**
 * Models the Antigravity clients (App / CLI / IDE) offer in their own model
 * pickers but that an account's `fetchAvailableModels` response may not
 * advertise. With the CLI user agent (see index.js) the endpoint already lists
 * `gemini-4-argon-*`; this entry is the safety net for older user agents or a
 * rollout that hides them again, and documents the runtime ids:
 *   gemini-4-argon-low / -medium / -high (medium is the product default).
 * Docs: https://antigravity.google/docs/models
 */
export const CURATED_MODELS = [
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    inputModalities: ["text", "image"],
    contextWindow: 1048576,
    maxTokens: 65536,
    reasoningEfforts: ["low", "medium", "high"],
    thinkingLevels: true,
    runtimeIds: {
      low: "gemini-4-argon-low",
      medium: "gemini-4-argon-medium",
      high: "gemini-4-argon-high",
      default: "gemini-4-argon-medium",
    },
    runtimeCandidates: [
      "gemini-4-argon-medium",
      "gemini-4-argon-high",
      "gemini-4-argon-low",
      "gemini-4-argon",
      "gemini-4-argon-tiered",
    ],
  },
];

/** Add curated entries the live catalog does not already cover. */
export function mergeCuratedModels(catalog) {
  const entries = Array.isArray(catalog) ? catalog : [];
  const coveredIds = new Set(entries.map((entry) => entry.id));
  const coveredRuntimeIds = new Set(
    entries.flatMap((entry) =>
      isPlainObject(entry.runtimeIds) ? Object.values(entry.runtimeIds).filter((id) => typeof id === "string") : [],
    ),
  );
  const merged = [...entries];
  for (const curated of CURATED_MODELS) {
    const candidates = [curated.id, ...(curated.runtimeCandidates || [])];
    const covered = candidates.some((id) => coveredIds.has(id) || coveredRuntimeIds.has(id));
    if (covered) continue;
    merged.push({ ...curated, available: true, curated: true });
    for (const id of candidates) coveredIds.add(id);
  }
  merged.sort(compareAntigravityModels);
  return merged;
}

/** True when the runtime id accepts `generationConfig.thinkingConfig`. */
/** GPT-OSS on Antigravity takes a token budget instead of a thinking level. */
export const GPT_OSS_THINKING_BUDGET = 8192;

export function isGptOssFamily(runtimeModel) {
  return /^gpt-oss-/i.test(String(runtimeModel || ""));
}

/**
 * `generationConfig.thinkingConfig` in the exact shapes the CLI 1.5.2 sends
 * (captured 2026-11-07): gemini-4-argon and claude-*-5-5 use `thinkingLevel`,
 * gpt-oss uses `thinkingBudget`. Returns undefined when the model takes none.
 */
export function buildThinkingConfig(model, runtimeModel, effort) {
  const wants =
    isGptOssFamily(runtimeModel) ||
    model?.thinkingLevels === true ||
    (model?.thinkingLevels === undefined && runtimeSupportsThinkingLevel(runtimeModel));
  if (!wants) return undefined;
  if (isGptOssFamily(runtimeModel)) {
    return { includeThoughts: true, thinkingBudget: GPT_OSS_THINKING_BUDGET };
  }
  const selected = effort || "off";
  return {
    includeThoughts: true,
    thinkingLevel:
      selected === "high" || selected === "xhigh" ? "HIGH" : selected === "medium" ? "MEDIUM" : "LOW",
  };
}

/** `tools` array for every Antigravity family: uppercase Gemini Schema. */
export function buildFunctionDeclarations(tools) {
  if (!Array.isArray(tools) || tools.length === 0) return undefined;
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: toGeminiToolSchema(tool.parameters),
      })),
    },
  ];
}

/** The nine `request.labels` fields, with family flags derived from the runtime id. */
export function buildLabels({ runtimeModel, cascadeId, trajectoryId, modelEnum }) {
  if (!modelEnum) return undefined;
  const isClaude = /^claude-/i.test(String(runtimeModel || ""));
  return {
    cascade_id: cascadeId,
    last_step_index: "0",
    model_enum: modelEnum,
    request_id: `${trajectoryId}-0`,
    root_cascade_id: cascadeId,
    trajectory_id: trajectoryId,
    used_claude: isClaude ? "true" : "false",
    used_claude_conservative: isClaude ? "true" : "false",
    used_non_gemini_model: isClaude || isGptOssFamily(runtimeModel) ? "true" : "false",
  };
}

const DELEGATION_BASE = [
  "For work that is independent and parallelizable (separate files or modules, competing hypotheses,",
  "broad codebase or web research), prefer delegating to subagents with the `subagent` tool instead of",
  "doing everything inline: launch several at once, then collect their results. Use `subagent_fork` when",
  "the child needs this conversation's completed context. Never busy-poll a running child: the host",
  "notifies you when it finishes or sends a message, so continue other work or stop calling tools.",
  "Keep small, targeted lookups to yourself. When you delegate, give each child a complete,",
  "self-contained prompt (paths, constraints, expected output) and state what you already verified.",
].join(" ");

const DELEGATION_BY_FAMILY = {
  claude: [
    DELEGATION_BASE,
    "Before spawning, state the decomposition explicitly (what each child owns and how you will merge",
    "the results), and verify each returned result rather than accepting it verbatim.",
  ].join(" "),
  gemini: [
    DELEGATION_BASE,
    "Gemini tends to solve tasks serially inline; when a task has two or more independent parts,",
    "spawn them in the same step instead of running them one after another.",
  ].join(" "),
  other: DELEGATION_BASE,
};

/**
 * Extra system-prompt guidance appended per model family. Self-written (not the
 * vendor prompt) and gated by ANTIGRAVITY_PROMPT_ADDENDUM=0 in the adapter.
 */
export function buildPromptAddendum(runtimeModel) {
  const id = String(runtimeModel || "");
  if (/^claude-/i.test(id)) return DELEGATION_BY_FAMILY.claude;
  if (/^gemini-4-argon/i.test(id)) return DELEGATION_BY_FAMILY.gemini;
  if (/^gemini-/i.test(id)) return DELEGATION_BY_FAMILY.other;
  if (/^gpt-oss-/i.test(id)) return DELEGATION_BY_FAMILY.other;
  return undefined;
}

export function runtimeSupportsThinkingLevel(runtimeModel) {
  const id = String(runtimeModel || "");
  // Claude 5.5 exposes per-effort runtime ids and takes the same thinkingLevel
  // envelope as Gemini (captured 2026-11-07).
  if (/^claude-(?:opus|sonnet)-5-5/i.test(id)) return true;
  if (!/^gemini-/i.test(id)) return false;
  return /tiered(?:-preview)?$/i.test(id) || /(?:^|-)argon(?:-|$)/i.test(id);
}
