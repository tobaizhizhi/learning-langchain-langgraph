# 阶段 1 第四部分：Stream 流式输出

版本日期：2026-06-22

对应大纲章节：`phase1/README.md` 中的 `4. Stream：流式输出`

## 本节目标

本节只解决一个问题：

```text
怎样让模型边生成边输出，而不是等完整回答结束后一次性返回？
```

学完后你应该能看懂并写出：

```ts
const stream = await model.stream([
  { role: "system", content: systemPrompt },
  { role: "user", content: userPrompt },
]);

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

## 价值分级

必须学：

- `invoke()` 和 `stream()` 的区别
- `for await...of` 如何消费流
- chunk 是增量片段，不是完整最终回答
- 首 token 延迟和总耗时的意义

值得学：

- CLI 中如何逐步打印文本
- 如何把 chunk 拼成完整文本
- stream 出错时如何结束程序
- stream 和 invoke 共用同一套 `ModelConfig`

知道即可：

- 有些 provider 或模型可能不支持真正流式输出
- LangChain 还有 `streamEvents()`，但它更适合后面的 agent 事件流
- 流式 token usage 可能不如 `invoke()` 稳定

暂缓：

- LangGraph 节点事件流
- 工具调用过程流式展示
- WebSocket / SSE 前端实时推送
- 复杂 tracing
- 用户取消、恢复、断点续传

判断标准：如果它不能帮助你写出一个最小 CLI stream demo，就暂时不要放进本节。

## 核心概念

### 1. invoke 是等完整结果

第三部分已经学过：

```ts
const response = await model.invoke(messages);
console.log(response.text);
```

这表示：

```text
发出请求 -> 等模型完整生成完 -> 一次性拿到 AIMessage
```

适合：

- 简单脚本
- 后台任务
- 单次结果归一化
- 对延迟不敏感的流程

### 2. stream 是边生成边返回

stream 的形态是：

```ts
const stream = await model.stream(messages);

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

这表示：

```text
发出请求 -> 模型生成一点 -> 你收到一点 -> 继续打印
```

适合：

- CLI 实时显示
- 聊天界面
- 长答案
- 用户需要看到进度的场景

### 3. chunk 不是完整答案

`chunk` 是一次增量。

可能是：

```text
Lang
Chain
.js
 的
 stream
```

所以你通常要做两件事：

```ts
let text = "";

for await (const chunk of stream) {
  text += chunk.text;
  process.stdout.write(chunk.text);
}
```

记住：

```text
chunk.text 用来即时显示；
拼起来的 text 才是完整回答。
```

### 4. 首 token 延迟比总耗时更贴近体感

流式输出至少记录两个时间：

```text
firstChunkLatencyMs: 第一个 chunk 出现用了多久
totalLatencyMs: 整个回答完成用了多久
```

为什么重要：

- `firstChunkLatencyMs` 决定用户多久看到动静。
- `totalLatencyMs` 决定完整任务多久结束。

一个回答可能总耗时很长，但首 token 很快，用户体感会好很多。

## 推荐学习流程

### Step 1：先看懂 invoke 和 stream 的差异

价值标签：必须学

做什么：先不要写复杂代码，只比较两种调用方式。

`invoke`：

```ts
const response = await model.invoke(messages);
console.log(response.text);
```

`stream`：

```ts
const stream = await model.stream(messages);

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

你要能说清楚：

```text
invoke 返回完整 message；
stream 返回可遍历的 chunk 流。
```

重点文件：

- `phase1/src/run-single-prompt.ts`
- `phase1/src/stream-demo.ts`

验收：

- 能解释为什么 `stream` 需要 `for await...of`。
- 能解释为什么 chunk 不能当最终完整结果。

不做什么：

- 不接 LangGraph。
- 不学 `streamEvents()`。

### Step 2：实现最小 stream demo

价值标签：必须学

做什么：新增一个 CLI demo，从当前 `ModelConfig` 创建模型，然后流式输出。

本仓库实现文件：

```text
phase1/src/stream-demo.ts
```

本仓库命令：

```json
{
  "phase1:stream": "tsx phase1/src/stream-demo.ts"
}
```

最小代码形态：

```ts
const model = createChatModel(config);
const stream = await model.stream([
  { role: "system", content: systemPrompt },
  { role: "user", content: userPrompt },
]);

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

验收：

- 可以运行：

```bash
pnpm phase1:stream "请用五句话解释 LangChain.js 的 stream"
```

- 终端能逐步打印模型输出。
- 和 `pnpm phase1:invoke` 使用同一套 `.env` 配置。

不做什么：

- 不做 Web UI。
- 不做 SSE。
- 不做复杂事件显示。

### Step 3：拼出完整文本并记录时间

价值标签：必须学

做什么：一边打印 chunk，一边拼接完整回答，并记录首 chunk 延迟和总耗时。

本仓库实现结果结构：

```ts
type StreamPromptResult = {
  provider: ProviderName;
  model: string;
  text: string;
  firstChunkLatencyMs?: number;
  totalLatencyMs: number;
};
```

实现位置：

- `phase1/src/stream-demo.ts`

关键逻辑：

```ts
let text = "";
let firstChunkLatencyMs: number | undefined;
const startedAtMs = Date.now();

for await (const chunk of stream) {
  if (firstChunkLatencyMs === undefined && chunk.text.length > 0) {
    firstChunkLatencyMs = Date.now() - startedAtMs;
  }

  text += chunk.text;
  process.stdout.write(chunk.text);
}

const totalLatencyMs = Date.now() - startedAtMs;
```

验收：

- 能看到完整输出文本。
- 能看到首 chunk 延迟。
- 能看到总耗时。
- `phase1/tests/stream-demo.test.ts` 覆盖了文本拼接和计时字段。

不做什么：

- 不计算成本。
- 不强求 token usage。

### Step 4：处理错误和输出边界

价值标签：值得学

做什么：stream 过程中也可能失败，要让 CLI 清楚结束。

基本原则：

```text
流式正文写 stdout；
错误信息写 stderr；
错误后设置 process.exitCode = 1；
```

本仓库实现形态：

```ts
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Stream demo failed: ${message}`);
  process.exitCode = 1;
});
```

实现位置：

- `phase1/src/stream-demo.ts`

当前还处理了一个小细节：如果已经输出过部分正文，stream 中途失败时会先补一个换行，再显示错误，避免错误文本贴在模型正文后面。

为什么要区分：

- stdout 是模型正文。
- stderr 是程序错误。
- 后面如果把输出重定向到文件，不会把错误信息混进回答正文。

验收：

- provider 配错时，程序不会卡住。
- 错误能清楚显示。
- 正文和错误输出不混在一起。
- `phase1/tests/stream-demo.test.ts` 覆盖了 provider 未实现时的失败路径。

不做什么：

- 不做复杂错误分类。
- 不做自动 fallback。

## 当前代码地图

已经有：

- `phase1/src/model-config.ts`：读取模型配置
- `phase1/src/chat-model-factory.ts`：创建 chat model
- `phase1/src/system-prompts.ts`：读取 system prompt
- `phase1/src/invoke-demo.ts`：一次性 invoke demo

建议新增：

- `phase1/src/stream-demo.ts`：最小流式输出 demo

建议复用：

- `loadModelConfigFromEnv()`
- `createChatModel(config)`
- `loadSystemPromptFromEnv()`

## 常用命令

一次性调用：

```bash
pnpm phase1:invoke "请解释 LangChain.js 的 invoke"
```

流式调用：

```bash
pnpm phase1:stream "请解释 LangChain.js 的 stream"
```

对比观察：

```text
invoke: 等完整回答出来
stream: 边生成边显示
```

## 本节练习

### 练习 A：观察 stream 输出

用同一个 prompt 分别运行：

```bash
pnpm phase1:invoke "请用五句话解释 LangChain.js 的 stream"
pnpm phase1:stream "请用五句话解释 LangChain.js 的 stream"
```

完成标准：

- 能说出两者体感差异。
- 能说明 stream 为什么适合长回答。

### 练习 B：记录首 chunk 延迟

在 stream demo 中打印：

```text
First chunk latency: 123ms
Total latency: 4567ms
```

完成标准：

- 能解释 first chunk latency 和 total latency 的区别。

### 练习 C：故意制造错误

例如：

```env
MODEL_ID=anthropic:claude-sonnet-4-5
```

当前 factory 还没实现 Anthropic，会报错。

完成标准：

- 错误能清楚显示。
- 程序不会假死。

## 本节完成标准

你只需要做到：

- 能解释 `invoke()` 和 `stream()` 的区别。
- 能用 `for await...of` 消费 stream。
- 能把 chunk 逐步打印到终端。
- 能把 chunk 拼成完整文本。
- 能记录首 chunk 延迟和总耗时。
- 能处理 stream 过程中的错误。
- 知道 `streamEvents()` 是后面 LangGraph/agent 事件流再学的内容。

完成这些，阶段 1 的模型接口基础就比较完整了。

## 一句话复习

```text
invoke 是等完整 AIMessage；
stream 是边收到 chunk 边处理；
Phase 1 只做最小 CLI 流式输出，不做复杂事件系统。
```
