import { BaseMessage } from "@langchain/core/messages";
import { createAgent } from "langchain";
import { config as loadDotEnv } from "dotenv";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import { loadModelConfigFromEnv, type ModelConfig } from "../../phase1/src/model-config.js";
import { createPhase3ToolList } from "./agent-tools.js";

export const phase3DefaultUserPrompt =
	"请查询 langchain-ai/langchainjs 的 GitHub 仓库信息、@langchain/core 的 npm 包信息和最近一周下载量，并告诉我 UTC 当前时间。";

export const phase3SystemPrompt = [
	"You are a practical engineering assistant.",
	"Use external tools when the user asks about GitHub repositories, GitHub users, npm packages, npm downloads, or current time.",
	"Do not invent external facts. If a needed tool fails or no source is available, say that clearly.",
	"Keep the final answer concise and mention which external sources or tools were used.",
].join(" ");

export type AgentMessageSummary = {
	type: string;
	text: string;
	toolCalls: Array<{
		name: string;
		id?: string;
		args: unknown;
	}>;
	toolName?: string;
};

export type Phase3AgentResult = {
	provider: string;
	model: string;
	userPrompt: string;
	availableTools: string[];
	finalText: string;
	messageCount: number;
	toolCallCount: number;
	toolResultCount: number;
	messages: AgentMessageSummary[];
};

export type RunPhase3AgentInput = {
	config: ModelConfig;
	userPrompt: string;
	recursionLimit?: number;
};

export async function runPhase3Agent(input: RunPhase3AgentInput): Promise<Phase3AgentResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase3 requires a real chat model. Set MODEL_ID=openai:<model> in phase3/.env.");
	}

	const model = createChatModel(input.config);
	const tools = createPhase3ToolList();
	const agent = createAgent({
		model,
		tools,
		systemPrompt: phase3SystemPrompt,
	});

	const result = await agent.invoke(
		{
			messages: [{ role: "user", content: input.userPrompt }],
		},
		{
			recursionLimit: input.recursionLimit ?? 12,
		},
	);

	const messages = Array.isArray(result.messages) ? result.messages : [];
	const summarizedMessages = messages.map(summarizeMessage);

	return {
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
		availableTools: tools.map((tool) => tool.name),
		finalText: readFinalText(messages),
		messageCount: summarizedMessages.length,
		toolCallCount: summarizedMessages.reduce(
			(total, message) => total + message.toolCalls.length,
			0,
		),
		toolResultCount: summarizedMessages.filter((message) => message.type === "tool").length,
		messages: summarizedMessages,
	};
}

export function loadPhase3ModelConfig(): ModelConfig {
	loadDotEnv({ path: "phase3/.env", override: false, quiet: true });
	loadDotEnv({ path: "phase2/.env", override: false, quiet: true });
	loadDotEnv({ path: "phase1/.env", override: false, quiet: true });

	return loadModelConfigFromEnv();
}

async function main() {
	const config = loadPhase3ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase3DefaultUserPrompt;
	const result = await runPhase3Agent({ config, userPrompt });

	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	console.log("Available tools:");
	for (const toolName of result.availableTools) {
		console.log(`- ${toolName}`);
	}
	console.log("");

	console.log("Agent trace:");
	for (const message of result.messages) {
		console.log(`- ${message.type}${message.toolName ? `:${message.toolName}` : ""}`);
		if (message.toolCalls.length > 0) {
			for (const toolCall of message.toolCalls) {
				console.log(`  tool_call: ${toolCall.name} args=${JSON.stringify(toolCall.args)}`);
			}
		}
		if (message.text) {
			console.log(indentText(truncateText(message.text, 1_000), "  "));
		}
	}
	console.log("");

	console.log("Summary:");
	console.log(`- messages: ${result.messageCount}`);
	console.log(`- tool calls: ${result.toolCallCount}`);
	console.log(`- tool results: ${result.toolResultCount}`);
	console.log("");

	console.log("Final answer:");
	console.log(result.finalText || "(empty final answer)");
}

function summarizeMessage(message: unknown): AgentMessageSummary {
	const type = readMessageType(message);

	return {
		type,
		text: truncateText(readMessageText(message), 2_000),
		toolCalls: readToolCalls(message),
		toolName: type === "tool" ? readToolName(message) : undefined,
	};
}

function readFinalText(messages: unknown[]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const text = readMessageText(messages[index]).trim();
		if (text.length > 0) {
			return text;
		}
	}

	return "";
}

function readMessageType(message: unknown): string {
	if (BaseMessage.isInstance(message)) {
		return message._getType();
	}

	return readObjectString(message, "type") ?? "unknown";
}

function readMessageText(message: unknown): string {
	if (BaseMessage.isInstance(message)) {
		return message.text;
	}

	const content = readObjectValue(message, "content");
	if (typeof content === "string") {
		return content;
	}

	return content === undefined ? "" : JSON.stringify(content);
}

function readToolCalls(message: unknown): AgentMessageSummary["toolCalls"] {
	const toolCalls = readObjectValue(message, "tool_calls");
	if (!Array.isArray(toolCalls)) {
		return [];
	}

	return toolCalls.map((toolCall) => ({
		name: readObjectString(toolCall, "name") ?? "unknown_tool",
		id: readObjectString(toolCall, "id"),
		args: readObjectValue(toolCall, "args") ?? {},
	}));
}

function readToolName(message: unknown): string | undefined {
	return readObjectString(message, "name");
}

function readObjectValue(value: unknown, key: string): unknown {
	return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function readObjectString(value: unknown, key: string): string | undefined {
	const item = readObjectValue(value, key);
	return typeof item === "string" && item.length > 0 ? item : undefined;
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength)}...`;
}

function indentText(text: string, prefix: string): string {
	return text
		.split("\n")
		.map((line) => `${prefix}${line}`)
		.join("\n");
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase3 agent demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
