import { config as loadDotEnv } from "dotenv";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import { loadModelConfigFromEnv, type ModelConfig } from "../../phase1/src/model-config.js";
import { createExternalTools } from "./tools.js";

const defaultUserPrompt =
	"请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。";

export type ToolCallSummary = {
	id?: string;
	name: string;
	args: Record<string, unknown>;
};

export type ToolCallRequestResult = {
	provider: string;
	model: string;
	userPrompt: string;
	text: string;
	toolCalls: ToolCallSummary[];
};

export type RequestToolCallInput = {
	config: ModelConfig;
	userPrompt: string;
};

export async function requestToolCall(input: RequestToolCallInput): Promise<ToolCallRequestResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase2 requires a real chat model. Set MODEL_ID=openai:<model> in phase2/.env.");
	}

	const model = createChatModel(input.config);
	if (!model.bindTools) {
		throw new Error(`Model provider "${input.config.provider}" does not support bindTools.`);
	}

	const tools = createExternalTools();
	const modelWithTools = model.bindTools([
		tools.getGitHubRepository,
		tools.searchGitHubRepositories,
		tools.getNpmPackage,
	]);
	const response = await modelWithTools.invoke([
		{
			role: "system",
			content:
				"You are an engineering assistant. When the user asks about GitHub repositories or npm packages, request the appropriate external API tool call. Do not answer from memory when an external tool can fetch current data.",
		},
		{ role: "user", content: input.userPrompt },
	]);

	return {
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
		text: response.text,
		toolCalls: (response.tool_calls ?? []).map((toolCall) => ({
			id: toolCall.id,
			name: toolCall.name,
			args: toolCall.args,
		})),
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
	const result = await requestToolCall({ config, userPrompt });

	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	if (result.toolCalls.length === 0) {
		console.log("No tool call.");
		console.log(result.text);
		return;
	}

	console.log("Tool calls:");
	for (const toolCall of result.toolCalls) {
		console.log(`- name: ${toolCall.name}`);
		console.log(`  id: ${toolCall.id ?? "n/a"}`);
		console.log(`  args: ${JSON.stringify(toolCall.args)}`);
	}
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Tool call request demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
