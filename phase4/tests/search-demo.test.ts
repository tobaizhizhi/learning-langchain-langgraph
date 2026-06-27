import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";

import { defaultEmbeddingConfig } from "../src/embedding-config.js";
import {
	resolveSearchOptions,
	searchPhase4Index,
	type SearchVectorStore,
} from "../src/search-demo.js";
import type { RagSourceMetadata } from "../src/source-config.js";
import { defaultQdrantConfig } from "../src/vector-store.js";

describe("phase4 search demo", () => {
	it("searches the vector store and returns readable result metadata", async () => {
		const vectorStore = new FakeSearchVectorStore([
			[
				new Document<RagSourceMetadata>({
					id: "point-1",
					pageContent: "LangChain invoke is a single call on a runnable.",
					metadata: {
						...createMetadata(),
						chunkId: "phase1-summary::chunk-1",
						chunkIndex: 1,
						sectionTitle: "Invoke",
					},
				}),
				0.88,
			],
		]);

		const result = await searchPhase4Index({
			query: "invoke 是什么",
			vectorStore,
			embeddingConfig: defaultEmbeddingConfig,
			qdrantConfig: defaultQdrantConfig,
			options: {
				topK: 3,
				previewCharacters: 24,
			},
		});

		expect(vectorStore.lastQuery).toBe("invoke 是什么");
		expect(vectorStore.lastTopK).toBe(3);
		expect(result).toMatchObject({
			query: "invoke 是什么",
			topK: 3,
			results: [
				{
					rank: 1,
					score: 0.88,
					sourcePath: "phase1/02-summary-review.md",
					chunkIndex: 1,
					sectionTitle: "Invoke",
					chunkId: "phase1-summary::chunk-1",
				},
			],
		});
		expect(result.results[0]?.preview).toBe("LangChain invoke is a si...");
	});

	it("validates query and search options", async () => {
		await expect(
			searchPhase4Index({
				query: "   ",
				vectorStore: new FakeSearchVectorStore([]),
				embeddingConfig: defaultEmbeddingConfig,
				qdrantConfig: defaultQdrantConfig,
			}),
		).rejects.toThrow(/Search query/);

		expect(() => resolveSearchOptions({ topK: 0 })).toThrow(/topK/);
		expect(() => resolveSearchOptions({ previewCharacters: 0 })).toThrow(/previewCharacters/);
	});
});

class FakeSearchVectorStore implements SearchVectorStore {
	lastQuery?: string;
	lastTopK?: number;

	constructor(private readonly matches: Array<[Document<RagSourceMetadata>, number]>) {}

	async similaritySearchWithScore(
		query: string,
		k: number,
	): Promise<Array<[Document<RagSourceMetadata>, number]>> {
		this.lastQuery = query;
		this.lastTopK = k;

		return this.matches.slice(0, k);
	}
}

function createMetadata(): RagSourceMetadata {
	return {
		sourceId: "phase1-summary",
		sourcePath: "phase1/02-summary-review.md",
		sourceName: "02-summary-review.md",
		sourceKind: "summary-review",
		phase: "phase1",
		title: "Phase 1 Review",
		format: "markdown",
		language: "mixed",
		topic: "invoke",
		retrievalIntent: "concept-review",
		audience: "learner",
		sourcePriority: 1,
		contentHash: "a".repeat(64),
	};
}
