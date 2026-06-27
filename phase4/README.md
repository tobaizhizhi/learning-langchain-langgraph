# 阶段 4 学习大纲：Retrieval 与 RAG

版本日期：2026-06-24

路线图仅供参考。阶段 4 的实际执行以当前代码、阶段 1 到阶段 3 已完成能力、作品集目标和 `docs/course-outline-rules.md` 为准；如果有更直接、更贴近真实项目的方式，就按更好的方式做。

## 阶段目标

把真实资料集变成可检索知识库，并让模型基于检索到的原文片段回答问题、给出引用、在证据不足时拒答。

一句话：

```text
阶段 4 学的是：不要只让模型凭记忆回答，而是先检索真实资料，再基于证据生成答案。
```

## 阶段硬性约束

本阶段继续贴近真实项目：

- 不使用 mock 文档集作为主线。
- 不使用假 embedding 或假向量结果作为主线。
- 默认使用当前仓库里的真实课程文档、路线图、README 作为第一批知识库资料。
- 使用真实 embedding 模型；如果当前中转不支持 embeddings，需要单独配置 embedding provider。
- 使用成熟 vector store。主线建议用本地 Docker Qdrant；`MemoryVectorStore` 只允许作为单元测试或临时 smoke test，不作为阶段成果。
- RAG 先做成独立检索问答链，不急着塞进 agent。跑稳后再把 retriever 包成工具给阶段 3 agent 使用。
- 每个回答必须能追溯来源。没有来源时要明确拒答。

## 本阶段和前面阶段的关系

阶段 1 主线：

```text
messages -> model.invoke(...) -> AIMessage / stream
```

阶段 2 主线：

```text
tool schema -> real external tool -> tool result -> structured output
```

阶段 3 主线：

```text
createAgent -> tools -> middleware -> run report
```

阶段 4 主线：

```text
real documents
-> load into Documents
-> split into chunks
-> embed chunks
-> store in vector database
-> retrieve relevant chunks
-> answer with citations
-> evaluate retrieval and answer quality
```

你要观察的是：

```text
RAG 的核心不是“向量搜索很神奇”，而是“答案必须受检索证据约束”。
```

## 必须学

- `Document`：`pageContent` 和 `metadata` 分别放什么。
- document loader：怎样把真实文件读成统一文档结构。
- chunking：为什么长文档不能整篇直接 embedding。
- embedding：文本如何变成向量，`embedDocuments` 和 `embedQuery` 的区别。
- vector store：怎样存 chunk、向量和 metadata。
- retriever：怎样从 query 找回相关片段。
- 2-step RAG：先检索，再把检索结果放进 prompt 让模型回答。
- citation：答案必须带来源路径、标题、chunk id 或行号范围。
- refusal：证据不足时拒答，而不是编造。
- 最小 RAG 评估：检索是否找对、引用是否正确、答案是否忠实于原文。

## 值得学

- Qdrant 本地 Docker 作为真实持久化 vector store。
- 文档 hash / chunk hash，避免每次重复索引。
- metadata filter，例如只查 `phase1`、`phase2`、`docs`。
- 结构化 RAG 输出，例如 `answer`、`citations`、`notEnoughEvidence`。
- 本地 JSON run report，记录 query、retrieved chunks、scores、latency、错误。

## 知道即可

- hybrid retrieval：向量检索 + 关键词检索。
- reranker：先多召回，再用模型或专用模型重排。
- query rewriting / multi-query retrieval：把用户问题改写成多个检索查询。
- agentic RAG：让 agent 自己决定什么时候检索。
- semantic cache：缓存相似问题的回答或检索结果。
- Graph RAG / knowledge graph。

这些未来会有用，但现在不是主线。

## 暂缓内容

- 完整 Web UI：先用 CLI 跑通 RAG 核心。
- 大规模网页爬虫：先用本仓库真实文档，避免把问题变成爬虫工程。
- PDF / 表格 / 图片解析：先处理 Markdown / text，后续再扩展复杂格式。
- 多租户权限系统：阶段 4 先学 metadata filter，不做权限后台。
- LangGraph 工作流：阶段 5 再学。
- Deep Research：阶段 6 再学多步骤研究、并行检索和 evaluator。
- 生产级评估平台：先做最小本地 dataset，LangSmith evaluation 后面再深化。

## 最小可运行成果

阶段 4 完成后，应该能跑：

```bash
pnpm phase4:sources
pnpm phase4:documents
pnpm phase4:chunks
pnpm phase4:embedding "LangChain invoke 返回什么"
pnpm phase4:index
pnpm phase4:search "LangChain invoke 返回什么"
pnpm phase4:answer "阶段 2 为什么要用 Zod 定义工具参数"
pnpm phase4:eval
```

预期它会：

- 从真实课程文档加载资料。
- 切成带 metadata 的 chunks。
- 用真实 embedding 模型生成向量。
- 写入本地 Qdrant collection。
- 对问题检索相关 chunks。
- 调用真实大模型生成带引用答案。
- 找不到证据时明确拒答。
- 生成最小评估结果。

## 实现前需要准备的配置

当前项目已经有 chat model 的 `.env` 配置。阶段 4 还需要补充 embedding 和 vector store 配置。

建议新增：

```env
# 默认主线：本地 Ollama embedding
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=bge-m3
EMBEDDING_BASE_URL=http://localhost:11434

# 如果要走 OpenAI 官方 API / OpenAI-compatible 中转，再改成：
# EMBEDDING_PROVIDER=openai
# EMBEDDING_MODEL=text-embedding-3-small
# EMBEDDING_API_KEY=your-api-key
# EMBEDDING_BASE_URL=https://api.openai.com/v1

QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=aiframe_phase4
QDRANT_INDEX_BATCH_SIZE=4
```

如果中转同时支持 chat 和 embeddings，可以复用 `OPENAI_API_KEY` / `MODEL_BASE_URL` 的值，但代码里最好把 chat config 和 embedding config 分开，避免以后换模型时混乱。

如果本地服务不支持 OpenAI-compatible embeddings API，就不要硬套 `OpenAIEmbeddings`，而是使用对应 provider 的 embedding class。本阶段主线支持 `OllamaEmbeddings`。

实现时大概率需要新增依赖：

```bash
pnpm add @langchain/qdrant @langchain/textsplitters @langchain/ollama
```

根据实际 loader 选择，可能还会用到：

```bash
pnpm add @langchain/community
```

## Step 1：理解 RAG 解决什么问题

做什么：

用几个真实问题对比“直接问模型”和“先检索再回答”的差异。

为什么现在做：

你已经会调用模型和 agent。现在要明确：RAG 不是为了让模型更会聊天，而是为了让答案有外部证据、可更新、可追溯。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `docs/langchain-langgraph-learning-roadmap.md`
- `phase1/src/invoke-demo.ts`
- 阶段 4 后续新建的 `phase4/src/rag-answer-demo.ts`

练习：

- 选 3 个只靠模型可能答错的问题，例如“当前课程阶段 2 学了哪些工具”。
- 先直接问模型，再用文档检索后回答。
- 记录直接回答哪里不可靠。

验收：

- 能解释 RAG 的价值是 grounding，不是单纯“搜一下”。
- 能说明为什么 RAG 对课程文档、项目文档、审计知识库有作品集价值。

不做什么：

- 不先学 agentic RAG。
- 不讨论复杂论文。
- 不直接做网页爬虫。

## Step 2：选择真实资料集并定义 Document metadata

做什么：

确定第一批进入知识库的真实文件，并规定每个 `Document` 必须带哪些 metadata。

第一批资料使用本仓库自己的学习资料和规划资料：

```text
docs/*.md
phase1/*.md
phase2/*.md
phase3/*.md
README 类文档
```

当前实现：

- `phase4/src/source-config.ts`
- `phase4/tests/source-config.test.ts`
- `pnpm phase4:sources`

详细 metadata：

```ts
type RagSourceMetadata = {
  sourceId: string;
  sourcePath: string;
  sourceName: string;
  sourceKind:
    | "course-rule"
    | "learning-process"
    | "phase-readme"
    | "portfolio-plan"
    | "prompt-notes"
    | "reference-doc"
    | "roadmap"
    | "summary-review";
  phase: "docs" | "phase1" | "phase2" | "phase3" | "phase4";
  title: string;
  format: "markdown";
  language: "zh" | "en" | "mixed";
  topic:
    | "agent-harness"
    | "course-planning"
    | "invoke"
    | "messages-prompts"
    | "model-interface"
    | "portfolio"
    | "rag"
    | "stream"
    | "structured-output"
    | "tool-calling";
  retrievalIntent:
    | "concept-review"
    | "decision-rule"
    | "implementation-guide"
    | "project-plan";
  audience: "builder" | "learner" | "portfolio-reviewer";
  sourcePriority: 1 | 2 | 3;
  contentHash: string;
  sectionTitle?: string;
  sectionLevel?: number;
  sectionPath?: string[];
  chunkIndex?: number;
  chunkStartLine?: number;
  chunkEndLine?: number;
};
```

字段作用：

- `sourcePath`：引用时必须能回到真实文件。
- `sourceKind`：区分学习过程、复习总结、路线图、作品集计划等不同资料。
- `phase`：支持只查某个阶段，例如只查 `phase3`。
- `topic`：支持按主题过滤，例如只查 `agent-harness` 或 `tool-calling`。
- `retrievalIntent`：区分概念复习、实现指导、项目规划、规则决策。
- `sourcePriority`：让总结文档、路线图、规则文档在检索和评估时权重更高。
- `contentHash`：后面判断文件是否变化，避免重复索引。
- `section*` / `chunk*`：Step 4 chunking 后补充，用来做精确 citation。

运行预览：

```bash
pnpm phase4:sources
```

为什么现在做：

RAG 后面所有引用、过滤、评估都依赖 metadata。没有 metadata，答案即使对了也说不清来自哪里。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- `phase4/src/source-config.ts`
- `phase4/tests/source-config.test.ts`

练习：

- 列出要索引的文件 glob。
- 每个文档至少保留 `sourcePath`。
- 尽量从 Markdown 标题提取 `title`。
- 给每个来源推断 `phase`、`sourceKind`、`topic`、`retrievalIntent`、`sourcePriority`。

验收：

- `pnpm phase4:sources` 能列出第一批资料来源。
- 每个来源都有 `sourcePath`、`title`、`phase`、`topic`、`sourceKind`。
- 没有来源路径、标题或内容 hash 的资料不能进入后续索引。
- 能解释为什么后续引用、过滤、评估都依赖 metadata。

不做什么：

- 不做权限系统。
- 不设计复杂数据库表。
- 不索引整个用户主目录。

## Step 3：把真实文件加载成 LangChain Documents

做什么：

用成熟 loader 或小范围文件读取，把 Markdown / text 文件变成 LangChain `Document[]`。

为什么现在做：

RAG 的第一步是数据进入统一格式。后面 splitter、embedding、vector store 都围绕 `Document` 工作。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `phase4/src/document-loader.ts`
- `phase4/tests/document-loader.test.ts`
- `Document` 的 `pageContent`
- `Document` 的 `metadata`

练习：

- 加载 `docs`、`phase1`、`phase2`、`phase3` 下的 Markdown 文件。
- 过滤空文件和明显无用文件。
- 打印文档数量、总字符数、前 3 个来源。

当前实现：

```text
buildSourceFileConfigs(...)
-> 读取真实 Markdown 文件
-> new Document({ pageContent, metadata })
-> summarizeLoadedDocuments(...)
```

运行：

```bash
pnpm phase4:documents
```

验收：

- `pnpm phase4:documents` 能列出真实文档。
- 所有文档都有 `pageContent` 和 `sourcePath`。
- 不读取 `.env`、`node_modules`、日志文件、锁文件。

不做什么：

- 不做 PDF。
- 不做网页抓取。
- 不处理图片和表格。

## Step 4：切分 chunks，并保留来源信息

做什么：

使用 text splitter 把长文档切成适合 embedding 的 chunks，同时保留原始 metadata。

建议先从这个级别开始：

```text
chunkSize: 800 到 1200 字符
chunkOverlap: 100 到 200 字符
```

为什么现在做：

embedding 一整篇长文档会让语义变稀，检索时很难精确命中。chunking 是 RAG 质量的核心变量之一。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `phase4/src/split-documents.ts`
- `MarkdownTextSplitter`
- chunk metadata 里的 `chunkIndex`

练习：

- 把 loaded documents 切成 chunks。
- 打印 chunk 数量、平均长度、最长 chunk。
- 随机检查 5 个 chunk 的内容是否完整可读。

当前实现：

```text
loadPhase4Documents()
-> MarkdownTextSplitter
-> 给每个 chunk 补充 chunkIndex / chunkStartLine / chunkEndLine / sectionTitle
-> 输出 chunk 统计和样例
```

默认参数：

```ts
chunkSize: 1000
chunkOverlap: 150
```

运行：

```bash
pnpm phase4:chunks
```

可选调参：

```bash
PHASE4_CHUNK_SIZE=800 PHASE4_CHUNK_OVERLAP=120 pnpm phase4:chunks
```

验收：

- 每个 chunk 都知道来自哪个文件。
- chunk 内容不是空字符串。
- chunk 不会大到明显超过模型上下文预算。
- chunk metadata 包含 `chunkIndex`，尽量包含行号和章节标题。

不做什么：

- 不一开始研究所有 chunking 算法。
- 不为每种文件格式写专门 splitter。
- 不做自动调参平台。

## Step 5：配置真实 embedding 模型

做什么：

新增 embedding model factory，用真实 embedding 模型把文本转成向量。

默认先支持本地 Ollama：

```ts
const embeddings = new OllamaEmbeddings({
  model: embeddingConfig.model,
  baseUrl: embeddingConfig.baseUrl,
});
```

同时保留 OpenAI 官方 API / OpenAI-compatible 中转：

```ts
const embeddings = new OpenAIEmbeddings({
  model: embeddingConfig.model,
  apiKey: embeddingConfig.apiKey,
  configuration: {
    baseURL: embeddingConfig.baseUrl,
  },
});
```

为什么现在做：

向量检索靠的是 query 和 chunk 的 embedding 在同一个向量空间里可比较。chat model 和 embedding model 是两类模型，不能混为一谈。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- `phase1/src/model-config.ts` 的配置思路
- `phase1/src/chat-model-factory.ts` 的中转处理思路
- 新建 `phase4/src/embedding-config.ts`
- 新建 `phase4/src/embedding-model.ts`
- `pnpm phase4:embedding "LangChain invoke 是什么"`

练习：

- 写 `loadEmbeddingConfigFromEnv()`。
- 跑一次 `embedQuery("LangChain invoke")`。
- 跑一次少量 `embedDocuments([...])`。
- 打印向量维度，不打印完整向量。

验收：

- 缺少 embedding model 或 key 时立刻报错。
- 支持本地 Ollama embedding。
- 支持 OpenAI-compatible base URL。
- 能解释 `embedDocuments` 和 `embedQuery` 的区别。

不做什么：

- 不做复杂 provider 路由；只保留 `ollama` 和 `openai` 两条真实路径。
- 不计算真实成本看板。
- 不把 embedding 配置和 chat 配置揉成一个大配置。

## Step 6：用 Qdrant 建立真实 vector index

做什么：

启动本地 Qdrant，把 chunks 和 embeddings 写入一个 collection。

建议命令：

```bash
docker run -d --name aiframe-qdrant -p 6333:6333 qdrant/qdrant
pnpm phase4:index
```

如果要清空并重建 collection：

```bash
pnpm phase4:index --reset
```

为什么现在做：

RAG 不只是内存里算相似度。真实项目需要可重复查询、可更新、可清空或重建的 vector store。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 成熟工具

重点看：

- 新建 `phase4/src/vector-store.ts`
- 新建 `phase4/src/index-documents.ts`
- `QDRANT_COLLECTION`
- `QDRANT_RESET_COLLECTION`

练习：

- 创建或连接 Qdrant collection。
- 把 chunks 写入 vector store。
- 记录索引耗时、chunk 数量、collection 名。
- 做一次最小 verification search，确认 metadata 能从 Qdrant 取回来。

验收：

- `pnpm phase4:index` 可以重复运行。
- 重建索引前能清楚知道是否会覆盖 collection。
- chunk metadata 能从 Qdrant 检索结果中拿回来。

当前实现：

- `phase4/src/vector-store.ts` 负责 Qdrant 配置、collection 操作、chunk id 到 Qdrant UUID point id 的稳定映射。
- `phase4/src/index-documents.ts` 负责完整索引流程：load documents -> split chunks -> embedding -> addDocuments -> verification search。
- 默认使用 `phase4/.env` 里的本地 Ollama embedding：`EMBEDDING_PROVIDER=ollama`、`EMBEDDING_MODEL=bge-m3`。
- 默认 collection 是 `aiframe_phase4`。

不做什么：

- 不做云端 Qdrant 部署。
- 不做多 collection 管理后台。
- 不做复杂增量同步。

## Step 7：实现最小 retriever / search CLI

做什么：

先不调用大模型，只测试检索质量：用户输入 query，返回 topK chunks、来源和分数。

建议命令：

```bash
pnpm phase4:search "tool call 是怎么执行外部 API 的"
pnpm phase4:search "LangChain invoke 返回什么" --topK 6
```

为什么现在做：

如果检索都没找对，后面模型回答再漂亮也没意义。RAG 调试要先看 retrieval，再看 generation。

价值标签：必须学，高价值

来源/定位：官方核心概念

重点看：

- 新建 `phase4/src/search-demo.ts`
- `vectorStore.similaritySearchWithScore(...)`
- `vectorStore.asRetriever(...)` 后面接 chain / agent 时再用；当前 CLI 先用 `similaritySearchWithScore`，方便看 score。

练习：

- 支持 `topK` 配置，默认 4。
- 打印每个结果的 `sourcePath`、`chunkIndex`、score、内容摘要。
- 准备 5 个你知道答案在哪个文档的问题。

验收：

- 检索结果可读，不只打印 JSON。
- 能手动判断 topK 是否找到了正确文档。
- 能解释 score 高低只是参考，不等于答案一定正确。

当前实现：

- `phase4/src/search-demo.ts` 只做 retrieval，不调用 chat model。
- 默认 `topK=4`，可以用 `--topK 6` 或 `PHASE4_SEARCH_TOP_K=6` 覆盖。
- 输出每条结果的 score、`sourcePath`、`chunkIndex`、`sectionTitle`、`chunkId` 和内容 preview。
- 运行前需要已经执行过 `pnpm phase4:index`，否则 Qdrant collection 里没有可检索 chunks。

不做什么：

- 不马上让模型总结。
- 不做 reranker。
- 不做 query rewriting。

## Step 8：实现 2-step RAG 回答并带引用

做什么：

先检索 chunks，再把 chunks 作为 context 放进 prompt，让 chat model 基于 context 回答。

建议命令：

```bash
pnpm phase4:answer "LangChain invoke 返回什么"
pnpm phase4:answer "阶段 2 为什么要用 Zod 定义工具参数" --topK 6
```

建议输出结构：

```ts
type RagAnswer = {
  answer: string;
  citations: Array<{
    sourcePath: string;
    chunkIndex: number;
    quote?: string;
  }>;
  notEnoughEvidence: boolean;
};
```

为什么现在做：

这是 RAG 的最小闭环：retrieval 提供证据，generation 负责组织答案，但答案必须受证据约束。

价值标签：必须学，高价值

来源/定位：官方核心概念 + 工程实践

重点看：

- 新建 `phase4/src/rag-answer-demo.ts`
- `phase1/src/chat-model-factory.ts`
- `phase2/src/structured-output.ts`

练习：

- 写 system prompt：只能根据提供的 context 回答。
- 如果 context 不包含答案，返回 `notEnoughEvidence: true`。
- 使用结构化输出或 Zod 校验最终结果。

验收：

- 回答里至少有一个 citation。
- 引用必须来自检索到的 chunks。
- 问一个文档里没有的问题时，会拒答。

当前实现：

- `phase4/src/rag-answer-demo.ts` 先调用 Qdrant retrieval，再调用 chat model。
- 使用 `model.withStructuredOutput(ragAnswerSchema, { method: "functionCalling" })` 约束输出结构。
- 输出结构包括 `answer`、`citations`、`notEnoughEvidence`。
- 代码会校验 citation 必须来自本次检索到的 chunks，避免模型编造文件引用。
- 默认 `topK=4`，可以用 `--topK 6` 或 `PHASE4_RAG_TOP_K=6` 覆盖。
- 默认每个 chunk 最多放入 1600 字符 context，可以用 `--maxChunkChars 2000` 调整。

不做什么：

- 不做长篇报告生成。
- 不让模型自己编引用。
- 不把检索工具交给 agent 自动循环。

## Step 9：记录 RAG run report，方便排查

做什么：

给每次 RAG 问答记录 query、topK、retrieved chunks、引用、latency、错误。

为什么现在做：

RAG 出错通常有两类：没检索到，或者检索到了但模型没用好。没有 run report，很难判断问题在哪。

价值标签：必须学，中高价值

来源/定位：工程实践 + 作品集准备

重点看：

- `phase1/src/model-run-log.ts`
- 阶段 3 后续的 run report 思路
- 新建 `phase4/src/rag-run-report.ts`
- `phase4/src/rag-answer-demo.ts` 里的 `onEvent`

练习：

- 每次 `phase4:answer` 生成一个本地 JSON report。
- report 中保存 retrieved chunk 的 metadata 和短摘要。
- 错误时也保存失败阶段：load / embed / search / answer。

验收：

- 能从 report 判断失败原因。
- report 不包含 API key。
- report 可以作为作品集 demo 的调试材料。

不做什么：

- 不做线上监控面板。
- 不做复杂 trace UI。
- 不记录完整敏感原文。

当前实现：

- `phase4:answer` 默认会把 report 写到 `phase4/runs/rag/*.json`。
- 可以用 `PHASE4_RAG_REPORT_DIR=off` 关闭本地 report。
- report 会记录：
  - `query`
  - `options.topK`
  - chat model 和 embedding model 名称
  - retrieval / answer / validate 阶段事件和耗时
  - retrieved chunks 的 metadata 和短摘要
  - final answer、citations、`notEnoughEvidence`
  - 失败时的 `failedStage` 和 `errorMessage`
- report 不记录 API key，也不记录完整 chunk 原文。

建议命令：

```bash
pnpm phase4:answer "LangChain invoke 返回什么" --topK 2
ls phase4/runs/rag
```

## Step 10：建立最小 RAG 评估集

做什么：

准备一组固定问题，重复运行 RAG，记录检索命中和答案质量。

建议第一版 dataset：

```ts
type RagEvalCase = {
  id: string;
  question: string;
  expectedSourcePaths: string[];
  mustMention?: string[];
  shouldRefuse?: boolean;
};
```

为什么现在做：

RAG 很容易“看一个 demo 好像可以”。只有固定评估集才能比较 chunk size、topK、embedding model、prompt 改动是否真的变好。

价值标签：必须学，高价值

来源/定位：工程实践 + 作品集准备

重点看：

- `phase4/src/eval-cases.ts`：固定评估题、期望命中文档、必须提到的关键词、应该拒答的问题。
- `phase4/src/eval-rag.ts`：逐条运行 RAG，计算 retrieval hit、citation hit、refusal hit、pass rate，并保存 report。

练习：

- 先写 10 到 20 条真实问题，不用一开始写 100 条。
- 至少包含 3 条应该拒答的问题。
- 记录 retrieval hit、citation valid、answer ok。

当前已实现：

- 默认 10 条 eval cases，其中 7 条检查课程知识检索，3 条检查应该拒答的问题。
- 每条 case 会记录：
  - 是否检索到期望来源：`retrievalHit`
  - 引用是否来自期望来源：`citationHit`
  - 引用是否确实来自本次 retrieved chunks：`citationValid`
  - 必须出现的关键词是否出现：`mustMentionHit`
  - 应该拒答的问题是否真的拒答：`refusalHit`
  - 失败原因：`retrieval-miss`、`citation-miss`、`must-mention-miss`、`should-refuse` 等
- report 默认保存到 `phase4/runs/eval/*.json`，目录已被 `.gitignore` 忽略。

运行：

```bash
pnpm phase4:eval
```

只跑前 2 条，适合快速 smoke test：

```bash
pnpm phase4:eval --limit 2
```

调整检索参数：

```bash
pnpm phase4:eval --topK 6 --maxChunkChars 2000
```

可选环境变量：

```bash
PHASE4_EVAL_TOP_K=4
PHASE4_EVAL_MAX_CHUNK_CHARS=1600
PHASE4_EVAL_REPORT_DIR=phase4/runs/eval
PHASE4_EVAL_CASE_LIMIT=3
```

运行前需要：

- Ollama 正在运行，且已经有 `bge-m3`：`ollama list`
- Qdrant 正在运行：`docker ps`
- 已经建立索引：`pnpm phase4:index`
- `.env` 里已经配置真实 chat model 和 embedding model。

验收：

- `pnpm phase4:eval` 能输出通过率。
- 改 chunk size 或 topK 后能重新比较。
- 失败案例会被保存，而不是只展示成功样例。

不做什么：

- 不做复杂 LLM-as-judge。
- 不接完整 LangSmith evaluation 平台。
- 不为了分数写很复杂的评估框架。

## Step 11：把 RAG 暴露成只读工具，接回阶段 3 agent

做什么：

把检索问答能力包装成一个只读工具，例如 `search_course_knowledge_base`，让阶段 3 agent 能在需要课程知识时调用它。

为什么现在做：

RAG 本身可以独立工作，但作品集里的 agent 往往需要把知识库检索作为一个工具。这个 step 是阶段 3 和阶段 4 的连接点。

价值标签：值得学，中高价值

来源/定位：官方核心概念 + 作品集准备

重点看：

- `phase4/src/rag-tool.ts`：把 Qdrant 检索包装成只读 tool。
- `phase4/src/rag-agent-demo.ts`：用阶段 3 的 `createAgent` 接入 RAG tool。
- `phase2/src/tools.ts`：对照普通外部 API tool 的写法。

练习：

- 用 Zod 定义工具参数：`query`、`topK`、`phaseFilter?`。
- 工具返回检索片段和来源，不直接执行写操作。
- 在 agent prompt 里说明：回答课程相关问题时优先调用知识库工具。

当前已实现：

- `search_course_knowledge_base` 只读工具：
  - 输入：`query`、`topK`、`phaseFilter?`
  - 输出：`sourcePath`、`chunkIndex`、`citationKey`、`sectionTitle`、`contentPreview`
  - 只查询 Qdrant，不重建索引，不修改文件。
- `phase4:rag-tool`：直接调用 RAG tool，观察工具返回值。
- `phase4:rag-agent`：用 `createAgent` 调用 RAG tool，再生成最终回答。

运行：

```bash
pnpm phase4:rag-tool "LangChain invoke 返回什么"
pnpm phase4:rag-tool "ToolMessage 是什么" --phase phase2 --topK 3
```

接入 agent：

```bash
pnpm phase4:rag-agent "请根据课程知识库解释 Step10 RAG eval 应该重点看哪些代码"
```

运行前需要：

- Ollama 正在运行，且有 embedding model：`ollama list`
- Qdrant 正在运行：`docker ps`
- 已建立索引：`pnpm phase4:index`
- `.env` 里已有真实 chat model、embedding、Qdrant 配置。

验收：

- agent 能调用 RAG 工具查询课程知识。
- 工具结果包含 citations。
- RAG 工具是只读工具，不修改文件和数据库。

不做什么：

- 不做 agentic RAG 多轮检索规划。
- 不让 agent 自动重建索引。
- 不加入高风险写入工具。

## 本阶段不是核心，但未来可以深化

### 1. Web UI 展示引用（切chunk的多种方式，search的多种方式）

价值：高，作品集展示价值大。

为什么暂缓：

现在先确保 RAG 答案可信。UI 会额外引入前端状态、引用高亮、chunk 展开、加载态和错误态。

未来深化：

- 点击 citation 展开原文 chunk。
- 显示 source path、section、score。
- 对“证据不足”的回答展示检索到但不够用的片段。

### 2. Hybrid retrieval

价值：高，真实项目常用。

为什么暂缓：

第一版先学 dense vector retrieval。hybrid 会引入 BM25、关键词索引、分数融合和调参。

未来深化：

- 向量检索找语义相近内容。
- 关键词检索保证术语、函数名、文件名命中。
- 合并两路结果并去重。

### 3. Reranker

价值：中高，可以明显提升 topK 质量。

为什么暂缓：

reranker 是第二阶段优化。基础 retriever 没跑稳前，加 reranker 只会让问题更难定位。

未来深化：

- topK 先召回 20 条。
- reranker 重排到 4 到 6 条。
- 比较 rerank 前后的 citation hit rate。

### 4. Query rewriting / multi-query retrieval

价值：中高，适合复杂问题。

为什么暂缓：

当前要先掌握“一问一检索”。改写查询会增加一次或多次模型调用，也会增加成本和调试难度。

未来深化：

- 把口语问题改写成文档关键词。
- 同一个问题生成多个 query。
- 合并多个检索结果，减少漏召回。

### 5. Agentic RAG

价值：高，但不是 RAG 入门第一步。

为什么暂缓：

阶段 4 的核心是把检索链路做扎实。让 agent 自己决定检索时机，会把问题重新变成 agent 调试。

未来深化：

- agent 判断是否需要查知识库。
- agent 多次检索不同子问题。
- agent 根据检索不足主动澄清问题。

### 6. 增量索引和文档更新

价值：高，真实项目一定会遇到。

为什么暂缓：

第一版可以手动重建索引。增量索引需要 hash、删除旧 chunks、版本管理和失败恢复。

未来深化：

- 用 `contentHash` 判断文件是否变化。
- 只更新变化文件对应 chunks。
- 记录 index manifest。

### 7. 权限过滤和多租户

价值：高，生产必要。

为什么暂缓：

当前资料集是个人课程文档，没有用户权限边界。先学 metadata filter，再学权限模型。

未来深化：

- metadata 加 `ownerId`、`visibility`、`tenantId`。
- 检索时必须带权限 filter。
- run report 记录权限过滤条件。

### 8. PDF、网页和复杂格式解析

价值：中高，取决于作品集方向。

为什么暂缓：

复杂格式解析容易把学习重点从 RAG 变成清洗数据。Markdown 文档足够先学 RAG 核心。

未来深化：

- PDFLoader / Unstructured。
- FireCrawl / Cheerio 抓取网页。
- 表格保留结构化 metadata。

### 9. LangSmith evaluation

价值：高，但可以晚一点系统化。

为什么暂缓：

先用本地 eval dataset 理解评估指标。LangSmith 适合当评估需求稳定后接入。

未来深化：

- 把 RAG eval cases 同步到 LangSmith dataset。
- 比较不同 chunk size / topK / embedding model 的实验结果。
- 记录失败案例和回归趋势。

## 阶段完成标准

- [ ] 能解释 RAG 为什么不是“让模型联网”。
- [ ] 能把真实 Markdown 文档加载成 `Document[]`。
- [ ] 能解释 `pageContent` 和 `metadata` 的分工。
- [ ] 能把文档切成可检索 chunks。
- [ ] 能用真实 embedding 模型生成 query / document embeddings。
- [ ] 能把 chunks 写入真实 Qdrant vector store。
- [ ] 能用 search CLI 检查检索质量。
- [ ] 能生成带 citation 的 RAG 答案。
- [ ] 能在证据不足时拒答。
- [ ] 能记录 RAG run report。
- [ ] 能用最小 eval dataset 比较改动是否变好。
- [ ] 能把 RAG 包成只读工具接回 agent。

## 推荐命令规划

后续实现时建议逐步增加：

```bash
pnpm phase4:sources
pnpm phase4:documents
pnpm phase4:chunks
pnpm phase4:embedding "LangChain invoke 返回什么"
pnpm phase4:index
pnpm phase4:search "LangChain invoke 返回什么"
pnpm phase4:answer "阶段 2 为什么要用 Zod 定义工具参数"
pnpm phase4:eval
pnpm phase4:rag-tool "课程里 tool call 是怎么执行外部工具的"
```

## 参考资料

- LangChain.js Retrieval docs: https://docs.langchain.com/oss/javascript/langchain/retrieval
- LangChain.js RAG docs: https://docs.langchain.com/oss/javascript/langchain/rag
- LangChain.js semantic search tutorial: https://docs.langchain.com/oss/javascript/langchain/knowledge-base
- LangChain.js document loaders: https://docs.langchain.com/oss/javascript/integrations/document_loaders
- LangChain.js text splitters: https://docs.langchain.com/oss/javascript/integrations/splitters
- LangChain.js Qdrant vector store: https://docs.langchain.com/oss/javascript/integrations/vectorstores/qdrant
- LangChain.js OpenAI embeddings: https://docs.langchain.com/oss/javascript/integrations/embeddings/openai

## 一句话复习

```text
阶段 4 学的是：把真实文档变成可检索知识库，让模型基于检索证据回答，并用引用、拒答和评估控制可信度。
```
