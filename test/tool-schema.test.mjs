// Verifies the JSON Schema -> Gemini Schema conversion against the shape the
// Antigravity CLI actually sends (captured 2026-11-06, tools[].parameters).
const { toGeminiToolSchema } = await import(new URL("../lib/models.js", import.meta.url).href);

let failures = 0;
function check(label, condition, detail) {
  if (condition) return;
  failures += 1;
  console.log("FAIL:", label, detail ?? "");
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}
function eq(label, actual, expected) {
  check(
    label,
    JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected)),
    `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

// A DSH-style tool schema: nested object, array of objects, enum, nullable union,
// numeric constraints, additionalProperties, and an inlined $def.
const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: ["path", "mode"],
  properties: {
    path: { type: "string", description: "Absolute path" },
    mode: { type: "string", enum: ["read", "write"], description: "Mode" },
    labels: { type: "array", items: { type: "string" }, minItems: 1 },
    tasks: {
      type: "array",
      items: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          note: { type: ["string", "null"] },
          ref: { $ref: "#/$defs/Ref" },
        },
      },
    },
    limit: { type: "integer", minimum: 1 },
    flag: { const: "on" },
  },
  $defs: {
    Ref: { type: "object", properties: { id: { type: "string", minLength: 1 } } },
  },
};

const out = toGeminiToolSchema(schema);
console.log(JSON.stringify(out, null, 2).slice(0, 1200));

eq("root type uppercase", out.type, "OBJECT");
eq("required kept", out.required, ["path", "mode"]);
check("additionalProperties dropped", out.additionalProperties === undefined);
check("$schema dropped", out.$schema === undefined);
eq("string prop", out.properties.path, { type: "STRING", description: "Absolute path" });
eq("enum prop", out.properties.mode, { type: "STRING", enum: ["read", "write"], description: "Mode" });
eq("array items", out.properties.labels, { type: "ARRAY", items: { type: "STRING" }, minItems: 1 });
eq(
  "nullable union -> nullable true",
  out.properties.tasks.items.properties.note,
  { type: "STRING", nullable: true },
);
eq(
  "$ref inlined",
  out.properties.tasks.items.properties.ref,
  { type: "OBJECT", properties: { id: { type: "STRING", minLength: 1 } } },
);
eq("integer prop", out.properties.limit, { type: "INTEGER" });
eq("const -> enum", out.properties.flag, { type: "STRING", enum: ["on"] });

// Every key the converter emits must be a key the CLI itself emits (plus the two
// Gemini Schema fields we intentionally keep for unions).
const CLI_KEYS = new Set([
  "type",
  "description",
  "properties",
  "required",
  "items",
  "enum",
  "minLength",
  "minItems",
  "maxLength",
  "maxItems",
  "nullable",
  "anyOf",
]);
function walkKeys(node, out = new Set()) {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    node.forEach((child) => walkKeys(child, out));
    return out;
  }
  for (const [key, value] of Object.entries(node)) {
    // properties keys are user field names, not schema keywords
    if (key === "properties" && value && typeof value === "object") {
      Object.values(value).forEach((child) => walkKeys(child, out));
      continue;
    }
    out.add(key);
    if (key === "items" || key === "anyOf") walkKeys(value, out);
  }
  return out;
}
const emitted = [...walkKeys(out)];
const stray = emitted.filter((key) => !CLI_KEYS.has(key));
check("no keywords outside the CLI set", stray.length === 0, stray);

// anyOf: union of objects becomes anyOf, type dropped
const union = toGeminiToolSchema({
  anyOf: [{ type: "object", properties: { a: { type: "string" } } }, { type: "string" }],
});
check("union -> anyOf", Array.isArray(union.anyOf) && union.anyOf.length === 2);
check("union has no stray type", union.type === undefined);

// plain string schema
eq("bare string", toGeminiToolSchema({ type: "string" }), { type: "STRING" });

// no schema at all -> empty object
eq("empty", toGeminiToolSchema(undefined), { type: "OBJECT", properties: {} });

console.log(failures === 0 ? "TOOL SCHEMA TESTS PASSED" : `${failures} TOOL SCHEMA CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
