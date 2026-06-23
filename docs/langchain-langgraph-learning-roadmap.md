# LangChain.js 与 LangGraph.js 学习路线图

版本日期：2026-06-20

目标：从能调用模型，逐步进阶到能设计、实现、评估、部署作品集级别的 agent 系统。路线不绑定某一个大模型，优先学习成熟工具和可迁移的工程能力。

生成或修改每个阶段课程大纲时，必须遵守：`docs/course-outline-rules.md`。

## 总体策略

这条路线分成两条并行主线：

- 知识深化线：模型抽象、工具调用、结构化输出、RAG、agent harness、状态图、持久化、人类介入、流式输出、评估、安全、部署。
- 项目推进线：每学一层能力，就做一个可展示的小项目；最后把这些能力整合成一个完整的作品集项目。

建议周期：16 到 28 周。已有 TypeScript、Node.js、后端或 AI 应用经验时可压缩；如果希望吃透底层机制，按 24 周以上更稳。

核心判断：

- 简单 agent 和常见工具循环优先用 LangChain.js 的 `createAgent`。
- 需要确定性流程、长任务、状态管理、人类审批、多 agent 编排时使用 LangGraph.js。
- 观测、调试、评估从一开始就接入 LangSmith，而不是项目后期才补。
- 模型选择只作为配置和评测变量，不写死在业务逻辑里。

## 成熟工具栈

基础工程：

- TypeScript strict mode、Node.js LTS、pnpm、Zod、Vitest、Playwright、Docker。
- Web 项目可选 Next.js；纯后端服务可选 Hono、Fastify 或 Express。
- 数据层优先 PostgreSQL；向量检索可选 pgvector、Qdrant、Pinecone、Weaviate 等，根据部署成本和团队熟悉度选择。

AI 应用核心：

- LangChain.js：模型、消息、工具、结构化输出、agent harness、middleware、retrieval 集成。
- LangGraph.js：状态图、节点、边、条件路由、reducers、subgraphs、持久化、interrupt、人类介入、流式事件。
- LangSmith：trace、debug、dataset、offline evaluation、online evaluation、实验对比。
- MCP：把外部工具以标准协议接入 agent，适合把数据库、文件系统、搜索、业务 API 包装成可组合工具。
- Vercel AI SDK：适合作为前端聊天、流式 UI、多 provider UI 层的补充；核心 agent 编排仍建议放在 LangChain/LangGraph 侧。

关于 Hermes Agent / OpenClaw / 个人常驻 agent：

- 不建议作为 LangChain.js 与 LangGraph.js 学习主线的必备工具。
- 如果 Hermes 指的是某个模型，例如开源 Hermes 系列模型，它只应进入“模型能力矩阵”，用于对比 tool calling、结构化输出、延迟和成本，而不是决定架构。
- 如果 Hermes Agent 指的是常驻个人 agent harness，它适合作为阶段 8 之后的参考对象，学习它如何处理 memory、scheduler、shell、skills、多 profile 和本地工作流。
- 作品集项目更建议自己用 LangGraph 搭一个可观察、可恢复、可审批的 graph，而不是直接套一个黑盒 personal agent。
- 常驻 agent 往往把消息、记忆、计划任务、文件系统、shell 放在同一个权限边界里，安全风险更高；必须有最小权限、审批、审计和 prompt injection 防护。

安全与可靠性：

- OWASP Top 10 for LLM Applications 作为 agent 安全检查清单。
- 最小权限工具、参数 schema、工具白名单、人工审批、速率限制、预算限制、日志脱敏、可回放 trace。

## 项目推进地图

这一节是整条路线的项目主线。每学完一组能力，就做一个对应项目；不要等全部学完再开始做大项目。前面的项目是后面项目的积木，最后组合成作品集级 Capstone。

| 学完的内容 | 可以做的项目 | 项目目标 | 重点展示能力 |
| --- | --- | --- | --- |
| 阶段 0：TypeScript、Node.js、异步、测试基础 | AI 调用 CLI | 做一个可配置 provider/model 的命令行模型调用器 | 工程基础、错误处理、环境变量、调用日志 |
| 阶段 1：模型抽象、messages、invoke、stream | Model Interface Lab | 做一个可配置、可观测的模型调用层 | 不绑定模型、messages 边界、结果归一化、调用日志 |
| 阶段 2：tools、Zod schema、structured output | Structured Tool Assistant | 一个能查资料、改任务状态、输出结构化结果的工具型助理 | 工具调用、参数校验、结构化输出、失败恢复 |
| 阶段 3：`createAgent`、middleware、memory、observability | Personal Operations Agent | 一个带 Web UI 的个人运营助理，可展示 tool calls 和 trace | agent harness、middleware、短期记忆、调试可视化 |
| 阶段 4：RAG、chunking、embedding、retriever、citation | Knowledge Base Assistant | 对真实文档集问答，答案带引用，找不到依据时拒答 | RAG 工程、引用溯源、检索评估、拒答能力 |
| 阶段 5：StateGraph、state、node、edge、reducer | Graph Workflow Assistant | 用 LangGraph 重写前面的工具助理，把流程拆成显式状态图 | 状态建模、条件路由、节点测试、可控编排 |
| 阶段 6：workflow patterns、parallel、routing、evaluator | Deep Research Workflow | 自动拆解研究问题，并行检索，评估证据，生成报告 | 多步骤工作流、并行 worker、evaluator-optimizer |
| 阶段 7：persistence、interrupt、streaming、memory | Durable Agent Workspace | 可恢复长任务 workspace，高风险动作需要用户审批 | 持久化、人类介入、流式进度、长期记忆 |
| 阶段 8：MCP、多工具、多 agent、安全边界 | Agent Tool Platform | 通过 MCP 接入多个工具，并做权限、审计和审批面板 | 工具生态、权限控制、审计、多 agent/多工具协作 |
| 阶段 9：LangSmith eval、dataset、监控、成本控制 | Production Agent Evaluation Suite | 为前面任一项目建立回归评估、trace 分析和质量看板 | 评估体系、生产观测、回归测试、成本性能控制 |
| 阶段 10：综合能力 | Capstone 作品集项目 | 做一个真实可部署的 agent 产品，例如 Research OS、Codebase Intelligence Agent 或 Solidity Audit Agent | 架构完整性、可靠性、安全性、评估报告、部署能力 |

项目之间的升级关系：

- AI 调用 CLI 升级成 Model Interface Lab：从“能调用一个接口”变成“有可配置、可替换、可观测的模型层”。
- Structured Tool Assistant 升级成 Personal Operations Agent：从“能调用工具”变成“有 agent harness、UI 和 trace”。
- Knowledge Base Assistant 升级成 Deep Research Workflow：从“单次 RAG 问答”变成“多步骤研究系统”。
- Graph Workflow Assistant 升级成 Durable Agent Workspace：从“状态图 demo”变成“可恢复、可审批、可长时间运行的应用”。
- Agent Tool Platform 升级成 Capstone：从“工具接入能力”变成“真实场景里的完整 agent 产品”。

每个项目都要产出：

- 可运行代码和 README。
- 至少 1 张架构图或流程图。
- 至少 5 条失败案例复盘。
- 至少 20 条基础评估样例；RAG 和 Capstone 项目建议 50 到 100 条。
- 一段 demo 说明：输入是什么，agent 做了哪些步骤，为什么结果可信。

## 阶段 0：预备能力

目标：避免把问题误认为是 LangChain 或 LangGraph 的问题，其实是 TypeScript、异步、HTTP、数据建模或测试基础不牢。

要掌握：

- TypeScript 泛型、联合类型、类型收窄、Zod schema、环境变量管理。
- Node.js async iterator、stream、AbortController、错误处理、重试、超时。
- API route、server-sent events、websocket 的基本取舍。
- 基础测试：单元测试、集成测试、mock 外部 API。

练习：

- 写一个 CLI：输入 prompt，选择 provider/model，输出文本、token usage、latency。
- 给 CLI 加 `timeout`、`maxRetries`、错误分类和日志。

完成标准：

- 模型 key 不出现在代码里。
- 同一段业务逻辑可切换至少两个 provider。
- 每次调用记录 provider、model、latency、cost estimate、error type。

## 阶段 1：模型抽象与 provider 无关设计

目标：理解 LangChain.js 的模型接口，建立“不绑定某个模型”的工程习惯。

要掌握：

- `initChatModel`、chat model、embedding model、message roles。
- `invoke`、`stream` 的差异。
- `AIMessage`、`response.text`、usage metadata、response metadata。
- 模型配置、mock provider、中转地址、调用日志。

项目 1：Model Interface Lab

- 做一个模型调用实验台，支持配置 provider/model。
- 支持 `mock` 和至少一个真实 provider 或 OpenAI-compatible 中转。
- 支持 `invoke` 和最小 `stream`。
- 记录 provider、model、latency、runId、错误摘要。

完成标准：

- 业务代码只依赖统一的 model factory。
- 模型名、provider、temperature、max tokens 都由配置管理。
- 能解释 messages 的 role、`AIMessage` 返回值和结果归一化。

## 阶段 2：工具调用与结构化输出

目标：从“聊天机器人”进阶为“能可靠执行动作的系统”。

要掌握：

- LangChain `tool`、Zod 参数 schema、工具命名规范。
- tool calling 与 function calling 的关系。
- 工具返回值设计：文本、对象、错误、可展示 artifact。
- 结构化输出：Zod schema、JSON Schema、provider strategy、tool strategy。
- 工具错误处理：可重试错误、用户可修复错误、系统错误。

项目 2：Tool-Using Assistant

- 做一个任务助理，工具包括：搜索本地文档、读取模拟数据库、创建任务、修改任务状态。
- 要求所有工具都有 schema、权限描述和测试。
- agent 输出必须包含结构化字段：`answer`、`actionsTaken`、`confidence`、`needsHumanReview`。

完成标准：

- 工具不能直接执行高风险操作，必须先生成计划或等待确认。
- malformed tool args 有明确错误信息。
- 结构化输出解析失败时有 fallback 或重试策略。

## 阶段 3：LangChain agent harness 与 middleware

目标：理解 LangChain.js 高层 agent 的边界：什么时候够用，什么时候该换 LangGraph。

要掌握：

- `createAgent` 的核心组成：model、tools、prompt、middleware。
- prompt 与系统约束的分层：身份、目标、工具规则、输出格式、安全边界。
- middleware：日志、重试、路由、guardrails、上下文注入。
- short-term memory 与 message trimming。
- 人类介入模式的基础用法。

项目 3：Personal Operations Agent

- 做一个个人运营助理：整理输入、查询资料、拆任务、生成日程建议。
- 加入 middleware：敏感信息过滤、工具调用审计、模型路由。
- 做一个简单 Web UI，能实时显示 assistant response 与 tool calls。

完成标准：

- trace 能看清每一步 prompt、tool call、latency、错误。
- prompt、tools、model config 可以独立修改。
- UI 能展示“模型为什么调用某个工具”的最小调试信息。

## 阶段 4：Retrieval 与 RAG

目标：掌握知识库应用，不止会做向量搜索，还能设计可评估的 RAG 系统。

要掌握：

- document loader、chunking、metadata、embedding、vector store、retriever。
- 2-step RAG、agentic RAG、hybrid RAG 的取舍。
- query rewriting、multi-query retrieval、reranking、citation、answer grounding。
- 文档更新、增量索引、权限过滤、多租户隔离。
- RAG 评估：召回率、引用正确性、答案忠实度、拒答能力。

项目 4：Knowledge Base Assistant

- 选择一个真实资料集，例如课程文档、技术文档、论文、项目 README。
- 实现文档导入、分块、索引、检索、引用回答。
- 提供“答案引用到原文片段”的 UI。
- 构建 50 到 100 条问题 dataset，用 LangSmith 或自建脚本做离线评估。

完成标准：

- 每个回答能显示引用来源。
- 找不到依据时会拒答，而不是编造。
- 能对比不同 chunk size、embedding、topK、reranker 设置。

## 阶段 5：LangGraph 心智模型

目标：从“让 agent 自己循环”进阶为“把复杂任务拆成可控的状态机”。

要掌握：

- `StateGraph`、`StateSchema`、node、edge、conditional edge、`START`、`END`。
- state 设计：messages、intermediate results、artifacts、errors、budget。
- reducer 的作用：并发分支如何合并结果。
- `Command`、`Send`、subgraph、runtime context。
- graph 与普通 workflow、agent loop 的关系。

练习：

- 用 LangGraph 重写阶段 2 的工具助理。
- 把“理解任务、选择工具、执行、总结”拆成显式节点。
- 给每个节点写测试，测试输入 state 和输出 patch。

完成标准：

- 每个节点职责单一。
- 条件路由逻辑可读、可测。
- state schema 能解释清楚：哪些是短期状态，哪些是长期记忆，哪些是外部持久化数据。

## 阶段 6：工作流模式

目标：掌握 agent 系统常用架构，而不是每次从空白开始想。

要掌握：

- Prompt chaining：分步生成、验证、改写。
- Parallelization：并行子任务、多评委投票、速度与置信度提升。
- Routing：分类后进入不同专家流程。
- Orchestrator-worker：规划器动态创建 worker，适合写报告、代码分析、多文件处理。
- Evaluator-optimizer：生成、评分、反馈、重试，适合有清晰质量标准的任务。
- Agent loop：适合路径不可预知、工具选择开放的任务。

项目 5：Deep Research Workflow

- 输入一个研究问题。
- planner 生成子问题。
- workers 并行检索、摘要、提取证据。
- evaluator 检查引用质量、覆盖面、矛盾点。
- synthesizer 输出最终报告。

完成标准：

- 至少包含 routing、parallel workers、evaluator-optimizer 三种模式。
- 每个 worker 的输出保存在 state 中，可追踪。
- 报告中明确区分事实、推断、未知。

## 阶段 7：持久化、记忆、流式输出与人类介入

目标：把 demo 变成能跑长任务、能恢复、能被用户监督的应用。

要掌握：

- checkpointer：线程级短期状态、恢复、time travel、fault tolerance。
- store：跨线程长期记忆、用户偏好、事实、案例库。
- memory 类型：semantic、episodic、procedural。
- interrupt：审批、编辑状态、验证输入、暂停后恢复。
- event streaming：token、state updates、tool progress、interrupt payload。

项目 6：Durable Agent Workspace

- 一个可以长时间运行的 agent workspace。
- 用户关闭页面后，任务仍可恢复。
- 高风险动作触发 interrupt，用户审批后继续。
- UI 展示 token streaming、节点进度、工具进度、当前等待的人工输入。

完成标准：

- 同一个 `thread_id` 可恢复会话。
- 节点失败后不会丢失已完成步骤。
- 人类审批前不会执行高风险工具。
- trace 中能看到 state transition。

## 阶段 8：MCP、多工具生态与多 agent

目标：让系统能接入真实世界工具，同时保持边界和可控性。

要掌握：

- MCP server、transport、tool discovery、tool loading。
- 本地工具与远程工具的鉴权、权限、审计。
- multi-agent 的几种形态：supervisor、specialists、handoff、blackboard/shared state。
- 工具安全：最小权限、命令白名单、参数校验、dry run、审批、审计日志。

项目 7：Agent Tool Platform

- 写 2 到 3 个 MCP server：例如文档搜索、任务系统、数据库查询。
- LangChain/LangGraph agent 通过 MCP 使用这些工具。
- 做一个工具权限面板：启用/禁用工具、查看调用历史、设置审批规则。

完成标准：

- 工具 schema 清晰，失败可观察。
- 每个工具有权限等级和审计日志。
- agent 不能调用未授权工具。

## 阶段 9：评估、测试、观测与生产化

目标：作品集项目必须能证明“可靠”，而不是只证明“能跑”。

要掌握：

- LangSmith tracing：本地 debug、生产监控、metadata、tags。
- Offline evaluation：dataset、evaluators、experiment comparison、regression tests。
- Online evaluation：生产抽样、安全检查、格式检查、质量监控、反馈闭环。
- 测试分层：纯函数节点测试、工具集成测试、graph path 测试、RAG dataset 测试、端到端 UI 测试。
- 成本与性能：token budget、缓存、batch、并发限制、fallback、熔断。

项目要求：

- 每个项目都保留 `evals/` 或 `datasets/`。
- 每次重要改动跑回归集。
- README 展示质量指标，不只展示截图。

完成标准：

- 有固定 golden dataset。
- 有至少 3 类 evaluator：规则、代码、LLM-as-judge 或人工标注。
- 能比较两个版本的 agent 表现。

## 阶段 10：作品集级 Capstone

目标：做一个让人一眼看出你掌握 agent 系统工程的项目。

推荐方向 1：AI Research Operating System

- 用户输入研究主题，系统自动规划、检索、阅读、对比、生成报告。
- 支持多轮追问、引用追踪、观点冲突检测、报告版本管理。
- LangGraph 编排 planner、retrievers、workers、evaluator、synthesizer、citation checker。
- LangSmith 展示 traces 和评估结果。

推荐方向 2：Codebase Intelligence Agent

- 连接一个真实代码仓库，支持架构问答、变更影响分析、PR review、测试建议。
- RAG 负责代码和文档检索，LangGraph 负责多步骤分析。
- 高风险操作，例如生成 patch 或执行命令，必须 human-in-the-loop。
- 作品集亮点是“可解释分析链路”和“评估集”。

推荐方向 3：Solidity Security Learning/Audit Agent

- 结合 Solidity 学习或审计场景，读取合约、课程资料、漏洞案例。
- 功能包括：合约解释、漏洞定位、攻击路径推演、修复建议、测试用例生成。
- 使用 evaluator 检查漏洞分类、证据引用、误报率、修复建议是否可执行。
- 适合把当前学习方向和 AI agent 能力结合成差异化作品。

Capstone 必备功能：

- 多 provider model routing。
- RAG 与引用。
- LangGraph 状态图，包含条件路由、并行 worker、evaluator-optimizer。
- checkpointer/store，支持会话恢复和长期记忆。
- interrupt 人类审批。
- 流式 UI，展示节点进度、工具调用、最终输出。
- LangSmith trace 和 evaluation。
- 安全边界：工具权限、敏感信息处理、成本限制、审计日志。
- README、架构图、demo 视频、评估报告、部署说明。

Capstone 架构建议：

```text
Web UI
  -> API / Agent Server
    -> LangGraph app
      -> intake node
      -> planner node
      -> router node
      -> retrieval workers
      -> tool execution nodes
      -> evaluator node
      -> human approval interrupt
      -> synthesizer node
      -> memory writer node
    -> checkpointer / store
    -> vector store / relational DB
    -> LangSmith tracing and evaluation
```

作品集验收标准：

- 不是单轮聊天，而是一个真实工作流。
- 不是只接一个模型，而是能配置和比较多个模型。
- 不是只展示回答，而是展示证据、过程、评估和失败处理。
- 不是只在本地能跑，而是有部署路径、环境变量说明、测试和回归集。
- 不是隐藏复杂性，而是把复杂任务拆成可观察、可恢复、可改进的 graph。

## 每周学习节奏

建议每周 5 个学习块：

- 第 1 块：读官方文档和 API reference，只读当前阶段相关内容。
- 第 2 块：做最小代码实验，验证一个概念。
- 第 3 块：把概念接入阶段项目。
- 第 4 块：写测试、trace、评估样例。
- 第 5 块：写复盘，记录失败案例、prompt 改动、模型表现和下一步。

每两周输出一个小成果：

- 一篇技术笔记。
- 一个可运行 demo。
- 一个 trace 截图或评估报告。
- 一个清晰的 README 更新。

## 推荐阅读顺序

第一轮只看能马上动手的内容：

1. LangChain.js overview、quickstart、models、tools、structured output。
2. LangChain.js retrieval、short-term memory、middleware、observability。
3. LangGraph.js overview、quickstart、workflows and agents。
4. LangGraph.js persistence、streaming、interrupts、memory、subgraphs。
5. LangSmith observability、evaluation。
6. MCP 与安全资料。

第二轮开始读机制：

1. LangGraph Graph API、Functional API、runtime。
2. checkpointers、stores、fault tolerance、time travel。
3. LangChain middleware、guardrails、context engineering。
4. LangSmith dataset、evaluator、experiment comparison、online evaluation。

## 容易踩坑的地方

- 只会 prompt，不会 state：复杂 agent 的关键是状态建模，不是把 prompt 写长。
- 过早 multi-agent：先把单 graph 的节点职责、状态和评估做好，再扩展多 agent。
- RAG 只看相似度：真实项目要看引用、权限、更新、拒答和评估。
- 工具权限过大：agent 工具越强，越需要审批、审计和最小权限。
- 没有评估集：没有 dataset 就无法证明变好，只能靠感觉。
- UI 只显示最终答案：作品集项目应该展示过程、证据、进度和可恢复性。
- 把模型当核心卖点：模型会变，系统设计、评估和工具编排能力才是长期价值。

## 官方资料

- [LangChain.js overview](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangChain.js models](https://docs.langchain.com/oss/javascript/langchain/models)
- [LangChain.js tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain.js structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- [LangChain.js retrieval](https://docs.langchain.com/oss/javascript/langchain/retrieval)
- [LangChain.js MCP](https://docs.langchain.com/oss/javascript/langchain/mcp)
- [LangGraph.js overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangGraph.js workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)
- [LangGraph.js persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [LangGraph.js interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangGraph.js streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [LangGraph memory concepts](https://docs.langchain.com/oss/javascript/concepts/memory)
- [LangSmith docs](https://docs.langchain.com/langsmith)
- [LangSmith evaluation](https://docs.langchain.com/langsmith/evaluation)
- [Vercel AI SDK](https://vercel.com/ai-sdk)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [Sleeper Channels and Provenance Gates: Persistent Prompt Injection in Always-on Autonomous AI Agents](https://arxiv.org/abs/2605.13471)
