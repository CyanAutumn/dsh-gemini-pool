// Smoke test: load the browser client bundle with a minimal fake host and make
// sure the new usage pill registers on conversation.input.right and renders.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const code = readFileSync(fileURLToPath(new URL("../lib/client.js", import.meta.url)), "utf8");

// ── fake React ──────────────────────────────────────────────────────────────
const React = {
  createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
  useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (fn) => fn(),
  useRef: () => ({ current: null }),
  useCallback: (fn) => fn,
  useSyncExternalStore: (subscribe, getSnapshot) => getSnapshot(),
};

const styleEl = { id: "", textContent: "" };
const elements = [];
globalThis.window = {
  __ModuleLoader__: { load: (def) => { globalThis.__module = def; } },
  setInterval: () => 1,
  clearInterval: () => {},
  addEventListener: () => {},
  __antigravityNavObserver: null,
};
globalThis.document = {
  getElementById: (id) => (styleEl.id === id ? styleEl : null),
  createElement: () => { const el = { id: "", textContent: "", setAttribute() {} }; elements.push(el); return el; },
  head: { append: () => {} },
  querySelectorAll: () => [],
  documentElement: {},
  body: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  visibilityState: "visible",
};
globalThis.MutationObserver = class { observe() {} };
Object.defineProperty(globalThis, "navigator", { value: { language: "zh-CN" }, configurable: true });
globalThis.fetch = async () => ({ ok: true, json: async () => ({ ok: true, value: {} }) });
globalThis.Node = class {};
globalThis.require = (name) => {
  if (name === "react") return React;
  throw new Error(`unexpected require ${name}`);
};

eval(code);
const mod = globalThis.__module.factory(globalThis.require);
console.log("exports:", Object.keys(mod));
if (typeof mod.apply !== "function") throw new Error("apply missing");

const registrations = [];
const ctx = {
  locale: {
    register() {},
    bind: () => (key) => key,
    getLocale: () => ({ active: "zh-CN" }),
  },
  slots: {
    inject(name, cb) { cb(); },
    register(def, component) {
      registrations.push({ def, component });
      return () => {};
    },
  },
  get: (name) => (name === "modelDirectories" ? ctx.modelDirectories : undefined),
  inject(names, cb) { cb(); },
  modelDirectories: { directoryFor: () => ({ store: { subscribe() {}, getSnapshot: () => ({}) } }) },
  effect() {},
};
mod.apply(ctx);

const names = registrations.map((r) => r.def.name);
console.log("registered slots:", names);
const pill = registrations.find((r) => r.def.name === "conversation.input.right");
if (!pill) throw new Error("usage pill was not registered");
console.log("pill id/order:", pill.def.id, pill.def.order);
if (typeof pill.def.inject !== "function") throw new Error("pill inject missing");

// props the slot would hand the component
const props = pill.def.inject("session-1");
console.log("pill props:", Object.keys(props));
if (!props.directory || typeof props.directory.getSnapshot !== "function") throw new Error("directory missing");
if (typeof props.t !== "function") throw new Error("translator missing");

// selected model is NOT antigravity -> renders nothing
const other = pill.component({ ...props, directory: { subscribe() {}, getSnapshot: () => ({ current: { provider: "cline-pass" } }) } });
if (other !== null) throw new Error("pill should be hidden for other providers");

// selected model is antigravity -> renders the pill
const store = {
  subscribe() {},
  getSnapshot: () => ({ current: { provider: "antigravity", model: "gemini-4-argon" } }),
};
const tree = pill.component({ ...props, directory: store });
if (!tree) throw new Error("pill did not render for antigravity");

function flatten(node, out = []) {
  if (node === null || node === undefined || node === false) return out;
  if (Array.isArray(node)) { node.forEach((n) => flatten(n, out)); return out; }
  if (typeof node === "string" || typeof node === "number") { out.push(String(node)); return out; }
  if (typeof node.type === "function") { flatten(node.type(node.props), out); return out; }
  if (node.children) node.children.forEach((child) => flatten(child, out));
  if (node.props && node.props.children !== undefined) flatten(node.props.children, out);
  return out;
}
const text = flatten(tree).join(" ");
console.log("pill text:", JSON.stringify(text.slice(0, 120)));
if (!/AGY/.test(text)) throw new Error("pill label missing");

// unknown provider id still hidden
const hidden = pill.component({ ...props, directory: { subscribe() {}, getSnapshot: () => ({}) } });
if (hidden !== null) throw new Error("pill should be hidden without a selection");

console.log("USAGE PILL SMOKE TEST PASSED");
