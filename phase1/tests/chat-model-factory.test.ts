import { AIMessage } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";

import { createChatModel, MockChatModel } from "../src/chat-model-factory.js";
import type { ModelConfig } from "../src/model-config.js";

const mockConfig: ModelConfig = {
	provider: "mock",
	model: "mock-chat",
	temperature: 0,
	timeoutMs: 30_000,
	maxRetries: 0,
};

describe("createChatModel", () => {
	it("creates a mock LangChain chat model that supports invoke", async () => {
		const model = createChatModel(mockConfig);
		const response = await model.invoke("Explain reentrancy in one sentence.");

		expect(model).toBeInstanceOf(MockChatModel);
		expect(response).toBeInstanceOf(AIMessage);
		expect(response.content).toContain("[mock:mock-chat]");
		expect(response.content).toContain("Explain reentrancy");
	});

	it("creates an OpenAI chat model without calling the provider", () => {
		const model = createChatModel({
			provider: "openai",
			model: "gpt-4o-mini",
			temperature: 0,
			baseUrl: "https://proxy.example.com/v1",
			timeoutMs: 30_000,
			maxRetries: 2,
		});

		expect(model.constructor.name).toBe("ChatOpenAI");
	});

	it("fails clearly for providers that are not implemented in Step 4 yet", () => {
		expect(() =>
			createChatModel({
				provider: "anthropic",
				model: "claude-sonnet-4-5",
				temperature: 0,
				timeoutMs: 30_000,
				maxRetries: 2,
			}),
		).toThrow(/not implemented yet/);
	});
});
