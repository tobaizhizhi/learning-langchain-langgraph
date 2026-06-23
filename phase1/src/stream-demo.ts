import { config as loadDotEnv } from "dotenv";

import { createChatModel } from "./chat-model-factory.js";
import { loadModelConfigFromEnv } from "./model-config.js";
import type { ModelConfig, ProviderName } from "./model-config.js";
import { loadSystemPromptFromEnv } from "./system-prompts.js";

const defaultUserPrompt = "请用五句话解释 LangChain.js 的 stream。";

export type StreamPromptInput = {
	config: ModelConfig;
	systemPrompt: string;
	userPrompt: string;
	onTextChunk?: (text: string) => void;
};

export type StreamPromptResult = {
	provider: ProviderName;
	model: string;
	text: string;
	firstChunkLatencyMs?: number;
	totalLatencyMs: number;
};

export async function runStreamPrompt(input: StreamPromptInput): Promise<StreamPromptResult> {
	const model = createChatModel(input.config);
	const startedAtMs = Date.now();
	const stream = await model.stream([
		{ role: "system", content: input.systemPrompt },
		{ role: "user", content: input.userPrompt },
	]);

	let text = "";
	let firstChunkLatencyMs: number | undefined;

	for await (const chunk of stream) {
		const chunkText = chunk.text;
		if (!chunkText) {
			continue;
		}

		if (firstChunkLatencyMs === undefined) {
			firstChunkLatencyMs = Date.now() - startedAtMs;
		}

		text += chunkText;
		input.onTextChunk?.(chunkText);
	}

	return {
		provider: input.config.provider,
		model: input.config.model,
		text,
		firstChunkLatencyMs,
		totalLatencyMs: Date.now() - startedAtMs,
	};
}

async function main() {
	loadDotEnv({ quiet: true });
	loadDotEnv({ path: "phase1/.env", override: false, quiet: true });

	const config = loadModelConfigFromEnv();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() || process.env.USER_PROMPT || defaultUserPrompt;
	const systemPrompt = loadSystemPromptFromEnv();

	console.error(`Provider: ${config.provider}`);
	console.error(`Model: ${config.model}`);
	console.error("");
	console.error("Answer:");

	let wroteOutput = false;
	let result: StreamPromptResult;

	try {
		result = await runStreamPrompt({
			config,
			systemPrompt,
			userPrompt,
			onTextChunk: (text) => {
				wroteOutput = true;
				process.stdout.write(text);
			},
		});
	} catch (error: unknown) {
		if (wroteOutput) {
			process.stdout.write("\n");
		}

		throw error;
	}

	if (result.text.length > 0) {
		process.stdout.write("\n");
	}

	console.error("");
	console.error(`First chunk latency: ${formatOptionalLatency(result.firstChunkLatencyMs)}`);
	console.error(`Total latency: ${result.totalLatencyMs}ms`);
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Stream demo failed: ${message}`);
	process.exitCode = 1;
}

function formatOptionalLatency(value: number | undefined): string {
	return value === undefined ? "n/a" : `${value}ms`;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
