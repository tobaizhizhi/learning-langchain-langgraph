import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";

import { runSinglePrompt } from "../src/run-single-prompt.js";

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
		expect(result.raw).toBeInstanceOf(AIMessage);
	});
});
