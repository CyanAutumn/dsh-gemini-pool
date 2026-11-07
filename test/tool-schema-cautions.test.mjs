// Verifies the argument-shape cautions added to the tool declarations the model
// actually reads: edit.old_string, read.file_path and update_goal's
// goal_id/revision/action (the four failures measured in the audit session).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  EDIT_OLD_STRING_CAUTION,
  GOAL_ACTION_CAUTION,
  GOAL_ID_CAUTION,
  GOAL_REVISION_CAUTION,
  READ_PATH_CAUTION,
  buildFunctionDeclarations,
  hardenToolSchema,
} from "../lib/models.js";

const tools = JSON.parse(
  readFileSync(fileURLToPath(new URL("./fixtures/model-process-tools.json", import.meta.url)), "utf8"),
);
const toolByName = (name) => tools.find((tool) => tool.name === name);

function parametersOf(tool) {
  return buildFunctionDeclarations([tool])[0].functionDeclarations[0].parameters;
}

test("edit.old_string carries the verbatim-copy caution", () => {
  const parameters = parametersOf(toolByName("edit"));
  assert.ok(parameters.properties.old_string.description.includes(EDIT_OLD_STRING_CAUTION));
  // the original wording is kept in front
  assert.ok(
    parameters.properties.old_string.description.startsWith(
      toolByName("edit").parameters.properties.old_string.description,
    ),
  );
});

test("read.file_path tells the model not to invent paths", () => {
  const parameters = parametersOf(toolByName("read"));
  assert.ok(parameters.properties.file_path.description.includes(READ_PATH_CAUTION));
});

test("update_goal explains goal_id, revision and the human-only actions", () => {
  const parameters = parametersOf(toolByName("update_goal"));
  assert.ok(parameters.properties.goal_id.description.includes(GOAL_ID_CAUTION));
  assert.ok(parameters.properties.revision.description.includes(GOAL_REVISION_CAUTION));
  assert.ok(parameters.properties.action.description.includes(GOAL_ACTION_CAUTION));
  // enum survives the conversion
  assert.deepEqual(parameters.properties.action.enum, ["edit", "pause", "resume", "complete", "blocked"]);
});

test("hardening is idempotent across repeated builds", () => {
  const tool = toolByName("update_goal");
  const once = hardenToolSchema(JSON.parse(JSON.stringify(tool)));
  const twice = hardenToolSchema(JSON.parse(JSON.stringify(tool)));
  for (const property of ["goal_id", "revision", "action"]) {
    assert.equal(
      twice.properties[property].description.split(GOAL_ID_CAUTION).length,
      once.properties[property].description.split(GOAL_ID_CAUTION).length,
    );
  }
  assert.equal(
    once.properties.goal_id.description.split(GOAL_ID_CAUTION).length - 1,
    1,
    "the caution is appended exactly once",
  );
});

test("tools without the targeted properties are untouched", () => {
  const plain = {
    name: "unknown_tool",
    parameters: { type: "object", properties: { value: { type: "string", description: "A value." } } },
  };
  const parameters = parametersOf(plain);
  assert.equal(parameters.properties.value.description, "A value.");
});
