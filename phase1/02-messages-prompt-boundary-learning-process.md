# 阶段 1 第二部分：Messages 与 Prompt 边界

版本日期：2026-06-22

对应大纲章节：`phase1/README.md` 中的 `2. Messages 与 Prompt 边界`

## 本节目标

本节只解决一个问题：

```text
调用 chat model 时，应该给 model.invoke(...) 传什么 messages？
```

学完后你应该能看懂并自己写出：

```ts
await model.invoke([
  { role: "system", content: "你是一个严谨的学习助手。" },
  { role: "user", content: "请用三句话解释 LangChain.js 的 invoke。" },
]);
```

## 价值分级

必须学：

- `model.invoke([...messages])`
- `system` message 和 `user` message 的区别
- 如何写一个清楚的 user prompt

值得学：

- 可命名的 system prompt，例如 `study`、`solidity-security`
- 通过日志回看实际传入的 user prompt

知道即可：

- 固定 prompt dataset 是未来评测内容
- prompt metadata 不属于本节主线

暂缓：

- prompt builder
- prompt template
- 自动评测
- 复杂 prompt dataset

判断标准：如果删掉某个抽象后，不影响你理解 `model.invoke([system, user])`，它就不是本节主线。

## 核心概念

### 1. Chat model 的输入是 messages

字符串调用可以跑：

```ts
await model.invoke("解释 reentrancy");
```

但更推荐显式 messages：

```ts
await model.invoke([
  { role: "system", content: "你是一个严谨的 Solidity 安全学习助手。" },
  { role: "user", content: "请用三句话解释 reentrancy。" },
]);
```

原因：messages 能表达角色和职责。

### 2. system 是长期规则

system prompt 用来描述模型应该如何做事：

```text
你是一个严谨的 AI 工程学习助手。回答要清晰、准确、简洁。
遇到不确定的信息要说明不确定，不要编造。
```

不要把本次任务放进 system prompt。

不推荐：

```text
你是一个老师，请解释 LangChain.js 的 invoke。
```

更推荐：

```ts
systemPrompt = "你是一个严谨的学习助手。回答要清晰、简洁。";
userPrompt = "请解释 LangChain.js 的 invoke。";
```

### 3. user 是本次任务

user prompt 放这一次具体要做的事。

简单任务可以直接写：

```text
请用三句话解释 LangChain.js 的 invoke。
```

复杂一点可以写清楚：

```text
请面向初学者，用三句话解释 Solidity 的 reentrancy，并给出一个常见防护方式。
```

不需要强行拆成固定格式。只要让模型知道：

```text
这次要做什么？
处理什么内容？
希望怎么输出？
```

## 推荐学习流程

### Step 1：看懂当前 messages 调用

价值标签：必须学

做什么：回看当前项目里真正调用模型的地方。

重点文件：

- `phase1/src/run-single-prompt.ts`

核心代码：

```ts
const response = await model.invoke([
  { role: "system", content: input.systemPrompt },
  { role: "user", content: input.userPrompt },
]);
```

你只需要确认三件事：

- `systemPrompt` 先进 messages
- `userPrompt` 后进 messages
- 返回的是 `AIMessage`

验收：

- 能说出 `systemPrompt` 和 `userPrompt` 分别从哪里传进来。
- 能解释为什么 messages 比单个字符串更适合后续 agent。

不做什么：

- 不学 prompt template。
- 不设计复杂 dataset。

### Step 2：区分 system 和 user

价值标签：必须学

做什么：用同一个 user prompt，切换不同 system prompt，观察回答变化。

可以这样运行：

```bash
SYSTEM_PROMPT_NAME=study pnpm phase1:invoke "请解释 Solidity reentrancy"
```

再运行：

```bash
SYSTEM_PROMPT_NAME=solidity-security pnpm phase1:invoke "请解释 Solidity reentrancy"
```

重点文件：

- `phase1/src/system-prompts.ts`
- `phase1/src/invoke-demo.ts`

当前已有两个 system prompt：

```text
study
solidity-security
```

验收：

- 能说明 `study` 更偏学习解释。
- 能说明 `solidity-security` 更强调风险、证据和待验证项。

不做什么：

- 不把合约源码、用户问题、临时任务塞进 system prompt。

### Step 3：手写清楚的 user prompt

价值标签：必须学

做什么：把模糊 prompt 改成清楚 prompt。

模糊：

```text
讲讲这个。
```

清楚：

```text
请面向初学者，用三句话解释 LangChain.js 的 invoke，并说明它接收什么、返回什么。
```

检查清单：

- 是否说清楚任务？
- 是否说清楚输入对象？
- 是否说清楚输出要求？

不是每次都要写“任务/受众/输入/输出”四段。那只是检查清单，不是固定格式。

练习：

- 写 3 个 user prompt：
  - 解释 LangChain.js invoke
  - 解释 Solidity reentrancy
  - 比较 `new ChatOpenAI()` 和 `createChatModel(config)`

验收：

- user prompt 单独拿出来也能看懂本次任务。
- 不依赖隐藏上下文。

不做什么：

- 不写 `buildClearUserPrompt()`。
- 不写 `sentenceCount` 这类 prompt builder 参数。

## 当前代码地图

主线代码：

- `phase1/src/run-single-prompt.ts`：真正调用 `model.invoke([...messages])`
- `phase1/src/system-prompts.ts`：可命名 system prompt
- `phase1/src/invoke-demo.ts`：命令行入口

辅助代码：

- `phase1/src/model-run-log.ts`：记录输入输出摘要

## 常用命令

默认调用：

```bash
pnpm phase1:invoke
```

自定义 user prompt：

```bash
pnpm phase1:invoke "请用三句话解释 LangChain.js 的 invoke"
```

切换 system prompt：

```bash
SYSTEM_PROMPT_NAME=solidity-security pnpm phase1:invoke "请解释 reentrancy"
```

查看日志：

```bash
pnpm phase1:logs
```

## 本节完成标准

你只需要做到：

- 能解释 messages 是什么。
- 能写出 `system` + `user` 两条 messages。
- 能区分 system 是长期规则，user 是本次任务。
- 能手写一个清楚的 user prompt。

完成这些，就可以进入下一节：`3. Invoke：单次调用与结果归一化`。
