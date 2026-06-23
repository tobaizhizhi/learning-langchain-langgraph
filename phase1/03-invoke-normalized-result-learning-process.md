# 阶段 1 第三部分：Invoke 单次调用与结果归一化

版本日期：2026-06-22

对应大纲章节：`phase1/README.md` 中的 `3. Invoke：单次调用与结果归一化`

## 本节目标

本节只解决一个问题：

```text
model.invoke(...) 返回了什么？上层业务应该拿到什么？
```

学完后你应该能把 LangChain 返回的 `AIMessage` 转成项目内部稳定结果：

```ts
type NormalizedModelResult = {
  runId: string;
  provider: ProviderName;
  model: string;
  latencyMs: number;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  raw: BaseMessage;
};
```

## 价值分级

必须学：

- `invoke` 返回的是 message，不是普通字符串
- 正文通常从 `response.text` 取
- 上层业务最好拿统一结果结构，不直接依赖 provider 原始返回

值得学：

- `usage_metadata` 里可能有 token usage
- `response_metadata` 里可能有 finish reason
- latency、provider、model、runId 要一起记录

知道即可：

- 不同 provider 的 metadata 字段可能不完全一致
- token usage 有时会缺失

暂缓：

- 成本估算
- 完整错误分类系统
- LangSmith tracing
- 自动 evaluator

## 核心概念

### 1. invoke 返回 AIMessage

当前代码：

```ts
const response = await model.invoke([
  { role: "system", content: input.systemPrompt },
  { role: "user", content: input.userPrompt },
]);
```

这里的 `response` 不是 string，而是 LangChain message。

你常用的字段：

```ts
response.text
response.content
response.usage_metadata
response.response_metadata
response.tool_calls
```

本阶段重点只看：

```ts
response.text
response.usage_metadata
response.response_metadata
```

### 2. 为什么要归一化

如果上层代码直接依赖 `AIMessage`，以后会遇到问题：

- OpenAI、Anthropic、Google 的 metadata 可能不同。
- 有的 provider 返回 token usage，有的不返回。
- 报告和调试需要统一字段。
- 业务代码不应该到处知道 provider 的原始响应细节。

所以更稳的是：

```text
AIMessage + 调用元数据 -> NormalizedModelResult
```

上层业务只读：

```ts
result.text
result.latencyMs
result.inputTokens
result.outputTokens
```

原始 message 可以保留在 `raw` 里，用于 debug。

### 3. 缺失 metadata 是正常情况

不要假设每次都有 token usage。

应该允许：

```ts
inputTokens?: number;
outputTokens?: number;
finishReason?: string;
```

如果 provider 没返回，就保持 `undefined`，不要编一个假值。

## 推荐学习流程

### Step 1：看懂当前 runSinglePrompt 返回值

价值标签：必须学

做什么：回看当前最小调用函数，确认现在已经返回了哪些字段。

重点文件：

- `phase1/src/run-single-prompt.ts`

当前返回：

```ts
export type RunSinglePromptResult = {
  runId: string;
  provider: ProviderName;
  model: string;
  startedAt: string;
  latencyMs: number;
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
  raw: BaseMessage;
};
```

这已经是一个很小的归一化结果：

- `text` 给业务使用
- `raw` 给 debug 使用
- `provider/model/latencyMs/runId` 给日志和报告使用
- `inputTokens/outputTokens/finishReason` 有就记录，没有就保持 `undefined`

验收：

- 能解释为什么 `text` 和 `raw` 都要保留。
- 能说明 `latencyMs` 是在哪里计算的。

不做什么：

- 不做成本计算。
- 不接 LangSmith。

### Step 2：补齐 token usage 和 finish reason

价值标签：值得学

做什么：从 `AIMessage` 里提取常见 metadata，并兼容缺失字段。

建议新增字段：

```ts
inputTokens?: number;
outputTokens?: number;
finishReason?: string;
```

为什么现在做：

- token usage 是后面成本估算和报告展示的基础。
- finish reason 可以帮助判断模型是正常停止、长度截断，还是其他原因。

重点看：

```ts
response.usage_metadata
response.response_metadata
```

可能的提取方式：

```ts
const inputTokens = response.usage_metadata?.input_tokens;
const outputTokens = response.usage_metadata?.output_tokens;
const finishReason = response.response_metadata?.finish_reason;
```

注意：不同 provider 的字段可能不同，所以第一版只做“有就取，没有就 undefined”。

验收：

- mock provider 没有 usage 时不会报错。
- OpenAI 返回 usage 时能记录。
- 上层代码不需要直接访问 `response.usage_metadata`。

不做什么：

- 不为缺失 token usage 自己估算。
- 不做价格表。
- 不强行适配所有 provider 的所有 metadata。

### Step 3：把成功和失败都记录成可排查结果

价值标签：值得学

做什么：成功时记录统一结果，失败时记录错误摘要。

当前已经有：

- `phase1/src/model-run-log.ts`
- `phase1/src/show-recent-logs.ts`

日志结构现在分成成功和失败两种：

```ts
type BaseModelRunLog = {
  runId: string;
  provider: string;
  model: string;
  startedAt: string;
  latencyMs: number;
  inputPreview: string;
};

type SuccessfulModelRunLog = BaseModelRunLog & {
  ok: true;
  outputPreview: string;
  inputTokens?: number;
  outputTokens?: number;
  finishReason?: string;
};

type FailedModelRunLog = BaseModelRunLog & {
  ok: false;
  errorType: string;
  errorMessage: string;
};
```

为什么现在做：

- 同一次调用要能追踪模型、耗时、token usage、错误类型。
- 失败日志比成功日志更有排查价值。

验收：

- `pnpm phase1:invoke` 后能看到 run id。
- `pnpm phase1:logs` 能看到最近调用。
- 失败时日志里有 `errorType` 和 `errorMessage`。
- 如果失败日志写入也失败，仍然抛出原始模型错误。

不做什么：

- 不建立复杂错误层级。
- 不隐藏原始错误；只记录摘要，仍然抛出错误。

## 当前代码地图

主线代码：

- `phase1/src/run-single-prompt.ts`：封装单次 `invoke`，返回归一化结果
- `phase1/src/model-run-log.ts`：记录调用日志
- `phase1/src/invoke-demo.ts`：命令行入口
- `phase1/src/show-recent-logs.ts`：查看最近日志

测试：

- `phase1/tests/run-single-prompt.test.ts`
- `phase1/tests/model-run-log.test.ts`

## 常用命令

运行一次 invoke：

```bash
pnpm phase1:invoke "请解释 LangChain.js 的 invoke"
```

查看最近调用日志：

```bash
pnpm phase1:logs
```

跑测试：

```bash
pnpm test
```

## 本节练习

### 练习 A：观察 AIMessage

运行一次真实或 mock 调用，然后在代码里临时打印：

```ts
console.log(response.text);
console.log(response.usage_metadata);
console.log(response.response_metadata);
```

完成标准：

- 能说明哪些字段有值，哪些字段可能是 undefined。

### 练习 B：补齐 NormalizedModelResult

把 `RunSinglePromptResult` 扩展成：

```ts
inputTokens?: number;
outputTokens?: number;
finishReason?: string;
```

完成标准：

- mock 调用不报错。
- 如果真实 provider 返回 usage，结果里能带上。

### 练习 C：日志同步补字段

把日志也补上：

```ts
inputTokens?: number;
outputTokens?: number;
finishReason?: string;
```

完成标准：

- `pnpm phase1:logs` 能看到这些字段；没有值时不乱编。

## 本节完成标准

你只需要做到：

- 知道 `invoke` 返回的是 `AIMessage`。
- 知道业务正文用 `response.text`。
- 知道 token usage 和 finish reason 来自 metadata，而且可能缺失。
- 能把一次调用结果整理成统一结构。
- 能保留 `raw` 做 debug，但不让业务层依赖 provider 原始响应。

完成这些，就可以进入下一节：`4. Stream：流式输出`。
