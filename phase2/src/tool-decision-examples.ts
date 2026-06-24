export type ExternalToolName =
	| "get_github_repository"
	| "search_github_repositories"
	| "get_npm_package";

export type ToolUseDecision =
	| {
			kind: "direct_answer";
			reason: string;
	  }
	| {
			kind: "tool_call";
			toolName: ExternalToolName;
			exampleArgs: Record<string, unknown>;
			reason: string;
	  };

export type ToolUseCase = {
	userInput: string;
	decision: ToolUseDecision;
};

export const step1ToolUseCases: ToolUseCase[] = [
	{
		userInput: "解释一下 LangChain.js 的 tool calling 是什么。",
		decision: {
			kind: "direct_answer",
			reason: "这是概念解释，不需要查询外部实时数据。",
		},
	},
	{
		userInput: "查询 langchain-ai/langchainjs 的 GitHub 仓库信息。",
		decision: {
			kind: "tool_call",
			toolName: "get_github_repository",
			exampleArgs: {
				owner: "langchain-ai",
				repo: "langchainjs",
			},
			reason: "仓库 stars、issues、更新时间会变化，需要 GitHub API 的最新数据。",
		},
	},
	{
		userInput: "搜索 GitHub 上和 langchainjs 相关的 TypeScript 仓库。",
		decision: {
			kind: "tool_call",
			toolName: "search_github_repositories",
			exampleArgs: {
				query: "langchainjs language:typescript",
				limit: 3,
			},
			reason: "这是外部搜索任务，需要 GitHub Search API。",
		},
	},
	{
		userInput: "查看 @langchain/core 的 npm 包信息。",
		decision: {
			kind: "tool_call",
			toolName: "get_npm_package",
			exampleArgs: {
				packageName: "@langchain/core",
			},
			reason: "npm 包版本和元数据会变化，需要 npm registry 的最新数据。",
		},
	},
];

export function formatToolUseDecision(useCase: ToolUseCase): string {
	if (useCase.decision.kind === "direct_answer") {
		return [
			`User: ${useCase.userInput}`,
			"Decision: direct_answer",
			`Reason: ${useCase.decision.reason}`,
		].join("\n");
	}

	return [
		`User: ${useCase.userInput}`,
		`Decision: tool_call -> ${useCase.decision.toolName}`,
		`Args: ${JSON.stringify(useCase.decision.exampleArgs)}`,
		`Reason: ${useCase.decision.reason}`,
	].join("\n");
}

function main() {
	for (const [index, useCase] of step1ToolUseCases.entries()) {
		console.log(`${index + 1}.`);
		console.log(formatToolUseDecision(useCase));
		console.log("");
	}
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main();
}
