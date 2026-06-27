import { Document } from "@langchain/core/documents";
import type { BaseMessageLike } from "@langchain/core/messages";
import { describe, expect, it } from "vitest";

import { defaultModelConfig, type ModelConfig } from "../../phase1/src/model-config.js";
import { defaultEmbeddingConfig } from "../src/embedding-config.js";
import {
	answerWithRag,
	buildRagAnswerMessages,
	resolveRagAnswerOptions,
	type RagVectorStore,
	type StructuredRagRunnable,
	validateRagAnswer,
} from "../src/rag-answer-demo.js";
import type { RagSourceMetadata } from "../src/source-config.js";
import { defaultQdrantConfig } from "../src/vector-store.js";

describe("phase4 RAG answer demo", () => {
	it("retrieves chunks, sends them as context, and returns cited structured output", async () => {
		const vectorStore = new FakeRagVectorStore([
			[
				new Document<RagSourceMetadata>({
					id: "point-1",
					pageContent: "invoke 是 LangChain Runnable 的单次调用入口。",
					metadata: {
						...createMetadata(),
						chunkId: "phase1-summary::chunk-1",
						chunkIndex: 1,
						sectionTitle: "Invoke",
					},
				}),
				0.91,
			],
		]);
		const structuredModel = new FakeStructuredRagModel({
			answer: "invoke 是 LangChain Runnable 的单次调用入口。",
			citations: [
				{
					sourcePath: "phase1/02-summary-review.md",
					chunkIndex: 1,
					quote: "单次调用入口",
				},
			],
			notEnoughEvidence: false,
		});
		const stages: string[] = [];

		const result = await answerWithRag({
			query: "invoke 是什么？",
			modelConfig: createRealModelConfig(),
			embeddingConfig: defaultEmbeddingConfig,
			qdrantConfig: defaultQdrantConfig,
			vectorStore,
			structuredModel,
			onEvent: (event) => {
				stages.push(`${event.stage}:${event.ok ? "ok" : "error"}`);
			},
		});

		expect(vectorStore.lastQuery).toBe("invoke 是什么？");
		expect(vectorStore.lastTopK).toBe(4);
		expect(stages).toEqual(["load:ok", "search:ok", "answer:ok", "validate:ok"]);
		expect(structuredModel.lastMessagesJson()).toContain("invoke 是 LangChain Runnable");
		expect(result).toMatchObject({
			answer: "invoke 是 LangChain Runnable 的单次调用入口。",
			notEnoughEvidence: false,
			citations: [
				{
					sourcePath: "phase1/02-summary-review.md",
					chunkIndex: 1,
				},
			],
			retrievedChunks: [
				{
					sourcePath: "phase1/02-summary-review.md",
					chunkIndex: 1,
					score: 0.91,
				},
			],
		});
	});

	it("rejects citations that were not retrieved", () => {
		expect(() =>
			validateRagAnswer(
				{
					answer: "Invented citation.",
					citations: [
						{
							sourcePath: "phase9/missing.md",
							chunkIndex: 0,
						},
					],
					notEnoughEvidence: false,
				},
				[
					{
						rank: 1,
						score: 0.8,
						sourcePath: "phase1/02-summary-review.md",
						chunkIndex: 1,
						content: "real chunk",
					},
				],
			),
		).toThrow(/not retrieved/);
	});

	it("returns notEnoughEvidence without calling the model when retrieval is empty", async () => {
		const structuredModel = new FakeStructuredRagModel({
			answer: "should not be used",
			citations: [],
			notEnoughEvidence: false,
		});

		const result = await answerWithRag({
			query: "不存在的问题",
			modelConfig: createRealModelConfig(),
			embeddingConfig: defaultEmbeddingConfig,
			qdrantConfig: defaultQdrantConfig,
			vectorStore: new FakeRagVectorStore([]),
			structuredModel,
		});

		expect(structuredModel.invokeCount).toBe(0);
		expect(result.notEnoughEvidence).toBe(true);
		expect(result.citations).toEqual([]);
	});

	it("builds compact context messages and validates options", () => {
		const messages = buildRagAnswerMessages({
			query: "test",
			maxChunkCharacters: 12,
			retrievedChunks: [
				{
					rank: 1,
					score: 0.7,
					sourcePath: "phase4/README.md",
					chunkIndex: 2,
					content: "abcdefghijklmnopqrstuvwxyz",
				},
			],
		});

		expect(JSON.stringify(messages)).toContain("abcdefghijkl...");
		expect(() => resolveRagAnswerOptions({ topK: 0 })).toThrow(/topK/);
		expect(() => resolveRagAnswerOptions({ maxChunkCharacters: 0 })).toThrow(
			/maxChunkCharacters/,
		);
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

class FakeStructuredRagModel implements StructuredRagRunnable {
	invokeCount = 0;
	private lastMessages: BaseMessageLike[] = [];

	constructor(private readonly output: unknown) {}

	async invoke(input: BaseMessageLike[]): Promise<unknown> {
		this.invokeCount += 1;
		this.lastMessages = input;

		return this.output;
	}

	lastMessagesJson(): string {
		return JSON.stringify(this.lastMessages);
	}
}

function createRealModelConfig(): ModelConfig {
	return {
		...defaultModelConfig,
		provider: "openai",
		model: "test-chat-model",
	};
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
