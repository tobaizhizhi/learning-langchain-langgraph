import { describe, expect, it } from "vitest";

import { runStreamPrompt } from "../src/stream-demo.js";

describe("runStreamPrompt", () => {
	it("streams text chunks, returns the full text, and records timing", async () => {
		let streamedText = "";

		const result = await runStreamPrompt({
			config: {
				provider: "mock",
				model: "mock-chat",
				temperature: 0,
				timeoutMs: 30_000,
				maxRetries: 0,
			},
			systemPrompt: "You are concise.",
			userPrompt: "Explain LangChain stream.",
			onTextChunk: (text) => {
				streamedText += text;
			},
		});

		expect(result.provider).toBe("mock");
		expect(result.model).toBe("mock-chat");
		expect(result.text).toBe(streamedText);
		expect(result.text).toContain("Explain LangChain stream.");
		expect(result.firstChunkLatencyMs).toBeGreaterThanOrEqual(0);
		expect(result.totalLatencyMs).toBeGreaterThanOrEqual(result.firstChunkLatencyMs ?? 0);
	});

	it("fails clearly before streaming when the provider is not implemented", async () => {
		let streamedText = "";

		await expect(
			runStreamPrompt({
				config: {
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					temperature: 0,
					timeoutMs: 30_000,
					maxRetries: 0,
				},
				systemPrompt: "You are concise.",
				userPrompt: "Explain LangChain stream.",
				onTextChunk: (text) => {
					streamedText += text;
				},
			}),
		).rejects.toThrow(/not implemented yet/);

		expect(streamedText).toBe("");
	});
});
