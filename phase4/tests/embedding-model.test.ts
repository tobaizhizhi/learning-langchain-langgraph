import { OllamaEmbeddings } from "@langchain/ollama";
import { OpenAIEmbeddings } from "@langchain/openai";
import { describe, expect, it } from "vitest";

import type { EmbeddingClient } from "../src/embedding-model.js";
import {
	createEmbeddingModel,
	runEmbeddingSmoke,
} from "../src/embedding-model.js";
import { defaultEmbeddingConfig } from "../src/embedding-config.js";

describe("phase4 embedding model", () => {
	it("creates local Ollama embeddings", () => {
		const embeddings = createEmbeddingModel({
			...defaultEmbeddingConfig,
			provider: "ollama",
			model: "bge-m3",
			baseUrl: "http://localhost:11434",
		});

		expect(embeddings).toBeInstanceOf(OllamaEmbeddings);
	});

	it("creates OpenAI-compatible embeddings", () => {
		const embeddings = createEmbeddingModel({
			...defaultEmbeddingConfig,
			provider: "openai",
			model: "text-embedding-3-small",
			apiKey: "test-key",
			baseUrl: "https://api.openai.com/v1",
		});

		expect(embeddings).toBeInstanceOf(OpenAIEmbeddings);
	});

	it("summarizes a smoke run without printing full vectors", async () => {
		const fakeEmbeddings: EmbeddingClient = {
			async embedQuery() {
				return [0.1234567, -0.5, 0.25, 0.75, 1, -1];
			},
			async embedDocuments(documents) {
				return documents.map(() => [0.1, 0.2, 0.3]);
			},
		};

		const result = await runEmbeddingSmoke({
			config: defaultEmbeddingConfig,
			embeddings: fakeEmbeddings,
			query: "test query",
			documents: ["doc one", "doc two"],
		});

		expect(result).toEqual({
			provider: "ollama",
			model: "bge-m3",
			query: "test query",
			queryDimension: 6,
			documentCount: 2,
			documentDimensions: [3, 3],
			queryVectorPreview: [0.123457, -0.5, 0.25, 0.75, 1],
		});
	});
});
