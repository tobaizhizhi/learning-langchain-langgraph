# 作品集项目实现方案：Solidity Security Audit Agent

版本日期：2026-06-20

项目定位：做一个面向 Solidity 合约学习与安全审计的 AI 工作台。它不是“替代专业审计”的工具，而是一个能读取合约、调用成熟静态分析工具、检索漏洞知识库、组织多步骤分析、生成可追溯审计报告的 agent 系统。

这个项目的作品集价值不在于“又做了一个聊天机器人”，而在于展示你能把 LangChain.js、LangGraph.js、RAG、工具调用、静态分析、评估、UI 和安全边界组合成一个真实工作流。

## 一句话 Demo

用户上传或选择一个 Solidity 项目，点击 Start Audit。系统会：

1. 读取项目结构和合约文件。
2. 识别编译框架、Solidity 版本、关键合约和入口函数。
3. 调用静态分析工具，收集机器可验证的风险信号。
4. 检索漏洞知识库、Solidity 官方文档、OpenZeppelin 文档和历史案例。
5. 用 LangGraph 并行运行多个 audit worker。
6. 合并 findings，给出严重度、置信度、证据、攻击路径和修复建议。
7. 对高风险结论要求人工确认。
8. 输出一份可下载的 Markdown/HTML 审计报告。
9. 用 evaluation dataset 证明系统的准确性、拒答能力和引用质量。

## 目标用户

- Solidity 学习者：想理解合约逻辑、常见漏洞和修复方法。
- Web3 开发者：想在提交审计前做一次自查。
- 安全研究者入门者：想学习审计思路和漏洞证据组织方式。
- 面试官或作品集浏览者：想看到你是否真的掌握 agent 系统工程。

## 非目标

- 不承诺替代人工专业审计。
- 不自动部署合约。
- 不接触私钥。
- 不默认执行任意 shell 命令。
- 不把 LLM 的结论当作唯一证据。
- 不做“只返回一段审计意见”的薄封装。

## 核心卖点

- 可解释：每个 finding 都有源码位置、工具输出、检索证据和推理摘要。
- 可恢复：长审计任务支持暂停、恢复和失败重试。
- 可评估：有固定漏洞样例集，能跑回归测试和质量评估。
- 可审批：执行测试、生成 patch、调用高风险工具前必须 human-in-the-loop。
- 可替换模型：模型只作为配置，不绑定某一家 provider。
- 可展示工程深度：有 graph、state、tools、RAG、eval、trace、UI 和部署。

## 推荐技术栈

应用层：

- TypeScript、Node.js、pnpm。
- Next.js 或 Hono/Fastify + React。作品集展示建议用 Next.js。
- Zod：定义工具参数、structured output、API payload。
- PostgreSQL：保存 audit session、findings、tool runs、user feedback。
- Vector store：pgvector、Qdrant、Pinecone 或 Weaviate 任选一种。

AI 层：

- LangChain.js：模型抽象、tools、structured output、retrieval、MCP。
- LangGraph.js：审计工作流编排、状态管理、并行 worker、持久化、interrupt、streaming。
- LangSmith：tracing、dataset、evaluation、实验对比。

Solidity 工具层：

- Foundry：编译、测试、执行 PoC 测试、合约开发工作流。
- Slither：静态分析、漏洞 detector、代码理解信息。
- Hardhat：作为可选兼容层，支持已有 Hardhat 项目。
- Solidity compiler：解析 compiler version、ABI、AST、storage layout。
- OpenZeppelin Contracts docs：常见安全模式、token 标准、access control、upgradeable contracts 的知识来源。

## 项目范围

MVP 必做：

- 上传或选择一个 Solidity 项目目录。
- 读取合约文件，识别 Solidity pragma、imports、contract names、functions。
- 调用 Slither 或静态分析 wrapper，得到结构化 tool result。
- 构建 RAG 知识库，至少包含 Solidity 安全注意事项、OpenZeppelin 文档、你整理的漏洞案例。
- 用 LangGraph 编排审计流程。
- 输出结构化 findings 和 Markdown 报告。
- LangSmith tracing。
- 至少 30 条评估样例。

作品集增强：

- 支持 Foundry 测试运行。
- 支持生成 PoC test 草案，但执行前需要人工确认。
- 支持审计 session 恢复。
- 支持多 worker 并行分析。
- 支持 finding 去重、严重度校准、证据检查。
- 支持 report 导出 HTML/PDF。
- 支持 evaluation dashboard。

## 系统架构

```text
Browser UI
  -> Next.js API / Agent Server
    -> LangGraph Audit App
      -> project intake
      -> source normalization
      -> compile/static-analysis tools
      -> audit planner
      -> retrieval
      -> parallel audit workers
      -> finding merger
      -> evidence verifier
      -> human review interrupt
      -> report writer
      -> eval hooks
    -> PostgreSQL
    -> Vector Store
    -> LangSmith
    -> Sandboxed Solidity Tool Runner
```

## LangGraph State 设计

核心 state 不要只放 messages。审计任务是结构化工作流，应显式保存项目、工具结果、风险项、证据和审批状态。

```ts
type AuditState = {
  sessionId: string;
  userGoal: string;
  project: {
    rootPath: string;
    framework: "foundry" | "hardhat" | "unknown";
    compilerVersions: string[];
    entryContracts: string[];
  };
  files: Array<{
    path: string;
    contentHash: string;
    language: "solidity" | "typescript" | "markdown" | "other";
  }>;
  toolRuns: ToolRun[];
  retrievedEvidence: EvidenceChunk[];
  auditPlan: AuditTask[];
  workerFindings: AuditFinding[];
  mergedFindings: AuditFinding[];
  report?: AuditReport;
  approvals: HumanApproval[];
  errors: AgentError[];
  budget: {
    maxToolRuns: number;
    maxModelCalls: number;
    maxRuntimeSeconds: number;
  };
};
```

Finding 数据模型：

```ts
type AuditFinding = {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  confidence: "high" | "medium" | "low";
  category:
    | "reentrancy"
    | "access-control"
    | "oracle"
    | "upgradeability"
    | "unchecked-call"
    | "integer-arithmetic"
    | "dos"
    | "erc-standard"
    | "business-logic"
    | "other";
  affectedFiles: Array<{
    path: string;
    startLine?: number;
    endLine?: number;
  }>;
  evidence: Array<{
    kind: "source" | "tool" | "retrieval" | "test" | "reasoning";
    summary: string;
    reference?: string;
  }>;
  impact: string;
  attackPath: string;
  recommendation: string;
  suggestedTest?: string;
  falsePositiveRisk: string;
};
```

## LangGraph 节点设计

主流程：

```text
START
  -> intakeProject
  -> normalizeSources
  -> detectFramework
  -> runStaticAnalysis
  -> buildAuditPlan
  -> retrieveKnowledge
  -> fanOutAuditWorkers
  -> mergeFindings
  -> verifyEvidence
  -> maybeHumanReview
  -> writeReport
  -> saveMemory
  -> END
```

节点职责：

- `intakeProject`：接收项目路径、上传文件或 Git URL，创建 audit session。
- `normalizeSources`：过滤无关文件，计算 hash，提取 pragma、imports、contract/function index。
- `detectFramework`：识别 Foundry、Hardhat 或未知项目结构。
- `runStaticAnalysis`：调用 Slither、compiler、测试工具，保存结构化结果。
- `buildAuditPlan`：根据项目类型生成 audit tasks，例如 access control、external calls、upgradeability。
- `retrieveKnowledge`：为每个 audit task 检索相关安全知识和案例。
- `fanOutAuditWorkers`：并行运行多个 worker。
- `mergeFindings`：去重、合并同类问题、统一 severity。
- `verifyEvidence`：检查每个 finding 是否有源码位置、工具证据或引用依据。
- `maybeHumanReview`：对 critical/high 或需要执行命令的动作触发 interrupt。
- `writeReport`：生成 Markdown/HTML 报告。
- `saveMemory`：保存用户偏好、项目摘要、已确认误报。

并行 worker：

- `accessControlWorker`：检查 owner、role、权限修饰符、初始化函数。
- `externalCallWorker`：检查外部调用、回调、reentrancy、unchecked return。
- `upgradeabilityWorker`：检查 proxy、initializer、storage layout 风险。
- `tokenStandardWorker`：检查 ERC20/ERC721/ERC1155/ERC4626 规范偏差。
- `oracleWorker`：检查价格源、staleness、confidence、decimals。
- `businessLogicWorker`：分析业务约束，例如 mint/burn、withdraw、liquidation。
- `testSuggestionWorker`：为高风险 finding 生成 PoC test 草案。

条件路由：

- 静态分析失败：进入 `repairBuildContext`，提示用户补 dependency 或 compiler version。
- finding 缺少证据：回到 `retrieveKnowledge` 或 `runFocusedInspection`。
- 高风险动作：进入 `maybeHumanReview`。
- findings 为空：进入 `negativeReportVerifier`，检查是否应该拒绝给出“无漏洞”结论。

## 工具设计

所有工具必须有 Zod schema、权限等级、超时、审计日志。

基础工具：

- `listProjectFiles(rootPath)`：列出允许范围内的文件。
- `readSourceFile(path)`：读取 Solidity 或配置文件。
- `extractSolidityIndex(files)`：提取 contracts、functions、modifiers、events、imports。
- `detectProjectFramework(rootPath)`：判断 Foundry、Hardhat 或 unknown。
- `runSlither(target, detectors?)`：运行静态分析并归一化结果。
- `runForgeBuild(rootPath)`：编译项目。
- `runForgeTest(rootPath, testPattern?)`：运行测试。
- `searchKnowledgeBase(query, filters)`：检索漏洞知识库。
- `writeAuditReport(sessionId, report)`：保存报告。

高风险工具：

- `generatePatch(findingId)`：生成修复 patch，默认只生成 diff，不自动写入。
- `runGeneratedPoCTest(testCode)`：运行 PoC 测试，必须人工审批。
- `createIssue(finding)`：创建 issue，必须人工审批。

工具安全规则：

- 工具只能访问 audit workspace 内的路径。
- 命令必须使用 allowlist，例如 `forge build`、`forge test`、`slither`。
- 禁止任意 shell、网络下载、私钥读取。
- 每个命令有超时、最大输出长度、最大文件大小。
- 所有 tool calls 写入 `tool_runs` 表。
- 高风险工具必须经过 LangGraph interrupt。

## RAG 知识库设计

知识库类型：

- Solidity 官方文档：语言特性、安全注意事项、compiler output、known bugs。
- OpenZeppelin 文档：token 标准、access control、upgradeable contracts。
- Slither detector 文档：detector 名称、风险类型、典型模式。
- 公开漏洞案例：只使用许可允许的资料，保留来源和摘要。
- 自己整理的漏洞卡片：每张卡片包括模式、触发条件、示例、修复、测试方法。

chunk metadata：

```ts
type KnowledgeChunkMetadata = {
  sourceType: "solidity-docs" | "openzeppelin" | "slither" | "case-study" | "personal-note";
  topic: string;
  vulnerabilityCategory?: string;
  solidityVersion?: string;
  contractStandard?: "erc20" | "erc721" | "erc1155" | "erc4626" | "proxy" | "other";
  sourceUrl?: string;
  licenseNote?: string;
};
```

检索策略：

- 普通问答：topK 4 到 8。
- finding 验证：按 category、standard、compiler version 过滤。
- 报告生成：只允许引用已进入 `retrievedEvidence` 的片段。
- 没有证据时必须降级为“需要人工确认”，不能强行输出确定结论。

## Structured Output 设计

模型输出不要直接写自然语言报告。先输出结构化 findings，再由 report writer 生成报告。

核心 schema：

- `AuditPlanSchema`
- `AuditFindingSchema`
- `EvidenceCheckSchema`
- `SeverityCalibrationSchema`
- `AuditReportSchema`

严重度校准规则：

- Critical：可导致资金直接被盗、权限完全失控或协议不可恢复。
- High：可造成重大资产损失、关键功能绕过、严重状态破坏。
- Medium：需要特定条件或组合攻击，但影响明确。
- Low：影响较小、边界条件、最佳实践问题。
- Informational：代码质量、可读性、gas 或文档问题。

置信度校准规则：

- High：有源码位置和工具/测试/明确规范证据。
- Medium：源码证据明确，但缺少可执行 PoC 或工具确认。
- Low：模式可疑，但依赖上下文或业务假设。

## UI 设计

页面 1：Audit Dashboard

- 新建审计任务。
- 选择项目来源：本地路径、上传 zip、示例项目。
- 选择模型 profile：fast、balanced、deep。
- 显示历史 audit sessions。

页面 2：Audit Workspace

- 左侧：文件树和当前合约。
- 中间：审计进度、graph 节点状态、streaming 日志。
- 右侧：findings 列表，按 severity 和 confidence 过滤。
- 底部：tool calls、trace link、human approval 面板。

页面 3：Finding Detail

- 漏洞标题、严重度、置信度。
- 受影响文件和行号。
- 源码片段。
- 工具证据。
- 检索证据。
- 攻击路径。
- 修复建议。
- PoC test 草案。
- 标记为 confirmed、false positive、needs more evidence。

页面 4：Report

- Executive summary。
- Findings table。
- Detailed findings。
- Methodology。
- Tool versions。
- Limitations。
- Export Markdown/HTML。

页面 5：Evaluation Lab

- 选择 dataset。
- 选择 agent version。
- 运行评估。
- 查看 precision、recall、citation accuracy、format validity、latency、cost。

## 数据库表

核心表：

- `audit_sessions`
- `audit_files`
- `tool_runs`
- `retrieved_evidence`
- `audit_findings`
- `human_approvals`
- `audit_reports`
- `eval_datasets`
- `eval_cases`
- `eval_runs`
- `model_call_logs`

`audit_findings` 建议字段：

- `id`
- `session_id`
- `title`
- `severity`
- `confidence`
- `category`
- `affected_files`
- `evidence_json`
- `impact`
- `attack_path`
- `recommendation`
- `suggested_test`
- `status`
- `created_at`
- `updated_at`

## 评估方案

评估不是锦上添花，是这个项目从 demo 变成作品集项目的关键。

Dataset 类型：

- Vulnerability classification：给一段合约，判断漏洞类别。
- Finding extraction：给一个小项目，列出应发现的漏洞。
- Citation correctness：检查 finding 是否引用到正确源码行或知识片段。
- False positive control：安全合约或修复后合约，不应强行报高危。
- Report quality：检查报告结构、严重度、修复建议是否完整。

最小 dataset：

- 10 条 reentrancy。
- 10 条 access control。
- 10 条 unchecked call 或 external call 风险。
- 10 条 upgradeability/init 风险。
- 10 条 token standard 或 accounting 风险。
- 10 条无漏洞或只有低风险问题的负样例。

指标：

- Format validity：结构化输出是否符合 schema。
- Finding recall：应发现的问题发现了多少。
- False positive rate：无漏洞样例中错误报高危的比例。
- Citation accuracy：引用是否指向真实相关证据。
- Severity agreement：严重度是否与人工标签接近。
- Actionability：修复建议是否可执行。
- Latency/cost：完成一次审计的时间和成本。

LangSmith 使用方式：

- 每次 audit session 带 `session_id`、`project_hash`、`agent_version` tags。
- 每次 graph run 上传 trace。
- 每个 eval case 固定输入、期望 finding、评分标准。
- 每次改 prompt、模型或 graph 后跑 regression。

## 里程碑

建议 8 到 10 周完成一个可展示版本。

第 1 周：项目骨架

- Next.js 或 API server 搭好。
- model factory 搭好，支持至少两个 provider。
- audit session 数据模型搭好。
- 能读取一个 Solidity 文件并输出结构化解释。

第 2 周：工具层

- 实现文件读取、项目检测、Solidity index。
- 封装 Slither 或静态分析工具 runner。
- 保存 tool runs。
- 做第一个 CLI 或 API demo。

第 3 周：RAG

- 建立知识库导入脚本。
- 支持按漏洞类别检索。
- finding 能带知识引用。
- 完成 20 条 eval cases。

第 4 周：LangGraph 审计流程

- 实现 intake、analysis、retrieval、finding writer、report writer。
- 接入 LangSmith trace。
- 能跑完整单合约审计。

第 5 周：并行 worker

- 拆出 access control、external call、upgradeability、token standard workers。
- 实现 finding merge 和去重。
- 输出第一版 Markdown 报告。

第 6 周：UI 工作台

- 文件树、进度流、findings 列表、finding detail。
- 展示 tool calls 和 graph node progress。
- 支持导出报告。

第 7 周：持久化与人工审批

- 接入 checkpointer/store。
- 支持 session 恢复。
- 高风险动作触发 interrupt。
- 支持用户确认 false positive。

第 8 周：评估与打磨

- 完成 60 条以上 eval cases。
- 跑基线模型和目标模型对比。
- 输出评估报告。
- 修复高频失败模式。

第 9 到 10 周：作品集发布

- 部署 demo。
- 完成 README、架构图、demo 视频、技术复盘。
- 准备 3 个展示场景：简单漏洞、复杂多文件、无漏洞负样例。

## Demo 场景设计

场景 1：Reentrancy

- 输入一个存在外部调用顺序问题的合约。
- 展示 agent 如何定位函数、解释调用路径、引用源码、给出修复建议。
- 展示 Slither 或工具输出如何作为证据之一。

场景 2：Access Control

- 输入一个初始化或权限检查缺失的合约。
- 展示 access control worker 的结论。
- 展示人工确认和 finding 状态变更。

场景 3：False Positive Control

- 输入一个安全实现或已修复合约。
- 展示系统不会强行报高危。
- 展示“未发现高置信度漏洞，但有低风险建议”的报告。

场景 4：Long Audit Session

- 输入多文件项目。
- 中途停止，再恢复。
- 展示 graph 状态、tool run 历史和最终报告。

## 作品集交付物

必须有：

- 在线 demo 或本地一键运行说明。
- README：项目定位、功能、架构、安装、运行、环境变量、限制。
- 架构图：UI、API、LangGraph、tools、DB、vector store、LangSmith。
- Graph 图：节点、边、条件路由、interrupt。
- 示例报告：至少 2 份。
- 评估报告：dataset、指标、结果、失败案例。
- 安全说明：权限边界、高风险工具、人工审批。
- Demo 视频：3 到 5 分钟。

加分项：

- Public trace screenshots。
- Prompt/version changelog。
- 模型对比报告。
- 失败案例复盘。
- 工具输出原文和 agent finding 对照。

## 风险与对策

风险：LLM 编造漏洞。

- 对策：finding 必须有源码位置和证据；没有证据只能标记为 low confidence 或 needs review。

风险：静态分析工具误报。

- 对策：工具输出只作为证据之一，由 evidence verifier 和人工确认校准。

风险：执行命令不安全。

- 对策：命令 allowlist、路径 sandbox、超时、输出限制、人工审批。

风险：项目范围膨胀。

- 对策：MVP 只支持本地/上传项目、Slither、RAG、报告；链上数据、交易模拟、自动 patch 放到后续。

风险：评估太晚。

- 对策：第 3 周就建立 eval cases，每次 prompt/graph 改动都跑回归。

风险：UI 变成普通聊天页。

- 对策：UI 必须以审计工作台为中心，展示文件、findings、证据、进度和报告，而不是只放聊天框。

## 实现顺序

推荐按这个顺序写代码：

1. 数据模型和项目骨架。
2. model factory 和 structured output schema。
3. 文件读取、项目检测、Solidity index。
4. Slither/Foundry wrapper。
5. 最小 LangGraph：intake -> static analysis -> finding writer -> report。
6. RAG ingestion 和 retrieval。
7. 并行 worker。
8. finding merge、evidence verifier、severity calibration。
9. UI 工作台。
10. persistence、interrupt、session resume。
11. evaluation suite。
12. 部署、README、demo 视频。

## 文件结构建议

```text
src/
  app/
    audit/
    evals/
  server/
    agent/
      graph.ts
      state.ts
      nodes/
      workers/
      prompts/
    tools/
      filesystem.ts
      solidity-index.ts
      slither.ts
      foundry.ts
      knowledge-search.ts
    rag/
      ingest.ts
      retriever.ts
      schemas.ts
    evals/
      datasets/
      evaluators/
      run-eval.ts
    db/
      schema.ts
      repositories/
  components/
    audit-workspace/
    finding-detail/
    graph-progress/
    tool-run-log/
docs/
  architecture.md
  evaluation-report.md
  demo-script.md
```

## 最终验收清单

功能：

- 能导入 Solidity 项目。
- 能跑静态分析。
- 能生成结构化 findings。
- 能检索并引用知识库证据。
- 能输出审计报告。
- 能展示 graph 进度和 tool calls。
- 能恢复 session。
- 能对高风险动作进行人工审批。

质量：

- 60 条以上 eval cases。
- 至少 3 类漏洞的 recall 有记录。
- false positive 样例有记录。
- schema validity 接近 100%。
- 每个 high/critical finding 都有证据。

作品集：

- README 清楚。
- 架构图清楚。
- demo 视频清楚。
- 评估报告可信。
- UI 不像普通聊天 demo。
- 面试时能解释为什么用 LangGraph 而不是只用 agent loop。

## 官方资料

- [LangChain.js overview](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangChain.js tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain.js structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- [LangChain.js MCP](https://docs.langchain.com/oss/javascript/langchain/mcp)
- [LangGraph.js overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangGraph.js workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)
- [LangGraph.js persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [LangGraph.js interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangGraph.js streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [LangSmith evaluation](https://docs.langchain.com/langsmith/evaluation)
- [Foundry docs](https://www.getfoundry.sh/)
- [Slither repository](https://github.com/crytic/slither)
- [Hardhat docs](https://hardhat.org/docs)
- [Solidity docs](https://docs.soliditylang.org/)
- [OpenZeppelin Contracts docs](https://docs.openzeppelin.com/contracts)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

