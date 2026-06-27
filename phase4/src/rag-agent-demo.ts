import { BaseMessage } from "@langchain/core/messages";
import { config as loadDotEnv } from "dotenv";
import { createAgent } from "langchain";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import {
	loadModelConfigFromEnv,
	type ModelConfig,
} from "../../phase1/src/model-config.js";
import {
	createPhase4RagToolList,
	type CourseKnowledgeSearchToolOptions,
} from "./rag-tool.js";

export const phase4RagAgentDefaultPrompt =
	"请查询课程知识库，并解释 Step10 RAG eval 应该重点看哪些代码。";

export const phase4RagAgentSystemPrompt = [
	"You are a practical course assistant for this local LangChain/LangGraph learning project.",
	"When the user asks about course phases, local learning docs, RAG, tool calling, prompts, agents, or code locations, call search_course_knowledge_base before answering.",
	"Use only the returned knowledge-base evidence for course-specific claims.",
	"Include citation keys from the tool result, using sourcePath#chunk-index.",
	"If the tool returns no useful evidence, say the knowledge base does not contain enough evidence.",
	"Do not use the knowledge-base tool for secrets, weather, or live web facts.",
].join(" ");

export type RagAgentMessageSummary = {
	type: string;
	text: string;
	toolCalls: Array<{
		name: string;
		id?: string;
		args: unknown;
	}>;
	toolName?: string;
};

export type RagAgentResult = {
	provider: string;
	model: string;
	userPrompt: string;
	availableTools: string[];
	finalText: string;
	messageCount: number;
	toolCallCount: number;
	toolResultCount: number;
	messages: RagAgentMessageSummary[];
};

export type RunRagAgentInput = {
	config: ModelConfig;
	userPrompt: string;
	recursionLimit?: number;
	toolOptions?: CourseKnowledgeSearchToolOptions;
};

export async function runRagAgent(input: RunRagAgentInput): Promise<RagAgentResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase4 RAG agent requires a real chat model. Set MODEL_ID=openai:<model> in phase4/.env.");
	}

	const model = createChatModel(input.config);
	const tools = createPhase4RagToolList(input.toolOptions);
	const agent = createAgent({
		model,
		tools,
		systemPrompt: phase4RagAgentSystemPrompt,
	});
	const result = await agent.invoke(
		{
			messages: [{ role: "user", content: input.userPrompt }],
		},
		{
			recursionLimit: input.recursionLimit ?? 8,
		},
	);
	const messages = readMessages(result);
	const summarizedMessages = messages.map(summarizeMessage);

	return {
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
		availableTools: tools.map((toolInstance) => toolInstance.name),
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

export function loadPhase4RagAgentModelConfig(): ModelConfig {
	loadDotEnv({ path: "phase4/.env", override: false, quiet: true });
	loadDotEnv({ path: "phase3/.env", override: false, quiet: true });
	loadDotEnv({ path: "phase2/.env", override: false, quiet: true });
	loadDotEnv({ path: "phase1/.env", override: false, quiet: true });

	return loadModelConfigFromEnv();
}

function readMessages(result: unknown): unknown[] {
	const messages = readObjectValue(result, "messages");

	return Array.isArray(messages) ? messages : [];
}

function summarizeMessage(message: unknown): RagAgentMessageSummary {
	const type = readMessageType(message);

	return {
		type,
		text: truncateText(readMessageText(message), 2_000),
		toolCalls: readToolCalls(message),
		toolName: type === "tool" ? readObjectString(message, "name") : undefined,
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

function readToolCalls(message: unknown): RagAgentMessageSummary["toolCalls"] {
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

async function main() {
	loadDotEnv({ quiet: true });
	const config = loadPhase4RagAgentModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase4RagAgentDefaultPrompt;
	const result = await runRagAgent({ config, userPrompt });

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
		for (const toolCall of message.toolCalls) {
			console.log(`  tool_call: ${toolCall.name} args=${JSON.stringify(toolCall.args)}`);
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

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 RAG agent demo failed: ${message}`);
	if (
		message.includes("6333") ||
		message.toLowerCase().includes("qdrant") ||
		message.toLowerCase().includes("fetch failed")
	) {
		console.error(`Qdrant checklist: run "docker ps" and "pnpm phase4:index", then retry.`);
	} else if (message.includes("11434") || message.includes("/api/")) {
		console.error(`Ollama checklist: run "ollama ps" and verify EMBEDDING_MODEL in phase4/.env.`);
	}
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
