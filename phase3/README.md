# 阶段 3 学习大纲：LangChain Agent Harness 与 Middleware

版本日期：2026-06-24

路线图仅供参考。阶段 3 的实际执行以当前代码、阶段 2 已完成能力、作品集目标和 `docs/course-outline-rules.md` 为准；如果有更直接、更贴近真实项目的方式，就按更好的方式做。

## 阶段目标

把阶段 2 的“手写工具调用循环”升级为 LangChain.js 官方 `createAgent` agent harness，并学习最小必要的 middleware、运行限制、短期上下文和观测能力。

一句话：

```text
阶段 2 学会了手动执行 tool call；阶段 3 学会用成熟 agent harness 管理工具循环、middleware 和 trace。
```

## 阶段硬性约束

本阶段继续贴近真实项目：

- 不使用 mock 模型作为主线。
- 不用假工具冒充真实外部能力。
- 继续复用阶段 2 的真实外部工具：GitHub API、npm registry。
- 大模型继续从 `.env` 读取 OpenAI-compatible 中转配置。
- 优先使用 LangChain.js 官方成熟能力，例如 `createAgent`、`createMiddleware`、内置 middleware、LangSmith tracing。
- 先做 CLI / run report，不急着做完整 Web UI。

## 本阶段和阶段 2 的关系

阶段 2 主线：

```text
model.bindTools
-> AIMessage.tool_calls
-> tool.invoke(...)
-> ToolMessage
-> 第二次 invoke
-> structured output
```

阶段 3 主线：

```text
createAgent({
  model,
  tools,
  middleware,
  responseFormat
})
-> agent.invoke(...)
-> 自动管理工具循环
-> middleware 记录/限制/保护
-> trace/run report
```

你要观察的是：

```text
createAgent 替你管理了哪些事情？
哪些事情仍然必须由你设计和约束？
```

## 必须学

- `createAgent` 的最小用法：`model`、`tools`、`systemPrompt`、`responseFormat`。
- agent 输入输出结构：`messages`、最终消息、结构化响应。
- agent 自动工具循环：什么时候调用工具、怎么把工具结果继续喂回模型。
- middleware 的基本位置：model call 前后、tool call 前后、agent run 前后。
- 工具调用限制：最多调用多少次、哪些工具允许调用、失败怎么记录。
- LangSmith tracing 或最小本地 run report：必须能看清模型调用、工具调用、耗时、错误。

## 值得学

- PII / 敏感信息过滤 middleware。
- message trimming 或 summarization 的基本思路。
- 轻量 agent run report，方便作品集展示。
- 使用 `responseFormat` 让 agent 直接产出结构化结果，减少阶段 2 Step 8 那种额外整理调用。

## 知道即可

- human-in-the-loop middleware 的存在。
- model fallback / model routing middleware。
- long-term memory / store。
- stream transformers。
- subagent / multi-agent。

这些未来会有用，但现在不是主线。

## 暂缓内容

- LangGraph `StateGraph`：阶段 5 再学。
- RAG / vector store：阶段 4 再学。
- MCP：阶段 8 再学。
- 多 agent：阶段 8 或 Capstone 再学。
- 完整 Web UI：阶段 3 可以只做 CLI；UI 展示可以作为未来深化。
- 复杂人工审批：阶段 7 再系统学。
- 生产级权限系统：现在只做工具白名单和调用限制。

## 最小可运行成果

阶段 3 完成后，应该能跑一个真实 agent：

```bash
pnpm phase3:agent "请查询 langchain-ai/langchainjs，并总结 @langchain/core 当前 npm 信息"
```

预期它会：

- 读取真实 `.env` 模型配置。
- 使用阶段 2 的真实外部工具。
- 由 `createAgent` 自动完成工具调用循环。
- 输出最终回答或结构化结果。
- 生成一份 run report，包含模型调用、工具调用、耗时、错误摘要。

## 作品集关系

阶段 3 是未来 Personal Operations Agent 的 agent harness 基础。

未来作品集里它负责展示：

- 不是手写死流程，而是使用成熟 agent harness。
- 能观察 agent 为什么调用工具。
- 能通过 middleware 加规则、限制、审计和上下文控制。
- prompt、tools、model config、middleware 可以独立修改。

## Step 1：理解 createAgent 解决什么问题

做什么：

对比阶段 2 的手写工具循环和 `createAgent` 的职责边界。

为什么现在做：

你已经亲手写过 `tool_calls -> tool.invoke -> ToolMessage -> finalResponse`，现在学习 agent harness 才不会觉得它是黑盒魔法。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `phase2/src/tool-assistant-demo.ts`
- `phase2/src/tool-runner.ts`
- `langchain` 包里的 `createAgent`

练习：

- 写一段对照笔记：阶段 2 哪些逻辑未来会交给 `createAgent`。
- 标出仍然需要自己负责的东西：工具定义、schema、prompt 约束、权限、日志。

验收：

- 能解释 `createAgent` 不是“更聪明的模型”，而是 agent 运行框架。
- 能说明 `createAgent` 和 `model.bindTools(...)` 的关系。

不做什么：

- 不直接上 LangGraph。
- 不引入多 agent。
- 不重构阶段 2 所有代码。

## Step 2：用 createAgent 跑通最小真实 agent

做什么：

用真实模型和阶段 2 的真实外部工具创建一个最小 agent。

建议结构：

```ts
const agent = createAgent({
  model,
  tools,
  systemPrompt,
});

const result = await agent.invoke({
  messages: [{ role: "user", content: userPrompt }],
});
```

为什么现在做：

这是阶段 3 的第一条主线：先让官方 agent harness 真的跑起来，再学习 middleware。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `phase2/src/tools.ts`
- `phase1/src/chat-model-factory.ts`
- 新建 `phase3/src/agent-demo.ts`

练习：

- 复用 `createExternalTools()`。
- 从 `.env` 读取真实模型配置。
- 输入一个 GitHub/npm 查询，让 agent 自己决定调用哪些工具。

验收：

- 不使用 mock 模型。
- 不使用假工具。
- agent 能真实调用 GitHub API / npm registry。
- 能打印最终回答和使用过的工具名。

不做什么：

- 不做复杂状态管理。
- 不做多轮持久化记忆。
- 不做前端 UI。

## Step 3：理解 agent 的输入输出边界

做什么：

弄清楚 `agent.invoke(...)` 的输入是什么，返回结果里有什么。

重点关注：

- `messages` 输入。
- 最终 message。
- 中间工具调用是否能从 trace/report 观察到。
- 如果配置 `responseFormat`，结构化结果在哪里。

为什么现在做：

阶段 2 你已经看过 `AIMessage`、`ToolMessage`。阶段 3 要进一步理解 agent 返回的不只是字符串，而是一组可追踪的运行结果。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- 新建 `phase3/src/agent-result-demo.ts`
- `phase3/src/agent-demo.ts`

练习：

- 打印 agent 返回对象的关键字段。
- 提取最终文本。
- 如果有 structured response，打印结构化对象。

验收：

- 能说清楚“agent 的最终回答”和“工具调用过程”不是同一个东西。
- 能从返回值或 run report 找到工具调用记录。

不做什么：

- 不为了打印所有字段写复杂 parser。
- 不做 provider 兼容层大抽象。

## Step 4：用 responseFormat 直接输出结构化结果

做什么：

把阶段 2 Step 8 的“额外整理调用”改成 agent 直接输出结构化结果。

建议结构：

```ts
const agent = createAgent({
  model,
  tools,
  systemPrompt,
  responseFormat: toolStrategy(externalLookupOutputSchema),
});
```

为什么现在做：

阶段 2 的教学版为了分清概念，多调用了一次模型整理结果。阶段 3 可以学习更接近真实项目的写法：让 agent 工具循环结束后直接产出结构化结果。

对当前中转最稳的做法是用 `toolStrategy(...)`，也就是让结构化输出也走 function calling 机制，而不是赌某个 provider 的原生 JSON schema 支持。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- `phase2/src/structured-output.ts`
- `phase3/src/agent-structured-output.ts`
- `phase3/src/agent-result-demo.ts`
- `toolStrategy(...)`

练习：

- 复用或简化 `externalLookupOutputSchema`。
- 让 agent 最终返回 `answer`、`toolCallsUsed`、`sources`、`needsHumanReview`。
- 比较阶段 2 的三次模型调用和阶段 3 的 agent 结构化输出。

验收：

- 最终结果是稳定对象，不只是自然语言。
- 字段缺失或类型错误会被 schema 拦住。
- 能解释 `responseFormat` 和 `withStructuredOutput(...)` 的关系。

不做什么：

- 不设计大型报告 schema。
- 不做多种输出格式切换。

## Step 5：加入最小 middleware 观察 agent 过程

做什么：

使用 `createMiddleware` 或 LangChain 内置 middleware，记录 model call 和 tool call 的关键信息。

建议先记录：

```ts
type AgentRunEvent = {
  kind: "model" | "tool";
  name: string;
  ok: boolean;
  latencyMs: number;
  errorMessage?: string;
};
```

为什么现在做：

agent harness 会自动帮你跑工具循环，但真实项目不能只看最终答案。必须能观察每一步发生了什么。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- `phase2/src/tool-runner.ts` 的 `ToolRunLog`
- `phase3/src/middleware.ts`
- `phase3/src/run-report.ts`
- `phase3/src/agent-report-demo.ts`

练习：

- 记录每次工具调用的工具名、参数摘要、耗时、是否成功。
- 记录每次模型调用耗时。
- CLI 结束后打印 run report。

验收：

- 工具成功和失败都能在 report 中看到。
- report 不泄露 API key。
- 失败时能定位是模型问题、工具问题还是 schema 问题。

不做什么：

- 不做完整 APM 系统。
- 不做复杂 trace UI。
- 不把日志系统抽象成通用平台。

## Step 6：加入工具调用限制和安全边界

做什么：

使用成熟 middleware 或小范围自定义逻辑限制 agent 行为。

优先学习：

- `toolCallLimitMiddleware`：限制工具调用次数。
- `modelCallLimitMiddleware`：限制模型调用次数。
- 工具白名单：只允许当前阶段明确开放的外部只读工具。

为什么现在做：

agent 能自动循环，也意味着它可能过度调用工具、重复请求、浪费 token 或触发 API 限流。真实项目必须有边界。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 安全工程实践

重点看：

- 新建 `phase3/src/agent-limits.ts`
- 新建 `phase3/src/agent-demo.ts`

练习：

- 设置最大工具调用次数。
- 设置最大模型调用次数。
- 故意问一个可能反复搜索的问题，观察限制是否生效。

验收：

- agent 超过限制会明确失败，而不是无限循环。
- 错误信息能说明触发了哪个限制。
- report 中能看到限制相关信息。

不做什么：

- 不做复杂权限后台。
- 不做高风险写入工具。
- 不实现支付、链上交易、删除文件等危险动作。

## Step 7：短期上下文与消息裁剪

做什么：

学习 agent 在多轮对话中如何控制上下文长度，先做最小 message trimming。

为什么现在做：

真实 agent 很容易把历史消息、工具结果和中间过程塞满上下文。阶段 3 只需要学会“别让上下文无限增长”。

价值标签：值得学，中高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- LangChain `trimMessages` / 相关上下文处理能力。
- `phase3/src/context-demo.ts`
- `prepareShortTermContext(...)`：这一步真正做消息裁剪。
- `runContextAwareAgent(...)`：这一步把裁剪后的消息交给真实 agent。

练习：

- 准备一组多轮消息。
- 保留 system prompt 和最近几轮用户/助手消息。
- 丢弃过旧或过长的工具结果。

本项目实现：

```text
原始多轮消息
-> 压缩过长 ToolMessage
-> trimMessages 保留 system + 最近上下文
-> createAgent(...).invoke({ messages: preparedMessages })
```

为什么先压缩工具结果：

工具结果经常是大 JSON、README、搜索结果列表。真实项目里如果把旧工具结果完整塞回模型，上下文会很快膨胀，成本变高，模型也更容易被旧信息干扰。

为什么用 `startOn: "human"` 和 `endOn: "human"`：

agent 调用模型前，消息最好从一轮用户请求开始，并以当前用户请求结束。这样不容易留下孤立的 `ToolMessage` 或半截工具调用过程。

运行：

```bash
pnpm phase3:context "请查询 @langchain/core 的 npm 包信息和最近一周下载量。"
```

可选调小上下文预算，观察被裁剪的消息变多：

```bash
CONTEXT_MAX_APPROX_TOKENS=300 pnpm phase3:context "请查询 @langchain/core 的 npm 包信息和最近一周下载量。"
```

验收：

- 能解释短期上下文和长期记忆不是一回事。
- 多轮输入不会无限增长。
- 被裁剪的内容不会影响当前 demo 的主要任务。

不做什么：

- 不做长期记忆。
- 不做数据库存储。
- 不做向量记忆。
- 不做 LangGraph checkpointer。

## Step 8：接入 LangSmith 或最小真实观测

做什么：

优先接入 LangSmith tracing；如果没有 LangSmith key，则保留本地 JSON run report 作为降级观测。

为什么现在做：

真实 agent 项目必须能解释“它做了什么”。没有 trace，后面评估、调试、作品集展示都会很弱。

价值标签：必须学，高价值

来源/定位：成熟工具 + 作品集准备

重点看：

- `.env` 中 LangSmith 相关环境变量。
- 新建 `phase3/src/run-report.ts`
- 新建 `phase3/src/agent-demo.ts`

练习：

- 为每次 agent run 生成 run id。
- 记录 provider、model、userPrompt、工具调用、耗时、错误摘要。
- 如果配置了 LangSmith，确保 trace 能在 LangSmith 项目中看到。

验收：

- 每次运行都有可排查记录。
- 不配置 LangSmith 时，CLI 仍能运行。
- 不把 API key、token、敏感 header 写进 report。

不做什么：

- 不做完整评估集。
- 不做线上监控面板。
- 不做成本看板。

## Step 9：阶段收束：Personal Operations Agent 最小版

做什么：

把前面能力合成一个最小 agent CLI。

最小能力：

- 使用真实模型。
- 使用真实外部工具。
- 使用 `createAgent`。
- 有结构化输出。
- 有工具/模型调用限制。
- 有 run report。

为什么现在做：

阶段 3 不应该停在零散 API 学习，而应该产出一个能继续升级到 RAG、LangGraph 和作品集的 agent skeleton。

价值标签：必须学，高价值

来源/定位：作品集准备 + 工程实践

重点看：

- `phase3/src/agent-demo.ts`
- `phase3/src/middleware.ts`
- `phase3/src/run-report.ts`

练习：

- 做一个命令：`pnpm phase3:agent "..."`
- 输入 GitHub/npm 查询任务。
- 输出结构化结果和 run report。

验收：

- 一条命令能跑完整真实 agent。
- 能展示工具调用和最终结构化结果。
- 能解释阶段 3 和阶段 2 的区别。

不做什么：

- 不做完整 Web UI。
- 不做 RAG。
- 不做 LangGraph 状态图。
- 不做多 agent。

## 本阶段不是核心，但未来可以深化



### 1. Web UI 展示 agent 过程

价值：中高，作品集展示价值大。

为什么暂缓：

现在先把 agent harness 和 middleware 学稳。UI 会引入前端状态、流式事件、错误展示等额外复杂度。

未来深化：

- 用 Next.js 或 Vercel AI SDK 做聊天界面。
- 实时展示 tool calls、run report、结构化结果。
- 加入 trace 链接和失败案例回放。

### 2. Human-in-the-loop

价值：高，但当前只读工具不急。

为什么暂缓：

当前工具都是 GitHub/npm 只读查询，没有高风险写入动作。人工审批更适合阶段 7 和高风险工具阶段。

未来深化：

- 对写入 GitHub issue、发消息、链上交易、文件修改等动作加审批。
- 使用 LangChain / LangGraph 的 interrupt 或 HITL middleware。
- 记录审批人、审批时间、修改后的参数。

### 3. 多模型路由和 fallback

价值：中高，生产有用。

为什么暂缓：

当前阶段重点是 agent harness，不是模型策略。过早加路由会分散注意力。

未来深化：

- 简单任务用便宜模型。
- 复杂推理用强模型。
- 结构化输出失败时 fallback 到更稳定模型。

### 4. 长期记忆 （还有短期的上下文与裁剪策略也有待进一步提高）

价值：高，但容易过早复杂化。

为什么暂缓：

长期记忆需要 store、用户身份、隐私、更新策略、遗忘策略。阶段 3 只学短期上下文控制。

未来深化：

- 记录用户偏好。
- 记录常用仓库和包。
- 给记忆加来源、时间和可删除机制。

### 5. Agent streaming

价值：中高，适合 UI。

为什么暂缓：

阶段 1 已学过模型 stream，阶段 3 先不把 token stream、tool progress、middleware events 全部展开。

未来深化：

- CLI 实时显示工具调用进度。
- Web UI 显示 token、tool call、tool result。
- 与 LangGraph event streaming 对齐。

### 6. Subagent / multi-agent

价值：中，但现在容易变成概念堆叠。

为什么暂缓：

单 agent 的工具、上下文、限制、观测还没完全稳定前，多 agent 只会增加调试难度。

未来深化：

- Research agent + package analyst agent。
- Supervisor 分派任务。
- 多 agent 共享 run report 和权限边界。

## 阶段完成标准

- [ ] 能解释 `createAgent` 解决了阶段 2 手写循环里的哪些问题。
- [ ] 能用真实模型和真实外部工具跑通 agent。
- [ ] 能看懂 agent 输入输出结构。
- [ ] 能让 agent 返回结构化对象。
- [ ] 能用 middleware 记录工具/模型调用。
- [ ] 能限制工具调用次数和模型调用次数。
- [ ] 能做最小短期上下文裁剪。
- [ ] 能生成本地 run report 或接入 LangSmith trace。
- [ ] 能说明哪些内容暂缓到 RAG、LangGraph、MCP 或 Capstone。

## 推荐命令规划

后续实现时建议逐步增加：

```bash
pnpm phase3:agent "请查询 langchain-ai/langchainjs，并总结 @langchain/core 当前 npm 信息"
pnpm phase3:agent-result "请查询 @langchain/openai 的 npm 信息"
pnpm phase3:structured-agent "请查询 langchain-ai/langchainjs，并输出结构化结果"
pnpm phase3:agent-report "请查询 @langchain/core 的 npm 包信息，并给出最近一周下载量。"
pnpm phase3:context-demo
```

## 一句话复习

```text
阶段 3 学的是：用 LangChain createAgent 把真实工具、结构化输出、middleware、限制和观测组织成一个可继续升级的 agent harness。
```
