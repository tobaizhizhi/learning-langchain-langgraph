import type { BaseMessageLike, ToolCall } from "@langchain/core/messages";
import { config as loadDotEnv } from "dotenv";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import { loadModelConfigFromEnv, type ModelConfig } from "../../phase1/src/model-config.js";
import { createExternalTools } from "./tools.js";
import {
	createToolRegistry,
	executeToolCalls,
	ToolExecutionError,
	type ToolRunLog,
} from "./tool-runner.js";

const defaultUserPrompt =
	"请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。";

const systemPrompt =
	"You are an engineering assistant. When the user asks about GitHub repositories or npm packages, request the appropriate external API tool call. After tool results are provided, answer from those tool results and mention the source names.";

export type ToolAssistantResult = {
	provider: string;
	model: string;
	userPrompt: string;
	initialText: string;
	toolCalls: ToolCall[];
	toolResults: Array<{
		toolName: string;
		toolCallId: string;
		content: string;
	}>;
	toolRunLogs: ToolRunLog[];
	finalText: string;
	finalToolCalls: ToolCall[];
};

export type RunToolAssistantInput = {
	config: ModelConfig;
	userPrompt: string;
};

export async function runToolAssistant(input: RunToolAssistantInput): Promise<ToolAssistantResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase2 requires a real chat model. Set MODEL_ID=openai:<model> in phase2/.env.");
	}

	const model = createChatModel(input.config);
	if (!model.bindTools) {
		throw new Error(`Model provider "${input.config.provider}" does not support bindTools.`);
	}

	const tools = createExternalTools();
	const toolList = [tools.getGitHubRepository, tools.searchGitHubRepositories, tools.getNpmPackage];
	const registry = createToolRegistry(toolList);
	const modelWithTools = model.bindTools(toolList);
	const messages: BaseMessageLike[] = [
		{ role: "system", content: systemPrompt },
		{ role: "user", content: input.userPrompt },
	];

	const toolRequestMessage = await modelWithTools.invoke(messages);
	const toolCalls = toolRequestMessage.tool_calls ?? [];

	if (toolCalls.length === 0) {
		return {
			provider: input.config.provider,
			model: input.config.model,
			userPrompt: input.userPrompt,
			initialText: toolRequestMessage.text,
			toolCalls,
			toolResults: [],
			toolRunLogs: [],
			finalText: toolRequestMessage.text,
			finalToolCalls: [],
		};
	}

	const toolExecutions = await executeToolCalls(toolCalls, registry);
	const finalResponse = await modelWithTools.invoke([
		...messages,
		toolRequestMessage,
		...toolExecutions.map((execution) => execution.toolMessage),
	]);

	return {
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
		initialText: toolRequestMessage.text,
		toolCalls,
		toolResults: toolExecutions.map((execution) => ({
			toolName: execution.toolCall.name,
			toolCallId: execution.toolMessage.tool_call_id,
			content: execution.toolMessage.text,
		})),
		toolRunLogs: toolExecutions.map((execution) => execution.log),
		finalText: finalResponse.text,
		finalToolCalls: finalResponse.tool_calls ?? [],
	};
}

export function loadPhase2ModelConfig(): ModelConfig {
	loadDotEnv({ path: "phase2/.env", override: true, quiet: true });
	return loadModelConfigFromEnv();
}

async function main() {
	const config = loadPhase2ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() || process.env.USER_PROMPT || defaultUserPrompt;
	const result = await runToolAssistant({ config, userPrompt });

	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	if (result.toolCalls.length === 0) {
		console.log("No tool call.");
		console.log(result.finalText);
		return;
	}

	console.log("Tool calls:");
	for (const toolCall of result.toolCalls) {
		console.log(`- name: ${toolCall.name}`);
		console.log(`  id: ${toolCall.id ?? "n/a"}`);
		console.log(`  args: ${JSON.stringify(toolCall.args)}`);
	}
	console.log("");

	console.log("Tool results:");
	for (const toolResult of result.toolResults) {
		console.log(`- ${toolResult.toolName} (${toolResult.toolCallId})`);
		console.log(indentText(truncateText(toolResult.content, 1_200)));
	}
	console.log("");

	console.log("Tool run logs:");
	for (const log of result.toolRunLogs) {
		console.log(
			`- ${log.toolName}: ${log.ok ? "ok" : "error"} in ${log.latencyMs}ms args=${JSON.stringify(log.argsPreview)}`,
		);
		if (log.errorMessage) {
			console.log(`  error: ${log.errorMessage}`);
		}
	}
	console.log("");

	console.log("Final answer:");
	console.log(result.finalText);

	if (result.finalToolCalls.length > 0) {
		console.log("");
		console.log(
			`Note: final response requested ${result.finalToolCalls.length} more tool call(s). Step 6 intentionally executes only one tool round.`,
		);
	}
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength)}...`;
}

function indentText(text: string): string {
	return text
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Tool assistant demo failed: ${message}`);
	if (error instanceof ToolExecutionError) {
		console.error("Tool run log:");
		console.error(JSON.stringify(error.log, null, 2));
	}
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
