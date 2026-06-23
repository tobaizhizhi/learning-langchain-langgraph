# 阶段 1 学习大纲：LangChain.js 模型接口基础

版本日期：2026-06-22

阶段目标：从“能调用一个模型”进阶到“能用统一方式创建、调用、观察 chat model”。完成后，你应该能通过配置创建模型，传入清晰 messages，调用 `invoke`，拿到归一化结果，并理解流式输出为什么重要。

## 价值分级

必须学：

- LangChain.js chat model 基本调用方式。
- `ModelConfig` 和 `createChatModel(config)`。
- `model.invoke([...messages])`。
- `system` / `user` message 的职责差异。
- `AIMessage`、`response.text`、基础 metadata。
- 单次调用的 latency 和错误日志。

值得学：

- `mock` provider，用于离线测试。
- OpenAI-compatible 中转的 `baseUrl` 配置。
- 可命名 system prompt，例如 `study`、`solidity-security`。
- `stream` 的基本概念和最小调用。

知道即可：

- token usage 和 finish reason 可能因 provider 不同而缺失。
- 固定 prompt dataset 是未来评测内容，Phase 1 不写代码实现。

暂缓：

- 高阶模型评测。
- 批量运行。
- 模型路由。
- 成本估算。
- LangSmith evaluation。

## 阶段定位

阶段 1 不是做复杂 agent，也不是做模型评测平台。

这一阶段只练一条主线：

```text
配置 -> 创建模型 -> 组织 messages -> invoke -> 归一化结果 -> 记录日志
```

阶段 1 的关键不是“选出最强模型”，而是建立一个可靠的模型调用层，为后面的 tools、structured output、RAG 和 LangGraph 打基础。

## 推荐学习顺序

### 1. LangChain.js 模型接口

详细学习过程见：`phase1/01-langchain-model-interface-learning-process.md`

总结与复习见：`phase1/01-summary-review.md`

学习内容：

- Chat model 是什么。
- Provider 和 model 的区别。
- `ModelConfig` 的作用。
- `createChatModel(config)` 的作用。
- OpenAI-compatible 中转如何通过 `baseUrl` 配置。

练习：

- 写 `ModelConfig`。
- 写 `loadModelConfigFromEnv()`。
- 写 `createChatModel(config)`。
- 支持 `mock` 和 `openai`。
- 跑通最小 `invoke` demo。

完成标准：

- 业务代码不直接 `new ChatOpenAI()`。
- 模型名和 provider 来自配置。
- mock provider 可以离线跑通。
- 中转配置不污染业务代码。

### 2. Messages 与 Prompt 边界

详细学习过程见：`phase1/02-messages-prompt-boundary-learning-process.md`

总结与复习见：`phase1/02-summary-review.md`

学习内容：

- `model.invoke([...messages])` 的 messages 输入。
- `system` 是长期规则。
- `user` 是本次任务。
- 如何手写清楚的 user prompt。

练习：

- 用同一个 user prompt 切换 `study` 和 `solidity-security` system prompt。
- 手写 3 个 user prompt：
  - 解释 LangChain.js invoke。
  - 解释 Solidity reentrancy。
  - 比较 `new ChatOpenAI()` 和 `createChatModel(config)`。

完成标准：

- 能解释 system prompt 和 user prompt 的区别。
- 不把一次性业务输入塞进 system prompt。
- 能用日志回看实际发送的 user prompt。

### 3. Invoke：单次调用与结果归一化

详细学习过程见：`phase1/03-invoke-normalized-result-learning-process.md`

总结与复习见：`phase1/03-summary-review.md`

学习内容：

- `invoke` 返回的是 `AIMessage`，不是普通字符串。
- 正文通常从 `response.text` 取。
- `usage_metadata` 和 `response_metadata` 可能存在，也可能缺失。
- 如何把一次调用整理成稳定的内部结果。

练习：

- 扩展 `RunSinglePromptResult`。
- 记录 `provider`、`model`、`latencyMs`、`runId`。
- 兼容可选的 `inputTokens`、`outputTokens`、`finishReason`。
- 保留 `raw` 用于 debug，但业务层优先读归一化字段。

完成标准：

- 上层代码拿到统一结果结构。
- mock provider 缺失 usage 时不报错。
- 真实 provider 返回 usage 时可以记录。
- 错误调用也有日志摘要。

### 4. Stream：流式输出

详细学习过程见：`phase1/04-stream-learning-process.md`

总结与复习见：`phase1/04-summary-review.md`

学习内容：

- stream 为什么能改善用户体验。
- 一次性 `invoke` 和流式输出的区别。
- CLI 如何消费增量文本。
- 流式中断和错误处理的最小思路。

练习：

- 给当前模型层增加最小 stream demo。
- 在终端逐步打印增量文本。
- 记录首 token 延迟和完整响应延迟。

完成标准：

- stream 与 non-stream 共享同一套 `ModelConfig`。
- 流式输出和日志输出边界清楚。
- 出错时程序不会假死。

## 当前阶段项目：Model Interface Lab

项目目标：做一个轻量模型调用实验台，不做高阶模型评测，只验证模型调用层是否可靠。

MVP 功能：

- 从环境变量读取模型配置。
- 支持 `mock` provider。
- 支持 `openai` provider。
- 支持 OpenAI-compatible 中转。
- 支持 `invoke`。
- 支持最小 stream demo。
- 记录调用日志。
- 提供 README 和复习文档。

推荐命令：

```bash
pnpm phase1:invoke "请解释 LangChain.js 的 invoke"
pnpm phase1:stream "请解释 LangChain.js 的 stream"
pnpm phase1:logs
pnpm test
pnpm typecheck
```

## 当前文件结构

```text
phase1/
  README.md
  01-langchain-model-interface-learning-process.md
  01-summary-review.md
  02-messages-prompt-boundary-learning-process.md
  02-summary-review.md
  03-invoke-normalized-result-learning-process.md
  03-summary-review.md
  04-stream-learning-process.md
  04-summary-review.md
  .env.example
  src/
    model-config.ts
    chat-model-factory.ts
    run-single-prompt.ts
    invoke-demo.ts
    stream-demo.ts
    model-run-log.ts
    show-recent-logs.ts
    system-prompts.ts
  tests/
    model-config.test.ts
    chat-model-factory.test.ts
    run-single-prompt.test.ts
    stream-demo.test.ts
    model-run-log.test.ts
    system-prompts.test.ts
```

## 7 天学习安排

### Day 1：模型配置

- 理解 provider/model。
- 实现 `ModelConfig`。
- 实现 `loadModelConfigFromEnv()`。

### Day 2：模型工厂

- 实现 `createChatModel(config)`。
- 支持 `mock`。
- 支持 `openai`。

### Day 3：最小 invoke

- 实现 `runSinglePrompt()`。
- 跑通 `pnpm phase1:invoke`。

### Day 4：messages 边界

- 理解 `system` / `user`。
- 切换 `SYSTEM_PROMPT_NAME` 观察输出变化。

### Day 5：结果归一化

- 理解 `AIMessage`。
- 补齐可选 usage metadata。
- 保留 `raw` debug。

### Day 6：日志与排错

- 查看 `pnpm phase1:logs`。
- 故意制造配置错误。
- 确认错误日志不包含 API key。

### Day 7：stream 入门

- 阅读 LangChain.js streaming 文档。
- 做最小 stream demo。
- 记录和 invoke 的区别。

## 阶段完成标准

完成阶段 1 时，应满足：

- [ ] 能解释 Chat Model 是什么。
- [ ] 能解释 provider 和 model 的区别。
- [ ] 能从 `.env` 加载 `ModelConfig`。
- [ ] 能通过 `createChatModel(config)` 创建模型。
- [ ] 能用 messages 调用 `model.invoke()`。
- [ ] 能解释 system/user 的职责差异。
- [ ] 能拿到 `AIMessage` 的正文。
- [ ] 能记录 provider、model、latency、runId。
- [ ] 能查看最近调用日志。
- [ ] 能跑一个最小 stream demo。
- [ ] 模型调用层可以直接接到阶段 2 的 tools/structured output 学习里。

## 常见误区

- 误区 1：一开始就做高阶模型评测。
  - 更好的判断：先把单次调用、messages、结果结构练稳。

- 误区 2：把 prompt 抽成很多 builder。
  - 更好的判断：先手写清楚的 system/user prompt。

- 误区 3：过早写模型选择器。
  - 更好的判断：没有真实评估数据前，不写 `selectModel()`。

- 误区 4：把 provider 原始响应直接暴露给业务层。
  - 更好的判断：业务层读归一化字段，`raw` 只用于 debug。

- 误区 5：只看模型回答，不看调用过程。
  - 更好的判断：至少记录 provider、model、latency、错误摘要。

## 进入阶段 2 前的检查清单

- [ ] 你有一个可复用的 model factory。
- [ ] 你能稳定运行 `invoke`。
- [ ] 你能解释 messages 的 role。
- [ ] 你知道 `AIMessage` 和普通字符串的区别。
- [ ] 你知道如何配置中转。
- [ ] 你知道如何用 mock provider 离线测试。
- [ ] 你知道 stream 和 invoke 的区别。

## 参考资料

- LangChain.js Models: https://docs.langchain.com/oss/javascript/langchain/models
- LangChain.js Providers and Models: https://docs.langchain.com/oss/javascript/concepts/providers-and-models
- LangChain.js Streaming: https://docs.langchain.com/oss/javascript/langchain/streaming
