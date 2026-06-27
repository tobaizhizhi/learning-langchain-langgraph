import { Document } from "@langchain/core/documents";
import { describe, expect, it } from "vitest";

import {
	createCourseKnowledgeSearchTool,
	inferKnowledgePhase,
	type CourseKnowledgeSearchResult,
} from "../src/rag-tool.js";
import type { RagVectorStore } from "../src/rag-answer-demo.js";
import type { RagSourceMetadata } from "../src/source-config.js";

describe("phase4 RAG knowledge-base tool", () => {
	it("returns compact matches with citation keys", async () => {
		const vectorStore = new FakeRagVectorStore([
			[
				createDocument({
					sourcePath: "phase1/03-summary-review.md",
					chunkIndex: 2,
					content: "invoke 返回 AIMessage，项目里会把它整理成稳定结果。".repeat(4),
				}),
				0.91,
			],
		]);
		const searchTool = createCourseKnowledgeSearchTool({
			vectorStore,
			maxContentPreviewCharacters: 32,
		});

		const result = await searchTool.invoke({
			query: "invoke 返回什么",
			topK: 1,
		}) as CourseKnowledgeSearchResult;

		expect(vectorStore.lastQuery).toBe("invoke 返回什么");
		expect(vectorStore.lastTopK).toBe(1);
		expect(result).toMatchObject({
			query: "invoke 返回什么",
			topK: 1,
			matchCount: 1,
			notEnoughEvidence: false,
			matches: [
				{
					rank: 1,
					score: 0.91,
					sourcePath: "phase1/03-summary-review.md",
					sourcePhase: "phase1",
					chunkIndex: 2,
					citationKey: "phase1/03-summary-review.md#chunk-2",
				},
			],
		});
		expect(result.matches[0]?.contentPreview.length).toBeLessThanOrEqual(35);
	});

	it("can filter matches by phase", async () => {
		const vectorStore = new FakeRagVectorStore([
			[
				createDocument({
					sourcePath: "phase2/summary-review.md",
					chunkIndex: 0,
					content: "ToolMessage 是工具结果回填。",
				}),
				0.95,
			],
			[
				createDocument({
					sourcePath: "phase1/03-summary-review.md",
					chunkIndex: 0,
					content: "AIMessage 是 invoke 返回值。",
				}),
				0.9,
			],
		]);
		const searchTool = createCourseKnowledgeSearchTool({ vectorStore });

		const result = await searchTool.invoke({
			query: "AIMessage",
			topK: 1,
			phaseFilter: "phase1",
		}) as CourseKnowledgeSearchResult;

		expect(vectorStore.lastTopK).toBe(3);
		expect(result.matches).toHaveLength(1);
		expect(result.matches[0]?.sourcePath).toBe("phase1/03-summary-review.md");
	});

	it("returns notEnoughEvidence when no filtered matches remain", async () => {
		const searchTool = createCourseKnowledgeSearchTool({
			vectorStore: new FakeRagVectorStore([
				[
					createDocument({
						sourcePath: "phase1/03-summary-review.md",
						chunkIndex: 0,
						content: "AIMessage 是 invoke 返回值。",
					}),
					0.9,
				],
			]),
		});

		const result = await searchTool.invoke({
			query: "agent middleware",
			topK: 2,
			phaseFilter: "phase4",
		}) as CourseKnowledgeSearchResult;

		expect(result).toMatchObject({
			matchCount: 0,
			notEnoughEvidence: true,
			matches: [],
		});
	});

	it("infers knowledge phase from source path", () => {
		expect(inferKnowledgePhase("phase3/README.md")).toBe("phase3");
		expect(inferKnowledgePhase("docs/course-outline-rules.md")).toBe("docs");
		expect(inferKnowledgePhase("unknown/file.md")).toBeUndefined();
	});
});

class FakeRagVectorStore implements RagVectorStore {
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

function createDocument(input: {
	sourcePath: string;
	chunkIndex: number;
	content: string;
}): Document<RagSourceMetadata> {
	return new Document<RagSourceMetadata>({
		id: `${input.sourcePath}::chunk-${input.chunkIndex}`,
		pageContent: input.content,
		metadata: {
			sourceId: input.sourcePath.replace(/[^a-z0-9]+/gi, "-"),
			sourcePath: input.sourcePath,
			sourceName: input.sourcePath.split("/").at(-1) ?? "source.md",
			sourceKind: "summary-review",
			phase: inferKnowledgePhase(input.sourcePath) ?? "docs",
			title: "Test Source",
			format: "markdown",
			language: "mixed",
			topic: "rag",
			retrievalIntent: "concept-review",
			audience: "learner",
			sourcePriority: 1,
			contentHash: "a".repeat(64),
			chunkIndex: input.chunkIndex,
			sectionTitle: "Test Section",
			chunkId: `${input.sourcePath}::chunk-${input.chunkIndex}`,
		},
	});
}
