import { AIMessage, type BaseMessage } from "@langchain/core/messages";

import { createChatModel } from "./chat-model-factory.js";
import {
	appendModelRunLog,
	createRunId,
	createTextPreview,
	getErrorMessage,
	getErrorType,
} from "./model-run-log.js";
import type { ModelConfig, ProviderName } from "./model-config.js";

export type RunSinglePromptInput = {
	config: ModelConfig;
	systemPrompt: string;
	userPrompt: string;
	logPath?: string;
};

export type RunSinglePromptResult = {
	runId: string;
	provider: ProviderName;
	model: string;
	startedAt: string;
	latencyMs: number;
	text: string;
	inputTokens?: number;
	outputTokens?: number;
	finishReason?: string;
	raw: BaseMessage;
};

export type ModelResponseMetadata = Pick<
	RunSinglePromptResult,
	"inputTokens" | "outputTokens" | "finishReason"
>;

export async function runSinglePrompt(
	input: RunSinglePromptInput,
): Promise<RunSinglePromptResult> {
	const runId = createRunId();
	const startedAt = new Date();
	const startedAtMs = Date.now();
	const inputPreview = createTextPreview(input.userPrompt);

	try {
		const model = createChatModel(input.config);
		const response = await model.invoke([
			{ role: "system", content: input.systemPrompt },
			{ role: "user", content: input.userPrompt },
		]);

		const latencyMs = Date.now() - startedAtMs;
		const metadata = extractModelResponseMetadata(response);

		if (input.logPath) {
			await appendModelRunLog(
				{
					runId,
					provider: input.config.provider,
					model: input.config.model,
					startedAt: startedAt.toISOString(),
					latencyMs,
					ok: true,
					inputPreview,
					outputPreview: createTextPreview(response.text),
					...metadata,
				},
				input.logPath,
			);
		}

		return {
			runId,
			provider: input.config.provider,
			model: input.config.model,
			startedAt: startedAt.toISOString(),
			latencyMs,
			text: response.text,
			...metadata,
			raw: response,
		};
	} catch (error: unknown) {
		const latencyMs = Date.now() - startedAtMs;

		if (input.logPath) {
			try {
				await appendModelRunLog(
					{
						runId,
						provider: input.config.provider,
						model: input.config.model,
						startedAt: startedAt.toISOString(),
						latencyMs,
						ok: false,
						errorType: getErrorType(error),
						errorMessage: getErrorMessage(error),
						inputPreview,
					},
					input.logPath,
				);
			} catch {
				// Keep the original model error as the error the caller sees.
			}
		}

		throw error;
	}
}

export function extractModelResponseMetadata(response: BaseMessage): ModelResponseMetadata {
	const usage = AIMessage.isInstance(response) ? response.usage_metadata : undefined;
	const responseMetadata = response.response_metadata as Record<string, unknown> | undefined;
	const finishReason = responseMetadata?.finish_reason;

	return {
		inputTokens: usage?.input_tokens,
		outputTokens: usage?.output_tokens,
		finishReason: typeof finishReason === "string" ? finishReason : undefined,
	};
}
