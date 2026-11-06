# 本地补丁说明（基于上游 dsh-gemini-pool 0.8.2）

这个包**不是**上游原样发布：`lib/models.js`、`lib/index.js`、`lib/client.js`、`package.json`
都经过本地修补。上游发新版并覆盖本包时，需要重新打补丁（补丁与全部证据见同目录的
`docs/`、`captured/`，以及 Desktop 上 `dsh-gemini-pool-patched/0.8.2-live-catalog.patch`）。

## 包含的修补

### 1. 模型目录改为按端点实时拉取

- `buildLiveCatalog()`：端点返回什么就是什么；静态 `MODELS` 只做离线兜底；
- 按 `-low/-medium/-high/-extra-low/-tiered/-agent` 后缀把同一模型的多个运行时 id 合并成一条目录项，
  记录 `runtimeIds`、`modelEnums`（`MODEL_PLACEHOLDER_*`）、`thinkingLevels`；
- 刷新时保留用户勾选、丢弃下线模型、**首次出现的新模型自动启用**；
- 端点返回空时不覆写已存目录（避免幽灵模型复活）；
- 目录使用端点返回的 `maxTokens` / `maxOutputTokens`（如 Claude 5.5 = 1M 上下文 / 128k 输出）。

### 2. 请求行为对齐 Antigravity CLI（抓包验证）

- User-Agent 改为 CLI 形状：
  `antigravity/cli/1.5.1 (aidev_client; os_type=…; arch=…; cl=1014269460; auth_method=consumer)`；
  可用 `ANTIGRAVITY_USER_AGENT` / `ANTIGRAVITY_CLI_VERSION` / `ANTIGRAVITY_CLI_BUILD` 覆盖；
- 全局限速闸门 `antigravityFetch()`：最小间隔 1s、严格串行（替代原来的双端点并行扇出）；
- 只打 `daily-cloudcode-pa`，失败才串行回退 prod；目录刷新取首个成功端点，不再合并两处结果；
- 生成 / 生图 / 代看：单端点、最多 1 个候选重试、**429 不重试**；
- 请求头删除 `X-Goog-Api-Client`、`Client-Metadata`；`loadCodeAssist` 只发 `{"metadata":{"ideType":"ANTIGRAVITY"}}`；
- 生成体与 CLI 对齐：
  - 顶层 `userAgent: "antigravity"`、`requestId: agent/<cascade>/<ms>/<trajectory>/1`；
  - `request.labels`（`cascade_id` / `trajectory_id` / `request_id` / `model_enum` / `used_*`）；
  - `request.sessionId` 由宿主会话 id 派生为**有符号 int64**（同会话稳定），`cascade_id` 同步按会话派生；
  - `generationConfig.thinkingConfig.includeThoughts = true`；
  - `tools[].parameters` 改为大写 Gemini Schema（`$ref` 内联、`nullable`/`anyOf` 保留、其余关键字丢弃）；
  - 生成体只带宿主自己的 system prompt（删掉插件自造的两段 ignore 文案）。
- **Gemini 前言文本改记为 reasoning**（`ANTIGRAVITY_PREAMBLE_AS_REASONING=0` 可关闭）：
  当一段普通文本后面紧跟工具调用时（Gemini 3.8 的 "Let me read …" 这类前言），把该块的
  `block-end` 报成 `reasoning`，DSH 会把它折叠进思考预览，而不是留在正文里；
  **回放历史不受影响**：没有 thinkingSignature 的 reasoning 在重新发给模型时仍按普通文本发送。
- **不再对目录里的模型做静默降级**：只有离线静态目录才用 3.8→3.7→3.6 的兜底链；
  已拉取目录的模型失败时直接报错，错误里带 `model=` / `tried=[…]` / 首次失败原文，
  不会再出现「选 3.8 却报 gemini-3.7-flash-high 404」这种误导。

### 3. 聊天框额度徽标

- 在 `conversation.input.right` 槽（模型选择器左侧）显示 `AGY xx%`；
- 点开显示各额度分组（Gemini / Claude-GPT / Gemini 4 Argon）的剩余与重置时间；
- 仅当当前模型属于 `antigravity` 时挂载；60s 轮询，标签页隐藏时不请求。

## 与上游的元数据差异

- `package.json` 的 `dsh.client.inject` 增加 `@deepseek-ai/dsh-client-ui-model-selection`
  （额度徽标需要读模型选择目录）。

## 自检

```powershell
node --check lib\index.js
node --check lib\models.js
node --check lib\client.js
node docs\catalog-test.mjs
node docs\tool-schema-test.mjs
node docs\usage-pill-smoke.mjs
```