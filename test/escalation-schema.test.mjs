// Verifies the escalation-schema hardening: tools that expose both
// `justification` and `sandbox_permissions` must tell the model that a lone
// `justification` is invalid (DSH rejects it with "invalid escalation").
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { ESCALATION_CAUTION, buildFunctionDeclarations, hardenEscalationSchema } from "../lib/models.js";

const tools = JSON.parse(readFileSync(fileURLToPath(new URL("./fixtures/escalation-tools.json", import.meta.url)), "utf8"));

test("real write/edit/pwsh schemas get the caution", () => {
  for (const tool of tools) {
    const decls = buildFunctionDeclarations([tool]);
    const params = decls[0].functionDeclarations[0].parameters;
    assert.equal(params.type, "OBJECT");
    const description = params.properties.justification.description;
    assert.match(description, /ONLY valid together with sandbox_permissions/);
    // the original wording stays in front of the caution
    assert.ok(description.startsWith(tool.parameters.properties.justification.description.trim()));
  }
});

test("hardening is idempotent", () => {
  const once = hardenEscalationSchema(JSON.parse(JSON.stringify(tools[0].parameters)));
  const twice = hardenEscalationSchema(JSON.parse(JSON.stringify(once)));
  assert.equal(twice.properties.justification.description, once.properties.justification.description);
  assert.equal(twice.properties.justification.description.split(ESCALATION_CAUTION).length - 1, 1);
});

test("tools without the pair are untouched", () => {
  const plain = {
    name: "read",
    description: "Read a file",
    parameters: {
      type: "object",
      properties: {
        justification: { type: "string", description: "Why." },
        path: { type: "string" },
      },
      required: ["path"],
    },
  };
  const converted = buildFunctionDeclarations([plain])[0].functionDeclarations[0].parameters;
  assert.equal(converted.properties.justification.description, "Why.");
});

test("sandbox_permissions keeps its enum through conversion", () => {
  const decls = buildFunctionDeclarations([tools.find((tool) => tool.name === "write")]);
  const sandbox = decls[0].functionDeclarations[0].parameters.properties.sandbox_permissions;
  assert.equal(sandbox.type, "STRING");
  assert.ok(Array.isArray(sandbox.enum) && sandbox.enum.includes("workspace-write"));
});
