import type { BaseMessage } from "@langchain/core/messages";

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
	raw: BaseMessage;
};

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
			raw: response,
		};
	} catch (error: unknown) {
		const latencyMs = Date.now() - startedAtMs;

		if (input.logPath) {
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
		}

		throw error;
	}
}
