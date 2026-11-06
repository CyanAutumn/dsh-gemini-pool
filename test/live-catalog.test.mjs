import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const { buildLiveCatalog, runtimeModelIdFor, splitRuntimeVariant, humanizeModelId, antigravitySessionKeys, mergeEnabledModelIds, mergeCuratedModels, runtimeSupportsThinkingLevel, CURATED_MODELS } = await import(new URL("../lib/models.js", import.meta.url).href);

let failures = 0;
function check(label, condition, detail) {
  if (condition) return;
  failures += 1;
  console.log("FAIL:", label, detail ?? "");
}
function eq(label, actual, expected) {
  check(label, Object.is(actual, expected), `expected ${expected}, got ${actual}`);
}

// 1. splitRuntimeVariant
eq("tiered", splitRuntimeVariant("gemini-3.8-flash-tiered").baseId, "gemini-3.8-flash");
eq("tiered effort", splitRuntimeVariant("gemini-3.8-flash-tiered").effort, undefined);
eq("claude high", splitRuntimeVariant("claude-opus-5-5-high").baseId, "claude-opus-5-5");
eq("claude high effort", splitRuntimeVariant("claude-opus-5-5-high").effort, "high");
eq("extra-low", splitRuntimeVariant("gemini-3.5-flash-extra-low").baseId, "gemini-3.5-flash");
eq("extra-low effort", splitRuntimeVariant("gemini-3.5-flash-extra-low").effort, "minimal");
eq("lite stays", splitRuntimeVariant("gemini-4-flash-lite").baseId, "gemini-4-flash-lite");
eq("thinking stays", splitRuntimeVariant("gemini-2.5-flash-thinking").baseId, "gemini-2.5-flash-thinking");

// 2. humanizeModelId
eq("humanize claude", humanizeModelId("claude-opus-5-5"), "Claude Opus 5.5");
eq("humanize gemini", humanizeModelId("gemini-3.8-flash"), "Gemini 3.8 Flash");
eq("humanize gpt", humanizeModelId("gpt-oss-120b"), "GPT-OSS 120B");

// 3. live payload (captured from the real endpoint)
const live = JSON.parse(await readFile(fileURLToPath(new URL("./fixtures/agy-live-models.json", import.meta.url)), "utf8"));
const catalog = buildLiveCatalog(live.models || {});
console.log("live catalog entries:", catalog.length);
for (const entry of catalog) {
  console.log(
    `  ${entry.id.padEnd(26)} ${String(entry.name).padEnd(26)} efforts=${JSON.stringify(entry.reasoningEfforts)} runtime=${JSON.stringify(entry.runtimeIds)}`,
  );
}
const ids = new Set(catalog.map((entry) => entry.id));
check("has gemini-3.8-flash base", ids.has("gemini-3.8-flash"));
check("has claude-opus-5-5", ids.has("claude-opus-5-5"));
check("has claude-sonnet-5-5", ids.has("claude-sonnet-5-5"));
check("has 3.1-flash-lite", ids.has("gemini-3.1-flash-lite"));
check("has 3.5-flash-lite", ids.has("gemini-3.5-flash-lite"));
check("has 2.5-flash-thinking own entry", ids.has("gemini-2.5-flash-thinking"));
check("no phantom 3.1-pro", !ids.has("gemini-3.1-pro"));
check("no phantom 3.7", !ids.has("gemini-3.7-flash"));
check("no tab_ entry", ![...ids].some((id) => id.startsWith("tab_")));
check("no chat_ entry", ![...ids].some((id) => id.startsWith("chat_")));
eq("gpt-oss name", catalog.find((e) => e.id === "gpt-oss-120b")?.name, "GPT-OSS 120B");
eq(
  "3.8 effort default -> tiered",
  runtimeModelIdFor(catalog.find((e) => e.id === "gemini-3.8-flash"), "high"),
  "gemini-3.8-flash-tiered",
);
eq(
  "claude high -> high variant",
  runtimeModelIdFor(catalog.find((e) => e.id === "claude-opus-5-5"), "high"),
  "claude-opus-5-5-high",
);
eq(
  "claude unspecified -> high variant",
  runtimeModelIdFor(catalog.find((e) => e.id === "claude-opus-5-5"), undefined),
  "claude-opus-5-5-high",
);
eq(
  "single entry effort ignored",
  runtimeModelIdFor(catalog.find((e) => e.id === "gemini-3-flash"), "medium"),
  "gemini-3-flash",
);

// 4. synthetic future payload: Gemini 4 appears without touching code
const futureCatalog = buildLiveCatalog({
  "gemini-4-flash-low": { displayName: "Gemini 4 Flash (Low)", supportsImages: true },
  "gemini-4-flash-medium": { displayName: "Gemini 4 Flash (Medium)", supportsImages: true },
  "gemini-4-flash-high": { displayName: "Gemini 4 Flash (High)", supportsImages: true },
  "gemini-4-pro": { displayName: "Gemini 4 Pro", supportsImages: true },
  "gemini-4-flash-lite": { displayName: "Gemini 4 Flash Lite", supportsImages: true },
  "chat_999": { isInternal: true },
  "tab_flash_lite_preview": {},
});
console.log("future catalog:", JSON.stringify(futureCatalog.map((e) => [e.id, e.name, e.reasoningEfforts])));
const gemini4 = futureCatalog.find((e) => e.id === "gemini-4-flash");
check("gemini-4-flash present", Boolean(gemini4));
eq("gemini-4-flash name", gemini4?.name, "Gemini 4 Flash");
eq("gemini-4-flash efforts", JSON.stringify(gemini4?.reasoningEfforts), JSON.stringify(["low", "medium", "high"]));
eq("gemini-4-flash medium runtime", runtimeModelIdFor(gemini4, "medium"), "gemini-4-flash-medium");
check("gemini-4-pro present", futureCatalog.some((e) => e.id === "gemini-4-pro" && e.name === "Gemini 4 Pro"));
check("gemini-4-flash-lite separate", futureCatalog.some((e) => e.id === "gemini-4-flash-lite"));
eq("internal filtered", futureCatalog.some((e) => e.id.startsWith("chat_")), false);

// 5. empty payload falls back to caller-provided static table
eq("empty payload", JSON.stringify(buildLiveCatalog({})), "[]");
eq("garbage payload", JSON.stringify(buildLiveCatalog(null)), "[]");

// 5b. CLI user-agent payload (26 models): the real catalog the Antigravity CLI
//     receives. Verifies Gemini 4 Argon and the 3.8 thinking variants.
const cliPayload = JSON.parse(await readFile(fileURLToPath(new URL("./fixtures/models_cli_ua.json", import.meta.url)), "utf8"));
const cliCatalog = buildLiveCatalog(cliPayload.models || {});
console.log("cli-ua catalog entries:", cliCatalog.length);
for (const entry of cliCatalog) {
  console.log(
    `  ${entry.id.padEnd(26)} ${String(entry.name).padEnd(26)} ctx=${entry.contextWindow} out=${entry.maxTokens} efforts=${JSON.stringify(entry.reasoningEfforts)}`,
  );
}
const cliIds = new Set(cliCatalog.map((entry) => entry.id));
check("cli payload has gemini-4-argon", cliIds.has("gemini-4-argon"));
const cliArgon = cliCatalog.find((entry) => entry.id === "gemini-4-argon");
eq("argon grouped efforts", JSON.stringify(cliArgon?.reasoningEfforts), JSON.stringify(["low", "medium", "high"]));
eq("argon medium runtime", runtimeModelIdFor(cliArgon, "medium"), "gemini-4-argon-medium");
eq("argon high runtime", runtimeModelIdFor(cliArgon, "high"), "gemini-4-argon-high");
eq("argon name", cliArgon?.name, "Gemini 4 Argon");
eq("argon context", cliArgon?.contextWindow, 1048576);
eq("argon max output", cliArgon?.maxTokens, 65536);
eq("argon low model enum", cliArgon?.modelEnums?.["gemini-4-argon-low"], "MODEL_PLACEHOLDER_M419");
eq("argon medium model enum", cliArgon?.modelEnums?.["gemini-4-argon-medium"], "MODEL_PLACEHOLDER_M418");
check("claude has model enum too", Boolean(cliCatalog.find((e) => e.id === "claude-opus-5-5")?.modelEnums?.["claude-opus-5-5-low"]));
const cliFlash = cliCatalog.find((entry) => entry.id === "gemini-3.8-flash");
eq("3.8 low runtime", runtimeModelIdFor(cliFlash, "low"), "gemini-3.8-flash-low");
eq("3.8 high runtime", runtimeModelIdFor(cliFlash, "high"), "gemini-3.8-flash-high");
eq("claude 5.5 max output from endpoint", cliCatalog.find((e) => e.id === "claude-opus-5-5")?.maxTokens, 128000);
eq("claude 5.5 context from endpoint", cliCatalog.find((e) => e.id === "claude-opus-5-5")?.contextWindow, 1000000);
check("no tab_/chat_ in cli catalog", ![...cliIds].some((id) => id.startsWith("tab_") || id.startsWith("chat_")));
check("curated argon skips when live covers it", mergeCuratedModels(cliCatalog).filter((e) => e.id === "gemini-4-argon").length === 1);

// 5c. session keys match the CLI shape (signed int64 + cascade uuid), stable per session
{
  const a = antigravitySessionKeys("dsh-session-abc");
  const b = antigravitySessionKeys("dsh-session-abc");
  const c2 = antigravitySessionKeys("dsh-session-other");
  console.log("session keys:", JSON.stringify(a));
  check("sessionId is signed int64 string", /^-?\d+$/.test(a.sessionId), a.sessionId);
  check("sessionId fits int64", BigInt(a.sessionId) >= -9223372036854775808n && BigInt(a.sessionId) <= 9223372036854775807n);
  check("same session -> same pair", a.sessionId === b.sessionId && a.cascadeId === b.cascadeId);
  check("different session -> different pair", a.sessionId !== c2.sessionId && a.cascadeId !== c2.cascadeId);
  check("cascadeId is uuid v5", /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(a.cascadeId), a.cascadeId);
}

// 6. curated models: Antigravity offers Gemini 4 Argon although the endpoint
//    does not advertise it for this account (plan / rollout gating).
console.log("curated:", JSON.stringify(CURATED_MODELS.map((m) => [m.id, m.name])));
const withCurated = mergeCuratedModels(catalog);
const argon = withCurated.find((entry) => entry.id === "gemini-4-argon");
check("curated argon added", Boolean(argon));
eq("curated argon name", argon?.name, "Gemini 4 Argon");
eq("curated argon context", argon?.contextWindow, 1048576);
eq("curated argon efforts", JSON.stringify(argon?.reasoningEfforts), JSON.stringify(["low", "medium", "high"]));
eq("curated argon high -> high variant", runtimeModelIdFor(argon, "high"), "gemini-4-argon-high");
check("curated argon keeps candidate chain", (argon?.runtimeCandidates || []).includes("gemini-4-argon"));
eq("curated argon default -> medium", runtimeModelIdFor(argon, undefined), "gemini-4-argon-medium");
eq("curated does not duplicate live entry", withCurated.filter((e) => e.id === "gemini-4-argon").length, 1);
check("curated keeps live entries", catalog.every((entry) => withCurated.some((e) => e.id === entry.id)));
{
  const liveArgon = buildLiveCatalog({
    "gemini-4-argon-low": { displayName: "Gemini 4 Argon (Low)" },
    "gemini-4-argon-medium": { displayName: "Gemini 4 Argon (Medium)" },
    "gemini-4-argon-high": { displayName: "Gemini 4 Argon (High)" },
  });
  const mergedArgon = mergeCuratedModels(liveArgon);
  eq("live argon wins over curated", mergedArgon.filter((e) => e.id === "gemini-4-argon").length, 1);
  eq("live argon keeps runtime map", runtimeModelIdFor(mergedArgon[0], "medium"), "gemini-4-argon-medium");
}
check("thinking level for tiered", runtimeSupportsThinkingLevel("gemini-3.8-flash-tiered"));
check("thinking level for argon", runtimeSupportsThinkingLevel("gemini-4-argon"));
check("thinking level for argon variant", runtimeSupportsThinkingLevel("gemini-4-argon-high"));
check("no thinking level for plain gemini", !runtimeSupportsThinkingLevel("gemini-3-flash"));
check("no thinking level for claude", !runtimeSupportsThinkingLevel("claude-opus-5-5-high"));

// 7. enable-merge semantics (mirrors the stored settings of this profile)
// The pre-patch 0.8.2 static catalog plus the one enabled model, as a fixed
// fixture so this check does not depend on whatever a local profile stored.
const storedSettings = {
  catalogModels: [
    "gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash",
    "gemini-3.1-pro", "gemini-3.1-flash-image", "gemini-3-flash", "gemini-2.5-pro",
    "gemini-2.5-flash", "claude-opus-4-6", "claude-sonnet-4-6", "gpt-oss-120b",
  ].map((id) => ({ id })),
  enabledModelIds: ["gemini-3.8-flash"],
};
const merged = mergeEnabledModelIds(storedSettings.catalogModels, storedSettings.enabledModelIds, withCurated);
console.log("previously enabled:", JSON.stringify(storedSettings.enabledModelIds));
console.log("merged enabled    :", JSON.stringify(merged));
check("kept user's enabled model", merged.includes("gemini-3.8-flash"));
check("auto-enabled new claude 5.5", merged.includes("claude-opus-5-5") && merged.includes("claude-sonnet-5-5"));
check("auto-enabled new lite variants", merged.includes("gemini-3.1-flash-lite") && merged.includes("gemini-3.5-flash-lite"));
check("auto-enabled curated argon", merged.includes("gemini-4-argon"));
check("phantom 3.1-pro never enabled", !merged.includes("gemini-3.1-pro"));
check("still-disabled stay disabled", !merged.includes("gemini-2.5-pro") && !merged.includes("gemini-3-flash"));
check("every enabled id exists in catalog", merged.every((id) => withCurated.some((entry) => entry.id === id)));
eq("first run enables all", mergeEnabledModelIds([], [], withCurated).length, withCurated.length);
eq("empty refresh enables nothing", JSON.stringify(mergeEnabledModelIds(catalog, [...ids], [])), "[]");

console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
