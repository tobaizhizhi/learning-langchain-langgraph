# 第三部分总结与复习：Invoke 与结果归一化

一句话：**`invoke` 返回的是 LangChain 的 `AIMessage`，项目里要把它整理成自己稳定可用的结果。**

## 你要记住的核心

### 1. invoke 返回的不是普通字符串

重点代码：`phase1/src/run-single-prompt.ts`

```ts
const response = await model.invoke([
  { role: "system", content: input.systemPrompt },
  { role: "user", content: input.userPrompt },
]);
```

这里的 `response` 是 `AIMessage`。

常用正文：

```ts
response.text
```

原始返回保留在：

```ts
raw: response
```

记住：

```text
text 给业务用，raw 给 debug 用。
```

### 2. 为什么要归一化

不要让业务代码到处直接读 LangChain 原始对象。

项目里统一返回：

```ts
type RunSinglePromptResult = {
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

你要理解的是：

```text
AIMessage -> RunSinglePromptResult
```

这一步就是“结果归一化”。

### 3. metadata 是为了排查，不是为了让回答更好

重点函数：

```ts
extractModelResponseMetadata(response)
```

它只做三件事：

```text
usage_metadata.input_tokens  -> inputTokens
usage_metadata.output_tokens -> outputTokens
response_metadata.finish_reason -> finishReason
```

这些字段可能没有，所以类型是可选的：

```ts
inputTokens?: number;
outputTokens?: number;
finishReason?: string;
```

不要给缺失值编假数据。

### 4. finishReason 很有用

尤其要记住：

```text
stop   -> 正常结束
length -> 可能被 maxTokens 截断
```

如果回答写到一半停了，先看 `finishReason`，不要立刻怪 prompt 或模型。

### 5. 日志记录成功和失败两种情况

重点文件：

- `phase1/src/model-run-log.ts`
- `phase1/src/run-single-prompt.ts`

成功日志：

```text
ok: true
outputPreview
inputTokens/outputTokens/finishReason
```

失败日志：

```text
ok: false
errorType
errorMessage
```

关键原则：

```text
日志只记录摘要，不吞掉原始错误。
```

所以失败后代码仍然会：

```ts
throw error;
```

## 最该看的代码

按顺序看：

1. `phase1/src/run-single-prompt.ts`
   - 看 `model.invoke(...)`
   - 看 `RunSinglePromptResult`
   - 看 `extractModelResponseMetadata(...)`

2. `phase1/src/model-run-log.ts`
   - 看 `SuccessfulModelRunLog`
   - 看 `FailedModelRunLog`

3. `phase1/tests/run-single-prompt.test.ts`
   - 看如何模拟带 usage 的 `AIMessage`

4. `phase1/tests/model-run-log.test.ts`
   - 看成功日志和失败日志分别应该长什么样

## 你必须能回答

1. `invoke` 返回的是字符串吗？
2. 为什么业务层读 `result.text`，而不是到处读 `response.text`？
3. `raw` 为什么还要保留？
4. `inputTokens` 和 `outputTokens` 有什么用？
5. `finishReason: "length"` 说明什么？
6. 成功日志和失败日志分别记录什么？
7. 为什么失败日志记录后还要 `throw error`？

## 一句话复习

```text
invoke 拿到 AIMessage，runSinglePrompt 把它整理成稳定结果；
metadata 帮你排查 token 和停止原因；
日志帮你回看成功输出和失败原因，但不吞掉原始错误。
```
