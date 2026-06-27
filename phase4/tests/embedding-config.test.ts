import { describe, expect, it } from "vitest";

import {
	defaultEmbeddingConfig,
	loadEmbeddingConfigFromEnv,
	parseEmbeddingProviderName,
	validateEmbeddingConfig,
} from "../src/embedding-config.js";

describe("phase4 embedding config", () => {
	it("defaults to local Ollama embeddings", () => {
		expect(loadEmbeddingConfigFromEnv({})).toEqual(defaultEmbeddingConfig);
	});

	it("loads Ollama config from env", () => {
		expect(
			loadEmbeddingConfigFromEnv({
				EMBEDDING_PROVIDER: "ollama",
				EMBEDDING_MODEL: "mxbai-embed-large",
				EMBEDDING_BASE_URL: "http://localhost:11434",
				EMBEDDING_MAX_RETRIES: "3",
				EMBEDDING_BATCH_SIZE: "8",
			}),
		).toMatchObject({
			provider: "ollama",
			model: "mxbai-embed-large",
			baseUrl: "http://localhost:11434",
			maxRetries: 3,
			batchSize: 8,
		});
	});

	it("requires an API key for OpenAI-compatible embeddings", () => {
		expect(() =>
			loadEmbeddingConfigFromEnv({
				EMBEDDING_PROVIDER: "openai",
				EMBEDDING_MODEL: "text-embedding-3-small",
			}),
		).toThrow(/EMBEDDING_API_KEY/);

		expect(
			loadEmbeddingConfigFromEnv({
				EMBEDDING_PROVIDER: "openai",
				EMBEDDING_API_KEY: "test-key",
			}),
		).toMatchObject({
			provider: "openai",
			model: "text-embedding-3-small",
			apiKey: "test-key",
		});
		expect(
			loadEmbeddingConfigFromEnv({
				EMBEDDING_PROVIDER: "openai",
				EMBEDDING_API_KEY: "test-key",
			}).baseUrl,
		).toBeUndefined();
	});

	it("rejects invalid provider and numeric options", () => {
		expect(() => parseEmbeddingProviderName("local")).toThrow(/Unsupported embedding provider/);
		expect(() =>
			validateEmbeddingConfig({
				...defaultEmbeddingConfig,
				batchSize: 0,
			}),
		).toThrow(/batchSize/);
		expect(() =>
			loadEmbeddingConfigFromEnv({
				EMBEDDING_PROVIDER: "ollama",
				EMBEDDING_MODEL: "bge-m3",
				EMBEDDING_DIMENSIONS: "1.5",
			}),
		).toThrow(/EMBEDDING_DIMENSIONS/);
	});
});
