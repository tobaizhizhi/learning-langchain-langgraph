import { describe, expect, it } from "vitest";

import {
	buildStructuredLookupMessages,
	externalLookupOutputSchema,
	invokeStructuredLookupOutput,
	type ExternalLookupOutput,
	type StructuredOutputRunnable,
} from "../src/structured-output.js";
import type { ToolAssistantResult } from "../src/tool-assistant-demo.js";

describe("structured-output", () => {
	it("defines the stable output shape", () => {
		const output = externalLookupOutputSchema.parse({
			answer: "LangChain.js is a TypeScript project.",
			toolCallsUsed: ["get_github_repository"],
			sources: ["https://github.com/langchain-ai/langchainjs"],
			needsHumanReview: false,
		});

		expect(output.toolCallsUsed).toEqual(["get_github_repository"]);
	});

	it("builds messages from the assistant result instead of asking the model to remember", () => {
		const messages = buildStructuredLookupMessages(createAssistantResult());

		expect(messages).toHaveLength(2);
		expect(JSON.stringify(messages)).toContain("get_github_repository");
		expect(JSON.stringify(messages)).toContain("GitHub result");
	});

	it("parses structured output returned by a runnable", async () => {
		const structuredModel: StructuredOutputRunnable = {
			async invoke(): Promise<ExternalLookupOutput> {
				return {
					answer: "LangChain.js has repository metadata from GitHub.",
					toolCallsUsed: ["get_github_repository"],
					sources: ["GitHub REST API"],
					needsHumanReview: false,
				};
			},
		};

		const output = await invokeStructuredLookupOutput({
			structuredModel,
			assistantResult: createAssistantResult(),
		});

		expect(output.needsHumanReview).toBe(false);
		expect(output.sources).toContain("GitHub REST API");
	});

	it("rejects invalid structured output", async () => {
		const structuredModel: StructuredOutputRunnable = {
			async invoke(): Promise<unknown> {
				return {
					answer: "",
					toolCallsUsed: ["get_github_repository"],
					sources: [],
				};
			},
		};

		await expect(
			invokeStructuredLookupOutput({
				structuredModel,
				assistantResult: createAssistantResult(),
			}),
		).rejects.toThrow();
	});
});

function createAssistantResult(): ToolAssistantResult {
	return {
		provider: "openai",
		model: "gpt-example",
		userPrompt: "查询 langchain-ai/langchainjs",
		initialText: "",
		toolCalls: [
			{
				type: "tool_call",
				id: "call_1",
				name: "get_github_repository",
				args: { owner: "langchain-ai", repo: "langchainjs" },
			},
		],
		toolResults: [
			{
				toolName: "get_github_repository",
				toolCallId: "call_1",
				content: "GitHub result",
			},
		],
		toolRunLogs: [
			{
				toolName: "get_github_repository",
				toolCallId: "call_1",
				argsPreview: { owner: "langchain-ai", repo: "langchainjs" },
				ok: true,
				latencyMs: 10,
			},
		],
		finalText: "LangChain.js has repository metadata from GitHub.",
		finalToolCalls: [],
	};
}
