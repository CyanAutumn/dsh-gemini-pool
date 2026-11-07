// Verifies the failure-driven repair hint: after a rejected `edit`, the next
// request carries the file's real bytes so the retry can copy `old_string`
// instead of retyping it from memory.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildRepairHint, locateBlock } from "../lib/prompt-repair.js";

function withProject(files, run) {
  const dir = mkdtempSync(join(tmpdir(), "dsh-prompt-repair-"));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(dir, name), content, "utf8");
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function toolCall(name, args, id = "call-1") {
  return { type: "tool-call", id, name, arguments: JSON.stringify(args) };
}

function toolResult(text, id = "call-1", isError = true) {
  return { role: "tool", content: [{ type: "tool-result", toolCallId: id, isError, content: [{ type: "text", text }] }] };
}

test("a rejected edit injects the file's actual lines", () => {
  const actual = "func _ready() -> void:\n\tspeed = 0.10\n\tlife = 1000.0\n";
  withProject({ "devil.gd": actual }, (dir) => {
    const file = join(dir, "devil.gd");
    const messages = [
      { role: "user", content: [{ type: "text", text: "edit the file" }] },
      {
        role: "assistant",
        content: [toolCall("edit", { file_path: file, old_string: "func _ready() -> void:\n\tspeed = 0.08\n\tlife = 200.0\n", new_string: "x" })],
      },
      toolResult(`Error: old_string was not found in "${file}"`),
    ];
    const hint = buildRepairHint(messages);
    assert.ok(hint.includes("<tool_repair>"));
    assert.ok(hint.includes(file));
    assert.ok(hint.includes("speed = 0.10"), "the real value appears in the hint");
    assert.ok(hint.includes("life = 1000.0"));
    assert.ok(hint.includes("character-for-character"));
  });
});

test("no hint when the tail holds no repairable failure", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "hi" }] },
    toolResult("Error: something else broke"),
    { role: "user", content: [{ type: "text", text: "ok" }] },
  ];
  assert.equal(buildRepairHint(messages), undefined);
});

test("a missing read path lists the nearest existing directory", () => {
  withProject({ "constants.gd": "const A = 1\n", "other.gd": "" }, (dir) => {
    const missing = join(dir, "core", "constants.gd");
    const messages = [
      { role: "assistant", content: [toolCall("read", { file_path: missing })] },
      toolResult(`Error: cannot read "${missing}": not found`),
    ];
    const hint = buildRepairHint(messages);
    assert.ok(hint.includes("does not exist"));
    assert.ok(hint.includes("constants.gd"), "siblings are listed");
    assert.ok(hint.includes("glob"));
  });
});

test("goal rejections get a recovery instruction", () => {
  const stale = buildRepairHint([
    { role: "assistant", content: [toolCall("update_goal", { goal_id: "g-55073040", revision: 4, action: "edit" })] },
    toolResult('Error: stale goal ref "g-55073040" revision 4; current is "goal-abc" revision 1'),
  ]);
  assert.ok(stale.includes("get_goal"));

  const authority = buildRepairHint([
    { role: "assistant", content: [toolCall("update_goal", { goal_id: "goal-abc", revision: 1, action: "resume" })] },
    toolResult("Error: this goal operation requires a direct human turn on a top-level agent"),
  ]);
  assert.ok(authority.includes("pause") && authority.includes("direct human turn"));
});

test("locateBlock finds a block whose values drifted", () => {
  const file = [
    "class_name Devil",
    "",
    "func _ready() -> void:",
    "\tspeed = 0.10",
    "\tlife = 1000.0",
    "",
    "func other() -> void:",
    "\tpass",
  ];
  const old = ["func _ready() -> void:", "\tspeed = 0.08", "\tlife = 200.0"];
  assert.equal(locateBlock(file, old), 2);
});

test("an unreadable or absent file produces no edit hint", () => {
  const messages = [
    {
      role: "assistant",
      content: [toolCall("edit", { file_path: join(tmpdir(), "definitely-missing-xyz.gd"), old_string: "a", new_string: "b" })],
    },
    toolResult('Error: old_string was not found in "C:/definitely-missing-xyz.gd"'),
  ];
  assert.equal(buildRepairHint(messages), undefined);
});
