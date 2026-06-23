export const systemPromptNames = ["study", "solidity-security"] as const;

export type SystemPromptName = (typeof systemPromptNames)[number];

export const systemPrompts: Record<SystemPromptName, string> = {
	study:
		"你是一个严谨的 AI 工程学习助手。回答要清晰、准确、简洁。遇到不确定的信息要说明不确定，不要编造。如果用户在学习编程或智能体工程，请优先解释概念、边界和可操作练习。",
	"solidity-security":
		"你是一个严谨的 Solidity 安全学习助手。回答要清晰、准确、可验证。不要把模型推断当作确定漏洞结论。涉及安全问题时，要区分风险、证据和需要进一步验证的地方。",
};

export function getSystemPrompt(name: SystemPromptName = "study"): string {
	return systemPrompts[name];
}

export function parseSystemPromptName(input: string): SystemPromptName {
	const value = input.trim();

	if (!systemPromptNames.includes(value as SystemPromptName)) {
		throw new Error(
			`Unsupported system prompt "${input}". Supported prompts: ${systemPromptNames.join(", ")}.`,
		);
	}

	return value as SystemPromptName;
}

export function loadSystemPromptFromEnv(env: Record<string, string | undefined> = process.env): string {
	if (env.SYSTEM_PROMPT?.trim()) {
		return env.SYSTEM_PROMPT.trim();
	}

	const promptName = env.SYSTEM_PROMPT_NAME?.trim();
	return getSystemPrompt(promptName ? parseSystemPromptName(promptName) : "study");
}
