import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";

import {
	resolveSplitDocumentsOptions,
	splitPhase4Documents,
	summarizeDocumentChunks,
} from "../src/split-documents.js";
import type { RagSourceMetadata } from "../src/source-config.js";

describe("phase4 split documents", () => {
	it("splits documents into readable chunks and preserves source metadata", async () => {
		const document = new Document<RagSourceMetadata>({
			id: "phase4-readme-test",
			pageContent: [
				"# Phase 4",
				"",
				"Intro paragraph for retrieval.",
				"",
				"## Step 4",
				"",
				"Chunking keeps source metadata. ".repeat(12),
				"",
				"## Step 5",
				"",
				"Embedding will happen later. ".repeat(12),
			].join("\n"),
			metadata: createMetadata(),
		});

		const chunks = await splitPhase4Documents([document], {
			chunkSize: 120,
			chunkOverlap: 20,
		});
		const summary = summarizeDocumentChunks(1, chunks);

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks.every((chunk) => chunk.pageContent.trim().length > 0)).toBe(true);
		expect(chunks[0]?.metadata).toMatchObject({
			sourcePath: "phase4/README.md",
			title: "Phase 4",
			chunkIndex: 0,
		});
		expect(chunks[0]?.id).toBe("phase4-readme-test::chunk-0");
		expect(chunks.some((chunk) => chunk.metadata.sectionTitle === "Step 4")).toBe(true);
		expect(chunks.every((chunk) => chunk.metadata.chunkStartLine !== undefined)).toBe(true);
		expect(summary).toMatchObject({
			sourceDocumentCount: 1,
			chunkCount: chunks.length,
			byPhase: {
				phase4: chunks.length,
			},
		});
	});

	it("validates split options", () => {
		expect(resolveSplitDocumentsOptions({ chunkSize: 100, chunkOverlap: 20 })).toEqual({
			chunkSize: 100,
			chunkOverlap: 20,
		});
		expect(() => resolveSplitDocumentsOptions({ chunkSize: 100, chunkOverlap: 100 })).toThrow(
			/chunkOverlap/,
		);
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
