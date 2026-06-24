import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
	BaseChatModel,
	SimpleChatModel,
} from "@langchain/core/language_models/chat_models";
import { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import { RunnableLambda } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";

import type { ModelConfig } from "./model-config.js";

type BindableTool = {
	name: string;
};

export function createChatModel(config: ModelConfig): BaseChatModel {
	if (config.provider === "mock") {
		return new MockChatModel(config);
	}

	if (config.provider === "openai") {
		return new ChatOpenAI({
			model: config.model,
			temperature: config.temperature,
			maxTokens: config.maxTokens,
			timeout: config.timeoutMs,
			maxRetries: config.maxRetries,
			configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
		});
	}

	throw new Error(
		`Provider "${config.provider}" is not implemented yet. Step 4 currently supports: mock, openai.`,
	);
}

export class MockChatModel extends SimpleChatModel {
	constructor(private readonly config: ModelConfig) {
		super({});
	}

	_llmType(): string {
		return "phase1_mock_chat_model";
	}

	async _call(
		messages: BaseMessage[],
		_options: this["ParsedCallOptions"],
		_runManager?: CallbackManagerForLLMRun,
	): Promise<string> {
		const lastMessage = messages.at(-1);
		const prompt = lastMessage?.text.trim();
		const echo = prompt ? ` You asked: ${prompt}` : "";

		return `[mock:${this.config.model}] This is a deterministic mock response.${echo}`;
	}

	bindTools(tools: BindableTool[]) {
		return RunnableLambda.from(async (input: unknown) => {
			const prompt = readLanguageModelInputText(input);
			const toolCall = createMockToolCall(prompt, tools.map((tool) => tool.name));

			if (!toolCall) {
				return new AIMessageChunk({
					content: `[mock:${this.config.model}] No tool call requested.`,
				});
			}

			return new AIMessageChunk({
				content: "",
				tool_calls: [toolCall],
			});
		});
	}
}

function createMockToolCall(prompt: string, toolNames: string[]): ToolCall | undefined {
	const normalizedPrompt = prompt.toLowerCase();

	if (
		toolNames.includes("update_task_status") &&
		/(标记|改成|更新|update)/i.test(prompt) &&
		/task-\d+/.test(normalizedPrompt)
	) {
		const taskId = normalizedPrompt.match(/task-\d+/)?.[0] ?? "task-1";
		const status = normalizedPrompt.includes("in_progress")
			? "in_progress"
			: normalizedPrompt.includes("todo")
				? "todo"
				: "done";

		return {
			type: "tool_call",
			id: "mock_tool_call_update_task_status_1",
			name: "update_task_status",
			args: { taskId, status },
		};
	}

	if (toolNames.includes("create_task") && /(创建|新增|create)/i.test(prompt)) {
		return {
			type: "tool_call",
			id: "mock_tool_call_create_task_1",
			name: "create_task",
			args: {
				title: prompt.trim(),
				status: "todo",
			},
		};
	}

	if (toolNames.includes("get_task") && /(查看|读取|获取|get)/i.test(prompt)) {
		const taskId = normalizedPrompt.match(/task-\d+/)?.[0] ?? "task-1";
		return {
			type: "tool_call",
			id: "mock_tool_call_get_task_1",
			name: "get_task",
			args: { taskId },
		};
	}

	if (toolNames.includes("search_docs") && /(查|搜索|找|资料|search)/i.test(prompt)) {
		return {
			type: "tool_call",
			id: "mock_tool_call_search_docs_1",
			name: "search_docs",
			args: {
				query: extractMockSearchQuery(prompt),
				limit: 3,
			},
		};
	}

	return undefined;
}

function extractMockSearchQuery(prompt: string): string {
	const normalizedPrompt = prompt.toLowerCase();
	if (normalizedPrompt.includes("tool calling")) {
		return "tool calling";
	}

	if (normalizedPrompt.includes("reentrancy")) {
		return "reentrancy";
	}

	return prompt.trim();
}

function readLanguageModelInputText(input: unknown): string {
	if (typeof input === "string") {
		return input;
	}

	if (Array.isArray(input)) {
		const messages = input.map(readMessageLikeText).filter(Boolean);
		return messages.at(-1) ?? "";
	}

	if (
		input &&
		typeof input === "object" &&
		"toChatMessages" in input &&
		typeof input.toChatMessages === "function"
	) {
		const messages = input.toChatMessages().map(readMessageLikeText).filter(Boolean);
		return messages.at(-1) ?? "";
	}

	return "";
}

function readMessageLikeText(message: unknown): string {
	if (BaseMessage.isInstance(message)) {
		return message.text;
	}

	if (Array.isArray(message)) {
		return String(message[1] ?? "");
	}

	if (message && typeof message === "object" && "content" in message) {
		const content = message.content;
		return typeof content === "string" ? content : JSON.stringify(content);
	}

	return "";
}
