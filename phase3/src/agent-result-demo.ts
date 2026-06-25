import { BaseMessage, type BaseMessageLike } from "@langchain/core/messages";
import { createAgent } from "langchain";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import type { ModelConfig } from "../../phase1/src/model-config.js";
import {
	loadPhase3ModelConfig,
	phase3DefaultUserPrompt,
	phase3SystemPrompt,
} from "./agent-demo.js";
import { createPhase3ToolList } from "./agent-tools.js";

export type AgentInvokeInput = {
	messages: BaseMessageLike[];
};

export type AgentResultMessageInspection = {
	index: number;
	type: string;
	text: string;
	toolCalls: Array<{
		name: string;
		id?: string;
		args: unknown;
	}>;
	toolName?: string;
	toolCallId?: string;
};

export type AgentResultInspection = {
	provider: string;
	model: string;
	userPrompt: string;
	availableTools: string[];
	input: AgentInvokeInput;
	resultKeys: string[];
	messageCount: number;
	toolCallCount: number;
	toolResultCount: number;
	finalText: string;
	finalMessage?: AgentResultMessageInspection;
	hasStructuredResponse: boolean;
	structuredResponse?: unknown;
	messages: AgentResultMessageInspection[];
};

export type RunAgentResultDemoInput = {
	config: ModelConfig;
	userPrompt: string;
	recursionLimit?: number;
};

export async function runAgentResultDemo(
	input: RunAgentResultDemoInput,
): Promise<AgentResultInspection> {
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
	const agentInput = createAgentInvokeInput(input.userPrompt);
	const result = await agent.invoke(agentInput, {
		recursionLimit: input.recursionLimit ?? 12,
	});

	return inspectAgentInvokeResult({
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
		availableTools: tools.map((tool) => tool.name),
		input: agentInput,
		result,
	});
}

export function createAgentInvokeInput(userPrompt: string): AgentInvokeInput {
	return {
		messages: [{ role: "user", content: userPrompt }],
	};
}

export function inspectAgentInvokeResult(input: {
	provider: string;
	model: string;
	userPrompt: string;
	availableTools: string[];
	input: AgentInvokeInput;
	result: unknown;
}): AgentResultInspection {
	const messages = readMessages(input.result).map(inspectMessage);
	const structuredResponse = readObjectValue(input.result, "structuredResponse");

	return {
		provider: input.provider,
		model: input.model,
		userPrompt: input.userPrompt,
		availableTools: input.availableTools,
		input: input.input,
		resultKeys: readObjectKeys(input.result),
		messageCount: messages.length,
		toolCallCount: messages.reduce((total, message) => total + message.toolCalls.length, 0),
		toolResultCount: messages.filter((message) => message.type === "tool").length,
		finalText: readFinalText(messages),
		finalMessage: messages.at(-1),
		hasStructuredResponse: structuredResponse !== undefined,
		structuredResponse,
		messages,
	};
}

function inspectMessage(message: unknown, index: number): AgentResultMessageInspection {
	const type = readMessageType(message);

	return {
		index,
		type,
		text: truncateText(readMessageText(message), 2_000),
		toolCalls: readToolCalls(message),
		toolName: type === "tool" ? readObjectString(message, "name") : undefined,
		toolCallId: type === "tool" ? readObjectString(message, "tool_call_id") : undefined,
	};
}

async function main() {
	const config = loadPhase3ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase3DefaultUserPrompt;
	const inspection = await runAgentResultDemo({ config, userPrompt });

	console.log(`Provider: ${inspection.provider}`);
	console.log(`Model: ${inspection.model}`);
	console.log("");

	console.log("Agent invoke input:");
	console.log(JSON.stringify(inspection.input, null, 2));
	console.log("");

	console.log("Agent result keys:");
	for (const key of inspection.resultKeys) {
		console.log(`- ${key}`);
	}
	console.log("");

	console.log("Available tools:");
	for (const toolName of inspection.availableTools) {
		console.log(`- ${toolName}`);
	}
	console.log("");

	console.log("Message sequence:");
	for (const message of inspection.messages) {
		const label = `[${message.index}] ${message.type}${message.toolName ? `:${message.toolName}` : ""}`;
		console.log(`- ${label}`);

		if (message.toolCallId) {
			console.log(`  tool_call_id: ${message.toolCallId}`);
		}

		for (const toolCall of message.toolCalls) {
			console.log(`  requested_tool: ${toolCall.name}`);
			console.log(`  args: ${JSON.stringify(toolCall.args)}`);
		}

		if (message.text) {
			console.log(indentText(message.text, "  text: "));
		}
	}
	console.log("");

	console.log("Boundary summary:");
	console.log(`- message count: ${inspection.messageCount}`);
	console.log(`- tool calls requested by AI messages: ${inspection.toolCallCount}`);
	console.log(`- tool result messages: ${inspection.toolResultCount}`);
	console.log(
		`- structured response: ${inspection.hasStructuredResponse ? "present" : "not configured"}`,
	);

	if (inspection.hasStructuredResponse) {
		console.log("");
		console.log("Structured response:");
		console.log(JSON.stringify(inspection.structuredResponse, null, 2));
	}
	console.log("");

	console.log("Final message:");
	console.log(
		inspection.finalMessage
			? `${inspection.finalMessage.type}: ${inspection.finalMessage.text || "(no text)"}`
			: "(no final message)",
	);
	console.log("");

	console.log("Final text extracted for user:");
	console.log(inspection.finalText || "(empty final text)");
}

function readMessages(result: unknown): unknown[] {
	const messages = readObjectValue(result, "messages");
	return Array.isArray(messages) ? messages : [];
}

function readFinalText(messages: AgentResultMessageInspection[]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const text = messages[index]?.text.trim();
		if (text) {
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

function readToolCalls(message: unknown): AgentResultMessageInspection["toolCalls"] {
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

function readObjectKeys(value: unknown): string[] {
	return value && typeof value === "object" ? Object.keys(value).sort() : [];
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
		.map((line, index) => (index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`))
		.join("\n");
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase3 agent result demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
