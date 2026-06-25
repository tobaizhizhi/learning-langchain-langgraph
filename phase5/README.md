# 阶段 5 学习大纲：LangGraph 心智模型与 StateGraph

版本日期：2026-06-24

路线图仅供参考。阶段 5 的实际执行以当前代码、阶段 1 到阶段 4 已完成能力、作品集目标和 `docs/course-outline-rules.md` 为准；如果有更直接、更贴近真实项目的方式，就按更好的方式做。

## 阶段目标

把前面阶段的“模型调用、工具调用、RAG 问答”组织成一个可控的 LangGraph 状态图，让复杂流程不再藏在 agent 自己的循环里。

一句话：

```text
阶段 5 学的是：把任务拆成明确的 state、node、edge，让每一步可读、可测、可追踪、可恢复。
```

## 阶段硬性约束

本阶段继续贴近真实项目：

- 不使用 mock 模型作为主线。
- 不使用假工具、假 API、假知识库作为主线。
- 继续复用阶段 2 的真实外部工具：GitHub API、npm registry。
- 阶段 4 RAG 完成后，优先把真实课程知识库检索作为只读节点或工具接入。
- 大模型继续从 `.env` 读取 OpenAI-compatible 中转配置。
- LangGraph 用于显式流程编排，不用来重新发明 `createAgent`。
- 先做 CLI / run report / graph visualization，不急着做完整 Web UI。
- 节点可以是纯函数，但不能用假数据伪装真实外部能力。

## 本阶段和前面阶段的关系

阶段 2 主线：

```text
model.bindTools
-> AIMessage.tool_calls
-> tool.invoke(...)
-> ToolMessage
-> final response
```

阶段 3 主线：

```text
createAgent(...)
-> agent 自动管理工具循环
-> middleware 记录和限制过程
```

阶段 4 主线：

```text
documents
-> chunks
-> embeddings
-> vector store
-> retriever
-> citation answer
```

阶段 5 主线：

```text
StateGraph
-> StateSchema
-> nodes return state updates
-> edges control execution order
-> conditional edges route branches
-> reducers merge repeated updates
-> graph.invoke / graph.stream
-> run report / path tests
```

你要观察的是：

```text
createAgent 擅长开放式工具循环；LangGraph 擅长把流程拆成显式状态机。
```

## 必须学

- `StateGraph`：用图描述流程。
- `StateSchema`：定义 graph 的共享状态结构。
- state update：node 返回局部更新，不直接修改 state。
- node：一个节点就是一个明确职责的 TypeScript 函数。
- `START` / `END`：图的入口和终点。
- `addNode` / `addEdge` / `addConditionalEdges`：定义节点和执行顺序。
- `compile()` / `invoke()` / `stream()`：编译并运行 graph。
- reducer：同一个 state key 被多次更新时如何合并。
- `MessagesValue` / `ReducedValue`：LangGraph 常用内置 state value。
- 条件路由：根据 state 决定下一步走哪个节点。
- graph path testing：测试某类输入会走哪条路径。
- run report：记录节点执行顺序、耗时、输入摘要、输出摘要和错误。

## 值得学

- 用真实工具节点替代阶段 2 的手写工具循环。
- 用 RAG 节点查询阶段 4 的真实知识库。
- 输出 graph Mermaid 图，帮助作品集解释流程。
- `streamMode: "updates"` 查看每个节点的 state patch。
- recursion limit / 显式终止条件，避免图循环失控。
- node 级错误分类：模型错误、工具错误、检索错误、业务拒答。

## 知道即可

- `Command`：在 node 里同时更新 state 和决定下一跳。
- `Send`：动态并行分发任务。
- subgraph：把一个 graph 当成另一个 graph 的节点。
- checkpointer / `MemorySaver`：为持久化、人类介入、恢复执行做准备。
- LangGraph streaming events：更细粒度地推送 token、tool、node 事件。
- LangGraph Studio / LangSmith trace 深度调试。

这些未来会有用，但现在不是主线。

## 暂缓内容

- 复杂多 agent：阶段 8 或 Capstone 再学。
- 持久化和恢复执行：阶段 7 再系统学。
- human-in-the-loop interrupt：阶段 7 再系统学。
- 大规模并行 research workers：阶段 6 再学。
- `Command` / `Send` 深度使用：阶段 5 先知道它们存在。
- graph 部署服务：先用本地 CLI 跑通。
- 完整 Web UI：先做 run report 和 Mermaid 图。

## 最小可运行成果

阶段 5 完成后，应该能跑一个真实 Graph Workflow Assistant：

```bash
pnpm phase5:graph "请查询 langchain-ai/langchainjs，并说明 @langchain/core npm 包的用途"
pnpm phase5:inspect
pnpm phase5:path-tests
```

预期它会：

- 读取真实 `.env` 模型配置。
- 使用 LangGraph `StateGraph` 定义流程。
- 显式记录 state。
- 根据输入路由到 GitHub、npm、课程知识库/RAG 或拒答节点。
- 调用真实 GitHub API / npm registry / Qdrant RAG。
- 由最终 synthesis node 生成结构化答案。
- 输出 node 执行顺序和 run report。
- 可以用测试验证关键路径。

## 实现前需要准备的依赖和配置

当前 `package.json` 没有直接声明 `@langchain/langgraph`。阶段 5 实现前建议明确安装：

```bash
pnpm add @langchain/langgraph
```

继续复用前面阶段的配置：

```env
MODEL_ID=openai:your-chat-model
OPENAI_API_KEY=your-api-key
MODEL_BASE_URL=https://your-openai-compatible-base-url/v1
GITHUB_TOKEN=optional-github-token
```

如果接入阶段 4 RAG，还需要：

```env
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=your-api-key
EMBEDDING_BASE_URL=https://your-openai-compatible-base-url/v1
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=aiframe_phase4
```

## 推荐主项目：Graph Workflow Assistant

第一版不要做大而全。建议先做一个能解释清楚的图：

```text
START
-> classify_task
-> route_by_task
   -> github_lookup
   -> npm_lookup
   -> course_rag_lookup
   -> refuse_or_clarify
-> synthesize_answer
-> validate_answer
-> END
```

它学习的是：

- `classify_task`：模型或规则把用户输入分成任务类型。
- `route_by_task`：conditional edge 决定下一步。
- `github_lookup` / `npm_lookup`：真实外部工具节点。
- `course_rag_lookup`：真实知识库检索节点。
- `synthesize_answer`：真实模型基于 state 生成最终回答。
- `validate_answer`：检查结构化输出和引用。

## Step 1：理解 LangGraph 解决什么问题

做什么：

对比阶段 3 `createAgent` 和阶段 5 `StateGraph` 的职责边界。

为什么现在做：

你已经知道 agent 可以自动选择工具，但真实项目里很多流程不能完全交给模型自由循环。LangGraph 的价值是把流程显式化：谁先做、谁后做、什么时候停、失败怎么处理。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `phase2/src/tool-assistant-demo.ts`
- `phase3/README.md`
- LangGraph `StateGraph` 官方文档

练习：

- 写一段对照笔记：哪些任务适合 `createAgent`，哪些任务适合 `StateGraph`。
- 把阶段 2 的工具助理流程画成 4 到 6 个节点。

验收：

- 能解释 LangGraph 不是“更高级的 prompt”，而是显式 workflow / state machine。
- 能说清楚什么时候该从 agent harness 切到 graph。

不做什么：

- 不一开始做多 agent。
- 不做持久化。
- 不做人工审批。

## Step 2：确定真实 graph 场景和节点边界

做什么：

确定阶段 5 第一个 graph 处理什么任务，并把任务拆成节点。

建议第一版节点：

```text
classify_task
github_lookup
npm_lookup
course_rag_lookup
synthesize_answer
validate_answer
```

为什么现在做：

LangGraph 最难的不是 API，而是节点边界。节点太大，图没有意义；节点太碎，又会绕。第一版要围绕真实项目最小闭环拆。

价值标签：必须学，高价值

来源/定位：工程实践 + 作品集准备

重点看：

- `phase2/src/tools.ts`
- `phase4/README.md`
- 新建 `phase5/src/workflow-plan.ts`

练习：

- 写出每个节点的输入 state key。
- 写出每个节点会更新哪些 state key。
- 标出哪些节点会调用真实外部 API。

验收：

- 每个节点一句话能讲清职责。
- 没有“万能 node”。
- 没有为了凑图而拆出来的空节点。

不做什么：

- 不做 20 个节点的大图。
- 不引入 subgraph。
- 不把阶段 6 的 deep research 提前搬进来。

## Step 3：设计 GraphState

做什么：

用 `StateSchema` 定义 graph 共享状态。

建议第一版：

```ts
const GraphState = new StateSchema({
  input: z.string(),
  taskType: z.enum([
    "github_repo",
    "npm_package",
    "course_knowledge",
    "unknown",
  ]).optional(),
  messages: MessagesValue,
  toolResults: new ReducedValue(
    z.array(toolResultSchema).default(() => []),
    { reducer: (current, update) => current.concat(update) },
  ),
  citations: new ReducedValue(
    z.array(citationSchema).default(() => []),
    { reducer: (current, update) => current.concat(update) },
  ),
  events: new ReducedValue(
    z.array(runEventSchema).default(() => []),
    { reducer: (current, update) => current.concat(update) },
  ),
  answer: z.string().optional(),
  error: z.string().optional(),
});
```

为什么现在做：

LangGraph 的核心是 state。state 设计不好，后面 node、edge、测试、报告都会混乱。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- 新建 `phase5/src/graph-state.ts`
- `StateSchema`
- `MessagesValue`
- `ReducedValue`

练习：

- 定义 `GraphState`。
- 明确哪些字段会被覆盖，哪些字段要追加。
- 给 `toolResults`、`citations`、`events` 使用 reducer。

验收：

- 能解释 state 里的每个 key 为什么存在。
- 能解释普通字段默认覆盖，reducer 字段会合并。
- 不把 API key、完整 header、敏感配置放进 state。

不做什么：

- 不设计长期记忆。
- 不做数据库 schema。
- 不把所有未来可能用的字段都塞进 state。

## Step 4：写第一个最小 StateGraph

做什么：

先写一个最小可运行图：`START -> classify_task -> END`。

建议结构：

```ts
const graph = new StateGraph(GraphState)
  .addNode("classify_task", classifyTaskNode)
  .addEdge(START, "classify_task")
  .addEdge("classify_task", END)
  .compile();

const result = await graph.invoke({ input: userInput });
```

为什么现在做：

先跑通 LangGraph 的最小生命周期：定义 state、注册 node、连接 edge、compile、invoke。不要第一步就把工具、RAG、路由全塞进去。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- 新建 `phase5/src/minimal-graph-demo.ts`
- `START`
- `END`
- `addNode`
- `addEdge`
- `compile`
- `invoke`

练习：

- `classify_task` 先根据输入关键词做非常小的确定性分类。
- 打印 graph 最终 state。
- 确认 node 返回的是 state patch，不是直接修改原 state。

验收：

- `pnpm phase5:minimal` 能运行。
- 结果里能看到 `taskType` 被写入 state。
- 能解释 `START` 和 `END` 不是普通业务节点。

不做什么：

- 不调用真实模型。
- 不调用外部工具。
- 不做条件路由。

## Step 5：把节点写成可测试的函数

做什么：

把 node 从 CLI 里拆出来，写成可以单独测试的函数。

为什么现在做：

LangGraph 的一个大价值是节点可以单独测试。你不应该每次都跑完整 graph 才知道某个节点有没有问题。

价值标签：必须学，高价值

来源/定位：工程实践

重点看：

- 新建 `phase5/src/nodes/classify-task.ts`
- 新建 `phase5/tests/classify-task.test.ts`
- `GraphNode<typeof GraphState>`

练习：

- 给 `classifyTaskNode` 准备 5 个输入。
- 测试它返回的 state patch。
- 确认测试不需要真实模型和网络。

验收：

- node 测试只关心输入 state 和输出 patch。
- node 内部没有偷偷读 CLI 参数。
- node 内部没有偷偷写全局变量。

不做什么：

- 不为了测试写假业务工具。
- 不把 graph 全部 mock 掉。
- 不测试 LangGraph 官方库本身。

## Step 6：加入真实模型分类节点

做什么：

把 `classify_task` 从简单关键词分类升级成真实模型结构化分类。

建议输出：

```ts
type TaskClassification = {
  taskType: "github_repo" | "npm_package" | "course_knowledge" | "unknown";
  reason: string;
  needsClarification: boolean;
};
```

为什么现在做：

真实用户输入不会总是写得规整。模型适合把自然语言输入归一化成 graph 可以路由的结构。

价值标签：必须学，中高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- `phase1/src/chat-model-factory.ts`
- `phase2/src/structured-output.ts`
- 新建 `phase5/src/nodes/classify-task-with-model.ts`

练习：

- 使用真实 chat model。
- 使用结构化输出或 Zod 校验分类结果。
- 分类失败时写入 `error` 或路由到 `refuse_or_clarify`。

验收：

- 不使用 mock 模型。
- 分类结果稳定进入 state。
- 分类失败不会让 graph 崩成难懂错误。

不做什么：

- 不做多模型路由。
- 不加复杂 fallback。
- 不让模型直接决定所有后续执行细节。

## Step 7：用 conditional edge 做路由

做什么：

根据 `taskType` 使用 `addConditionalEdges` 路由到不同节点。

建议路由：

```text
github_repo -> github_lookup
npm_package -> npm_lookup
course_knowledge -> course_rag_lookup
unknown -> refuse_or_clarify
```

为什么现在做：

条件边是 LangGraph 和普通链式调用最重要的区别之一。它让流程选择显式、可读、可测。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- 新建 `phase5/src/routing.ts`
- `addConditionalEdges`
- `ConditionalEdgeRouter`

练习：

- 写 `routeByTask(state)`。
- 给每种 `taskType` 写 path test。
- unknown 必须走拒答或澄清节点。

验收：

- 每个任务类型都有明确下一跳。
- 不会出现没有处理的任务类型。
- 你能画出 graph 的执行路径。

不做什么：

- 不用 `Command` 代替所有条件边。
- 不做动态创建节点。
- 不把路由逻辑散落在各个 node 里。

## Step 8：接入真实工具节点

做什么：

把阶段 2 的真实外部工具接进 graph node。

建议节点：

```text
github_lookup -> 调用 getGitHubRepository / searchGitHubRepositories
npm_lookup -> 调用 getNpmPackage
course_rag_lookup -> 调用阶段 4 RAG 检索/问答
```

为什么现在做：

Graph 不是纸上流程图。它必须能承载真实外部调用，并把结果写回 state，供后续节点使用。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 作品集准备

重点看：

- `phase2/src/tools.ts`
- `phase2/src/tool-runner.ts`
- 阶段 4 后续的 `phase4/src/rag-tool.ts`
- 新建 `phase5/src/nodes/tool-nodes.ts`

练习：

- 在工具节点里调用真实 GitHub API / npm registry。
- 工具成功时追加到 `toolResults`。
- 工具失败时追加到 `events`，并写入可读错误。

验收：

- 不使用 fake tool result。
- 工具结果能在后续 state 中看到。
- 工具错误不会被吞掉。

不做什么：

- 不加入写入型高风险工具。
- 不做自动重试风暴。
- 不让模型直接执行 shell。

## Step 9：用 reducer 记录事件、错误和证据

做什么：

用 `ReducedValue` 追加记录 graph 运行过程中的 events、tool results、citations。

为什么现在做：

多个节点都会产生日志、证据和错误。如果没有 reducer，后一个节点可能覆盖前一个节点的结果。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- `phase5/src/graph-state.ts`
- `ReducedValue`
- `MessagesValue`

练习：

- 定义 `RunEvent`。
- 每个节点开始和结束时追加 event。
- 记录 node name、latency、ok、errorMessage。

验收：

- 运行结束能看到完整节点顺序。
- 多个工具结果不会互相覆盖。
- 引用来源不会丢失。

不做什么：

- 不做完整 APM 系统。
- 不把完整 API 响应全塞进事件日志。
- 不记录 API key 或敏感 header。

## Step 10：最终 synthesis node 生成结构化答案

做什么：

用真实模型读取 state 中的工具结果、RAG 引用和错误，生成最终结构化答案。

建议输出：

```ts
type GraphAnswer = {
  answer: string;
  usedNodes: string[];
  sources: Array<{
    kind: "github" | "npm" | "rag";
    label: string;
    urlOrPath?: string;
  }>;
  warnings: string[];
  needsHumanReview: boolean;
};
```

为什么现在做：

Graph 的节点负责收集证据，最终节点负责把证据组织成用户能读懂的答案。这样比“工具节点自己顺手回答”更清楚。

价值标签：必须学，高价值

来源/定位：工程实践 + 作品集准备

重点看：

- `phase2/src/structured-output.ts`
- `phase4/README.md` 的 citation 输出思路
- 新建 `phase5/src/nodes/synthesize-answer.ts`

练习：

- 只允许基于 state 中已有证据回答。
- 如果没有证据，生成拒答或澄清。
- 用 Zod 校验最终结构化对象。

验收：

- 最终答案能说明用了哪些节点和来源。
- 没有证据时不会编造。
- 输出结构稳定，适合后续 UI 展示。

不做什么：

- 不生成长篇研究报告。
- 不让最终节点重新调用一堆外部工具。
- 不把 citation 交给模型凭空编。

## Step 11：用 stream updates 和 Mermaid 图观察 graph

做什么：

用 `graph.stream(..., { streamMode: "updates" })` 观察每个节点的 state update，并导出 Mermaid 图或文本图。

为什么现在做：

LangGraph 的优势之一是可观察。只看最终答案，你还是不知道图怎么跑的；看 updates 和 graph 图，才能定位流程问题。

价值标签：值得学，中高价值

来源/定位：官方核心概念 + 作品集准备

重点看：

- 新建 `phase5/src/inspect-graph.ts`
- `graph.stream`
- `streamMode: "updates"`
- `graph.getGraphAsync()`

练习：

- 打印每个 update 对应的 node name 和 state patch 摘要。
- 输出 Mermaid 图到 `phase5/artifacts/graph.mmd`。
- 在 README 里记录一次真实运行路径。

验收：

- 能看到节点级执行过程。
- 能画出 graph 结构。
- run report 和 graph 图能互相对上。

不做什么：

- 不做 WebSocket / SSE 前端推送。
- 不做 token 级 streaming UI。
- 不做 LangGraph Studio 深度接入。

## Step 12：处理循环、终止条件和运行限制

做什么：

明确 graph 什么时候停止，并设置基础运行限制。

建议第一版：

```text
没有工具需求 -> END
工具失败且不可恢复 -> synthesize_answer with warning -> END
未知任务 -> refuse_or_clarify -> END
超过 recursionLimit -> 记录错误 -> 退出
```

为什么现在做：

一旦 graph 有条件路由或循环，就必须防止无限执行。真实项目里 graph 卡住比普通函数报错更难排查。

价值标签：必须学，中高价值

来源/定位：官方核心概念 + 安全工程实践

重点看：

- 新建 `phase5/src/graph-limits.ts`
- `GraphRecursionError`
- `recursionLimit`
- route function 的默认分支

练习：

- 给 `unknown` 输入写拒答路径。
- 故意构造一个会循环的测试 graph，观察 `recursionLimit`。
- 把限制错误写入 run report。

验收：

- 每条路径最终都能到 `END`。
- 路由函数有默认分支。
- 超限错误可读、可排查。

不做什么：

- 不做复杂预算系统。
- 不做自动恢复执行。
- 不做持久化 checkpoint。

## Step 13：写节点测试和 graph path 测试

做什么：

为关键节点和关键路径写测试。

建议测试层次：

```text
node test: 输入 state -> 输出 patch
router test: 输入 taskType -> 下一跳
graph path test: 输入问题 -> 预期经过哪些节点
integration smoke test: env 配好时调用真实 API
```

为什么现在做：

LangGraph 的价值不只是运行，还在于流程可测试。你要能证明某类输入会走正确路径，而不是靠肉眼看一次输出。

价值标签：必须学，高价值

来源/定位：工程实践 + 作品集准备

重点看：

- 新建 `phase5/tests/routing.test.ts`
- 新建 `phase5/tests/graph-paths.test.ts`
- `phase2/tests/tool-runner.test.ts`

练习：

- 测试 GitHub 问题会路由到 `github_lookup`。
- 测试 npm 问题会路由到 `npm_lookup`。
- 测试课程知识问题会路由到 `course_rag_lookup`。
- 测试 unknown 会路由到 `refuse_or_clarify`。

验收：

- 关键路径可重复验证。
- 单元测试不依赖真实网络。
- 真实 API 测试可以通过 env 开关运行。

不做什么：

- 不为了测试伪造主线业务。
- 不把所有测试都写成端到端慢测试。
- 不测试 LangGraph 官方内部实现。

## 本阶段不是核心，但未来可以深化

### 1. `Command`

价值：中高，复杂路由时有用。

为什么暂缓：

第一版用 `addConditionalEdges` 更容易看懂。`Command` 会把 state update 和 goto 合在 node 里，初学时容易让流程变隐蔽。

未来深化：

- 某个 node 同时写入结果并决定下一跳。
- 子图向父图发送更新。
- 构建更紧凑的专家路由节点。

### 2. `Send` 和动态并行

价值：高，阶段 6 Deep Research 会用。

为什么暂缓：

动态并行会引入并发、结果合并、限流和失败聚合。阶段 5 先学单路由和少量固定分支。

未来深化：

- 把一个研究问题拆成多个子问题。
- 为每个子问题 `Send` 一个 worker。
- 用 reducer 合并 worker 证据。

### 3. Subgraph

价值：高，复杂项目会用。

为什么暂缓：

第一版 graph 节点还少，不需要把 graph 再拆成 graph。过早 subgraph 会增加心智负担。

未来深化：

- 把 RAG 流程做成 subgraph。
- 把 GitHub 分析流程做成 subgraph。
- 多 agent 时每个 agent 一个 subgraph。

### 4. Persistence / Checkpointer

价值：高，但属于阶段 7 主线。

为什么暂缓：

阶段 5 先学状态图本身。持久化会引入 thread id、checkpoint、恢复、存储后端。

未来深化：

- 用 `MemorySaver` 做本地 checkpoint。
- 用 SQLite/Postgres checkpointer 做可恢复执行。
- 在失败节点后从 checkpoint 继续。

### 5. Human-in-the-loop interrupt

价值：高，涉及高风险动作时非常重要。

为什么暂缓：

当前工具仍以只读查询为主，没有删除、转账、发消息等高风险动作。人工审批更适合阶段 7。

未来深化：

- 高风险工具调用前 `interrupt()`。
- 用户修改参数后用 `Command` 恢复。
- 记录审批日志。

### 6. LangGraph streaming events

价值：中高，UI 展示时有用。

为什么暂缓：

阶段 5 先看 `updates`，已经足够理解节点级执行。更细粒度 token / tool event streaming 可以后面接 UI 时学。

未来深化：

- 同时 stream `updates` 和 `messages`。
- 前端实时展示节点进度。
- 展示工具调用进度和模型 token。

### 7. LangGraph Studio / LangSmith 深度 trace

价值：中高，作品集展示和调试有用。

为什么暂缓：

先用本地 run report 和 Mermaid 图理解基本流程。Studio / LangSmith 深度接入会引入额外账号、配置和调试面板。

未来深化：

- 每次 graph run 写入 LangSmith project。
- 对比不同 graph 版本的失败路径。
- 展示 trace 链接。

### 8. Durable deployment

价值：高，生产部署需要。

为什么暂缓：

阶段 5 只做本地 CLI。部署会引入服务框架、队列、数据库、鉴权、运行时隔离。

未来深化：

- 用 LangGraph Platform / 自建 API 服务运行 graph。
- 给每个 run 分配 thread id。
- 接入任务队列和状态查询 API。

### 9. MCP 工具平台

价值：中高，工具生态化时重要。

为什么暂缓：

阶段 5 主要学 graph 编排，不学工具协议。MCP 更适合阶段 8。

未来深化：

- 把 GitHub、npm、RAG 统一成 MCP tools。
- graph 节点调用 MCP client。
- 加权限、审计和工具白名单。

## 阶段完成标准

- [ ] 能解释 `createAgent` 和 `StateGraph` 的区别。
- [ ] 能设计一个不过度复杂的 `GraphState`。
- [ ] 能解释 state update 是 patch，不是直接修改 state。
- [ ] 能写 `START -> node -> END` 的最小 graph。
- [ ] 能用 `addNode` / `addEdge` / `compile` / `invoke`。
- [ ] 能用 `addConditionalEdges` 做显式路由。
- [ ] 能把阶段 2 真实工具接成 graph node。
- [ ] 能把阶段 4 RAG 接成只读知识节点。
- [ ] 能用 reducer 合并 events、tool results、citations。
- [ ] 能输出结构化最终答案。
- [ ] 能用 `streamMode: "updates"` 看节点级 state patch。
- [ ] 能导出或打印 graph 结构。
- [ ] 能处理 unknown、工具失败、证据不足和运行超限。
- [ ] 能写节点测试和 graph path 测试。
- [ ] 能说明哪些内容暂缓到阶段 6、阶段 7 或阶段 8。

## 推荐命令规划

后续实现时建议逐步增加：

```bash
pnpm phase5:minimal "请查询 langchain-ai/langchainjs"
pnpm phase5:graph "请查询 langchain-ai/langchainjs，并说明 @langchain/core npm 包的用途"
pnpm phase5:stream "课程里 RAG 和 LangGraph 分别解决什么问题"
pnpm phase5:inspect
pnpm phase5:path-tests
```

## 参考资料

- LangGraph.js overview: https://docs.langchain.com/oss/javascript/langgraph
- LangGraph.js quickstart: https://docs.langchain.com/oss/javascript/langgraph/quickstart
- LangGraph.js Graph API overview: https://docs.langchain.com/oss/javascript/langgraph/graph-api
- LangGraph.js use Graph API: https://docs.langchain.com/oss/javascript/langgraph/use-graph-api
- LangGraph.js streaming: https://docs.langchain.com/oss/javascript/langgraph/streaming
- LangGraph.js persistence: https://docs.langchain.com/oss/javascript/langgraph/persistence
- LangGraph.js subgraphs: https://docs.langchain.com/oss/javascript/langgraph/use-subgraphs
- `@langchain/langgraph` API reference: https://reference.langchain.com/javascript/langchain-langgraph

## 一句话复习

```text
阶段 5 学的是：用 LangGraph StateGraph 把真实模型、真实工具和真实知识库编排成显式、可测、可观察的状态图。
```
