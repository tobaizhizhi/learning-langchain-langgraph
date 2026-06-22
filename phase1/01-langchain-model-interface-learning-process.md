# 阶段 1 第一部分：LangChain.js 模型接口学习内容与过程

版本日期：2026-06-20

对应大纲章节：`phase1/README.md` 中的 `1. LangChain.js 模型接口`

本节目标：理解 LangChain.js 的 chat model 抽象，并写出第一版 `createChatModel(config)`。完成后，你应该能通过同一套业务代码切换不同 provider/model，而不是在业务逻辑里直接依赖某个 provider 的具体类。

## 本节学习结果

学完这一节，你要产出：

- 一个最小 TypeScript 项目或在阶段 0 CLI 基础上新增模型层。
- 一个 `ModelConfig` 类型。
- 一个 `createChatModel(config)` 工厂函数。
- 一个 `invoke` demo：输入 prompt，输出模型回答、provider、model、latency。
- 一份学习记录：本次用了什么 provider、什么模型、遇到什么错误、如何修复。

本节先不追求 stream、batch、tool calling、structured output。那些是后续章节。这里要先把“模型是可替换组件”这件事练稳。

## 前置准备

你需要已经具备：

- TypeScript strict mode 基础。
- Node.js 与 pnpm 基础。
- `.env` 环境变量管理。
- 基本 async/await。
- 基本错误处理。

建议准备：

```bash
pnpm add langchain @langchain/core
```

如果你要接真实 provider，再按需安装对应集成包。例如：

```bash
pnpm add @langchain/openai
pnpm add @langchain/anthropic
pnpm add @langchain/google-genai
```

实际安装哪些包，取决于你手上有什么 API key。没有真实 key 时，也可以先只设计接口和 mock 调用流程。

## 核心概念

### 1. Chat Model 是什么

LangChain.js 里的 chat model 接收一组 messages，返回一个 assistant message。它不是简单的字符串补全接口，而是面向对话结构的模型接口。

你可以把它理解成：

```text
messages -> chat model -> AIMessage
```

messages 通常包括：

- `system`：定义模型行为、角色、约束。
- `user`：用户输入或业务任务。
- `assistant`：历史 assistant 回复。
- `tool`：工具调用结果，后面阶段再学。

第一节只需要掌握 `system` 和 `user`。

### 2. Provider 与 Model 的区别

Provider 是提供模型服务的平台，例如 OpenAI、Anthropic、Google、AWS Bedrock、本地 Ollama 等。

Model 是 provider 下面具体的模型名称。

不要把两者混在一起。课程里建议一直显式保存：

```ts
type ModelConfig = {
  provider: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  maxRetries?: number;
};
```

这样后面做 benchmark、fallback、动态路由时，才能清楚知道每一次调用到底用的是谁。

### 3. Model Factory 的价值

不要在业务函数里这样写：

```ts
const model = new ChatOpenAI({ model: "..." });
```

业务函数不应该知道“现在用的是 OpenAI 还是 Anthropic”。更推荐：

```ts
const model = await createChatModel(config);
const response = await model.invoke(messages);
```

这样后续切模型、加 provider、做 fallback，都不会到处改业务逻辑。

## 推荐学习流程

### Step 1：阅读官方模型接口文档

这一步是在先搞清楚 LangChain.js 对“聊天模型”的统一叫法和用法。先读文档不是为了背 API，而是为了知道后面代码里的 `ChatOpenAI`、`invoke`、`AIMessage`、`temperature` 这些词分别代表什么，避免一上来就靠猜写代码。

先读官方文档时，不要试图一次读完全部内容。第一轮只抓 4 个问题：

- LangChain.js 如何初始化 chat model？
- `invoke` 的输入可以是什么？
- chat model 返回的是什么？
- 标准参数有哪些，例如 `model`、`temperature`、`maxTokens`、`timeout`、`maxRetries`？

阅读时重点标记：

- `initChatModel`。
- provider-specific class，例如 `ChatOpenAI`、`ChatAnthropic`。
- message roles。
- `invoke`。

学习记录模板：

```md
## 官方文档笔记

- 我选择的 provider：
- 我安装的包：
- 初始化模型的方式：
- invoke 输入格式：
- invoke 返回值里我能拿到的信息：
- 暂时不理解的问题：
```

### Step 2：确定本节使用的最小 provider 集合

这一步是在决定“先接哪些模型服务”。不要一开始就同时接 OpenAI、Anthropic、Google 和一堆中转，那样很容易把学习重点从 LangChain 模型接口变成 provider 参数排错。第一版只需要一个真实 provider 加一个 mock，就能练清楚模型创建、调用和测试流程。

建议一开始只选 1 个真实 provider 加 1 个 mock provider。

推荐组合：

```text
真实 provider：你已有 API key 的 provider
mock provider：本地固定返回，用于测试和离线开发
```

如果你没有任何真实 API key，也没关系。本节仍然可以先完成：

- `ModelConfig`
- `createChatModel`
- `MockChatModel`
- 调用结果归一化

等之后有 key 再接真实 provider。

### Step 3：设计模型配置

这一步是在设计项目自己的模型配置格式。它的作用是把 provider、model、temperature、timeout 这些选择集中管理起来，后面业务代码只接收一个 `ModelConfig`，不用到处散落模型名和参数。这样以后换模型、接中转、做 benchmark 或 fallback 时，不需要翻遍全项目改硬编码。

先定义课程内统一配置，不要照搬某个 provider 的所有参数。

建议第一版：

```ts
export type ProviderName = "openai" | "anthropic" | "google" | "mock";

export type ModelConfig = {
  provider: ProviderName;
  model: string;
  temperature: number;
  maxTokens?: number;
  baseUrl?: string;
  timeoutMs: number;
  maxRetries: number;
};
```

注意：

- `provider` 用 enum/union 限制，避免拼写错误。
- `model` 保留 string，因为模型名称更新很快。
- `baseUrl` 保留为可选字段，用来支持 OpenAI-compatible 中转或私有网关；不用中转时不填。
- `timeoutMs` 使用毫秒，和多数 JavaScript 生态习惯一致。
- `temperature` 第一阶段建议默认 `0` 或较低值，方便比较输出稳定性。

关于中转：

- 第一版不要新增 `provider: "proxy"`，否则 provider 的含义会变乱。
- 把 `provider` 理解成协议/SDK 类型，例如大部分中转是 OpenAI-compatible，就仍然写 `provider: "openai"`。
- 把中转地址放进 `baseUrl`，例如 `https://your-proxy.example.com/v1`。
- Anthropic-compatible 或 Google-compatible 中转可以后续再按各自 SDK 能力接入，第一版先重点支持 OpenAI-compatible。

练习：

- 写一个默认配置 `defaultModelConfig`。
- 写一个 `loadModelConfigFromEnv()`。
- 写一个 `parseModelId(input)`，支持把 `openai:gpt-x` 拆成 provider/model。

验收：

- provider 拼错时能立刻报错。
- 缺少 model 时能立刻报错。
- 配置模块不直接调用模型。

本仓库实现：

- 配置模块：`phase1/src/model-config.ts`
- 验收测试：`phase1/tests/model-config.test.ts`
- 默认配置：`defaultModelConfig`
- 从环境变量读取：`loadModelConfigFromEnv()`
- 解析模型 ID：`parseModelId(input)`

支持的环境变量：

- `MODEL_ID`：推荐写法，例如 `openai:gpt-4o-mini`
- `MODEL_PROVIDER` + `MODEL_NAME`：拆开写 provider 和 model
- `MODEL_TEMPERATURE`
- `MODEL_MAX_TOKENS`
- `MODEL_BASE_URL`：可选，中转地址，例如 OpenAI-compatible endpoint
- `MODEL_TIMEOUT_MS`
- `MODEL_MAX_RETRIES`

### Step 4：实现第一版 createChatModel

这一步是在把“配置”变成“真正可调用的聊天模型实例”。简单说，Step 3 只是准备配置，Step 4 才根据配置决定创建 `MockChatModel`、`ChatOpenAI`，还是以后其他 provider 的模型。这样业务层只需要调用 `createChatModel(config)`，不用知道底层具体 new 了哪个 SDK class。

第一版目标：根据 `ModelConfig` 返回一个 LangChain chat model 实例。

伪代码结构：

```ts
import { initChatModel } from "langchain/chat_models/universal";

export async function createChatModel(config: ModelConfig) {
  if (config.provider === "mock") {
    return createMockChatModel(config);
  }

  return initChatModel(`${config.provider}:${config.model}`, {
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries,
  });
}
```

注意：不同 LangChain.js 版本可能会展示不同 import 路径。以你本机安装版本和官方文档为准。如果 `langchain/chat_models/universal` 不可用，就查当前版本的 `initChatModel` 导出位置，再固定到项目 README 里。

如果要支持 OpenAI-compatible 中转，第一版可以在 factory 内部对 `openai` 单独使用 `ChatOpenAI`：

```ts
import { ChatOpenAI } from "@langchain/openai";

if (config.provider === "openai") {
  return new ChatOpenAI({
    model: config.model,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeout: config.timeoutMs,
    maxRetries: config.maxRetries,
    configuration: config.baseUrl
      ? { baseURL: config.baseUrl }
      : undefined,
  });
}
```

这样中转配置仍然走同一套 `ModelConfig`：

```env
MODEL_ID=openai:gpt-4o-mini
MODEL_BASE_URL=https://your-proxy.example.com/v1
OPENAI_API_KEY=your-proxy-key
```

这里的重点是：`baseUrl` 只是请求地址，不改变业务层对模型的抽象。业务代码仍然只接收 `createChatModel(config)` 返回的 chat model。

练习：

- 实现 `provider === "mock"` 分支。
- 实现一个真实 provider 分支。
- 写一个简单 demo 调用 `createChatModel(config)`。

验收：

- 业务 demo 不 import `ChatOpenAI` 或其他具体 provider 类。
- 新增 provider 时主要修改 factory，不修改业务 demo。
- 初始化失败能看到 provider/model 信息。

本仓库实现：

- 工厂模块：`phase1/src/chat-model-factory.ts`
- 验收测试：`phase1/tests/chat-model-factory.test.ts`
- 当前已支持：`mock`、`openai`
- 当前暂未支持：`anthropic`、`google`，会给出明确错误，等安装对应 provider package 后再接入
- OpenAI-compatible 中转通过 `ModelConfig.baseUrl` / `MODEL_BASE_URL` 传入

### Step 5：编写最小 invoke demo

这一步是在验证模型真的能被调用。前面只是定义配置和创建模型对象，这里开始用 `invoke` 发送一次真实任务，并记录回答和耗时。它的目的不是做复杂 agent，而是证明从 `ModelConfig -> createChatModel -> invoke -> response` 这条最小链路已经跑通。

先用最朴素的任务：

```text
请用三句话解释 Solidity 里的 reentrancy。
```

demo 的输出不要只打印模型正文，也要打印调用元数据：

```text
Provider: openai
Model: <model-name>
Latency: 1234ms

Answer:
...
```

建议函数边界：

```ts
export async function runSinglePrompt(input: {
  config: ModelConfig;
  systemPrompt: string;
  userPrompt: string;
}) {
  const model = await createChatModel(input.config);
  const startedAt = Date.now();

  const response = await model.invoke([
    { role: "system", content: input.systemPrompt },
    { role: "user", content: input.userPrompt },
  ]);

  return {
    provider: input.config.provider,
    model: input.config.model,
    latencyMs: Date.now() - startedAt,
    text: response.text,
    raw: response,
  };
}
```

练习：

- 换 3 个 prompt 调用同一个模型。
- 换 2 个模型调用同一个 prompt。
- 观察输出风格、长度、是否遵守 system prompt。

验收：

- 同一个 `runSinglePrompt` 可以调用不同 provider/model。
- 结果包含 latency。
- 出错时能知道是配置错误、认证错误、网络错误还是模型返回异常。

本仓库实现：

- 调用函数：`phase1/src/run-single-prompt.ts`
- 命令行 demo：`phase1/src/invoke-demo.ts`
- 验收测试：`phase1/tests/run-single-prompt.test.ts`
- 示例环境变量：`phase1/.env.example`
- 运行命令：`pnpm phase1:invoke`

默认不配置任何环境变量时，会使用 `mock:mock-chat`，不会调用真实模型，也不需要 API key。

如果要调用 OpenAI 官方 API：

```env
MODEL_ID=openai:gpt-4o-mini
OPENAI_API_KEY=sk-...
```

如果要调用 OpenAI-compatible 中转：

```env
MODEL_ID=openai:gpt-4o-mini
MODEL_BASE_URL=https://your-proxy.example.com/v1
OPENAI_API_KEY=your-proxy-key
```

可选配置：

```env
MODEL_TEMPERATURE=0
MODEL_MAX_TOKENS=1000
MODEL_TIMEOUT_MS=30000
MODEL_MAX_RETRIES=2
SYSTEM_PROMPT=你是一个严谨的 AI 工程学习助手。
USER_PROMPT=请用三句话解释 Solidity 里的 reentrancy。
```

`invoke-demo.ts` 会读取根目录 `.env`，也会读取 `phase1/.env`。同名变量优先使用根目录 `.env`。

### Step 6：明确 system prompt 与 user prompt 的边界

这一步是在学习 prompt 的分工。`system prompt` 负责长期规则和模型行为边界，`user prompt` 负责本次具体任务。把这两者分清楚，后面做可复用 prompt、benchmark、LangGraph 节点和审计报告生成时，才不会把一次性输入和长期约束混在一起。

第一版 system prompt 不要写太复杂。建议这样：

```text
你是一个严谨的 AI 工程学习助手。回答要清晰、准确、简洁。遇到不确定的信息要说明不确定，不要编造。
```

user prompt 放具体任务：

```text
请用三句话解释 Solidity 里的 reentrancy，并给一个最小例子。
```

不要把具体业务输入塞进 system prompt。system prompt 是长期行为约束，user prompt 是本次任务。

练习：

- 用同一个 user prompt，分别测试两个 system prompt。
- 用同一个 system prompt，分别测试三个 user prompt。
- 记录输出变化。

验收：

- 你能解释为什么 system prompt 不应该包含一次性业务数据。
- 你能把 prompt 拆成稳定约束和本次输入。

### Step 7：记录调用结果

这一步是在建立最小可观测性。模型调用失败或输出变差时，只看最终回答通常不够，你还需要知道用了哪个 provider/model、耗时多久、是否失败、失败类型是什么。先记录最基础的运行日志，后面接 LangSmith、benchmark 和作品集报告时会自然升级。

每一次模型调用至少记录：

```ts
type ModelRunLog = {
  runId: string;
  provider: string;
  model: string;
  startedAt: string;
  latencyMs: number;
  ok: boolean;
  errorType?: string;
  inputPreview: string;
  outputPreview?: string;
};
```

第一阶段可以先写到 JSONL 文件，也可以只打印到 stderr。关键是从一开始就养成记录习惯。

练习：

- 每次调用生成一个 `runId`。
- 成功时记录输出前 200 字。
- 失败时记录错误类型和错误消息摘要。

验收：

- 你能回看最近 5 次模型调用。
- 日志里没有 API key。
- 日志能帮助你定位 provider/model/latency/error。

本仓库实现：

- 日志模块：`phase1/src/model-run-log.ts`
- 调用时写日志：`phase1/src/run-single-prompt.ts`
- 查看最近 5 次调用：`phase1/src/show-recent-logs.ts`
- 验收测试：`phase1/tests/model-run-log.test.ts`
- 默认日志文件：`phase1/runs/model-runs.jsonl`
- 运行调用并写日志：`pnpm phase1:invoke`
- 查看最近调用日志：`pnpm phase1:logs`

默认日志只记录：

- `runId`
- `provider`
- `model`
- `startedAt`
- `latencyMs`
- `ok`
- `errorType` / `errorMessage`
- `inputPreview`
- `outputPreview`

日志不会记录 API key，也不会记录完整 `ModelConfig`。`inputPreview` 和 `outputPreview` 默认只保留前 200 字。

如果临时不想写日志，可以在环境变量里设置：

```env
MODEL_RUN_LOG_PATH=off
```

## 本节练习清单

### 练习 A：最小模型调用

输入：

```text
解释什么是 LangChain.js chat model。
```

要求：

- 使用 `createChatModel(config)` 创建模型。
- 使用 `invoke` 调用。
- 输出模型正文和 latency。

完成标准：

- 不在 demo 里直接 new provider class。
- 模型名来自配置。

### 练习 B：同一业务代码切换模型

输入：

```text
请把“模型抽象与 provider 无关设计”解释给初学者。
```

要求：

- 同一段 `runSinglePrompt` 代码跑两个模型配置。
- 输出两次结果。
- 手写比较：哪个更清晰，哪个更啰嗦，哪个更快。

完成标准：

- 切换模型只改配置。
- 比较结果写入学习记录。

### 练习 C：初始化失败排查

故意制造 3 个错误：

- provider 拼错。
- model 为空。
- API key 缺失。

要求：

- 每个错误都要有清晰错误消息。
- 错误消息包含 provider/model，但不包含密钥。

完成标准：

- 你能快速判断错误发生在配置阶段还是调用阶段。

## 建议文件结构

如果你还没开始写项目，可以按这个结构建第一版：

```text
phase1/
  model-capability-lab/
    src/
      config.ts
      model-factory.ts
      run-single-prompt.ts
      logs.ts
      index.ts
    tests/
      config.test.ts
      model-factory.test.ts
```

每个文件职责：

- `config.ts`：读取和校验模型配置。
- `model-factory.ts`：根据配置创建 chat model。
- `run-single-prompt.ts`：封装一次 `invoke`。
- `logs.ts`：记录调用结果。
- `index.ts`：CLI 入口或手动 demo 入口。

## 学习过程记录模板

建议每学完这一节，就写一个 `notes/01-model-interface.md`：

```md
# 01 模型接口学习记录

日期：

## 今天完成了什么

- 

## 使用的 provider/model

- 

## 我对 chat model 的理解

- 

## invoke 输入输出

- 输入格式：
- 返回值：
- 我还不确定的字段：

## 遇到的问题

| 问题 | 原因 | 解决方式 |
| --- | --- | --- |
| | | |

## 模型对比观察

| Provider | Model | Latency | 输出特点 | 问题 |
| --- | --- | --- | --- | --- |
| | | | | |

## 下一步

- 
```

## 常见问题

### 1. 应该用 `initChatModel` 还是 provider class？

学习阶段建议优先体验 `initChatModel`，因为它能强化“统一模型接口”的心智。后面如果你需要 provider 特有能力，再在 factory 内部使用具体 provider class。

原则：

- 业务代码依赖统一接口。
- provider 细节封装在 factory。
- provider 特有参数不要扩散到全项目。

### 2. 模型名称要不要写死？

不要写死在业务函数里。可以写在：

- `.env`
- `models.config.ts`
- JSON/YAML 配置文件
- benchmark suite 配置

业务逻辑只接收 `ModelConfig`。

### 3. 为什么要保留 mock provider？

mock provider 可以让你：

- 没有 API key 时也能开发。
- 测试不花钱。
- 测试稳定，不依赖网络。
- 专门测试错误路径。

阶段 1 后面做 benchmark 时，mock provider 还可以作为基准，验证 runner 和 report writer 本身没有问题。

### 4. 为什么现在就记录 latency？

模型工程不是只看“能不能回答”。latency 会直接影响用户体验，也会影响后面 agent 多步调用的总耗时。

阶段 1 的每次调用都记录 latency，是为了后面自然过渡到 model capability lab。

## 本节验收标准

完成本节后，请逐项检查：

- [ ] 我能解释 provider 和 model 的区别。
- [ ] 我能解释 chat model 和普通 text completion 的区别。
- [ ] 我有一个 `ModelConfig` 类型。
- [ ] 我有一个 `createChatModel(config)`。
- [ ] 业务 demo 不依赖具体 provider class。
- [ ] 我能通过配置切换模型。
- [ ] 我能用 `invoke` 调用模型。
- [ ] 我能记录 provider、model、latency 和错误类型。
- [ ] 我知道 system prompt 和 user prompt 的边界。
- [ ] 我写下了至少 3 条模型输出观察。

## 下一节衔接

完成这一节后，再进入 `2. Messages 与 Prompt 边界`。下一节会继续沿用这里的 `createChatModel(config)`，重点从“模型怎么创建”转向“应该给模型传什么 messages，以及怎样让 prompt 可测试、可复用、可比较”。

## 参考资料

- LangChain.js Models: https://docs.langchain.com/oss/javascript/langchain/models
- LangChain.js Providers and Models: https://docs.langchain.com/oss/javascript/concepts/providers-and-models
- LangChain.js Chat Model Integrations: https://docs.langchain.com/oss/javascript/integrations/chat
