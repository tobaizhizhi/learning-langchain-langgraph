import type { BaseMessageLike } from "@langchain/core/messages";
import { z } from "zod";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import type { ModelConfig } from "../../phase1/src/model-config.js";
import {
	loadPhase2ModelConfig,
	runToolAssistant,
	type ToolAssistantResult,
} from "./tool-assistant-demo.js";

const defaultUserPrompt =
	"请查询 langchain-ai/langchainjs 的 GitHub 仓库信息，并查看 @langchain/core 的 npm 包信息。";

export const externalLookupOutputSchema = z.object({
	answer: z.string().min(1).describe("A concise answer based on the external tool results."),
	toolCallsUsed: z
		.array(z.string())
		.describe("Tool names that were actually used, for example get_github_repository."),
	sources: z
		.array(z.string())
		.describe("External source names or URLs used to produce the answer."),
	needsHumanReview: z
		.boolean()
		.describe("True when tool calls failed, sources are missing, or the answer is uncertain."),
});

export type ExternalLookupOutput = z.infer<typeof externalLookupOutputSchema>;

export type StructuredOutputRunnable = {
	invoke(input: BaseMessageLike[]): Promise<unknown>;
};

export type CreateStructuredLookupOutputInput = {
	config: ModelConfig;
	assistantResult: ToolAssistantResult;
};

export async function createStructuredLookupOutput(
	input: CreateStructuredLookupOutputInput,
): Promise<ExternalLookupOutput> {
	if (input.config.provider === "mock") {
		throw new Error("Phase2 requires a real chat model. Set MODEL_ID=openai:<model> in phase2/.env.");
	}

	const model = createChatModel(input.config);
	const structuredModel = model.withStructuredOutput<ExternalLookupOutput>(
		externalLookupOutputSchema,
		{
			name: "ExternalLookupOutput",
			method: "functionCalling",
		},
	);

	return invokeStructuredLookupOutput({
		structuredModel,
		assistantResult: input.assistantResult,
	});
}

export async function invokeStructuredLookupOutput(input: {
	structuredModel: StructuredOutputRunnable;
	assistantResult: ToolAssistantResult;
}): Promise<ExternalLookupOutput> {
	const rawOutput = await input.structuredModel.invoke(
		buildStructuredLookupMessages(input.assistantResult),
	);

	return externalLookupOutputSchema.parse(rawOutput);
}

export function buildStructuredLookupMessages(result: ToolAssistantResult): BaseMessageLike[] {
	return [
		{
			role: "system",
			content:
				"You convert external lookup results into the requested structured object. Use only the provided tool results and final answer.",
		},
		{
			role: "user",
			content: JSON.stringify(
				{
					userPrompt: result.userPrompt,
					finalAnswer: result.finalText,
					toolCalls: result.toolCalls.map((toolCall) => ({
						name: toolCall.name,
						args: toolCall.args,
					})),
					toolRunLogs: result.toolRunLogs,
					toolResults: result.toolResults.map((toolResult) => ({
						toolName: toolResult.toolName,
						toolCallId: toolResult.toolCallId,
						content: truncateText(toolResult.content, 2_000),
					})),
				},
				null,
				2,
			),
		},
	];
}

async function main() {
	const config = loadPhase2ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() || process.env.USER_PROMPT || defaultUserPrompt;
	const assistantResult = await runToolAssistant({ config, userPrompt });
	const structuredOutput = await createStructuredLookupOutput({
		config,
		assistantResult,
	});

	console.log("Tool run logs:");
	for (const log of assistantResult.toolRunLogs) {
		console.log(
			`- ${log.toolName}: ${log.ok ? "ok" : "error"} in ${log.latencyMs}ms args=${JSON.stringify(log.argsPreview)}`,
		);
	}
	console.log("");

	console.log("Structured output:");
	console.log(JSON.stringify(structuredOutput, null, 2));
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength)}...`;
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Structured output demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
