# 阶段 1 第一部分总结与复习：LangChain.js 模型接口

本节一句话：**把模型当成可替换组件，而不是在业务代码里直接绑定某个 provider。**

## 核心链路

```text
.env
  -> loadModelConfigFromEnv()
  -> ModelConfig
  -> createChatModel(config)
  -> model.invoke(messages)
  -> AIMessage
  -> ModelRunLog
```

你要能解释这条链路每一步在做什么。

## 各 Step 总结

### Step 1：阅读官方模型接口文档

做什么：搞清楚 LangChain.js 里 chat model、messages、`invoke`、`AIMessage`、标准参数这些基本词。

为什么重要：先统一术语，后面看代码时才知道每个对象在 LangChain 里代表什么。

重点记住：chat model 是 `messages -> AIMessage`，不是普通字符串补全。

### Step 2：确定最小 provider 集合

做什么：第一版只选 `mock` 和一个真实 provider，目前实现的是 `mock` + `openai`。

为什么重要：避免一开始同时接太多 provider，把学习重点变成 SDK 参数排错。

重点记住：`mock` 用来离线测试，`openai` 用来真实调用或接 OpenAI-compatible 中转。

### Step 3：设计模型配置

做什么：定义 `ProviderName`、`ModelConfig`、`defaultModelConfig`、`loadModelConfigFromEnv()`、`parseModelId()`。

为什么重要：把模型选择集中成配置，不让 provider/model/temperature 散落在业务代码里。

重点文件：`phase1/src/model-config.ts`

重点记住：

```text
环境变量 -> ModelConfig
```

### Step 4：实现 createChatModel

做什么：根据 `ModelConfig` 创建对应的 LangChain chat model 实例。

为什么重要：provider 细节集中在 factory，业务代码不用直接 `new ChatOpenAI()`。

重点文件：`phase1/src/chat-model-factory.ts`

重点记住：

```text
ModelConfig -> createChatModel(config) -> ChatModel instance
```

### Step 5：编写最小 invoke demo

做什么：实现 `runSinglePrompt()` 和命令行 demo，用 `model.invoke()` 真正调用模型。

为什么重要：证明从配置到模型调用的最小链路已经跑通。

重点文件：

- `phase1/src/run-single-prompt.ts`
- `phase1/src/invoke-demo.ts`

重点记住：

```text
createChatModel() -> model.invoke(messages) -> AIMessage
```

### Step 6：明确 system prompt 与 user prompt 的边界

做什么：把长期行为规则放进 `systemPrompt`，把本次具体任务放进 `userPrompt`。

为什么重要：后面做 tools、RAG、LangGraph 节点时，输入边界不会乱。

重点文件：`phase1/src/run-single-prompt.ts`

重点记住：

```text
system = 长期规则
user = 本次任务
```

### Step 7：记录调用结果

做什么：给每次调用生成 `runId`，记录 provider、model、latency、成功/失败、输入输出 preview。

为什么重要：模型输出异常时，可以回看调用记录，判断问题来自配置、prompt、网络、模型还是代码。

重点文件：

- `phase1/src/model-run-log.ts`
- `phase1/src/show-recent-logs.ts`

重点记住：

```text
invoke 之后要留下可排查的运行证据
```

## 最重要的 5 个概念

### 1. Chat Model

LangChain.js 的 chat model 接收 messages，返回 assistant message。

```text
messages -> chat model -> AIMessage
```

不是简单字符串补全。

### 2. Provider 与 Model

```ts
provider: "openai"
model: "gpt-4o-mini"
```

`provider` 是服务/协议类型，`model` 是具体模型名。不要混在一起。

### 3. ModelConfig

统一保存模型配置：

```ts
type ModelConfig = {
  provider: ProviderName;
  model: string;
  temperature: number;
  maxTokens?: number;
  baseUrl?: string;
  timeoutMs: number;
  maxRetries: number;
};
```

重点：业务代码不直接读 `.env`，先变成可靠的 `ModelConfig`。

### 4. Model Factory

```ts
createChatModel(config)
```

作用：把配置变成真正可调用的模型实例。

```text
mock -> MockChatModel
openai -> ChatOpenAI
```

业务层不直接 `new ChatOpenAI()`。

### 5. invoke

真正调用模型的是：

```ts
await model.invoke([
  { role: "system", content: systemPrompt },
  { role: "user", content: userPrompt },
]);
```

返回值是 `AIMessage`，正文通常取：

```ts
response.text
```

## 文件地图

重点看这些文件：

- `phase1/src/model-config.ts`：配置类型、默认配置、环境变量解析。
- `phase1/src/chat-model-factory.ts`：根据 `ModelConfig` 创建模型实例。
- `phase1/src/run-single-prompt.ts`：一次完整 `invoke` 调用。
- `phase1/src/model-run-log.ts`：记录调用日志。
- `phase1/src/invoke-demo.ts`：命令行入口。
- `phase1/src/show-recent-logs.ts`：查看最近调用日志。

测试文件：

- `phase1/tests/model-config.test.ts`
- `phase1/tests/chat-model-factory.test.ts`
- `phase1/tests/run-single-prompt.test.ts`
- `phase1/tests/model-run-log.test.ts`

## 已完成能力

- 支持 `mock` provider，离线测试不消耗 API。
- 支持 `openai` provider。
- 支持 OpenAI-compatible 中转：

```env
MODEL_ID=openai:gpt-4o-mini
MODEL_BASE_URL=https://your-proxy.example.com/v1
OPENAI_API_KEY=your-proxy-key
```

- 支持默认配置：

```env
MODEL_ID=mock:mock-chat
```

- 支持记录调用日志：

```text
phase1/runs/model-runs.jsonl
```

## 常用命令

默认 mock 调用：

```bash
pnpm phase1:invoke
```

自定义问题：

```bash
pnpm phase1:invoke "请解释 LangChain.js 的 invoke"
```

查看最近 5 次调用：

```bash
pnpm phase1:logs
```

跑测试：

```bash
pnpm test
```

类型检查：

```bash
pnpm typecheck
```

## 配置速查

可以放在根目录 `.env` 或 `phase1/.env`。

mock：

```env
MODEL_ID=mock:mock-chat
```

OpenAI 官方：

```env
MODEL_ID=openai:gpt-4o-mini
OPENAI_API_KEY=sk-...
```

OpenAI-compatible 中转：

```env
MODEL_ID=openai:gpt-4o-mini
MODEL_BASE_URL=https://your-proxy.example.com/v1
OPENAI_API_KEY=your-proxy-key
```

可选参数：

```env
MODEL_TEMPERATURE=0
MODEL_MAX_TOKENS=1000
MODEL_TIMEOUT_MS=30000
MODEL_MAX_RETRIES=2
MODEL_RUN_LOG_PATH=phase1/runs/model-runs.jsonl
```

关闭日志：

```env
MODEL_RUN_LOG_PATH=off
```

## 复习重点

### 你必须能回答

1. `ModelConfig` 解决了什么问题？
2. 为什么业务代码不应该直接 `new ChatOpenAI()`？
3. `createChatModel(config)` 返回的是什么？
4. `model.invoke(...)` 的输入是什么？
5. `invoke` 返回的是字符串还是 message？
6. 中转地址应该放在哪里？
7. mock provider 有什么价值？
8. 为什么要记录 `provider`、`model`、`latencyMs`？

### 你必须能画出

```text
loadModelConfigFromEnv()
  -> createChatModel()
  -> runSinglePrompt()
  -> model.invoke()
  -> appendModelRunLog()
```

## 常见错误

### 1. 把 provider 和 model 混在一起

不要只保存：

```ts
model: "openai:gpt-4o-mini"
```

应该拆成：

```ts
provider: "openai"
model: "gpt-4o-mini"
```

### 2. 在业务代码里直接 new provider class

不推荐：

```ts
const model = new ChatOpenAI(...);
```

推荐：

```ts
const model = createChatModel(config);
```

### 3. 把中转当成新 provider

大多数中转是 OpenAI-compatible，所以仍然是：

```ts
provider: "openai"
baseUrl: "https://proxy.example.com/v1"
```

### 4. 只记录回答，不记录元数据

作品集里要能说明：

- 用了哪个 provider/model。
- 耗时多久。
- 是否失败。
- 输入输出摘要是什么。

## 本节完成标准

你现在应该已经能：

- 从 `.env` 加载模型配置。
- 用 `mock` 跑通离线调用。
- 用 `openai` 或 OpenAI-compatible 中转跑真实调用。
- 用统一 `runSinglePrompt()` 调用模型。
- 查看最近模型调用日志。
- 解释为什么模型层要和业务层解耦。

## 下一节

进入 `2. Messages 与 Prompt 边界`。

下一节重点不再是“怎么创建模型”，而是：

```text
应该给模型传什么 messages？
system prompt 和 user prompt 怎么分工？
prompt 怎么变成可测试、可复用、可比较的资产？
```
