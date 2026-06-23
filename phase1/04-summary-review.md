# 第四部分总结与复习：Stream 流式输出

一句话：**`stream` 不是等完整回答，而是边收到 chunk 边处理。**

## 你要记住的核心

### 1. invoke 和 stream 的区别

`invoke`：

```ts
const response = await model.invoke(messages);
console.log(response.text);
```

含义：

```text
等模型完整生成完，再一次性拿到结果。
```

`stream`：

```ts
const stream = await model.stream(messages);

for await (const chunk of stream) {
  process.stdout.write(chunk.text);
}
```

含义：

```text
模型生成一点，你收到一点，马上处理一点。
```

### 2. chunk 是碎片，不是完整回答

流式输出可能分成很多小段：

```text
"LangChain"
".js 的 "
"stream "
"可以边生成边返回。"
```

所以代码里要做两件事：

```ts
text += chunkText;
input.onTextChunk?.(chunkText);
```

记住：

```text
chunkText = 当前这一小段
result.text = 所有 chunk 拼起来的完整回答
```

### 3. firstChunkLatencyMs 看体感速度

重点字段：

```ts
type StreamPromptResult = {
  text: string;
  firstChunkLatencyMs?: number;
  totalLatencyMs: number;
};
```

区别：

```text
firstChunkLatencyMs = 用户多久看到第一段输出
totalLatencyMs = 完整回答多久结束
```

流式输出的价值很多时候不在于总耗时变短，而是用户更快看到“有动静”。

### 4. stdout 和 stderr 要分清

模型正文写：

```ts
process.stdout.write(text);
```

程序状态和错误写：

```ts
console.error(...);
```

记住：

```text
stdout -> 模型正文
stderr -> Provider、Model、耗时、错误
```

这样以后把模型回答重定向到文件时，不会把错误信息混进去。

### 5. 错误不能吞掉

stream 失败时：

```ts
throw error;
```

CLI 最后统一处理：

```ts
console.error(`Stream demo failed: ${message}`);
process.exitCode = 1;
```

原则：

```text
可以整理错误显示方式，但不要假装调用成功。
```

## 最该看的代码

按顺序看：

1. `phase1/src/stream-demo.ts`
   - 看 `runStreamPrompt(...)`
   - 看 `model.stream([...messages])`
   - 看 `for await (const chunk of stream)`
   - 看 `text += chunkText`
   - 看 `firstChunkLatencyMs`

2. `phase1/src/stream-demo.ts`
   - 看 `onTextChunk`
   - 看 `process.stdout.write(text)`
   - 看错误时为什么先补换行

3. `phase1/tests/stream-demo.test.ts`
   - 看如何验证 `streamedText === result.text`
   - 看 provider 未实现时如何失败

## 你不用重点学

现在先不要学：

```text
streamEvents
LangGraph 节点事件流
WebSocket / SSE
工具调用过程展示
复杂 tracing
断点续传
```

这些是后面做 agent 或前端产品时才需要。

## 你必须能回答

1. `invoke()` 和 `stream()` 最大区别是什么？
2. 为什么 stream 要用 `for await...of`？
3. `chunk.text` 是完整回答吗？
4. 为什么还要拼出 `result.text`？
5. `firstChunkLatencyMs` 和 `totalLatencyMs` 有什么区别？
6. 为什么模型正文写 stdout，错误写 stderr？
7. stream 失败时为什么还要抛出错误？

## 一句话复习

```text
stream 用 for await 逐段读取 chunk；
每段 chunk 既可以实时打印，也要拼成完整 text；
首 chunk 延迟看体感，总耗时看完整任务；
正文走 stdout，错误走 stderr，不吞掉失败。
```
