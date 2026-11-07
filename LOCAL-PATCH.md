# 本地补丁说明（基于上游 dsh-gemini-pool 0.8.2）

这个包**不是**上游原样发布：`lib/models.js`、`lib/index.js`、`lib/client.js`、`package.json`
都经过本地修补。上游发新版并覆盖本包时，需要重新打补丁（补丁与全部证据见同目录的
`docs/`、`captured/`，以及 Desktop 上 `dsh-gemini-pool-patched/0.8.2-live-catalog.patch`）。

## 2026-11-07 修复：连接被切断时整轮直接失败（`terminated` / UNKNOWN）

现象：`session-45e733d0` 跑到第 77 步时整轮失败，`turn/end` 里是
`{"message":"terminated","code":"UNKNOWN"}`，没有走重试。

根因：

- Antigravity 的响应体在 socket 层被切断时，undici 抛出的错误消息就是 `terminated`；
  旧实现让 `streamResponseToChunks()` 的 `reader.read()` 异常**原样冒泡**，
  宿主按未知错误处理（code `UNKNOWN`），而重试策略只覆盖
  `EMPTY_RESPONSE / RATE_LIMIT / SERVER / TIMEOUT / TRANSPORT`，于是**一次断连就终止整轮**；
- `classifyAntigravityError()` 当时也不认 `terminated`（只认 network/connection/socket/fetch/ECONN*），
  所以即使包装了也会落到不可重试的 `ANTIGRAVITY_ERROR`。

修复（0.8.2-patch.13）：

- `streamResponseToChunks()` 的读取循环加 try/catch：`AbortError`/`aborted` → `ABORTED`（不重试），
  其余统一抛 `LlmError("Antigravity stream read failed: …", classifyAntigravityError(…))`；
- `classifyAntigravityError()` 把 `terminated`、`other side closed`、`premature close`、
  `EPIPE`/`ECONNRESET` 归入 `TRANSPORT` → 走宿主重试（最多 5 次，指数退避）。
- 回归：新增 `test/stream-failure-classification.test.mjs`（4 项），全套 **162/162**。

注意：这只能保证“断连→重试”，断连本身仍可能来自网络/上游；如果连续重试都失败，
说明是持续性的链路问题（代理、上游限流或本地网络）。


## 2026-11-07 修复：预设 `gemini-cli` 一直不出现（组合缺 `workflowEngine`，被 Web 端当 broken 过滤）

现象：重启后 Agent 预设列表里始终没有「Gemini（CLI 风格）」。

根因（代码层确认，非缓存/重启问题）：

- 预设的 `delegation` 组里声明了 `tool-workflow`（`@deepseek-ai/dsh-tool-workflow`），它的
  `inject = ["tools", "workflowEngine", "systemPrompt"]`；`workflowEngine` 由
  `@deepseek-ai/dsh-workflow-ptc` 提供，而这一行在预设里被漏掉了（Host 侧的 `workflow-ptc` 是 disabled）。
- 缺服务时该行一直 pending。`dsh-agent-preset-registry` 的 `diagnostic()` 在
  `loader.await()` 后仍 pending 就判为 broken（`record.broken`），而 Web 端预设选择器
  （`dsh-client-ui-agent-preset/lib/client.js`）**过滤掉 broken 行**
  （`presets.filter((preset) => preset.broken === void 0)`），于是这个预设从头到尾都不显示。
- 注意 `plugin_manager list_plugins` 里 `include:preset-gemini-cli` 一直是 `active`：那是
  **声明行**的状态，组合挂载失败只体现在 registry 的 `broken` 诊断里，所以之前看起来"一切正常"。

修复：在 `delegation` 组补 `workflow-ptc`（`@deepseek-ai/dsh-workflow-ptc`, `config.provider: spawn`），
与官方 `standard` 预设的同组结构一致。修复后本预设的 27 行插件与 `standard` 预设逐行比对：
**没有 standard 里不存在的行**，只少了刻意不带的 `planning`(plan-mode) 与两个 plugin-manager 工具。

版本 0.8.2-patch.12；bundle patch 在启动时读取，需要重启 DSH 生效。


## 2026-11-07 增补：模型类过程报错修复（工具参数修复 + 失败回注）

审计会话 `session-02cf33e9`（Gemini 4 Argon，94 次 edit / 330 次工具调用）逐条统计出的
「模型自己造成的调用报错」与处理：

| 报错 | 次数 | 处理 |
|---|---|---|
| `invalid escalation: justification is only valid together with sandbox_permissions` | 11 | 适配器在发出调用前删掉单独出现的 `justification`（11/11 消除） |
| `old_string was not found in "<file>"` | 10 | ① 对 CRLF/LF、行尾空白、缩进、行内多空格做**唯一**匹配，命中则重写 `old_string`；② 仍未命中时不猜值，改为在**下一次请求**的 systemInstruction 附上该文件真实字节（带行号；长文件取最相似窗口），让模型照抄 |
| `cannot read "<path>": not found` | 1 | 下一次请求附上最近存在目录的条目列表，并要求改用 `glob` / `grep` |
| `stale goal ref "g-…"` | 1 | 下一次请求提示先 `get_goal` 再原样传 `goal_id` / `revision`；schema 同步追加约束句 |
| `this goal operation requires a direct human turn` | 1 | 同上（提示 `pause` / `resume` 只能在人类回合调用） |

实现：

- 新增 `lib/tool-repair.js`：`repairToolArguments()` 在 `processStreamLine()` 收到 `functionCall`、
  发出 `tool-call-delta` **之前**执行——剔除单飞 `justification`、归一
  `sandbox_permissions` 别名/非法值、解析被当成字符串返回的 `args`、修补 `edit.old_string`
  的空白类差异（只接受文件内唯一命中；命中不唯一就原样放行）；
- 新增 `lib/prompt-repair.js`：`buildRepairHint()` 只扫会话尾部 8 条消息里的 `isError`
  工具结果，命中上面四类签名才在**该次请求**的 systemInstruction 追加 `<tool_repair>`
  （一次性、不写入 transcript、文件不可读则不注入）；
- `lib/models.js`：`hardenToolSchema()` 在既有 escalation 描述加固之外，给
  `edit.old_string`、`read.file_path`、`update_goal.goal_id/revision/action` 追加约束句；
- 预设提示词（`cordis.patch.yml`）`<tooling>` 段同步加入 goal 工具规则与 read 路径规则；
- 诊断：`getAntigravityDiagnostics().toolRepairs` 暴露 `{ total, byKind }`。

**刻意不做**：不猜 `old_string` 的值（这 10 例的根因是模型把**想要的新值**写进了
`old_string`，替它改值会改错代码）、不改 `new_string`、不发明路径、不自动重发请求。

**回归**：`npm run check` 158/158（新增 `tool-repair` 16、`tool-repair-integration` 2、
`tool-schema-cautions` 5、`prompt-repair` 6）。

**回放**：把审计会话里 11 条 `invalid escalation` 的原始参数喂给修复层，11/11 变成合法调用；
10 条 `old_string was not found` 全部生成带真实字节的 `<tool_repair>` 提示
（例：`devil.gd` 的实际 `speed = 0.10` / `life = 1000.0`，模型当时写的是 `0.08` / `200.0`）。


## 2026-11-07 增补：内置「Gemini（CLI 风格）」Agent 预设（预设提示词，不再塞进插件）

插件不再向 `systemInstruction` 追加**常驻**文本（原来的委派/escalation/edit 追加段落已删除；
仅在上一轮工具参数被拒时按需追加一次性的 `<tool_repair>` 提示，见上一节）。
改为在插件自己的 bundle patch（`cordis.patch.yml`）里 **自动注册一个 Agent 预设** `gemini-cli`：

- 提示词：Antigravity CLI 的 `<identity>` / `<guidelines>` / `<communication_style>` 原文，
  子代理与消息协议改写成 DSH 形态（`subagent` / `subagent_fork` / `spawn_teammate` / `wait_agent`），
  另加一节 DSH 工具用法（edit 的精确 `old_string`、`justification` 必须与 `sandbox_permissions` 同时出现）；
- 插件列表：persona(`complete: true`) + agent-instructions + time-context + 文件/搜索/jobs/schedule/
  goal/压缩/子代理/网页/技能/present 等，与标准模式一致；
- 预设是**按会话**选择的，不会随模型自动切换；安装插件并重启 DSH 后，在 Agent 预设里选「Gemini（CLI 风格）」。


## 2026-11-07 增补：edit 使用纪律（减少 old_string was not found）

实测某会话 21 次 `edit` 有 5 次 `old_string was not found`：模型是**凭记忆重构** `old_string`，
里面的数值已是它想写入的新值，而文件里还是旧值（例：模型写 `speed = 0.08`，文件实际 `speed = 0.10`）。

- 提示词追加段落补充：调用 `edit` 前**同一轮内先 read**，逐字复制 `old_string`（缩进与当前值都要对），
  保持为少量唯一行；若报 `old_string was not found`，**重新 read** 后重试，不要凭猜测改字符串。
- `edit` 仍是精确字面匹配（DSH 侧行为，未改动）。


## 2026-11-07 增补：escalation 参数说明加固（修复 `invalid escalation`）

`write` / `edit` / `pwsh` 的 schema 里 `justification` 与 `sandbox_permissions` 都是普通可选属性，
但 DSH 校验要求「只带 `justification`、不带 `sandbox_permissions`」时报
`invalid escalation: justification is only valid together with sandbox_permissions`；
Gemini 4 Argon 曾把 `justification` 当成普通说明字段单独填。

- 提示词侧：委派追加段落里补了一句「不要单独传 justification」（`ANTIGRAVITY_PROMPT_ADDENDUM=0` 一起关掉）；
- schema 侧：`models.js::hardenEscalationSchema()` 在转换时给这类工具的 `justification`
  描述追加 "ONLY valid together with sandbox_permissions; omit it when you are not requesting escalation."，
  只对同时含两个字段的工具生效，幂等；
- 回归：`test/escalation-schema.test.mjs`（用真实 write/edit/pwsh schema 做 fixture）。
## 2026-11-07 增补：按模型家族追加委派引导（可选，默认开启）

CLI 的 21.7KB 系统提示词里有专门的 `<subagents>` 区块（`invoke_subagent` + self/research/image-generator
三个具名子代理），而 DSH 只给通用工具描述，导致 Gemini 很少主动起子代理。本补丁在
`systemInstruction` 末尾追加一段**自写**的委派引导（按 runtime 家族区分文案）：

- `claude-*`：显式分解 + 校验子代理结果；
- `gemini-4-argon*`：同一批并行发起（Gemini 倾向串行自己做完）；
- 其它 gemini / gpt-oss：通用委派说明（独立子任务并行、`subagent_fork` 继承上下文、不要轮询）。

关闭方式：`ANTIGRAVITY_PROMPT_ADDENDUM=0`（默认开启）。实现在 `models.js::buildPromptAddendum()`，
可单测：`test/prompt-addendum.test.mjs`。
## 2026-11-07 增补：Gemini 4 / Claude 5.5 / GPT-OSS 适配（CLI 1.5.2 抓包）

用同一个 rea 思路重装了 WSL 里的 `agy`（1.5.2），逐模型抓生成请求，结论：

- **UA 更新**：`antigravity/cli/1.5.2 (… cl=1015175089 …)`（原 1.5.1 / 1014269460）。
- **thinkingConfig 按家族区分**（此前只给 gemini 发）：
  - `gemini-4-argon-*`：`{includeThoughts:true, thinkingLevel:LOW|MEDIUM|HIGH}`，`maxOutputTokens 65536`；
  - `claude-opus/sonnet-5-5-*`：**同样发 thinkingLevel**，`maxOutputTokens 128000`；
  - `gpt-oss-120b`：`{includeThoughts:true, thinkingBudget:8192}`，`maxOutputTokens 32768`。
- **tools[].parameters 全部使用大写 Gemini Schema**：Claude 不再是 JSON-Schema 透传；
- **不再给 Claude 强塞 `toolConfig.validated`**：CLI 只在调用方强制模式时才发；
- **labels 家族标记**：Claude → `used_claude` / `used_claude_conservative` 均为 `"true"`（high 档也是 true）；
  GPT-OSS → `used_non_gemini_model:"true"`、`used_claude:"false"`；
- `maxOutputTokens` 仍取目录端点值（Claude 128k / Argon 64k / GPT-OSS 32k），静态兜底表同步补了 Claude 5.5 = 128000。

抓包证据（本地，未入库）：`captured/cli-1.5.2/`；可回归的自检：`test/model-family-parity.test.mjs`
（用脱敏后的 fixtures 断言 thinkingConfig / labels / 工具 schema / 输出上限与 CLI 逐字段一致）。
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
