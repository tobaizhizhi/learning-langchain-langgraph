# 阶段 1 学习大纲：模型抽象与 Provider 无关设计

版本日期：2026-06-20

阶段目标：从“能调用一个模型”进阶到“能把模型当作可替换的能力层”。完成后，你应该能用统一接口调用多个 provider/model，支持 `invoke`、`stream`、`batch`，并用固定 benchmark 对比模型质量、延迟、成本、结构化稳定性和能力边界。

## 阶段定位

阶段 1 还不是正式做复杂 agent。重点是建立一个非常重要的工程习惯：业务代码不要绑定某一家 provider，也不要把模型名散落在代码里。

这一阶段要练出的能力：

- 用统一 model factory 创建不同 provider 的 chat model。
- 理解 messages、roles、invoke、stream、batch 的基本使用方式。
- 建立模型能力矩阵，而不是凭感觉选模型。
- 用固定 prompt dataset 对模型做可重复比较。
- 把模型选择变成配置和策略，而不是硬编码。
- 为后续 tool calling、RAG、LangGraph 编排打基础。

## 核心心智模型

模型不是“一个 API”，而是一组可以被测量和替换的能力：

- 生成能力：回答质量、推理深度、语言风格、事实稳定性。
- 格式能力：JSON 稳定性、schema 服从度、结构化输出支持。
- 工具能力：是否支持 tool calling，工具参数是否稳定。
- 交互能力：是否支持 stream，流式增量是否好消费。
- 性能能力：首 token 延迟、总延迟、batch 吞吐、失败率。
- 成本能力：输入 token 成本、输出 token 成本、缓存或批处理折扣。
- 上下文能力：context window、长文本保持能力、长输出能力。

阶段 1 的关键不是“找到最强模型”，而是建立一套以后能持续更新的选择方法。

## 学习重点

需要掌握：

- LangChain.js chat model 抽象。
- `initChatModel` 或当前版本推荐的通用模型初始化方式。
- message roles：system、user/human、assistant/ai、tool。
- `invoke`：单次调用。
- `stream`：流式输出。
- `batch`：批量调用与并发限制。
- model config：model、provider、temperature、max tokens、timeout、max concurrency。
- provider integration package：OpenAI、Anthropic、Google、Ollama 或其他 provider。
- capability profile：为每个模型记录能力、限制和已知问题。
- benchmark dataset：用固定任务集合反复对比模型。

## 推荐学习顺序

### 1. LangChain.js 模型接口

学习内容：

- LangChain.js 中 chat model 的统一调用方式。
- provider package 与通用模型接口的关系。
- 为什么同一个业务函数应该只依赖统一 model interface。
- 模型初始化与环境变量的关系。

练习：

- 写一个 `createChatModel(config)`。
- 支持至少两个配置项：`provider`、`model`。
- 支持从 `.env` 读取 key，但不要让业务函数读取环境变量。
- 写一个最小 `invoke` demo：输入一句话，输出模型回答和 latency。

完成标准：

- 业务代码不直接 new 某一个 provider 的具体 class。
- provider/model 可以通过配置切换。
- 模型初始化失败时有清晰错误。

### 2. Messages 与 Prompt 边界

学习内容：

- system message 与 user message 的职责差异。
- prompt template 与普通字符串的取舍。
- 哪些内容属于业务输入，哪些内容属于模型行为约束。
- 如何记录最终发送给模型的 messages，方便调试。

练习：

- 设计一个统一消息结构：`systemPrompt`、`userPrompt`、`metadata`。
- 写 5 个小 prompt：解释概念、改写文本、提取信息、比较方案、生成 checklist。
- 对同一组 prompt 用不同模型跑一遍，观察风格和稳定性差异。

完成标准：

- 不把所有要求都塞进一个超长 user prompt。
- system prompt 有明确边界，不包含一次性业务数据。
- benchmark prompt 可以重复运行。

### 3. Invoke：单次调用与结果归一化

学习内容：

- `invoke` 的输入输出。
- 模型返回 message、text、usage metadata 的差异。
- 如何把 provider 原始响应归一化成内部结果。

练习：

- 定义 `NormalizedModelResult`。
- 记录 `provider`、`model`、`latencyMs`、`inputTokens`、`outputTokens`、`finishReason`。
- 对缺失 token usage 的 provider 做兼容处理。

完成标准：

- 上层代码拿到的是统一结果结构。
- 原始 provider response 可以作为 debug 信息保存，但不污染业务接口。
- 同一次调用能追踪模型、耗时和错误类型。

### 4. Stream：流式输出

学习内容：

- 为什么 stream 能改善用户体验。
- token stream、event stream、agent progress stream 的区别。
- 流式输出中断、取消和错误处理。
- CLI 或 Web UI 如何消费增量内容。

练习：

- 给阶段 0 的 CLI 增加 LangChain model stream。
- 在终端中逐步打印 token。
- 统计首 token 延迟和完整响应延迟。
- 支持用户取消或超时中断。

完成标准：

- stream 与 non-stream 共享同一套模型配置。
- 流式中断不会造成程序假死。
- 日志和正文输出边界清楚。

### 5. Batch：批量调用与基准测试

学习内容：

- `batch` 适合处理互相独立的任务。
- 并发带来的速度、成本、限流风险。
- `maxConcurrency` 的意义。
- benchmark dataset 的基本设计。

练习：

- 准备 20 条固定 prompt。
- 对每个模型批量运行同一组 prompt。
- 记录每条任务的 latency、error、输出长度、格式是否合格。
- 支持 `maxConcurrency` 配置。

完成标准：

- 同一批输入可以重复跑多个模型。
- 并发数可以控制，不会无脑打满 provider。
- 每次 benchmark 都能生成可对比结果。

### 6. 模型能力矩阵

学习内容：

- capability matrix 的字段设计。
- 哪些能力可以从文档得到，哪些必须自己测。
- 为什么“支持某能力”和“稳定支持某能力”不是一回事。

建议字段：

```ts
type ModelCapabilityProfile = {
  provider: string;
  model: string;
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  contextWindow?: number;
  maxOutputTokens?: number;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  averageLatencyMs?: number;
  formatStabilityScore?: number;
  notes?: string[];
};
```

练习：

- 为 3 到 5 个模型建立能力档案。
- 用固定 prompt 测试结构化输出稳定性。
- 记录失败案例，而不是只记录成功样例。

完成标准：

- 模型选择有数据依据。
- 每个模型都有适用任务和不适用任务说明。
- 能解释“快模型”“强推理模型”“格式稳定模型”的不同用途。

### 7. 动态模型选择

学习内容：

- 按任务类型选模型：分类、摘要、生成、推理、结构化提取。
- 按约束选模型：低延迟、低成本、高质量、高格式稳定性。
- fallback 策略：主模型失败后切换备用模型。
- 不要在业务分支里散落模型名。

练习：

- 写一个 `selectModel(task, constraints)`。
- 支持任务类型：`classification`、`summarization`、`reasoning`、`structured-output`。
- 支持约束：`cheap`、`fast`、`quality`、`stable-json`。
- 当模型调用失败时，尝试 fallback 模型并记录原因。

完成标准：

- 模型路由逻辑集中在一个模块。
- 新增模型只改配置和 capability profile。
- fallback 不会吞掉原始错误。

## 阶段项目：Model Capability Lab

项目目标：做一个模型能力实验台，用同一批任务对比多个模型，输出结构化结果和 Markdown 报告。

### MVP 功能

- 从配置读取多个 provider/model。
- 支持 `invoke`、`stream`、`batch` 三种调用方式。
- 支持固定 benchmark dataset。
- 记录 latency、token usage、error type、format pass/fail。
- 输出 JSON 结果文件。
- 生成 Markdown 对比报告。

### 推荐命令形态

```bash
pnpm model:run --suite basic --models openai:gpt-4.1-mini,anthropic:claude-sonnet
pnpm model:run --suite structured --max-concurrency 3 --output runs/2026-06-20.json
pnpm model:report --input runs/2026-06-20.json --output reports/model-capability-report.md
```

### 推荐目录结构

```text
phase1/
  README.md
  model-capability-lab/
    package.json
    tsconfig.json
    src/
      index.ts
      config.ts
      model-factory.ts
      model-router.ts
      benchmark-runner.ts
      report-writer.ts
      schemas.ts
      suites/
        basic.ts
        structured.ts
        reasoning.ts
        long-context.ts
      utils/
        timing.ts
        cost.ts
        errors.ts
    runs/
      .gitkeep
    reports/
      .gitkeep
    tests/
      model-router.test.ts
      benchmark-runner.test.ts
      report-writer.test.ts
```

### Benchmark Suites

#### Basic Suite

目的：测试普通文本任务。

任务示例：

- 用一句话解释一个技术概念。
- 把长段落压缩成 5 条 bullet。
- 改写成更清晰的工程说明。
- 比较两个技术方案的取舍。

记录指标：

- 回答是否完整。
- 是否遵守长度限制。
- latency。
- token usage。

#### Structured Suite

目的：测试格式稳定性。

任务示例：

- 从文本中提取 `{ title, risks, nextActions }`。
- 把用户需求分类成固定 enum。
- 输出一个严格 JSON 数组。

记录指标：

- JSON 是否可解析。
- 是否符合 Zod schema。
- 字段是否缺失。
- 是否出现额外解释文字。

#### Reasoning Suite

目的：测试推理质量。

任务示例：

- 给出一个 Solidity 风险场景，让模型判断可能漏洞。
- 给出多条约束，让模型做方案选择。
- 让模型找出一段流程描述中的矛盾。

记录指标：

- 结论是否正确。
- 推理是否引用输入证据。
- 是否过度猜测。

#### Long Context Suite

目的：测试较长输入下的信息保持能力。

任务示例：

- 给一篇长文档，让模型回答细节问题。
- 给多段需求，让模型提取冲突点。
- 给项目说明，让模型生成模块摘要。

记录指标：

- 是否遗漏关键事实。
- 是否引用不存在的信息。
- 输出是否仍然遵守格式。

## 报告模板

每次 benchmark 输出一份 Markdown 报告，建议包含：

```text
# Model Capability Report

运行时间：
模型列表：
测试套件：
并发设置：

## 总览

| Model | Success Rate | Avg Latency | Format Pass | Input Tokens | Output Tokens | Notes |
| --- | --- | --- | --- | --- | --- | --- |

## 任务表现

按 suite 展示每个模型的优缺点。

## 失败案例

记录至少 5 条失败案例：
- 输入
- 模型输出
- 失败类型
- 可能原因
- 是否可通过 prompt/schema/router 改善

## 选型建议

- 低成本任务推荐：
- 快速响应任务推荐：
- 结构化输出任务推荐：
- 推理任务推荐：
- 不建议使用的场景：
```

## 7 天学习安排

### Day 1：LangChain.js 模型接口

- 安装 LangChain.js 和至少一个 provider integration。
- 写 `createChatModel(config)`。
- 完成最小 `invoke`。

### Day 2：Messages 与结果归一化

- 设计统一 messages 输入。
- 设计 `NormalizedModelResult`。
- 记录 latency、usage、finish reason。

### Day 3：Stream

- 增加 stream 调用。
- 打印 token 增量。
- 统计首 token 延迟和总延迟。

### Day 4：Batch

- 增加 batch runner。
- 支持 benchmark dataset。
- 支持 `maxConcurrency`。

### Day 5：Capability Matrix

- 建立模型能力档案。
- 录入 3 到 5 个模型。
- 标注能力、成本、限制和失败模式。

### Day 6：Model Router 与 Fallback

- 写 `selectModel(task, constraints)`。
- 支持按任务类型选模型。
- 支持 fallback，并保留原错误。

### Day 7：报告与复盘

- 生成 Markdown 对比报告。
- 整理失败案例。
- 写阶段总结：哪些模型适合哪些任务，为什么。

## 阶段完成标准

完成阶段 1 时，应满足：

- [ ] 能用统一 factory 创建不同 provider/model。
- [ ] 能解释 `invoke`、`stream`、`batch` 的区别。
- [ ] 能用同一批 prompt 对多个模型做 benchmark。
- [ ] 能控制 batch 并发，避免触发无意义限流。
- [ ] 能记录 latency、token usage、error type、format pass/fail。
- [ ] 有至少 20 条 benchmark prompt。
- [ ] 有至少 3 个模型的 capability profile。
- [ ] 有一份 Markdown 模型对比报告。
- [ ] 模型名和 provider 不散落在业务代码里。
- [ ] 能说明某个任务为什么选 A 模型而不是 B 模型。

## 常见误区

- 误区 1：只要模型能回答，就说明适合生产使用。
  - 更好的判断：看延迟、失败率、成本、格式稳定性和可回归测试结果。

- 误区 2：benchmark 只跑一次。
  - 更好的判断：固定 dataset，多次运行，观察稳定性。

- 误区 3：把最强模型用于所有任务。
  - 更好的判断：分类、摘要、格式提取可以用便宜快模型；复杂推理再用强模型。

- 误区 4：模型选择写死在业务函数里。
  - 更好的判断：模型选择集中在配置、capability profile 和 router。

- 误区 5：只看平均延迟。
  - 更好的判断：同时看首 token 延迟、P95、失败率和限流情况。

## 进入阶段 2 前的检查清单

- [ ] 你已经有一个可复用的 model factory。
- [ ] 你能稳定运行 `invoke`、`stream`、`batch`。
- [ ] 你知道哪些模型支持 tool calling 和 structured output。
- [ ] 你已经观察过模型在 JSON/schema 任务上的失败方式。
- [ ] 你有能力矩阵，而不是只凭个人感觉选模型。
- [ ] 你可以把阶段 1 的模型层直接接到阶段 2 的 tool calling 项目里。

## 参考资料

- LangChain.js Models: https://docs.langchain.com/oss/javascript/langchain/models
- LangChain.js Providers and Models: https://docs.langchain.com/oss/javascript/concepts/providers-and-models
- LangChain.js Streaming: https://docs.langchain.com/oss/javascript/langchain/streaming
- LangChain.js Structured Output: https://docs.langchain.com/oss/javascript/langchain/structured-output
