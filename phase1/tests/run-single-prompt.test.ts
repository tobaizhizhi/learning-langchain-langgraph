import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";

import {
	extractModelResponseMetadata,
	runSinglePrompt,
} from "../src/run-single-prompt.js";

describe("runSinglePrompt", () => {
	it("invokes a chat model and returns normalized metadata", async () => {
		const result = await runSinglePrompt({
			config: {
				provider: "mock",
				model: "mock-chat",
				temperature: 0,
				timeoutMs: 30_000,
				maxRetries: 0,
			},
			systemPrompt: "You are concise.",
			userPrompt: "Explain reentrancy.",
		});

		expect(result.provider).toBe("mock");
		expect(result.model).toBe("mock-chat");
		expect(result.latencyMs).toBeGreaterThanOrEqual(0);
		expect(result.text).toContain("Explain reentrancy.");
		expect(result.inputTokens).toBeUndefined();
		expect(result.outputTokens).toBeUndefined();
		expect(result.finishReason).toBeUndefined();
		expect(result.raw).toBeInstanceOf(AIMessage);
	});

	it("extracts token usage and finish reason from an AIMessage", () => {
		const response = new AIMessage({
			content: "Done.",
			usage_metadata: {
				input_tokens: 12,
				output_tokens: 5,
				total_tokens: 17,
			},
			response_metadata: {
				finish_reason: "stop",
			},
		});

		expect(extractModelResponseMetadata(response)).toEqual({
			inputTokens: 12,
			outputTokens: 5,
			finishReason: "stop",
		});
	});
});
