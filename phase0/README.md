# 阶段 0 学习大纲：AI Agent 工程预备能力

版本日期：2026-06-20

阶段目标：在正式学习 LangChain.js、LangGraph.js 之前，先补齐 TypeScript、Node.js、异步编程、HTTP 调用、配置管理和测试基础。完成后，你应该能独立写出一个可配置模型、可记录调用日志、可处理错误的 AI 调用 CLI。

## 学习重点

阶段 0 不追求复杂 agent，而是把底层工程能力练稳。后面如果模型调用失败、流式输出中断、工具参数解析失败、测试不稳定，你能判断问题来自业务逻辑、模型 provider、网络、schema 还是异步控制。

需要重点掌握：

- TypeScript 类型系统：泛型、联合类型、类型收窄、可辨识联合、`unknown`、`never`。
- Zod：输入校验、环境变量校验、结构化数据解析、错误提示。
- Node.js 异步：`Promise`、`async/await`、`AbortController`、超时、重试、并发控制。
- Node.js stream 基础：Readable stream、async iterator、流式文本消费。
- HTTP/API 调用：请求封装、状态码处理、错误分类、速率限制意识。
- 配置管理：`.env`、环境变量、provider/model 配置、密钥不入库。
- 测试基础：单元测试、集成测试、mock 外部 API、失败路径测试。
- 日志与可观测性：调用耗时、token usage、错误类型、请求 ID、成本估算。

## 推荐学习顺序

### 1. TypeScript 工程基础

学习内容：

- `tsconfig`、strict mode、ESM/CommonJS 基本差异。
- interface、type、generic、union、literal type。
- 类型收窄：`typeof`、`in`、自定义 type guard。
- 错误建模：用 discriminated union 表达成功和失败结果。

练习：

- 定义 `ModelProvider`、`ModelConfig`、`ModelCallResult` 类型。
- 写一个 `Result<T, E>` 风格的返回类型，避免到处抛裸错误。
- 把外部 API 返回的 `unknown` 数据转换成内部可信类型。

完成标准：

- 项目开启 TypeScript strict mode。
- 业务函数参数和返回值有明确类型。
- 不用 `any` 逃避核心数据结构建模。

### 2. Zod 与配置校验

学习内容：

- `z.object`、`z.enum`、`z.union`、`z.array`、`safeParse`。
- 用 Zod 校验 `.env` 和 CLI 参数。
- 把 provider/model/temperature/maxTokens/timeout 变成配置。

练习：

- 创建环境变量 schema，例如 `OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`DEFAULT_MODEL`。
- 创建 CLI 参数 schema，例如 `--provider`、`--model`、`--timeout`、`--stream`。
- 对错误配置输出清晰提示。

完成标准：

- 缺少密钥时程序能给出明确错误。
- 模型名、provider、超时、重试次数不写死在业务逻辑里。
- 配置解析失败不会进入模型调用阶段。

### 3. Node.js 异步、超时与重试

学习内容：

- `Promise`、`async/await`、错误传播。
- `AbortController` 与超时取消。
- 指数退避、最大重试次数、可重试错误与不可重试错误。
- 并发控制：什么时候串行，什么时候并行，什么时候限流。

练习：

- 封装 `withTimeout(fn, ms)`。
- 封装 `retry(fn, options)`，只重试网络错误、429、5xx。
- 给模型调用加超时和取消。

完成标准：

- 模型调用卡住时能按超时退出。
- 401/403 这类认证错误不会反复重试。
- 429/5xx 这类临时错误有有限重试。

### 4. HTTP 调用与 provider 抽象

学习内容：

- `fetch` 请求、headers、JSON body、错误状态码。
- 不同 provider 的请求和响应差异。
- 统一内部接口：业务代码只关心 `callModel(prompt, config)`。

练习：

- 写一个 `ModelClient` 接口。
- 实现至少两个 provider wrapper，或者一个真实 provider 加一个 mock provider。
- 统一返回 `text`、`usage`、`latencyMs`、`rawProvider`、`rawModel`。

完成标准：

- 切换 provider 不需要改业务主流程。
- provider 原始响应不直接泄漏到上层业务。
- API 错误能被分类成认证、限流、网络、服务端、解析失败。

### 5. Stream 与 CLI 输出

学习内容：

- Readable stream 与 async iterator。
- 流式输出和非流式输出的差异。
- CLI 中的 stdout/stderr 分工。

练习：

- 支持普通调用：一次性输出完整回答。
- 支持流式调用：边生成边打印。
- 流式结束后仍然输出调用摘要，例如耗时和 token usage。

完成标准：

- 流式输出中断时能给出错误信息。
- 日志不会污染模型正文输出。
- 用户能通过参数选择 stream 或 non-stream。

### 6. 测试基础

学习内容：

- Vitest 基础：`describe`、`it`、`expect`、fixtures。
- Mock 外部 API，避免测试依赖真实模型调用。
- 测试错误路径和边界条件。

练习：

- 测试配置校验。
- 测试错误分类。
- 测试 timeout 和 retry。
- 测试 mock provider 的正常响应。

完成标准：

- 核心纯函数有单元测试。
- provider wrapper 至少有 mock 集成测试。
- 测试不会消耗真实 API key。

## 阶段项目：AI 调用 CLI

项目目标：做一个命令行模型调用器，用来验证你已经掌握阶段 0 的工程基础。

建议命令形态：

```bash
pnpm ai:ask --provider openai --model gpt-4.1-mini --prompt "解释 reentrancy" --timeout 30000
pnpm ai:ask --provider mock --model local-mock --prompt "hello" --stream
```

核心功能：

- 从 CLI 接收 prompt、provider、model、temperature、timeout、是否 stream。
- 从环境变量读取 API key。
- 调用模型并输出回答。
- 记录调用日志：provider、model、latency、token usage、cost estimate、error type。
- 支持超时、有限重试、错误分类。
- 支持 mock provider，方便测试。

推荐目录结构：

```text
phase0/
  README.md
  ai-call-cli/
    package.json
    tsconfig.json
    src/
      index.ts
      config.ts
      cli.ts
      model-client.ts
      providers/
        mock.ts
        openai.ts
      utils/
        retry.ts
        timeout.ts
        errors.ts
    tests/
      config.test.ts
      retry.test.ts
      model-client.test.ts
```

## 每日练习安排

### Day 1：TypeScript 与项目初始化

- 初始化 pnpm + TypeScript。
- 开启 strict mode。
- 定义核心类型。
- 写 3 到 5 个类型建模小练习。

### Day 2：Zod 配置与 CLI 参数

- 增加 `.env` 配置解析。
- 增加 CLI 参数解析。
- 对缺失 key、非法 model、非法 timeout 写测试。

### Day 3：HTTP Client 与错误分类

- 封装基础 fetch 调用。
- 定义 `ModelCallError`。
- 实现认证错误、限流错误、服务端错误、解析错误分类。

### Day 4：超时、重试与 mock provider

- 实现 `withTimeout`。
- 实现 `retry`。
- 添加 mock provider。
- 写 timeout/retry 的单元测试。

### Day 5：真实 provider 调用

- 接入一个真实模型 provider。
- 统一返回结果结构。
- 输出 latency 和 token usage。

### Day 6：Stream 输出

- 增加 `--stream`。
- 处理流式中断和最终摘要。
- 保持 stdout 输出正文，stderr 输出日志。

### Day 7：整理文档与复盘

- 写 README：安装、配置、运行、测试、常见错误。
- 整理 5 条失败案例复盘。
- 输出一份阶段 0 学习总结。

## 阶段完成标准

完成阶段 0 时，应满足：

- 能用 TypeScript strict mode 写小型 Node.js CLI。
- 能通过 Zod 校验环境变量和输入参数。
- 能封装 provider 无关的模型调用接口。
- 能处理 timeout、retry、错误分类和日志。
- 能写不依赖真实 API 的自动化测试。
- 能解释流式输出、普通输出、HTTP 错误、配置错误之间的差异。
- 密钥不会出现在代码、日志或提交内容里。

## 进入阶段 1 前的检查清单

- [ ] CLI 可以正常运行 mock provider。
- [ ] 至少一个真实 provider 可以调用成功。
- [ ] 所有核心配置都从环境变量或 CLI 参数读取。
- [ ] 缺少 API key 时有清晰错误提示。
- [ ] 超时、重试、错误分类都有测试。
- [ ] 每次调用都有结构化日志。
- [ ] README 能让别人从零跑起来。
- [ ] 你能用自己的话解释为什么业务代码不能绑定某一个模型 provider。
