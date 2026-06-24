# 阶段 2 总结与复习：外部工具调用与结构化输出

阶段 2 的核心不是“让模型变聪明”，而是让模型能安全地请求外部能力，并让代码拿到可继续处理的结果。

一句话记住：

```text
模型提出工具调用请求，代码执行真实外部工具，再把工具结果交回模型，最后输出稳定结构。
```

## 最重要的主线

```text
Zod schema
-> tool(...)
-> model.bindTools(...)
-> AIMessage.tool_calls
-> tool.invoke(toolCall.args)
-> ToolMessage
-> finalResponse
-> withStructuredOutput(...)
```

你真正要记住的是：

- `tool call` 只是模型提出的请求，不会自动调用外部 API。
- 真正访问 GitHub / npm 的是你写的 TypeScript 工具函数。
- `ToolMessage` 是把工具执行结果交回模型的标准消息。
- `withStructuredOutput(...)` 是让最终结果变成稳定对象，而不是随意文本。

## 各 Step 复习

### Step 1：什么时候需要工具

如果问题只需要解释概念，模型可以直接回答。

如果问题需要最新数据、外部系统状态、项目仓库信息、npm 版本信息，就应该使用工具。

重点记住：

```text
模型自己的知识可能过期；工具负责拿实时外部数据。
```

重点代码：

- `phase2/src/tool-decision-examples.ts`

### Step 2：Zod schema 定义工具参数

schema 规定工具能接收什么参数。

例如 GitHub 仓库查询必须有：

```ts
owner: string
repo: string
```

重点记住：

```text
schema 是工具调用的参数边界。
模型生成参数，代码仍然要用 schema 校验参数。
```

重点代码：

- `phase2/src/tool-schemas.ts`

### Step 3：定义真实外部工具

`tool(...)` 把普通函数包装成 LangChain 工具。

一个工具主要由三部分组成：

- `name`：模型返回 tool call 时用的工具名。
- `description`：帮助模型判断什么时候用这个工具。
- `schema`：工具参数格式。

真正请求外部 API 的地方在工具函数内部，例如 GitHub API、npm registry。

重点代码：

- `phase2/src/tools.ts`

### Step 4：直接调用工具

先不接模型，直接调用工具。

这样能确认：

- 参数校验是否正常。
- 外部 API 是否能通。
- API 失败时错误是否清楚。

运行：

```bash
pnpm phase2:direct-tools
```

重点代码：

- `phase2/src/direct-tool-demo.ts`

### Step 5：让模型提出 tool call

`model.bindTools(toolList)` 的意思是：

```text
把工具的 name / description / schema 告诉模型。
```

它不会执行工具。

第一次 `invoke` 后，模型可能返回：

```ts
tool_calls: [
  {
    name: "get_github_repository",
    args: { owner: "langchain-ai", repo: "langchainjs" }
  }
]
```

重点记住：

```text
AIMessage.tool_calls 是模型提出的工具调用请求。
```

运行：

```bash
pnpm phase2:tool-call "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息"
```

重点代码：

- `phase2/src/tool-call-request-demo.ts`

### Step 6：执行 tool call 并回填 ToolMessage

这是阶段 2 最核心的闭环。

流程：

```text
读取 AIMessage.tool_calls
-> 根据 toolCall.name 找到工具
-> 执行 tool.invoke(toolCall.args)
-> 用结果创建 ToolMessage
-> 再次 invoke 模型
```

重点记住：

```text
模型不执行工具；代码执行工具。
ToolMessage 必须带上原始 tool_call_id。
```

运行：

```bash
pnpm phase2:assistant "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

重点代码：

- `phase2/src/tool-assistant-demo.ts`
- `phase2/src/tool-runner.ts`

### Step 7：记录成功和失败

工具调用不是只看成功结果，还要能排查失败。

当前记录：

```ts
type ToolRunLog = {
  toolName: string;
  toolCallId?: string;
  argsPreview: Record<string, unknown>;
  ok: boolean;
  latencyMs: number;
  errorMessage?: string;
};
```

重点记住：

```text
真实项目里，工具失败很正常。
关键是失败时要知道哪个工具、什么参数、耗时多久、错误是什么。
```

重点代码：

- `phase2/src/tool-runner.ts`

### Step 8：结构化输出

普通文本适合人读，结构化对象适合代码继续处理。

当前结构：

```ts
{
  answer: string;
  toolCallsUsed: string[];
  sources: string[];
  needsHumanReview: boolean;
}
```

`withStructuredOutput(...)` 的作用是：

```text
让模型按 schema 返回对象，而不是随意写一段自然语言。
```

当前教学版会额外调用一次模型，把 Step 6 的结果整理成结构化对象。

运行：

```bash
pnpm phase2:structured-output "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

重点代码：

- `phase2/src/structured-output.ts`

## 最该看懂的 5 行代码

1. 把工具交给模型：

```ts
const modelWithTools = model.bindTools(toolList);
```

2. 模型提出工具调用请求：

```ts
const toolCalls = toolRequestMessage.tool_calls ?? [];
```

3. 代码找到并执行工具：

```ts
const tool = registry.get(toolCall.name);
const output = await tool.invoke(toolCall.args);
```

4. 把工具结果包装回模型可读消息：

```ts
const toolMessage = new ToolMessage({ tool_call_id: toolCallId, content });
```

5. 要求模型输出结构化对象：

```ts
const structuredModel = model.withStructuredOutput(externalLookupOutputSchema);
```

## 容易混淆的点

`bindTools` 不是执行工具。

它只是告诉模型有哪些工具可以请求。

`tool_calls` 不是工具结果。

它只是模型说“我想调用这个工具，参数是这些”。

`tool.invoke(...)` 才是真正执行工具。

外部 API 请求发生在工具函数内部。

`ToolMessage` 不是用户消息。

它是“工具执行结果”，要和原始 `tool_call_id` 对上。

`functionCalling` 在结构化输出里不是 GitHub/npm 工具调用。

它是借用函数参数机制，让模型返回符合 schema 的对象。

## 当前命令

```bash
pnpm phase2:tool-decisions
pnpm phase2:direct-tools
pnpm phase2:tool-call "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息"
pnpm phase2:assistant "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
pnpm phase2:structured-output "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

## 自测问题

学完阶段 2，你应该能回答：

- 为什么模型不能自己直接调用 GitHub API？
- `tool(...)` 的 `name`、`description`、`schema` 分别有什么用？
- `bindTools(...)` 做了什么，没做什么？
- `AIMessage.tool_calls` 里面通常有什么？
- 为什么 `ToolMessage.tool_call_id` 必须和原始 tool call id 对上？
- 工具调用失败时，为什么不能只返回一句“失败了”？
- `withStructuredOutput(...)` 解决了什么问题？

## 阶段 2 最终记忆版

```text
工具调用解决“模型怎么拿外部真实数据”。
结构化输出解决“代码怎么稳定使用模型结果”。
```
