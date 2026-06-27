import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";

import { defaultEmbeddingConfig } from "../src/embedding-config.js";
import {
	indexPhase4Documents,
	type IndexVectorStore,
} from "../src/index-documents.js";
import type { Phase4Chunk } from "../src/split-documents.js";
import type { RagSourceMetadata } from "../src/source-config.js";
import { defaultQdrantConfig } from "../src/vector-store.js";

describe("phase4 index documents", () => {
	it("indexes prepared chunks and verifies metadata can be read back", async () => {
		const vectorStore = new FakeIndexVectorStore();
		const document = createDocument();
		const chunk = createChunk();

		const result = await indexPhase4Documents({
			documents: [document],
			chunks: [chunk],
			vectorStore,
			embeddingConfig: defaultEmbeddingConfig,
			qdrantConfig: {
				...defaultQdrantConfig,
				indexBatchSize: 1,
			},
			verificationQuery: "Phase 4",
		});

		expect(vectorStore.added).toHaveLength(1);
		expect(vectorStore.added[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(vectorStore.added[0]?.metadata).toMatchObject({
			sourcePath: "phase4/README.md",
			chunkId: "phase4-readme-test::chunk-0",
			qdrantPointId: vectorStore.added[0]?.id,
		});
		expect(result).toMatchObject({
			sourceDocumentCount: 1,
			chunkCount: 1,
			indexedPointCount: 1,
			byPhase: {
				phase4: 1,
			},
			verification: {
				query: "Phase 4",
				score: 0.99,
				sourcePath: "phase4/README.md",
				chunkIndex: 0,
			},
		});
	});

	it("uses a custom reset hook when resetCollection is enabled for a fake store", async () => {
		const vectorStore = new FakeIndexVectorStore();
		let resetCalled = false;

		await indexPhase4Documents({
			documents: [createDocument()],
			chunks: [createChunk()],
			vectorStore,
			embeddingConfig: defaultEmbeddingConfig,
			qdrantConfig: {
				...defaultQdrantConfig,
				resetCollection: true,
			},
			resetVectorStore: async () => {
				resetCalled = true;
			},
		});

		expect(resetCalled).toBe(true);
	});
});

class FakeIndexVectorStore implements IndexVectorStore {
	added: Document<RagSourceMetadata>[] = [];

	async addDocuments(documents: Document<RagSourceMetadata>[]): Promise<void> {
		this.added.push(...documents);
	}

	async similaritySearchWithScore(): Promise<Array<[Document, number]>> {
		const first = this.added[0];
		return first ? [[first, 0.99]] : [];
	}
}

function createDocument(): Document<RagSourceMetadata> {
	return new Document<RagSourceMetadata>({
		id: "phase4-readme-test",
		pageContent: "# Phase 4\n\nStep 6 body",
		metadata: createMetadata(),
	});
}

function createChunk(): Phase4Chunk {
	return new Document<RagSourceMetadata>({
		id: "phase4-readme-test::chunk-0",
		pageContent: "Step 6 body",
		metadata: {
			...createMetadata(),
			chunkId: "phase4-readme-test::chunk-0",
			chunkIndex: 0,
			chunkStartLine: 3,
			chunkEndLine: 3,
		},
	});
}

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
