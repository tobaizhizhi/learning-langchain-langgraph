import { BaseMessage } from "@langchain/core/messages";
import { createMiddleware } from "langchain";

import type { AgentRunReport } from "./run-report.js";
import { recordAgentRunEvent } from "./run-report.js";

export type CreateObservationMiddlewareInput = {
	report: AgentRunReport;
	now?: () => Date;
};

export function createObservationMiddleware(input: CreateObservationMiddlewareInput) {
	const now = input.now ?? (() => new Date());

	return createMiddleware({
		name: "Phase3ObservationMiddleware",
		beforeAgent: () => {
			recordAgentRunEvent(input.report, {
				kind: "agent",
				name: "agent.start",
				ok: true,
				startedAtIso: now().toISOString(),
			});
		},
		wrapModelCall: async (request, handler) => {
			const startedAt = now();

			try {
				const response = await handler(request);
				const responseText = readMessageText(response);
				recordAgentRunEvent(input.report, {
					kind: "model",
					name: readModelName(request.model),
					ok: true,
					startedAtIso: startedAt.toISOString(),
					latencyMs: elapsedMs(startedAt, now()),
					input: {
						messageCount: request.messages.length,
						toolCount: request.tools.length,
						toolNames: request.tools.map((tool) => tool.name),
						hasResponseFormat: request.responseFormat !== undefined,
					},
					output: {
						textLength: responseText.length,
						requestedToolCalls: readToolCalls(response).map((toolCall) => toolCall.name),
					},
				});

				return response;
			} catch (error: unknown) {
				recordAgentRunEvent(input.report, {
					kind: "model",
					name: readModelName(request.model),
					ok: false,
					startedAtIso: startedAt.toISOString(),
					latencyMs: elapsedMs(startedAt, now()),
					input: {
						messageCount: request.messages.length,
						toolCount: request.tools.length,
					},
					errorMessage: readErrorMessage(error),
				});

				throw error;
			}
		},
		wrapToolCall: async (request, handler) => {
			const startedAt = now();
			const toolName = readToolCallName(request.tool, request.toolCall);

			try {
				const result = await handler(request);
				recordAgentRunEvent(input.report, {
					kind: "tool",
					name: toolName,
					ok: true,
					startedAtIso: startedAt.toISOString(),
					latencyMs: elapsedMs(startedAt, now()),
					input: {
						toolCallId: request.toolCall.id,
						argsPreview: previewArgs(request.toolCall.args),
					},
					output: {
						textPreview: previewText(readMessageText(result), 400),
					},
				});

				return result;
			} catch (error: unknown) {
				recordAgentRunEvent(input.report, {
					kind: "tool",
					name: toolName,
					ok: false,
					startedAtIso: startedAt.toISOString(),
					latencyMs: elapsedMs(startedAt, now()),
					input: {
						toolCallId: request.toolCall.id,
						argsPreview: previewArgs(request.toolCall.args),
					},
					errorMessage: readErrorMessage(error),
				});

				throw error;
			}
		},
		afterAgent: (state) => {
			recordAgentRunEvent(input.report, {
				kind: "agent",
				name: "agent.end",
				ok: true,
				startedAtIso: now().toISOString(),
				output: {
					messageCount: readMessageCount(state),
				},
			});
		},
	});
}

function elapsedMs(startedAt: Date, endedAt: Date): number {
	return Math.max(0, endedAt.getTime() - startedAt.getTime());
}

function readModelName(model: unknown): string {
	return (
		readObjectString(model, "model") ??
		readObjectString(model, "modelName") ??
		readConstructorName(model) ??
		"model"
	);
}

function readToolCallName(tool: unknown, toolCall: unknown): string {
	return readObjectString(tool, "name") ?? readObjectString(toolCall, "name") ?? "unknown_tool";
}

function readToolCalls(message: unknown): Array<{ name: string }> {
	const toolCalls = readObjectValue(message, "tool_calls");
	if (!Array.isArray(toolCalls)) {
		return [];
	}

	return toolCalls.map((toolCall) => ({
		name: readObjectString(toolCall, "name") ?? "unknown_tool",
	}));
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

function readMessageCount(state: unknown): number {
	const messages = readObjectValue(state, "messages");
	return Array.isArray(messages) ? messages.length : 0;
}

function previewArgs(args: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(args).map(([key, value]) => [key, previewValue(value)]),
	);
}

function previewValue(value: unknown): unknown {
	if (typeof value === "string") {
		return previewText(value, 160);
	}

	if (typeof value === "number" || typeof value === "boolean" || value === null) {
		return value;
	}

	if (Array.isArray(value)) {
		return `[array:${value.length}]`;
	}

	if (typeof value === "object") {
		return "[object]";
	}

	return String(value);
}

function previewText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength)}...`;
}

function readErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function readObjectValue(value: unknown, key: string): unknown {
	return value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

function readObjectString(value: unknown, key: string): string | undefined {
	const item = readObjectValue(value, key);
	return typeof item === "string" && item.length > 0 ? item : undefined;
}

function readConstructorName(value: unknown): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	return value.constructor?.name;
}
