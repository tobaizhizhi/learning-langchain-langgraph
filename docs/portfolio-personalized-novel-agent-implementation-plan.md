# 作品集项目实现方案：Personalized Novel Agent

版本日期：2026-06-20

项目定位：做一个能够根据用户长期偏好、兴趣、雷点、爽点和实时反馈生成连贯小说的 AI 创作工作台。它不是简单的“一次性生成小说”，而是一个能维护人物设定、管理剧情因果、合理引入角色、处理重大事件后的角色变化，并允许用户中途调整走向的长篇叙事 agent 系统。

项目关键词：长上下文、人物一致性、剧情状态、用户偏好建模、爽点识别、可控转向、连续章节生成、可追溯修订。

## 一句话 Demo

用户创建一个小说项目，填写偏好、雷点、题材、人物关系和想看的爽点。系统生成世界观、人物卡、主线大纲和第一章。之后每一章都会：

1. 检索故事圣经、人物卡、已发生事件和用户偏好。
2. 规划本章目标、冲突、情绪推进和爽点落点。
3. 写出场景草稿。
4. 检查人物设定是否跑偏。
5. 检查剧情是否连贯、因果是否成立。
6. 检查新角色是否有叙事功能。
7. 根据用户偏好评分，判断是否击中爽点。
8. 在需要时询问用户是否转向，例如更甜、更虐、更爽、更慢热、更黑暗。
9. 将已确认内容写入长期记忆，供后续章节使用。

## 目标用户

- 想把自己的偏好变成长期连载故事的读者。
- 想快速试验题材、人设、CP、世界观的小说作者。
- 想做互动小说、AI 陪伴式阅读、私人口味故事生成的开发者。
- 作品集浏览者：想看到你是否能处理复杂的 long-running agent state，而不是只会单轮聊天。

## 非目标

- 不做无限制内容生成器。
- 不生成涉及未成年人性内容、非自愿性内容或其他违法伤害内容。
- 不把用户隐私偏好公开或用于无关用途。
- 不保证一次生成就是最终稿，核心价值是持续规划、检查、修订和偏好学习。
- 不把故事写作完全交给一个 prompt，而是拆成可观察、可测试的 workflow。

## 核心卖点

- 人物不轻易崩：每个角色有 canonical facts、mutable state、relationship graph 和 change log。
- 角色能合理变化：只有重大事件、长期关系变化或用户确认的转向能改写人物状态。
- 剧情有因果：维护 timeline、open threads、foreshadowing、payoff 和 unresolved conflicts。
- 引入角色有功能：每个新角色必须有叙事目的、关系入口、冲突价值或后续回收计划。
- 理解用户爽点：把用户偏好建模为 narrative preferences，而不是只记几个关键词。
- 能中途转向：支持用户改题材、改 CP、加快节奏、增加冲突、降低强度、换视角，但要处理代价和连贯性。
- 能长期写：通过 story bible、chapter summary、scene memory、vector retrieval 和 state graph 管理长篇上下文。

## 内容边界与隐私

这个项目会处理用户私人偏好，必须把边界和隐私设计放在核心位置。

内容边界：

- 用户偏好分为 likes、dislikes、hard limits、soft limits、intensity。
- 成人向偏好必须有明确开关、年龄确认和内容边界。
- 禁止未成年人性内容、非自愿性内容、真实个人隐私侵害、违法伤害指导。
- 对高风险题材使用安全重写：保留叙事张力，但移除违法或伤害性细节。
- 用户可以随时添加雷点，系统必须立刻写入项目规则。

隐私：

- 偏好数据默认只用于当前用户和当前故事项目。
- 支持删除用户偏好、删除项目、导出项目。
- 敏感偏好字段单独存储，访问需要最小权限。
- 日志和 trace 中避免记录过度私密的原始文本，可保存摘要或脱敏版本。

## 推荐技术栈

应用层：

- TypeScript、Node.js、pnpm。
- Next.js：适合做创作工作台、章节编辑器、角色卡、时间线。
- Zod：定义用户偏好、人物卡、剧情事件、章节计划、检查器输出。
- PostgreSQL：保存项目、章节、角色、事件、用户偏好、反馈。
- Vector store：保存章节摘要、场景片段、人物历史、用户反馈。

AI 层：

- LangChain.js：模型抽象、structured output、tools、retrieval、middleware。
- LangGraph.js：长篇故事流程、状态管理、conditional routing、interrupt、persistence、streaming。
- LangSmith：trace、评估、版本对比、失败案例分析。

可选扩展：

- 文本编辑器：TipTap、Lexical 或 Monaco。
- 导出：Markdown、EPUB、PDF。
- 前端流式输出：Vercel AI SDK 或自建 SSE。

## 核心概念模型

### User Taste Profile

用户偏好不是简单标签。要把“喜欢什么”拆成多个层次。

```ts
type UserTasteProfile = {
  genres: string[];
  favoriteTropes: string[];
  dislikedTropes: string[];
  relationshipDynamics: string[];
  pacingPreference: "slow-burn" | "balanced" | "fast";
  tonePreference: Array<"sweet" | "dark" | "comedic" | "angsty" | "epic" | "slice-of-life">;
  powerFantasyPreference?: {
    enabled: boolean;
    style: "face-slapping" | "competence" | "revenge" | "growth" | "social-status" | "protective";
    intensity: 1 | 2 | 3 | 4 | 5;
  };
  emotionalPayoffs: string[];
  hardLimits: string[];
  softLimits: string[];
  explicitDoNotWrite: string[];
};
```

### Story Bible

故事圣经是全书的真相源。模型不能随意改。

```ts
type StoryBible = {
  projectId: string;
  title: string;
  genre: string[];
  premise: string;
  setting: string;
  narrativePOV: "first-person" | "third-limited" | "third-omniscient" | "multi-pov";
  tone: string[];
  themes: string[];
  canonRules: string[];
  forbiddenDirections: string[];
  mainConflict: string;
  endingPromise?: string;
};
```

### Character Card

人物卡分为不可随意变化的设定和可随剧情变化的状态。

```ts
type CharacterCard = {
  id: string;
  name: string;
  role: "protagonist" | "deuteragonist" | "love-interest" | "antagonist" | "supporting" | "minor";
  immutableFacts: {
    ageBand: "adult" | "unknown";
    background: string;
    corePersonality: string[];
    coreValues: string[];
    speechStyle: string;
  };
  mutableState: {
    currentGoal: string;
    emotionalState: string;
    trustMap: Record<string, number>;
    relationshipStatus: Record<string, string>;
    secrets: string[];
    wounds: string[];
    beliefsThatMayChange: string[];
  };
  arc: {
    startingPoint: string;
    desiredChange?: string;
    changeTriggers: string[];
    currentStage: string;
  };
  changeLog: Array<{
    chapterId: string;
    eventId: string;
    before: string;
    after: string;
    reason: string;
  }>;
};
```

### Plot State

剧情状态用于避免“上一章刚说过，下一章就忘了”。

```ts
type PlotState = {
  timeline: StoryEvent[];
  openThreads: Array<{
    id: string;
    description: string;
    introducedAt: string;
    expectedPayoff?: string;
    urgency: "low" | "medium" | "high";
  }>;
  foreshadowing: Array<{
    clue: string;
    plantedAt: string;
    payoffPlan?: string;
  }>;
  unresolvedConflicts: string[];
  relationshipArcs: Array<{
    characters: string[];
    currentDynamic: string;
    nextBeat: string;
  }>;
};
```

### Scene Plan

每个场景先规划，再写作。

```ts
type ScenePlan = {
  chapterId: string;
  sceneId: string;
  povCharacterId: string;
  location: string;
  participatingCharacters: string[];
  objective: string;
  conflict: string;
  emotionalTurn: string;
  plotFunction: "setup" | "escalation" | "reversal" | "payoff" | "recovery" | "transition";
  userPayoffTargets: string[];
  mustInclude: string[];
  mustAvoid: string[];
  expectedStateChanges: string[];
};
```

## LangGraph 工作流设计

### 初始化流程

```text
START
  -> collectUserTaste
  -> safetyAndBoundaryCheck
  -> generateStorySeed
  -> createStoryBible
  -> createInitialCharacters
  -> planMainArc
  -> planFirstChapters
  -> userApprovalInterrupt
  -> END
```

节点说明：

- `collectUserTaste`：收集题材、喜欢的关系动态、爽点、雷点、节奏、文风。
- `safetyAndBoundaryCheck`：将 hard limits、内容边界、隐私设置写入项目规则。
- `generateStorySeed`：生成 3 到 5 个故事方向让用户选择。
- `createStoryBible`：生成世界观、主线冲突、叙事承诺。
- `createInitialCharacters`：生成主角、重要配角、反派或关系角色。
- `planMainArc`：规划全书大方向，不写死每个细节。
- `planFirstChapters`：只详细规划前 3 到 5 章。
- `userApprovalInterrupt`：用户确认或修改设定后才进入正文。

### 章节生成流程

```text
START
  -> loadProjectState
  -> retrieveRelevantMemory
  -> planChapter
  -> planScenes
  -> writeScene
  -> continuityCheck
  -> characterConsistencyCheck
  -> tasteFitCheck
  -> reviseScene
  -> updateCanonState
  -> askUserSteeringIfNeeded
  -> END
```

条件路由：

- 人物崩坏：回到 `reviseScene`，并提供违反了哪条人物设定。
- 剧情不连贯：回到 `planScenes`，修复因果链。
- 爽点不足：回到 `reviseScene`，加强对应 payoff，但不破坏剧情合理性。
- 触碰 hard limit：进入 `safetyRewrite`。
- 用户中途调整：进入 `applyUserSteering`，再重新规划后续章节。

### 中途转向流程

```text
START
  -> parseUserSteering
  -> classifySteeringType
  -> estimateContinuityCost
  -> proposeTransitionOptions
  -> userChoiceInterrupt
  -> rewriteFutureOutline
  -> updateStoryBibleOrPlotState
  -> END
```

转向类型：

- Soft steering：调整文风、节奏、甜虐比例、爽点强度，不改变已发生事实。
- Plot steering：改变后续主线、增加新冲突、提前某个 payoff。
- Character steering：改变某个角色关系或成长方向，需要重大事件支撑。
- Retcon request：用户想改已经发生的内容，需要版本管理和影响分析。

## 是否需要多 agent

结论：MVP 不需要真正的多 agent。更稳的做法是先用一个 LangGraph story engine，里面拆出多个专职节点和检查器。作品集增强版可以加入“编辑部式多 agent”，但不要一开始就让每个角色都变成独立 agent。

不建议的做法：

- 不建议给每个小说角色都创建一个长期自治 agent。
- 不建议让多个 agent 分别维护自己的角色记忆。
- 不建议让 writer agent、character agent、plot agent 都能直接改 story bible。

原因：

- 人物设定更容易分叉。
- 角色记忆之间容易冲突。
- 剧情 canon 没有唯一真相源。
- 多 agent 争抢创作方向，反而降低连贯性。
- 调试困难，不适合作品集第一版。

推荐架构：

```text
Story Orchestrator
  -> Planner Node
  -> Scene Writer Node
  -> Continuity Checker Node
  -> Character Keeper Node
  -> Taste Critic Node
  -> Safety/Boundary Checker Node
  -> Revision Node
  -> Canon State Writer Node
```

这里的每个节点可以使用 LLM，但它们不是完全自治的 agent。它们都围绕同一个 StoryState 工作，并且只有 `Canon State Writer Node` 能修改 story bible、人物卡和 timeline。

核心节点职责对照：

| 中文节点 | 实现名 | 职责 |
| --- | --- | --- |
| planner node | `StoryArchitectAgent` / `Planner Node` | 规划章节、场景、冲突、伏笔和 payoff |
| writer node | `SceneWriterAgent` / `Scene Writer Node` | 根据 scene plan 写正文 |
| character consistency checker | `CharacterKeeperAgent` / `Character Keeper Node` | 检查人物语言、动机、关系变化是否崩坏 |
| continuity checker | `ContinuityEditorAgent` / `Continuity Checker Node` | 检查剧情因果、时间线、地点、信息知情范围 |
| taste critic | `TasteCriticAgent` / `Taste Critic Node` | 检查用户爽点、雷点、偏好和节奏是否命中 |
| revision node | `RevisionEditorAgent` / `Revision Node` | 根据检查结果和总编裁决改写场景 |
| canon state writer | `CanonStateWriter` / `Canon State Writer Node` | 唯一能修改 story bible、人物卡、timeline 和长期 canon 的节点 |

什么时候可以引入多 agent：

- 需要多个创作候选方案：例如 3 个 writer agents 分别写不同风格场景，再由 editor 选择。
- 需要模拟读者反馈：例如 reader agent 判断爽点是否命中，critic agent 判断节奏是否拖沓。
- 需要更强的审稿流程：例如 continuity editor、character editor、taste editor、安全编辑分别给意见。
- 需要多 POV：不同 POV writer 可以生成候选，但最终仍由 orchestrator 合并和校准。

推荐的作品集增强版多 agent：

- `StoryArchitectAgent`：负责章节目标、冲突、伏笔和 payoff。
- `SceneWriterAgent`：负责写场景正文。
- `CharacterKeeperAgent`：检查人物语言、动机、关系变化是否一致。
- `ContinuityEditorAgent`：检查时间线、因果、地点、信息知情范围。
- `TasteCriticAgent`：评估是否命中用户爽点，是否触碰雷点。
- `RevisionEditorAgent`：综合检查意见，改写场景。

多 agent 设计规则：

- Story bible、人物卡、timeline 是唯一真相源。
- worker agents 只能提交建议，不能直接改 canon。
- 所有 canon 修改必须经过 `updateCanonState`。
- 重大人物变化、retcon、内容边界变化必须触发用户确认。
- 每个 agent 的输出必须是结构化结果，而不是只返回自然语言意见。

## 编辑部式多 agent 详细设计

编辑部式多 agent 的核心不是让 agent 自由聊天，而是模拟一个有分工、有流程、有主编裁决的创作编辑部。

核心原则：

- `EditorInChief` 是总编，也是 orchestrator，负责分配任务和裁决冲突。
- 其他 agents 是专职编辑或作者，只能读取上下文和提交结构化意见。
- 所有 agents 共享同一个 StoryState，不允许各自维护独立 canon。
- 只有 `CanonStateWriter` 能提交 story bible、人物卡、timeline 的变更。
- 所有评审意见都要能追溯到具体段落、人物卡、timeline 或用户偏好。

### Agent 分工

第一版建议实现 7 个 agents：

| Agent | 职责 | 输入 | 输出 |
| --- | --- | --- | --- |
| `EditorInChief` | 总编，制定 brief、协调 agents、裁决冲突 | StoryState、用户目标、上一轮反馈 | EditorialBrief、RevisionDecision |
| `StoryArchitectAgent` | 设计章节结构、冲突、伏笔、payoff | story bible、plot state、用户偏好 | ChapterPlan、ScenePlan |
| `SceneWriterAgent` | 根据 scene plan 写正文 | ScenePlan、人物卡、相关记忆 | SceneDraft |
| `CharacterKeeperAgent` | 检查人物语言、动机、关系变化 | SceneDraft、CharacterCards、timeline | CharacterReview |
| `ContinuityEditorAgent` | 检查剧情因果、时间线、信息知情范围 | SceneDraft、PlotState、Timeline | ContinuityReview |
| `TasteCriticAgent` | 检查爽点命中、雷点规避、节奏偏好 | SceneDraft、UserTasteProfile | TasteReview |
| `RevisionEditorAgent` | 综合审稿意见，改写正文 | SceneDraft、reviews、RevisionDecision | RevisedScene |

增强版可以加入：

- `DialogueEditorAgent`：专门检查对白是否符合人物声线。
- `PacingEditorAgent`：检查节奏、信息密度、情绪曲线。
- `StyleEditorAgent`：统一文风和叙述口吻。
- `WorldbuildingEditorAgent`：检查设定、地理、规则、能力体系。
- `ReaderSimulatorAgent`：模拟目标用户阅读反馈。
- `SafetyBoundaryAgent`：专门检查 hard limits、成人内容边界和隐私风险。

### 编辑部工作流

```text
START
  -> EditorInChief.createBrief
  -> StoryArchitectAgent.planChapter
  -> StoryArchitectAgent.planScenes
  -> SceneWriterAgent.writeDraft
  -> parallelEditorialReview
      -> CharacterKeeperAgent.review
      -> ContinuityEditorAgent.review
      -> TasteCriticAgent.review
      -> SafetyBoundaryAgent.review
  -> EditorInChief.resolveReviews
  -> RevisionEditorAgent.rewrite
  -> finalEditorialCheck
  -> userSteeringInterrupt?
  -> CanonStateWriter.commit
  -> END
```

并行评审的 fan-out/fan-in：

- fan-out：同一个 `SceneDraft` 同时发给多个 editor agents。
- fan-in：所有 review 汇总到 `EditorInChief.resolveReviews`。
- resolve：总编按优先级决定哪些意见必须改、哪些意见可选、哪些意见拒绝。
- rewrite：修订编辑只根据总编决策改写，避免多个编辑直接抢文本。

### 结构化输入输出

Editorial brief：

```ts
type EditorialBrief = {
  chapterId: string;
  sceneId: string;
  goal: string;
  targetEmotion: string;
  requiredPlotBeats: string[];
  characterFocus: string[];
  userPayoffTargets: string[];
  constraints: string[];
  forbiddenMoves: string[];
};
```

Scene draft：

```ts
type SceneDraft = {
  sceneId: string;
  text: string;
  claimedStateChanges: string[];
  usedCanonFacts: string[];
  intendedPayoffs: string[];
};
```

Editorial review：

```ts
type EditorialReview = {
  agentName: string;
  verdict: "pass" | "revise" | "block";
  score: number;
  issues: Array<{
    severity: "blocking" | "major" | "minor";
    location?: string;
    problem: string;
    evidence: string;
    suggestedFix: string;
  }>;
  approvedElements: string[];
};
```

Revision decision：

```ts
type RevisionDecision = {
  mustFix: string[];
  shouldFix: string[];
  intentionallyIgnore: Array<{
    issue: string;
    reason: string;
  }>;
  rewriteInstruction: string;
  canonPatchAllowed: boolean;
  requiresUserApproval: boolean;
};
```

### 冲突裁决优先级

当多个编辑意见冲突时，按这个优先级裁决：

1. 内容边界和 hard limits。
2. Story bible 和已确认 canon。
3. 时间线和因果连贯性。
4. 人物核心设定。
5. 用户本轮明确指令。
6. 长期用户偏好和爽点。
7. 章节节奏和文风。
8. 单个编辑的审美建议。

例子：

- TasteCritic 认为“这里更虐会更刺激”，但用户刚说“不要再虐”，则用户本轮明确指令优先。
- SceneWriter 写了一个很爽的反转，但 ContinuityEditor 发现角色不可能知道那个秘密，则必须改。
- CharacterKeeper 认为主角不该突然表白，但 StoryArchitect 证明过去 5 章已有铺垫，可以允许，但需要写清心理转折。

### Canon 写入规则

编辑部式多 agent 最大风险是“每个 agent 都想改设定”。所以必须把写入权集中。

只允许 `CanonStateWriter` 写入：

- story bible。
- character mutable state。
- character change log。
- timeline。
- open threads。
- foreshadowing/payoff queue。
- user preference updates。

写入前必须检查：

- 这次变化来自哪个事件。
- 是否有 scene text 支撑。
- 是否违反 immutable facts。
- 是否需要用户确认。
- 是否影响未来 outline。

### 多候选写作模式

作品集增强版可以让多个 writer 生成候选场景，但仍由总编裁决。

```text
EditorInChief.createBrief
  -> SceneWriterAgent(style="emotional").writeDraft
  -> SceneWriterAgent(style="plot-heavy").writeDraft
  -> SceneWriterAgent(style="taste-max").writeDraft
  -> EditorInChief.selectDraft
  -> editorialReview
  -> RevisionEditorAgent.rewrite
```

候选评估指标：

- canon consistency。
- plot usefulness。
- user taste fit。
- prose quality。
- pacing。
- novelty。
- boundary compliance。

### Agent 记忆权限

每个 editor agent 只能拿到它需要的上下文。

- `CharacterKeeperAgent`：人物卡、相关历史对话、关系变化，不需要完整用户隐私偏好。
- `ContinuityEditorAgent`：timeline、open threads、当前章节，不需要敏感偏好。
- `TasteCriticAgent`：用户偏好、雷点、scene draft，不需要完整数据库。
- `SafetyBoundaryAgent`：内容边界、hard limits、scene draft。
- `SceneWriterAgent`：brief、人物卡、近期章节、必要 canon，不直接拿全部历史。

这样既减少 prompt 噪声，也降低隐私暴露。

### LangGraph 实现建议

用 subgraph 表达编辑部：

```text
ChapterGraph
  -> PlanningSubgraph
  -> WritingSubgraph
  -> EditorialReviewSubgraph
  -> RevisionSubgraph
  -> CanonCommitSubgraph
```

`EditorialReviewSubgraph` 内部并行：

```text
START
  -> fanOutReviews
  -> characterReview
  -> continuityReview
  -> tasteReview
  -> safetyReview
  -> collectReviews
  -> END
```

状态合并：

- reviews 使用 reducer 追加数组。
- blocking issue 触发 rewrite。
- safety block 直接进入 safe rewrite 或用户确认。
- 连续 2 次 rewrite 仍失败时，进入 human interrupt。

### MVP 与增强版边界

MVP 做：

- `EditorInChief`
- `StoryArchitectAgent`
- `SceneWriterAgent`
- `CharacterKeeperAgent`
- `ContinuityEditorAgent`
- `TasteCriticAgent`
- `RevisionEditorAgent`

暂时不做：

- 多 writer 候选竞争。
- 每个角色一个 agent。
- 完整读者模拟器。
- 复杂协作写作。

增强版再做：

- 多候选场景生成。
- StyleEditor、PacingEditor、DialogueEditor。
- ReaderSimulator。
- 编辑意见可视化面板。
- agent 评分趋势和失败统计。

## 关键机制

### 人物设定不轻易变化

实现方式：

- 每次写场景前检索相关角色卡。
- `immutableFacts` 默认不可变。
- `mutableState` 只能通过 `expectedStateChanges` 和 `StoryEvent` 更新。
- 每个角色变化必须写入 `changeLog`。
- `characterConsistencyCheck` 输出违反项和修订建议。

检查规则：

- 角色说话方式是否突然变化。
- 核心价值观是否无事件支撑地改变。
- 关系亲密度是否跳跃过快。
- 前一章的伤害、秘密、目标是否被遗忘。
- 重大心理转变是否有足够情节铺垫。

### 重大事件后允许人物变化

人物变化不是禁止，而是要有因果。

事件影响模型：

```ts
type EventImpact = {
  eventId: string;
  affectedCharacters: string[];
  emotionalImpact: string;
  beliefChanges: Array<{
    characterId: string;
    oldBelief: string;
    newBelief: string;
    evidence: string;
  }>;
  relationshipChanges: Array<{
    from: string;
    to: string;
    before: string;
    after: string;
    reason: string;
  }>;
  plotConsequences: string[];
};
```

只有通过 `updateCanonState` 节点确认的事件影响，才能改变角色长期状态。

### 合理引入人物角色

新角色不能为了热闹随便出现。

新角色 gate：

- 是否服务主线冲突。
- 是否推动某个角色弧光。
- 是否带来新的信息、选择、代价或阻碍。
- 是否能和已有角色建立清楚关系。
- 是否有后续回收计划。
- 是否会抢走主角戏份。

如果新角色没有明确功能，系统应该建议改用已有角色承担该功能。

### 剧情连贯性与合理性

维护 4 个结构：

- Timeline：已经发生的事实顺序。
- Causality Chain：事件 A 为什么导致事件 B。
- Open Threads：埋下但未解决的问题。
- Payoff Queue：未来需要回收的伏笔和情绪承诺。

continuity checker 需要检查：

- 时间顺序是否冲突。
- 角色是否知道自己不该知道的信息。
- 地点、物品、伤势、能力是否前后矛盾。
- 上一章的决定是否影响下一章。
- 伏笔是否被遗忘。
- 冲突解决是否过于突然。

### 用户爽点建模

“爽点”不要只理解成标签，要理解成叙事机制。

常见爽点维度：

- 能力爽：主角凭实力解决问题。
- 反转爽：被低估后反杀或翻盘。
- 关系爽：被理解、被偏爱、被守护、互相救赎。
- 成长爽：从弱到强，有明确进步。
- 权谋爽：信息差、布局、揭示真相。
- 复仇爽：压迫者付出代价。
- 治愈爽：创伤被看见，关系逐步修复。
- 禁忌张力爽：边界、克制、拉扯，但必须在合法和用户边界内。

用户偏好学习方式：

- 显式设置：喜欢/不喜欢/雷点/强度。
- 场景反馈：这一段喜欢、无聊、太快、太慢、太轻、太重。
- 选择记录：用户经常选择哪类走向。
- 续写行为：用户愿意继续看的片段权重更高。

不要过度拟合：

- 爽点要服务剧情，不是每段都硬塞。
- 同一爽点重复过多会疲劳。
- 每章要有节奏变化：铺垫、压迫、爆发、缓和。

### 中途调整小说走向

用户可能会说：

- “我想让男二戏份更多。”
- “不要这么虐，甜一点。”
- “节奏快点，早点揭露身份。”
- “我不喜欢这个新角色，删掉。”
- “让主角黑化，但要合理。”

系统处理方式：

1. 判断这是 soft steering、plot steering、character steering 还是 retcon。
2. 评估会影响哪些角色、伏笔、章节计划。
3. 给出 2 到 3 个转向方案。
4. 用户选择后更新 outline、plot state 或 story bible。
5. 后续生成时优先遵守新方向。

## 工具设计

内部工具：

- `getUserTasteProfile(projectId)`
- `updateUserTasteProfile(projectId, patch)`
- `getStoryBible(projectId)`
- `updateStoryBible(projectId, patch, reason)`
- `getCharacterCards(projectId, characterIds)`
- `updateCharacterState(characterId, eventImpact)`
- `getPlotState(projectId)`
- `appendStoryEvent(projectId, event)`
- `retrieveRelevantScenes(query, filters)`
- `retrieveCanonFacts(projectId, query)`
- `saveChapterDraft(chapter)`
- `saveSceneVersion(sceneId, version)`
- `exportManuscript(projectId, format)`

LLM 节点工具：

- `planChapter`
- `planScene`
- `writeSceneDraft`
- `checkContinuity`
- `checkCharacterConsistency`
- `scoreTasteFit`
- `rewriteScene`
- `summarizeChapter`
- `proposeSteeringOptions`

工具规则：

- 任何写入 story bible、人物卡、timeline 的工具都必须带 `reason`。
- 改变 immutable facts 必须触发人工确认。
- 删除已发布章节必须走版本管理。
- 触碰 hard limit 必须拒绝或安全改写。

## Prompt 分层

不要把所有规则塞进一个巨大 prompt。建议分层：

- System policy：内容边界、隐私、安全规则。
- Project bible：题材、世界观、叙事承诺。
- Character context：本场景相关人物卡。
- Plot context：最近章节、open threads、timeline。
- User taste context：当前用户爽点、雷点、强度。
- Scene instruction：本场景目标、冲突、情绪转折。
- Output schema：要求输出 scene text、state changes、warnings。

## 记忆设计

三类记忆：

- Canon memory：故事圣经、人物卡、已确认设定。最高优先级。
- Episodic memory：章节摘要、场景片段、用户反馈。用于检索。
- Preference memory：用户偏好、雷点、选择历史。用于个性化。

写入规则：

- 场景草稿不直接写入 canon。
- 用户确认或章节定稿后，才更新 chapter summary 和 timeline。
- 角色变化必须由 EventImpact 驱动。
- 用户反馈要区分“一次性意见”和“长期偏好”。

## UI 设计

页面 1：Project Setup

- 题材、风格、视角、篇幅。
- 用户偏好、爽点、雷点、强度。
- 选择成人内容开关和内容边界。
- 生成 3 到 5 个故事 seed。

页面 2：Story Workspace

- 左侧：故事圣经、人物卡、时间线。
- 中间：章节编辑器和流式生成。
- 右侧：爽点命中、连贯性警告、人物一致性警告。
- 底部：用户转向控制，例如更甜、更爽、更慢热、更黑暗、增加冲突。

页面 3：Character Board

- 人物卡。
- 关系图。
- 信任值、秘密、目标、伤口、成长阶段。
- change log。

页面 4：Plot Timeline

- 已发生事件。
- 未回收伏笔。
- 未解决冲突。
- 未来章节计划。
- 转向影响分析。

页面 5：Revision Panel

- 展示检查器发现的问题。
- 提供改写选项。
- 支持用户手动锁定某段文字或某个设定。

页面 6：Evaluation Lab

- 测试人物一致性。
- 测试剧情连贯性。
- 测试用户偏好命中。
- 比较不同 prompt、模型、graph 版本。

## 数据库表

核心表：

- `users`
- `taste_profiles`
- `story_projects`
- `story_bibles`
- `characters`
- `character_change_logs`
- `chapters`
- `scenes`
- `scene_versions`
- `story_events`
- `plot_threads`
- `foreshadowing`
- `user_feedback`
- `agent_runs`
- `eval_cases`
- `eval_runs`

## 评估方案

这个项目的评估不能只看文字好不好看，还要看叙事系统是否稳定。

评估维度：

- Character consistency：人物是否维持核心设定。
- Character growth validity：人物变化是否由重大事件支撑。
- Plot coherence：因果、时间线、信息知情范围是否合理。
- Role introduction quality：新角色是否有功能，是否能回收。
- Taste fit：是否命中用户设定的爽点和偏好。
- Boundary compliance：是否避开 hard limits。
- Steering compliance：用户中途转向后是否真正调整。
- Long-form memory：第 20 章是否还记得第 2 章的重要伏笔。

最小 eval dataset：

- 20 条人物一致性测试。
- 20 条剧情连贯性测试。
- 20 条用户爽点命中测试。
- 10 条中途转向测试。
- 10 条 hard limit 边界测试。
- 10 条长篇记忆回收测试。

自动评分器：

- Schema validator：输出是否符合结构。
- Rule-based checker：是否违反 hard limits、是否遗漏必填字段。
- LLM-as-judge：评分人物一致性、剧情合理性、爽点命中。
- Retrieval checker：重要设定是否来自 canon memory。
- Human review：抽样查看最关键章节。

## 里程碑

建议 8 到 10 周完成可展示版本。

第 1 周：项目骨架与偏好模型

- Next.js 工作台或 API server。
- 用户偏好 schema。
- story project、story bible、character card 数据模型。
- 生成故事 seed。

第 2 周：人物卡与故事圣经

- 生成 story bible。
- 生成主角和核心角色。
- 人物卡编辑和锁定机制。
- 用户确认 interrupt。

第 3 周：章节与场景生成

- chapter planner。
- scene planner。
- scene writer。
- 保存章节和场景版本。

第 4 周：一致性检查

- continuity checker。
- character consistency checker。
- revision loop。
- 人物变化 change log。

第 5 周：偏好与爽点评估

- taste fit checker。
- 用户反馈收集。
- 偏好更新逻辑。
- 爽点强度控制。

第 6 周：长篇记忆与 RAG

- 章节摘要。
- scene embeddings。
- canon retrieval。
- open threads 和 payoff queue。

第 7 周：中途转向

- steering parser。
- continuity cost estimator。
- 转向方案生成。
- outline rewrite。

第 8 周：UI 打磨

- Story Workspace。
- Character Board。
- Plot Timeline。
- Revision Panel。
- 流式生成和检查器提示。

第 9 周：评估系统

- eval dataset。
- LangSmith trace。
- consistency、coherence、taste fit 评估。
- 失败案例复盘。

第 10 周：作品集发布

- README。
- 架构图。
- demo 视频。
- 示例小说项目。
- 评估报告。

## Demo 场景

场景 1：人物一致性

- 用户创建一个冷静克制、信任困难的主角。
- 系统写多章后仍保持说话方式和价值观。
- 重大事件后，主角开始改变，但 change log 能解释原因。

场景 2：合理引入新角色

- 用户要求加入新角色。
- 系统先说明新角色的叙事功能和关系入口。
- 如果角色没有必要，建议由已有角色承担功能。

场景 3：爽点命中

- 用户喜欢“被低估后反杀”和“关系中的偏爱”。
- 系统在章节计划里安排铺垫、压迫、爆发、情绪回收。
- taste fit checker 给出命中点和不足。

场景 4：中途转向

- 用户第 8 章说“不要继续虐了，想变甜一点”。
- 系统给出 3 种转向方式。
- 用户选择后，后续章节改变节奏，但不推翻已发生事实。

场景 5：长篇伏笔回收

- 第 2 章埋下一个物品或秘密。
- 第 15 章自然回收。
- timeline 和 foreshadowing 记录能证明不是临时编的。

## 作品集交付物

必须有：

- 在线 demo 或本地运行说明。
- README：项目定位、功能、运行、技术栈、限制。
- 架构图：UI、API、LangGraph、DB、vector store、LangSmith。
- Graph 图：初始化流程、章节生成流程、中途转向流程。
- 示例故事项目：至少 8 到 10 章。
- 人物卡和 timeline 截图。
- 评估报告：人物一致性、剧情连贯性、爽点命中。
- Demo 视频：展示从偏好输入到章节生成，再到中途转向。

加分项：

- 支持 EPUB/Markdown 导出。
- 支持用户手动锁定 canon。
- 支持多故事 profile。
- 支持 prompt/version changelog。
- 支持失败案例库。

## 未来需求扩展策略

你提到过程中还可能增加项目需求，所以这个项目从一开始要留扩展点。

扩展原则：

- 需求先进入 backlog，不直接塞进主 prompt。
- 新需求要判断属于 taste profile、story bible、character state、plot state、tool、UI 还是 evaluation。
- 所有新增需求都要有 schema 字段和测试样例。
- 影响 canon 的需求必须有迁移逻辑。
- 影响内容边界的需求必须先更新 safety/boundary check。

推荐扩展模块：

- 多主角/多 POV。
- 分卷大纲。
- 角色关系图可视化。
- 情绪曲线控制。
- 章节节奏分析。
- 用户偏好迁移到新项目。
- 协作写作模式。
- 世界观百科。
- 读者反馈模拟器。
- 封面和角色图生成。

## 风险与对策

风险：人物崩坏。

- 对策：人物卡分 immutable/mutable，写作后强制 consistency check。

风险：剧情散掉。

- 对策：每章必须有 objective、conflict、emotional turn、state changes。

风险：爽点变成机械堆砌。

- 对策：taste fit 只作为评估，不直接替代剧情合理性。

风险：用户偏好过于私密。

- 对策：敏感字段脱敏、可删除、最小权限、trace 摘要化。

风险：中途转向破坏前文。

- 对策：区分 soft steering、plot steering、retcon，并展示 continuity cost。

风险：长篇上下文超限。

- 对策：canon memory、episodic memory、preference memory 分层；只检索当前场景相关内容。

风险：项目变成普通聊天应用。

- 对策：UI 必须围绕故事圣经、人物卡、时间线、章节编辑器和检查器，而不是只做聊天框。

## 最终验收清单

功能：

- 能创建用户偏好和内容边界。
- 能生成 story bible。
- 能生成并维护人物卡。
- 能生成连续章节。
- 能检查人物一致性。
- 能检查剧情连贯性。
- 能根据用户爽点改写场景。
- 能中途调整走向。
- 能维护 timeline、伏笔和 open threads。
- 能导出小说。

质量：

- 至少 8 到 10 章连续故事 demo。
- 人物核心设定无明显崩坏。
- 重大人物变化有事件支撑。
- 用户转向后后续章节确实改变。
- hard limits 被遵守。
- eval dataset 至少 80 条。

作品集：

- README 清楚。
- 架构图清楚。
- LangGraph 流程清楚。
- UI 不像普通聊天页。
- 有示例故事、人物卡、时间线和评估报告。
- 能解释为什么这个项目必须用 state graph，而不是一个超长 prompt。

## 官方资料

- [LangChain.js overview](https://docs.langchain.com/oss/javascript/langchain/overview)
- [LangChain.js tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain.js structured output](https://docs.langchain.com/oss/javascript/langchain/structured-output)
- [LangChain.js retrieval](https://docs.langchain.com/oss/javascript/langchain/retrieval)
- [LangGraph.js overview](https://docs.langchain.com/oss/javascript/langgraph/overview)
- [LangGraph.js workflows and agents](https://docs.langchain.com/oss/javascript/langgraph/workflows-agents)
- [LangGraph.js persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence)
- [LangGraph.js interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts)
- [LangGraph.js streaming](https://docs.langchain.com/oss/javascript/langgraph/streaming)
- [LangSmith evaluation](https://docs.langchain.com/langsmith/evaluation)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
