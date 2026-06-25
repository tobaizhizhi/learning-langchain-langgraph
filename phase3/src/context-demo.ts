import {
	AIMessage,
	BaseMessage,
	type BaseMessageLike,
	HumanMessage,
	SystemMessage,
	ToolMessage,
	coerceMessageLikeToMessage,
	trimMessages,
} from "@langchain/core/messages";
import { createAgent } from "langchain";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import type { ModelConfig } from "../../phase1/src/model-config.js";
import {
	createAgentInvokeInput,
	inspectAgentInvokeResult,
	type AgentInvokeInput,
	type AgentResultInspection,
} from "./agent-result-demo.js";
import {
	loadPhase3ModelConfig,
	phase3DefaultUserPrompt,
	phase3SystemPrompt,
} from "./agent-demo.js";
import { createPhase3ToolList } from "./agent-tools.js";

export type ShortTermContextOptions = {
	maxApproxTokens: number;
	maxToolResultChars: number;
};

export type MessageContextSummary = {
	index: number;
	type: string;
	textLength: number;
	textPreview: string;
	toolCalls: string[];
	toolName?: string;
	toolCallId?: string;
};

export type ShortTermContextResult = {
	maxApproxTokens: number;
	maxToolResultChars: number;
	originalMessageCount: number;
	preparedMessageCount: number;
	droppedMessageCount: number;
	originalApproxTokens: number;
	preparedApproxTokens: number;
	compressedToolResultCount: number;
	preparedMessages: BaseMessage[];
	originalSummary: MessageContextSummary[];
	preparedSummary: MessageContextSummary[];
};

export type RunContextAwareAgentInput = {
	config: ModelConfig;
	userPrompt: string;
	recursionLimit?: number;
	contextOptions?: Partial<ShortTermContextOptions>;
	messages?: BaseMessageLike[];
};

export type ContextAwareAgentResult = AgentResultInspection & {
	context: ShortTermContextResult;
};

export const defaultShortTermContextOptions: ShortTermContextOptions = {
	maxApproxTokens: 900,
	maxToolResultChars: 700,
};

export async function runContextAwareAgent(
	input: RunContextAwareAgentInput,
): Promise<ContextAwareAgentResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase3 requires a real chat model. Set MODEL_ID=openai:<model> in phase3/.env.");
	}

	const model = createChatModel(input.config);
	const tools = createPhase3ToolList();
	const rawMessages = input.messages ?? createDemoConversationMessages(input.userPrompt);
	const context = await prepareShortTermContext(rawMessages, input.contextOptions);
	const agent = createAgent({
		model,
		tools,
	});
	const agentInput: AgentInvokeInput = {
		messages: context.preparedMessages,
	};
	const rawResult = await agent.invoke(agentInput, {
		recursionLimit: input.recursionLimit ?? 12,
	});
	const inspection = inspectAgentInvokeResult({
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
		availableTools: tools.map((tool) => tool.name),
		input: agentInput,
		result: rawResult,
	});

	return {
		...inspection,
		context,
	};
}

export async function prepareShortTermContext(
	messages: BaseMessageLike[],
	options: Partial<ShortTermContextOptions> = {},
): Promise<ShortTermContextResult> {
	const resolvedOptions = {
		...defaultShortTermContextOptions,
		...options,
	};
	const originalMessages = messages.map((message) => coerceMessageLikeToMessage(message));
	const compressed = compressLongToolResults(
		originalMessages,
		resolvedOptions.maxToolResultChars,
	);
	const preparedMessages = await trimMessages(compressed.messages, {
		maxTokens: resolvedOptions.maxApproxTokens,
		tokenCounter: countApproxTokens,
		strategy: "last",
		includeSystem: true,
		startOn: "human",
		endOn: "human",
		allowPartial: false,
	});

	validatePreparedContext(preparedMessages);

	return {
		maxApproxTokens: resolvedOptions.maxApproxTokens,
		maxToolResultChars: resolvedOptions.maxToolResultChars,
		originalMessageCount: originalMessages.length,
		preparedMessageCount: preparedMessages.length,
		droppedMessageCount: originalMessages.length - preparedMessages.length,
		originalApproxTokens: countApproxTokens(originalMessages),
		preparedApproxTokens: countApproxTokens(preparedMessages),
		compressedToolResultCount: compressed.changedCount,
		preparedMessages,
		originalSummary: summarizeContextMessages(originalMessages),
		preparedSummary: summarizeContextMessages(preparedMessages),
	};
}

export function createDemoConversationMessages(userPrompt: string): BaseMessage[] {
	return [
		new SystemMessage(phase3SystemPrompt),
		new HumanMessage("之前请你查一下 langchain-ai/langchainjs 的 GitHub 仓库。"),
		new AIMessage({
			content: "",
			tool_calls: [
				{
					id: "call_old_repo",
					name: "get_github_repository",
					args: { owner: "langchain-ai", repo: "langchainjs" },
				},
			],
		}),
		new ToolMessage({
			name: "get_github_repository",
			tool_call_id: "call_old_repo",
			content: JSON.stringify({
				fullName: "langchain-ai/langchainjs",
				description: "LangChain.js repository metadata from an earlier turn.",
				url: "https://github.com/langchain-ai/langchainjs",
				language: "TypeScript",
			}),
		}),
		new AIMessage("langchain-ai/langchainjs 是 LangChain.js 的主仓库，主要语言是 TypeScript。"),
		new HumanMessage("再查一下 @langchain/core 的 npm 包信息。"),
		new AIMessage({
			content: "",
			tool_calls: [
				{
					id: "call_old_npm",
					name: "get_npm_package",
					args: { packageName: "@langchain/core" },
				},
			],
		}),
		new ToolMessage({
			name: "get_npm_package",
			tool_call_id: "call_old_npm",
			content: createLongHistoricalToolResult(),
		}),
		new AIMessage("@langchain/core 是 LangChain.js 的核心抽象包，包含消息、工具和 runnable 等基础类型。"),
		new HumanMessage(userPrompt),
	];
}

export function countApproxTokens(messages: BaseMessage[]): number {
	return messages.reduce((total, message) => {
		const textTokens = Math.ceil(message.text.length / 4);
		const toolCallTokens = readToolCallNames(message).length * 16;

		return total + 4 + textTokens + toolCallTokens;
	}, 0);
}

export function summarizeContextMessages(messages: BaseMessage[]): MessageContextSummary[] {
	return messages.map((message, index) => ({
		index,
		type: message._getType(),
		textLength: message.text.length,
		textPreview: truncateText(message.text, 140),
		toolCalls: readToolCallNames(message),
		toolName: ToolMessage.isInstance(message) ? message.name : undefined,
		toolCallId: ToolMessage.isInstance(message) ? message.tool_call_id : undefined,
	}));
}

function compressLongToolResults(
	messages: BaseMessage[],
	maxToolResultChars: number,
): { messages: BaseMessage[]; changedCount: number } {
	let changedCount = 0;
	const compressedMessages = messages.map((message) => {
		if (!ToolMessage.isInstance(message) || message.text.length <= maxToolResultChars) {
			return message;
		}

		changedCount += 1;

		return new ToolMessage({
			name: message.name,
			tool_call_id: message.tool_call_id,
			status: message.status,
			metadata: message.metadata,
			content: `${message.text.slice(0, maxToolResultChars)}\n...[tool result truncated for short-term context]`,
		});
	});

	return {
		messages: compressedMessages,
		changedCount,
	};
}

function validatePreparedContext(messages: BaseMessage[]): void {
	if (messages.length === 0) {
		throw new Error("Prepared context is empty. Increase maxApproxTokens.");
	}

	if (messages.at(-1)?._getType() !== "human") {
		throw new Error("Prepared context must end with the latest human message.");
	}
}

function createLongHistoricalToolResult(): string {
	return JSON.stringify({
		name: "@langchain/core",
		description: "Core LangChain.js abstractions and schemas",
		latestVersion: "1.2.1",
		repository: "git+https://github.com/langchain-ai/langchainjs.git",
		readmeExcerpt:
			"Historical npm package metadata can be very large. ".repeat(45) +
			"In a real agent, old tool results should usually be summarized or trimmed before the next model call.",
	});
}

function readToolCallNames(message: BaseMessage): string[] {
	if (!AIMessage.isInstance(message) || !Array.isArray(message.tool_calls)) {
		return [];
	}

	return message.tool_calls.map((toolCall) => toolCall.name);
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength)}...`;
}

async function main() {
	const config = loadPhase3ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase3DefaultUserPrompt;
	const result = await runContextAwareAgent({
		config,
		userPrompt,
		contextOptions: {
			maxApproxTokens: readPositiveIntegerEnv("CONTEXT_MAX_APPROX_TOKENS", 900),
			maxToolResultChars: readPositiveIntegerEnv("CONTEXT_MAX_TOOL_RESULT_CHARS", 700),
		},
	});

	printContextAwareAgentResult(result);
}

function printContextAwareAgentResult(result: ContextAwareAgentResult) {
	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	console.log("Short-term context:");
	console.log(`- original messages: ${result.context.originalMessageCount}`);
	console.log(`- prepared messages: ${result.context.preparedMessageCount}`);
	console.log(`- dropped messages: ${result.context.droppedMessageCount}`);
	console.log(`- compressed long tool results: ${result.context.compressedToolResultCount}`);
	console.log(`- approx tokens: ${result.context.originalApproxTokens} -> ${result.context.preparedApproxTokens}`);
	console.log("");

	console.log("Prepared messages sent to agent:");
	for (const message of result.context.preparedSummary) {
		const label = `[${message.index}] ${message.type}${message.toolName ? `:${message.toolName}` : ""}`;
		console.log(`- ${label} chars=${message.textLength}`);
		if (message.toolCallId) {
			console.log(`  tool_call_id: ${message.toolCallId}`);
		}
		if (message.toolCalls.length > 0) {
			console.log(`  requested_tools: ${message.toolCalls.join(", ")}`);
		}
		if (message.textPreview) {
			console.log(`  text: ${message.textPreview}`);
		}
	}
	console.log("");

	console.log("Agent result:");
	console.log(`- messages: ${result.messageCount}`);
	console.log(`- tool calls: ${result.toolCallCount}`);
	console.log(`- tool results: ${result.toolResultCount}`);
	console.log("");

	console.log("Final answer:");
	console.log(result.finalText || "(empty final text)");
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return fallback;
	}

	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return value;
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase3 context demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
