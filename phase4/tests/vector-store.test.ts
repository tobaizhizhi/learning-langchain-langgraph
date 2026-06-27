import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";

import {
	createStableQdrantPointId,
	defaultQdrantConfig,
	loadQdrantConfigFromEnv,
	prepareChunksForQdrant,
	validateQdrantConfig,
} from "../src/vector-store.js";
import type { RagSourceMetadata } from "../src/source-config.js";

describe("phase4 vector store", () => {
	it("loads Qdrant config from env", () => {
		expect(loadQdrantConfigFromEnv({})).toEqual(defaultQdrantConfig);
		expect(
			loadQdrantConfigFromEnv({
				QDRANT_URL: "http://localhost:6333",
				QDRANT_COLLECTION: "course_docs",
				QDRANT_API_KEY: "test-key",
				QDRANT_RESET_COLLECTION: "true",
				QDRANT_INDEX_BATCH_SIZE: "8",
			}),
		).toEqual({
			url: "http://localhost:6333",
			collectionName: "course_docs",
			apiKey: "test-key",
			resetCollection: true,
			indexBatchSize: 8,
		});
	});

	it("validates Qdrant config", () => {
		expect(() =>
			validateQdrantConfig({
				...defaultQdrantConfig,
				collectionName: "",
			}),
		).toThrow(/collectionName/);
		expect(() =>
			loadQdrantConfigFromEnv({
				QDRANT_INDEX_BATCH_SIZE: "0",
			}),
		).toThrow(/QDRANT_INDEX_BATCH_SIZE/);
		expect(() =>
			loadQdrantConfigFromEnv({
				QDRANT_RESET_COLLECTION: "sometimes",
			}),
		).toThrow(/QDRANT_RESET_COLLECTION/);
	});

	it("maps chunk ids to stable Qdrant UUID point ids", () => {
		const pointId = createStableQdrantPointId("phase4-readme::chunk-0");

		expect(pointId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(createStableQdrantPointId("phase4-readme::chunk-0")).toBe(pointId);
		expect(createStableQdrantPointId("phase4-readme::chunk-1")).not.toBe(pointId);
	});

	it("prepares chunks with Qdrant-safe ids and traceable metadata", () => {
		const chunks = [
			new Document<RagSourceMetadata>({
				id: "phase4-readme-test::chunk-0",
				pageContent: "Chunk body",
				metadata: {
					...createMetadata(),
					chunkId: "phase4-readme-test::chunk-0",
					chunkIndex: 0,
				},
			}),
		];

		const [prepared] = prepareChunksForQdrant(chunks);

		expect(prepared?.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(prepared?.metadata.chunkId).toBe("phase4-readme-test::chunk-0");
		expect(prepared?.metadata.qdrantPointId).toBe(prepared?.id);
		expect(prepared?.metadata.sourcePath).toBe("phase4/README.md");
	});
});

function createMetadata(): RagSourceMetadata {
	return {
		sourceId: "phase4-readme-test",
		sourcePath: "phase4/README.md",
		sourceName: "README.md",
		sourceKind: "phase-readme",
		phase: "phase4",
		title: "Phase 4",
		format: "markdown",
		language: "mixed",
		topic: "rag",
		retrievalIntent: "implementation-guide",
		audience: "builder",
		sourcePriority: 2,
		contentHash: "a".repeat(64),
	};
}
