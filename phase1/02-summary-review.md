# 第二部分总结与复习：Messages 与 Prompt 边界

一句话：**chat model 最推荐传 messages；`system` 管长期规则，`user` 管本次任务。**

## 你要记住的核心

### 1. invoke 可以传 messages

重点代码：`phase1/src/run-single-prompt.ts`

```ts
const response = await model.invoke([
  { role: "system", content: input.systemPrompt },
  { role: "user", content: input.userPrompt },
]);
```

你要记住：

```text
messages 是一组带角色的输入，不只是一个字符串。
```

第一阶段重点只看两个角色：

```text
system
user
```

### 2. system 是长期规则

`systemPrompt` 用来告诉模型“应该怎么做事”。

比如：

```text
你是一个严谨的 AI 工程学习助手。回答要清晰、准确、简洁。
```

不要把本次问题塞进 system。

不推荐：

```text
你是一个学习助手，请解释 LangChain.js 的 invoke。
```

更推荐：

```text
system: 你是一个严谨的学习助手。
user: 请解释 LangChain.js 的 invoke。
```

### 3. user 是本次任务

`userPrompt` 放这次具体要模型做什么。

模糊：

```text
讲讲这个。
```

清楚：

```text
请面向初学者，用三句话解释 LangChain.js 的 invoke，并说明它接收什么、返回什么。
```

写 user prompt 时，只需要检查三件事：

```text
任务是什么？
处理什么内容？
希望怎么输出？
```

这不是固定模板，只是检查清单。

### 4. system prompt 可以命名复用

重点文件：`phase1/src/system-prompts.ts`

当前有：

```text
study
solidity-security
```

它们的区别：

```text
study             -> 偏学习解释
solidity-security -> 偏安全分析，强调证据和待验证项
```

运行时可以切换：

```bash
SYSTEM_PROMPT_NAME=study pnpm phase1:invoke "请解释 Solidity reentrancy"
SYSTEM_PROMPT_NAME=solidity-security pnpm phase1:invoke "请解释 Solidity reentrancy"
```

## 最该看的代码

按顺序看：

1. `phase1/src/run-single-prompt.ts`
   - 看 `model.invoke([...messages])`
   - 看 `systemPrompt` 和 `userPrompt` 怎么进入 messages

2. `phase1/src/system-prompts.ts`
   - 看 `systemPrompts`
   - 看 `loadSystemPromptFromEnv(...)`

3. `phase1/src/invoke-demo.ts`
   - 看命令行参数怎么变成 `userPrompt`
   - 看环境变量怎么切换 `systemPrompt`

## 你不用重点学

现在先不要学：

```text
prompt builder
prompt template
复杂 prompt dataset
自动评测
metadata 设计
```

这些不是第二部分主线。

## 你必须能回答

1. 为什么 messages 比单个字符串更清楚？
2. `systemPrompt` 应该放什么？
3. `userPrompt` 应该放什么？
4. 为什么不要把一次性问题放进 system？
5. `study` 和 `solidity-security` 的区别是什么？
6. 写 user prompt 时要检查哪三件事？

## 一句话复习

```text
system 写长期规则，user 写本次任务；
messages 让模型输入有角色边界；
prompt 先写清楚，不要急着抽象成 builder。
```
