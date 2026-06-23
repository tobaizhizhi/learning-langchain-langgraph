import { describe, expect, it } from "vitest";
import {
	defaultModelConfig,
	loadModelConfigFromEnv,
	parseModelId,
	validateModelConfig,
} from "../src/model-config.js";

describe("model config", () => {
	it("defines a stable default config for offline learning", () => {
		expect(defaultModelConfig).toEqual({
			provider: "mock",
			model: "mock-chat",
			temperature: 0,
			timeoutMs: 30_000,
			maxRetries: 2,
		});
	});

	it("parses provider:model ids", () => {
		expect(parseModelId("openai:gpt-4o-mini")).toEqual({
			provider: "openai",
			model: "gpt-4o-mini",
		});
	});

	it("throws immediately when provider is misspelled", () => {
		expect(() => parseModelId("opneai:gpt-4o-mini")).toThrow(
			/Unsupported provider "opneai"/,
		);
	});

	it("throws immediately when model is missing", () => {
		expect(() => parseModelId("openai:")).toThrow(/model is required/);
	});

	it("loads config from MODEL_ID and numeric env values", () => {
		expect(
			loadModelConfigFromEnv({
				MODEL_ID: "anthropic:claude-sonnet-4-5",
				MODEL_TEMPERATURE: "0.2",
				MODEL_MAX_TOKENS: "1200",
				MODEL_BASE_URL: "https://proxy.example.com/v1",
				MODEL_TIMEOUT_MS: "45000",
				MODEL_MAX_RETRIES: "1",
			}),
		).toEqual({
			provider: "anthropic",
			model: "claude-sonnet-4-5",
			temperature: 0.2,
			maxTokens: 1200,
			baseUrl: "https://proxy.example.com/v1",
			timeoutMs: 45_000,
			maxRetries: 1,
		});
	});

	it("uses the default mock config when MODEL_ID is not set", () => {
		expect(loadModelConfigFromEnv({})).toEqual({
			provider: "mock",
			model: "mock-chat",
			temperature: 0,
			timeoutMs: 30_000,
			maxRetries: 2,
		});
	});

	it("validates config without calling any model provider", () => {
		expect(
			validateModelConfig({
				provider: "google",
				model: "gemini-2.5-flash",
				temperature: 0,
				timeoutMs: 30_000,
				maxRetries: 0,
			}),
		).toEqual({
			provider: "google",
			model: "gemini-2.5-flash",
			temperature: 0,
			timeoutMs: 30_000,
			maxRetries: 0,
			maxTokens: undefined,
		});
	});
});
