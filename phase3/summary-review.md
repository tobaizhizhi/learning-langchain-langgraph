# 阶段 3 总结与复习：Agent Harness 与 Middleware

阶段 3 的核心不是“再手写一遍工具调用”，而是学习如何用 LangChain 的 `createAgent` 把模型、工具、结构化输出、middleware、限制和观测组织成一个可继续升级的 agent skeleton。

一句话记住：

```text
阶段 2 手动管理 tool call；阶段 3 用 createAgent 管理工具循环，并用 middleware 观察和约束 agent。
```

## 最重要的主线

```text
真实 chat model
-> 真实外部 tools
-> createAgent(...)
-> agent.invoke({ messages })
-> agent 自动处理 tool loop
-> responseFormat 输出结构化结果
-> middleware 记录/限制模型和工具调用
-> run report / LangSmith trace 方便排查
```

你真正要记住的是：

- `createAgent` 是 agent 运行框架，不是一个新模型。
- `agent.invoke(...)` 的输入核心仍然是 `messages`。
- 工具仍然是真实 TypeScript 函数，模型只是提出工具调用请求。
- `responseFormat: toolStrategy(schema)` 可以让 agent 最终产出结构化对象。
- middleware 是插入 agent 运行过程的观察点/控制点。
- run report 和 LangSmith 的价值是让 agent 行为可解释、可排查。

## 各 Step 复习

### Step 1：理解 createAgent 解决什么问题

阶段 2 里你手写了：

```text
AIMessage.tool_calls
-> tool.invoke(...)
-> ToolMessage
-> 再次 model.invoke(...)
```

阶段 3 的 `createAgent` 会替你管理这套工具调用循环。

重点记住：

```text
createAgent 不是让模型更聪明，而是帮你管理 agent 运行流程。
```

重点代码：

- `phase2/src/tool-assistant-demo.ts`
- `phase3/src/agent-demo.ts`

### Step 2：跑通最小真实 agent

最小 agent 结构：

```ts
const agent = createAgent({
  model,
  tools,
  systemPrompt,
});
```

重点记住：

```text
model 负责生成；tools 负责外部能力；createAgent 负责组织循环。
```

运行：

```bash
pnpm phase3:agent "请查询 langchain-ai/langchainjs，并总结 @langchain/core 当前 npm 信息"
```

重点代码：

- `phase3/src/agent-demo.ts`
- `phase3/src/agent-tools.ts`

### Step 3：理解 agent 输入输出边界

`agent.invoke(...)` 输入的是：

```ts
{
  messages: [...]
}
```

返回结果里通常有：

```text
messages
structuredResponse
```

重点记住：

```text
agent 的过程不是黑盒，最终可以检查 messages 里每一步发生了什么。
```

运行：

```bash
pnpm phase3:agent-result "请查询 @langchain/core 的 npm 包信息。"
```

重点代码：

- `phase3/src/agent-result-demo.ts`

### Step 4：agent 直接输出结构化结果

当前使用：

```ts
responseFormat: toolStrategy(externalLookupOutputSchema)
```

重点记住：

```text
结构化输出不是让模型随便写 JSON，而是让 agent 最终按 schema 返回对象。
```

运行：

```bash
pnpm phase3:structured-agent "请查询 langchain-ai/langchainjs，并输出结构化结果"
```

重点代码：

- `phase3/src/agent-structured-output.ts`
- `phase2/src/structured-output.ts`

### Step 5：用 middleware 观察 agent 过程

自定义 observation middleware 记录：

```text
agent.start
model call
tool call
agent.end
```

重点记住：

```text
middleware 不负责回答问题；middleware 负责观察、修改或限制 agent 运行过程。
```

重点代码：

- `phase3/src/middleware.ts`
- `phase3/src/run-report.ts`
- `phase3/src/agent-report-demo.ts`

运行：

```bash
pnpm phase3:agent-report "请查询 @langchain/core 的 npm 包信息，并给出最近一周下载量。"
```

### Step 6：工具调用限制和安全边界

最终 agent 使用了 LangChain 内置限制：

```ts
modelCallLimitMiddleware(...)
toolCallLimitMiddleware(...)
```

重点记住：

```text
agent 不能无限调用模型，也不能无限调用工具。
```

重点代码：

- `phase3/src/personal-ops-agent.ts`

### Step 7：短期上下文与消息裁剪

短期上下文管理解决的是：

```text
下一次 agent.invoke 前，这次 messages 里应该带哪些历史？
哪些旧消息可以丢掉？
哪些旧工具结果需要压缩？
```

当前 demo 做两步：

```text
压缩过长 ToolMessage
-> trimMessages 保留 system + 最近消息
```

重点记住：

```text
常用的是“上下文裁剪/摘要”这个思想；当前按字符截断只是教学版兜底方案。
```

运行：

```bash
pnpm phase3:context "请查询 @langchain/core 的 npm 包信息和最近一周下载量。"
```

调小预算观察裁剪：

```bash
CONTEXT_MAX_APPROX_TOKENS=300 pnpm phase3:context "请查询 @langchain/core 的 npm 包信息和最近一周下载量。"
```

重点代码：

- `phase3/src/context-demo.ts`

### Step 8：run report 与 LangSmith

本地 run report 记录：

```text
runId
provider/model
userPrompt
model/tool 调用事件
耗时
错误
最终结果
```

LangSmith 是更完整的可视化 trace。

重点记住：

```text
真实 agent 必须能解释“它为什么这么做、调用了什么、哪里失败”。
```

重点代码：

- `phase3/src/run-report.ts`
- `phase3/src/middleware.ts`
- `phase3/src/agent-report-demo.ts`

### Step 9：Personal Operations Agent 最小版

这是阶段 3 的收束入口：

```text
真实模型
-> 真实工具
-> createAgent
-> 结构化输出
-> 调用限制
-> run report
-> 可选 LangSmith trace
```

运行：

```bash
pnpm phase3:personal-agent "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查询 @langchain/core 最近一周下载量。"
```

重点代码：

- `phase3/src/personal-ops-agent.ts`

## 最该重点看的代码

按重要程度排序：

1. `phase3/src/personal-ops-agent.ts`
2. `phase3/src/agent-demo.ts`
3. `phase3/src/agent-result-demo.ts`
4. `phase3/src/agent-structured-output.ts`
5. `phase3/src/middleware.ts`
6. `phase3/src/run-report.ts`
7. `phase3/src/context-demo.ts`
8. `phase3/src/agent-tools.ts`

## 容易混淆的点

### createAgent 和 model.bindTools 的区别

`model.bindTools(...)`：

```text
把工具 schema 告诉模型，但工具循环你自己写。
```

`createAgent(...)`：

```text
把模型、工具、prompt、middleware 组织成 agent，并自动管理工具循环。
```

### tool call 是谁执行的

模型只提出：

```text
我要调用 get_npm_package，参数是 packageName
```

真正执行外部 API 的仍然是代码里的工具函数。

### 一次 agent.invoke 里为什么会多次调用模型

常见流程：

```text
模型先判断要调用工具
-> 工具返回结果
-> 模型再基于工具结果回答
```

所以一次 `agent.invoke(...)` 内部可能有多次 model call 和多次 tool call。

### 短期上下文不是长期记忆

短期上下文：

```text
这一次调用模型前，带哪些最近消息。
```

长期记忆：

```text
跨会话保存用户偏好、历史事实、长期状态。
```

阶段 3 只学短期上下文控制，不做数据库记忆。

### LangSmith 和 run report 的关系

本地 run report：

```text
轻量、可控、离线也能看。
```

LangSmith：

```text
可视化 trace，更适合复杂调试和展示。
```

两者不是互斥关系。

## 阶段 3 完成后你应该会解释

- `createAgent` 相比阶段 2 手写工具循环省了什么。
- agent 的输入输出结构是什么。
- 为什么一次 agent 调用里会出现多次模型/工具调用。
- middleware 的 `wrapModelCall` 和 `wrapToolCall` 是怎么接入的。
- run report 为什么能记录模型和工具调用。
- 为什么要限制模型/工具调用次数。
- 为什么多轮 agent 需要短期上下文裁剪。
- 为什么最终作品集需要结构化输出和可观测 trace。

## 最小复习命令

```bash
pnpm phase3:agent "请查询 langchain-ai/langchainjs，并总结 @langchain/core 当前 npm 信息"
pnpm phase3:agent-result "请查询 @langchain/core 的 npm 包信息。"
pnpm phase3:structured-agent "请查询 langchain-ai/langchainjs，并输出结构化结果"
pnpm phase3:agent-report "请查询 @langchain/core 的 npm 包信息，并给出最近一周下载量。"
pnpm phase3:context "请查询 @langchain/core 的 npm 包信息和最近一周下载量。"
pnpm phase3:personal-agent "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查询 @langchain/core 最近一周下载量。"
```

## 一句话复习

```text
阶段 3 学的是：用 createAgent 把真实工具、结构化输出、middleware、限制和观测组装成一个可继续升级的 agent harness。
```
