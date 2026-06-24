# 阶段 2 学习大纲：外部工具调用与结构化输出

版本日期：2026-06-23

阶段目标：让真实大模型通过 LangChain.js 请求外部 API 工具，由代码执行工具，并把最终结果整理成稳定结构。

## 阶段硬性约束

本阶段不使用 mock。

- 不使用 `MODEL_ID=mock:mock-chat`。
- 不用内存假数据冒充工具结果。
- 不用假模型模拟 `tool_calls`。
- 大模型必须从 `phase2/.env` 读取配置。
- 当前模型调用使用 OpenAI-compatible 中转。
- 工具必须调用真实外部服务。

参考配置：[phase2/.env.example](/home/lenovo/solidity-course/aiframe/phase2/.env.example:1)

```bash
MODEL_ID=openai:gpt-4o-mini
MODEL_BASE_URL=https://your-proxy.example.com/v1
OPENAI_API_KEY=your-proxy-key
```

可选：

```bash
GITHUB_TOKEN=github_pat_...
```

`GITHUB_TOKEN` 不是必须，但可以提高 GitHub REST API 的限流额度。

## 为什么用外部工具

你说得对：真实项目里更常见的 tool 不是本地假函数，而是外部能力。

常见外部工具包括：

- GitHub API：查仓库、issue、PR、commit。
- npm registry：查包版本、依赖、发布时间。
- Etherscan / 区块链 RPC：查合约源码、交易、链上状态。
- 搜索 API：查网页或知识库。
- 数据库 / SaaS API：查业务数据、更新任务、发通知。

阶段 2 第一版选择低风险外部只读 API：

- `get_github_repository`
- `search_github_repositories`
- `get_npm_package`

原因：

- 不需要写入外部系统。
- 不需要资金或链上交易权限。
- 工具返回真实、会变化的数据。
- 很适合观察模型如何生成 tool call 参数。

## 阶段定位

阶段 2 不做复杂 agent，也不做 LangGraph。

这一阶段只练一条主线：

```text
外部 API 工具 -> Zod schema -> 真实模型提出 tool call -> 代码执行工具 -> ToolMessage -> 结构化输出
```

核心要弄清楚：

- `tool(...)` 怎么把外部 API 调用封装成 LangChain 工具。
- Zod schema 怎么限制外部 API 参数。
- `model.bindTools(...)` 怎么把工具交给真实模型。
- `AIMessage.tool_calls` 只是模型提出的调用请求。
- 真正执行外部 API 的是你的 TypeScript 代码。
- 工具结果要通过 `ToolMessage` 回填给模型。

## 当前外部工具

第一版只做外部只读工具：

- `get_github_repository`：通过 GitHub REST API 查询公开仓库信息。
- `search_github_repositories`：通过 GitHub REST API 搜索公开仓库。
- `get_npm_package`：通过 npm registry 查询包信息。

暂不做：

- 创建 GitHub issue / PR。
- 调 Etherscan 或 RPC。
- 写数据库。
- 发通知。
- 真实交易、资金操作、高风险操作。

未来扩展顺序：

```text
外部只读 API 工具
-> 本地低风险写入工具
-> 外部写入工具
-> 命令行/分析工具
-> 区块链 RPC / Etherscan 工具
-> 高风险工具
```

## 推荐学习顺序

### Step 1：理解工具调用解决什么问题

做什么：

先区分“模型直接回答”和“模型请求调用外部工具”。

例子：

| 用户问题 | 应该怎么处理 | 原因 |
|---|---|---|
| 解释 tool calling | 直接回答 | 不需要外部数据 |
| 查询 `langchain-ai/langchainjs` 仓库信息 | 调用 `get_github_repository` | 需要最新 GitHub 数据 |
| 查看 `@langchain/core` npm 包信息 | 调用 `get_npm_package` | 需要最新 npm 数据 |

重点记住：

```text
模型不会自己调用 GitHub 或 npm。
模型只提出 tool call。
代码负责真正请求外部 API。
```

运行：

```bash
pnpm phase2:tool-decisions
```

重点看：

- `phase2/src/tool-decision-examples.ts`

### Step 2：用 Zod 定义外部工具参数 schema

做什么：

给每个外部工具写清楚输入参数。

重点 schema：

```ts
const getGitHubRepositoryInputSchema = z.object({
  owner: z.string().trim().min(1),
  repo: z.string().trim().min(1),
});

const getNpmPackageInputSchema = z.object({
  packageName: z.string().trim().min(1),
});
```

验收：

- GitHub owner/repo 为空会报错。
- npm packageName 为空会报错。
- search limit 有上下限。
- schema 模块不调用模型，也不请求外部 API。

### Step 3：定义第一批外部工具

做什么：

用 LangChain `tool(...)` 定义真实外部 API 工具。

核心结构：

```ts
const getGitHubRepository = tool(
  async ({ owner, repo }) => {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
    return await response.json();
  },
  {
    name: "get_github_repository",
    description: "Fetch public GitHub repository metadata by owner and repo name.",
    schema: getGitHubRepositoryInputSchema,
  },
);
```

验收：

- 每个工具都有 `name`。
- 每个工具都有 `description`。
- 每个工具都有 `schema`。
- 工具调用的是真实外部 API。
- 外部 API 失败时有明确错误。

### Step 4：直接调用外部工具，先不接模型

做什么：

先手动调用工具，确认 schema 校验、外部 API 请求、错误路径都正常。

运行：

```bash
pnpm phase2:direct-tools
```

应该看到：

- `get_github_repository` 返回 `langchain-ai/langchainjs` 信息。
- `search_github_repositories` 返回 GitHub 搜索结果。
- `get_npm_package` 返回 `@langchain/core` 信息。
- 参数错误触发 schema 错误。
- 不存在的仓库触发外部 API 错误。

### Step 5：让真实模型提出外部 tool call

做什么：

从 `phase2/.env` 读取中转模型配置，把外部工具绑定给真实模型。

运行：

```bash
pnpm phase2:tool-call "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

预期看到类似：

```text
Tool calls:
- name: get_github_repository
  id: ...
  args: {"owner":"langchain-ai","repo":"langchainjs"}
- name: get_npm_package
  id: ...
  args: {"packageName":"@langchain/core"}
```

重点：

- 这里调用的是真实大模型。
- 这里还不执行外部工具。
- 这里只观察模型返回的 `AIMessage.tool_calls`。

如果模型没有返回 tool call，要检查：

- `phase2/.env` 是否配置了 `MODEL_ID`、`MODEL_BASE_URL`、`OPENAI_API_KEY`。
- 当前中转模型是否支持 tool calling。
- prompt 是否明确要求查询 GitHub / npm。
- tool description 是否清楚。

### Step 6：执行 tool call 并回填 ToolMessage

做什么：

实现最小工具调用循环：

```text
AIMessage.tool_calls
-> 根据 name 找到外部工具
-> 请求外部 API
-> 生成 ToolMessage
-> 再次调用真实模型
```

验收：

- `ToolMessage.tool_call_id` 能对应原始 tool call id。
- 未知工具名会明确报错。
- 外部 API 失败不会被伪装成成功。

运行：

```bash
pnpm phase2:assistant "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

重点看：

- `phase2/src/tool-runner.ts`
- `phase2/src/tool-assistant-demo.ts`

### Step 7：设计工具返回值和错误结果

做什么：

让成功和失败都可排查。

建议记录：

```ts
type ToolRunLog = {
  toolName: string;
  argsPreview: Record<string, unknown>;
  ok: boolean;
  latencyMs: number;
  errorMessage?: string;
};
```

重点：

- 成功时记录 `toolName`、`argsPreview`、`ok`、`latencyMs`。
- 失败时不伪装成成功，而是抛出 `ToolExecutionError`，同时保留 `log`。
- 日志是给开发者排查问题用的，不是直接给用户看的最终答案。

运行：

```bash
pnpm phase2:assistant "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

重点看：

- `phase2/src/tool-runner.ts`
- `phase2/src/tool-assistant-demo.ts`

### Step 8：学习结构化输出

做什么：

让最终回答变成稳定对象，而不是随意文本。

示例：

```ts
const ExternalLookupOutput = z.object({
  answer: z.string(),
  toolCallsUsed: z.array(z.string()),
  sources: z.array(z.string()),
  needsHumanReview: z.boolean(),
});
```

重点：

```text
结构化输出不是为了好看，而是为了让后续代码能继续处理结果。
```

运行：

```bash
pnpm phase2:structured-output "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
```

重点看：

- `phase2/src/structured-output.ts`

这一部分要记住：

```text
普通 finalText 适合人读。
structured output 适合代码继续处理。
```

## 当前项目目标

做一个最小外部信息查询助手：

- 使用 `phase2/.env` 中的真实中转模型。
- 绑定真实外部 API 工具。
- 让模型提出 tool call。
- 由代码执行外部 API 工具。
- 把结果通过 `ToolMessage` 回填。
- 最终输出结构化结果。

## 推荐目录结构

```text
phase2/
  .env.example
  README.md
  src/
    tool-schemas.ts
    tools.ts
    direct-tool-demo.ts
    tool-call-request-demo.ts
    tool-runner.ts
    structured-output.ts
    tool-assistant-demo.ts
  tests/
    tool-schemas.test.ts
    tools.test.ts
    direct-tool-demo.test.ts
    structured-output.test.ts
```

## 推荐命令

```bash
pnpm phase2:tool-decisions
pnpm phase2:direct-tools
pnpm phase2:tool-call "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
pnpm phase2:assistant "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
pnpm phase2:structured-output "请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。"
pnpm test
pnpm typecheck
```

## 阶段完成标准

- [ ] 能解释 tool calling 和普通文本回答的区别。
- [ ] 能用 Zod 写外部工具参数 schema。
- [ ] 能用 LangChain `tool(...)` 定义外部 API 工具。
- [ ] 能直接调用外部工具。
- [ ] 能通过 `.env` 中转配置调用真实模型。
- [ ] 能看懂真实模型返回的 `AIMessage.tool_calls`。
- [x] 能执行 tool call 并生成 `ToolMessage`。
- [x] 能处理未知工具、参数错误、外部 API 错误。
- [x] 能用 `withStructuredOutput(...)` 得到结构化结果。

## 暂缓清单

这些以后再学：

- `createAgent` 深入使用。
- middleware。
- LangGraph state graph。
- RAG 向量检索。
- LangSmith tracing/evaluation。
- 多模型 fallback/router。
- Web UI 工具调用可视化。
- 外部写入工具和高风险工具。

原因：阶段 2 的重点是先跑通真实的：

```text
external tool schema -> bindTools -> tool_calls -> ToolMessage -> structured output
```

## 一句话复习

```text
阶段 2 学的是：让真实大模型通过 schema 请求外部 API 工具，由代码执行工具，再把结果交回模型并得到稳定结构化输出。
```
