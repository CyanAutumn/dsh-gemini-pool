// Parity tests for the model families captured from the Antigravity CLI 1.5.2
// on 2026-11-07: gemini-4-argon-*, claude-{opus,sonnet}-5-5-*, gpt-oss-120b.
// Fixtures live in test/fixtures/model-family/ (system prompt elided, ids scrubbed).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildFunctionDeclarations,
  buildLabels,
  buildLiveCatalog,
  buildThinkingConfig,
  isGptOssFamily,
} from "../lib/models.js";

const fixtures = fileURLToPath(new URL("./fixtures/model-family/", import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(fixtures + name, "utf8"));

const catalog = readJson("catalog.json");
const liveModels = buildLiveCatalog(catalog.models);

const ENUM = "MODEL_PLACEHOLDER_M";
const CASES = [
  { file: "argon-low.json", base: "gemini-4-argon", effort: "low", maxOutput: 65536 },
  { file: "argon-medium.json", base: "gemini-4-argon", effort: "medium", maxOutput: 65536 },
  { file: "claude-opus-high.json", base: "claude-opus-5-5", effort: "high", maxOutput: 128000 },
  { file: "gpt-oss-medium.json", base: "gpt-oss-120b", effort: "medium", maxOutput: 32768 },
];

for (const item of CASES) {
  const body = readJson(item.file);
  const model = liveModels.find((entry) => entry.id === item.base);
  const runtime = body.model;

  test(`${runtime}: catalog entry groups the family and reports its output cap`, () => {
    assert.ok(model, `catalog entry for ${item.base}`);
    assert.equal(model.maxTokens, item.maxOutput);
    assert.equal(model.runtimeIds[item.effort], runtime);
    assert.equal(model.modelEnums[runtime], body.request.labels.model_enum);
    assert.ok(model.modelEnums[runtime].startsWith(ENUM) || model.modelEnums[runtime].startsWith("MODEL_OPENAI_"));
  });

  test(`${runtime}: thinkingConfig matches the captured CLI body`, () => {
    const thinking = buildThinkingConfig(model, runtime, item.effort);
    assert.deepEqual(thinking, body.request.generationConfig.thinkingConfig);
    assert.equal(body.request.generationConfig.maxOutputTokens, item.maxOutput);
    // the CLI sends nothing else in generationConfig for these models
    assert.deepEqual(Object.keys(body.request.generationConfig).sort(), ["maxOutputTokens", "thinkingConfig"]);
  });

  test(`${runtime}: labels carry the family flags the CLI sends`, () => {
    const labels = buildLabels({
      runtimeModel: runtime,
      cascadeId: body.request.labels.cascade_id,
      trajectoryId: body.request.labels.trajectory_id,
      modelEnum: body.request.labels.model_enum,
    });
    assert.deepEqual(labels, body.request.labels);
  });

  test(`${runtime}: tools are the uppercase Gemini Schema and toolConfig is absent`, () => {
    const decls = readJson(item.file).request.tools[0].functionDeclarations;
    const types = new Set();
    const walk = (node) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      if (typeof node.type === "string") types.add(node.type);
      Object.values(node).forEach(walk);
    };
    decls.forEach((decl) => walk(decl.parameters));
    for (const type of types) {
      assert.ok(["OBJECT", "STRING", "INTEGER", "BOOLEAN", "ARRAY"].includes(type), `type ${type} is Gemini Schema`);
    }
    assert.equal(body.request.toolConfig ?? null, null);

    // The host's tools go through buildFunctionDeclarations, which must also
    // produce uppercase types and keep the CLI's key set.
    const converted = buildFunctionDeclarations([
      {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            Path: { type: "string" },
            StartLine: { type: "integer" },
            Mode: { type: "string", enum: ["read", "write"] },
          },
          required: ["Path"],
          additionalProperties: false,
        },
      },
    ]);
    assert.equal(converted[0].functionDeclarations[0].parameters.type, "OBJECT");
    const json = JSON.stringify(converted);
    assert.ok(json.includes('"Path":{"type":"STRING"}'));
    assert.ok(!json.includes("additionalProperties"));
  });
}

test("gpt-oss uses a thinking budget, gemini/claude use a thinking level", () => {
  assert.ok(isGptOssFamily("gpt-oss-120b-medium"));
  assert.ok(!isGptOssFamily("gemini-4-argon-low"));
  assert.equal(buildThinkingConfig(liveModels.find((m) => m.id === "gpt-oss-120b"), "gpt-oss-120b-medium", "medium").thinkingBudget, 8192);
});

test("UA advertises the CLI version/build the captures were made with", () => {
  const source = readFileSync(fileURLToPath(new URL("../lib/index.js", import.meta.url)), "utf8");
  assert.match(source, /DEFAULT_ANTIGRAVITY_CLI_VERSION = "1\.5\.2"/);
  assert.match(source, /DEFAULT_ANTIGRAVITY_CLI_BUILD = "1015175089"/);
});
