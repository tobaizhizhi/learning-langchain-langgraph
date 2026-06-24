import { ToolMessage, type ToolCall } from "@langchain/core/messages";

import { createExternalTools, type ExternalToolsOptions } from "./tools.js";

export type RunnableTool = {
	name: string;
	invoke(input: unknown): Promise<unknown>;
};

export type ToolExecutionResult = {
	toolCall: ToolCall;
	output: unknown;
	toolMessage: ToolMessage;
	log: ToolRunLog;
};

export type ToolRunLog = {
	toolName: string;
	toolCallId?: string;
	argsPreview: Record<string, unknown>;
	ok: boolean;
	latencyMs: number;
	errorMessage?: string;
};

export class ToolExecutionError extends Error {
	constructor(
		message: string,
		readonly log: ToolRunLog,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "ToolExecutionError";
	}
}

export function createExternalToolRegistry(options: ExternalToolsOptions = {}): Map<string, RunnableTool> {
	const tools = createExternalTools(options);

	return createToolRegistry([
		tools.getGitHubRepository,
		tools.searchGitHubRepositories,
		tools.getNpmPackage,
	]);
}

export function createToolRegistry(tools: Iterable<RunnableTool>): Map<string, RunnableTool> {
	const registry = new Map<string, RunnableTool>();

	for (const tool of tools) {
		if (registry.has(tool.name)) {
			throw new Error(`Duplicate tool name "${tool.name}".`);
		}

		registry.set(tool.name, tool);
	}

	return registry;
}

export async function executeToolCalls(
	toolCalls: ToolCall[],
	registry: Map<string, RunnableTool>,
): Promise<ToolExecutionResult[]> {
	const results: ToolExecutionResult[] = [];

	for (const toolCall of toolCalls) {
		results.push(await executeToolCall(toolCall, registry));
	}

	return results;
}

export async function executeToolCall(
	toolCall: ToolCall,
	registry: Map<string, RunnableTool>,
): Promise<ToolExecutionResult> {
	const startedAt = Date.now();
	const argsPreview = createArgsPreview(toolCall.args);

	try {
		const toolCallId = parseToolCallId(toolCall);
		const tool = registry.get(toolCall.name);

		if (!tool) {
			throw new Error(`Unknown tool "${toolCall.name}".`);
		}

		const output = await tool.invoke(toolCall.args);
		const toolMessage = new ToolMessage({
			content: stringifyToolOutput(output),
			name: toolCall.name,
			tool_call_id: toolCallId,
			status: "success",
			artifact: output,
		});

		return {
			toolCall,
			output,
			toolMessage,
			log: {
				toolName: toolCall.name,
				toolCallId,
				argsPreview,
				ok: true,
				latencyMs: Date.now() - startedAt,
			},
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		throw new ToolExecutionError(
			message,
			{
				toolName: toolCall.name,
				toolCallId: toolCall.id,
				argsPreview,
				ok: false,
				latencyMs: Date.now() - startedAt,
				errorMessage: message,
			},
			error,
		);
	}
}

function parseToolCallId(toolCall: ToolCall): string {
	if (!toolCall.id?.trim()) {
		throw new Error(`Tool call "${toolCall.name}" is missing id.`);
	}

	return toolCall.id;
}

function stringifyToolOutput(output: unknown): string {
	if (typeof output === "string") {
		return output;
	}

	try {
		return JSON.stringify(output, null, 2) ?? String(output);
	} catch {
		return String(output);
	}
}

function createArgsPreview(args: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(args).map(([key, value]) => [key, previewValue(value)]),
	);
}

function previewValue(value: unknown): unknown {
	if (typeof value === "string") {
		return value.length > 120 ? `${value.slice(0, 120)}...` : value;
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
