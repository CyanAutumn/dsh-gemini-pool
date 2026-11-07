// Verifies the tool-call argument repair layer: lone `justification`, sandbox
// mode spellings, and `old_string` values retyped from memory (CRLF / trailing
// whitespace / indentation) are fixed before DSH validates the call.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  findLiteralMatch,
  guessBaseDirs,
  parseToolArguments,
  repairToolArguments,
  resolveExistingFile,
} from "../lib/tool-repair.js";

function withFile(content, run) {
  const dir = mkdtempSync(join(tmpdir(), "dsh-tool-repair-"));
  try {
    const file = join(dir, "sample.gd");
    writeFileSync(file, content, "utf8");
    return run({ dir, file });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("parseToolArguments keeps objects and parses JSON strings", () => {
  assert.deepEqual(parseToolArguments({ a: 1 }), { a: 1 });
  assert.deepEqual(parseToolArguments('{"a":1}'), { a: 1 });
  assert.deepEqual(parseToolArguments("not json"), {});
  assert.deepEqual(parseToolArguments(undefined), {});
  assert.deepEqual(parseToolArguments([1, 2]), {});
});

test("a lone justification is dropped and counted", () => {
  const result = repairToolArguments("edit", {
    file_path: "C:/x.gd",
    old_string: "a",
    new_string: "b",
    justification: "because",
  });
  assert.equal("justification" in result.args, false);
  assert.deepEqual(
    result.repairs.map((entry) => entry.kind),
    ["drop-lone-justification"],
  );
});

test("justification with sandbox_permissions is preserved", () => {
  const args = {
    file_path: "C:/x.gd",
    content: "x",
    sandbox_permissions: "workspace-write",
    justification: "needs the wider sandbox",
  };
  const result = repairToolArguments("write", args);
  assert.deepEqual(result.args, args);
  assert.equal(result.repairs.length, 0);
});

test("sandbox mode spellings are normalised to the enum", () => {
  const result = repairToolArguments("pwsh", {
    command: "ls",
    description: "list",
    sandbox_permissions: "workspace_write",
    justification: "retry after denial",
  });
  assert.equal(result.args.sandbox_permissions, "workspace-write");
  assert.equal(result.args.justification, "retry after denial");
  assert.deepEqual(
    result.repairs.map((entry) => entry.kind),
    ["normalize-sandbox-mode"],
  );
});

test("an unknown or empty escalation is removed together with justification", () => {
  const unknown = repairToolArguments("edit", {
    file_path: "C:/x.gd",
    old_string: "a",
    new_string: "b",
    sandbox_permissions: "admin-mode",
    justification: "why not",
  });
  assert.equal("sandbox_permissions" in unknown.args, false);
  assert.equal("justification" in unknown.args, false);
  assert.deepEqual(
    unknown.repairs.map((entry) => entry.kind),
    ["drop-unknown-escalation"],
  );

  const empty = repairToolArguments("edit", {
    file_path: "C:/x.gd",
    old_string: "a",
    new_string: "b",
    sandbox_permissions: "",
  });
  assert.equal("sandbox_permissions" in empty.args, false);
});

test("escalation without the required justification is dropped", () => {
  const result = repairToolArguments("edit", {
    file_path: "C:/x.gd",
    old_string: "a",
    new_string: "b",
    sandbox_permissions: "danger-full-access",
  });
  assert.equal("sandbox_permissions" in result.args, false);
  assert.deepEqual(
    result.repairs.map((entry) => entry.kind),
    ["drop-escalation-without-justification"],
  );
});

test("an exact old_string is left untouched", () => {
  const content = "func run():\n\tpass\n";
  withFile(content, ({ file }) => {
    const result = repairToolArguments("edit", {
      file_path: file,
      old_string: "\tpass\n",
      new_string: "\treturn\n",
    });
    assert.equal(result.args.old_string, "\tpass\n");
    assert.equal(result.repairs.length, 0);
  });
});

test("LF old_string is repaired against a CRLF file", () => {
  const content = "alpha\r\nbeta\r\ngamma\r\n";
  withFile(content, ({ file }) => {
    const result = repairToolArguments("edit", {
      file_path: file,
      old_string: "alpha\nbeta\n",
      new_string: "alpha\nbeta2\n",
    });
    assert.equal(result.args.old_string, "alpha\r\nbeta\r\n");
    assert.deepEqual(
      result.repairs.map((entry) => entry.kind),
      ["edit-old-string"],
    );
  });
});

test("indentation and trailing whitespace mismatches are repaired", () => {
  const content = "func main():\n\tvar speed = 0.10\n\treturn speed\n";
  withFile(content, ({ file }) => {
    const result = repairToolArguments("edit", {
      file_path: file,
      old_string: "    var speed = 0.10   \n    return speed",
      new_string: "    var speed = 0.12\n    return speed",
    });
    assert.equal(result.args.old_string, "\tvar speed = 0.10\n\treturn speed");
    // new_string is never rewritten
    assert.equal(result.args.new_string, "    var speed = 0.12\n    return speed");
  });
});

test("inner whitespace runs are matched, unique spans only", () => {
  const content = "if  a  ==  b:\n    done\n";
  withFile(content, ({ file }) => {
    const result = repairToolArguments("edit", {
      file_path: file,
      old_string: "if a == b:",
      new_string: "if c == b:",
    });
    assert.equal(result.args.old_string, "if  a  ==  b:");
  });
});

test("ambiguous matches are not rewritten", () => {
  const content = "value = 1\nother = 2\nvalue = 1\n";
  withFile(content, ({ file }) => {
    const result = repairToolArguments("edit", {
      file_path: file,
      old_string: "value = 1",
      new_string: "value = 3",
    });
    assert.equal(result.args.old_string, "value = 1");
    assert.equal(result.repairs.length, 0);
  });
});

test("a missing file or empty old_string changes nothing", () => {
  const missing = repairToolArguments("edit", {
    file_path: join(tmpdir(), "definitely-missing-file-xyz.gd"),
    old_string: "x",
    new_string: "y",
  });
  assert.equal(missing.repairs.length, 0);

  const empty = repairToolArguments("edit", { file_path: "C:/x.gd", old_string: "", new_string: "y" });
  assert.equal(empty.args.old_string, "");
});

test("relative paths are resolved against base directories", () => {
  withFile("line\n", ({ dir, file }) => {
    assert.equal(resolveExistingFile("sample.gd", [dir]), file);
    const result = repairToolArguments(
      "edit",
      { file_path: "sample.gd", old_string: "line", new_string: "other" },
      { baseDirs: [dir] },
    );
    assert.equal(result.repairs.length, 0, "exact content needs no repair");
    assert.equal(result.args.file_path, "sample.gd");
  });
});

test("guessBaseDirs derives workspace roots from earlier absolute paths", () => {
  const messages = [
    { content: [{ type: "text", text: "no paths here" }] },
    {
      content: [
        {
          type: "tool-call",
          name: "read",
          arguments: JSON.stringify({ file_path: "C:\\Users\\Admin\\Desktop\\Game\\scripts\\player.gd" }),
        },
      ],
    },
  ];
  const dirs = guessBaseDirs(messages);
  assert.ok(dirs.includes("C:\\Users\\Admin\\Desktop\\Game\\scripts"));
  assert.ok(dirs.includes("C:\\Users\\Admin\\Desktop\\Game"));
});

test("findLiteralMatch refuses to guess when nothing matches", () => {
  assert.equal(findLiteralMatch("alpha\nbeta\n", "gamma"), undefined);
});

test("non-edit tools keep their arguments", () => {
  const args = { file_path: "C:/x.gd" };
  const result = repairToolArguments("read", args);
  assert.deepEqual(result.args, args);
  assert.equal(result.repairs.length, 0);
});
