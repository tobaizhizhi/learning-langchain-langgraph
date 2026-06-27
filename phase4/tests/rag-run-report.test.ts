import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createRagRunReport,
	createRagRunReportPath,
	finishRagRunReport,
	recordRagRunEvent,
	saveRagRunReport,
	summarizeRagRunReport,
} from "../src/rag-run-report.js";
import type { RagAnswerResult } from "../src/rag-answer-demo.js";

describe("phase4 RAG run report", () => {
	let rootDir: string;

	beforeEach(async () => {
		rootDir = await mkdtemp(path.join(tmpdir(), "aiframe-rag-report-"));
	});

	afterEach(async () => {
		await rm(rootDir, { recursive: true, force: true });
	});

	it("creates, finishes, and saves a successful RAG report", async () => {
		const report = createRagRunReport({
			query: "invoke 返回什么",
			options: {
				topK: 2,
				maxChunkCharacters: 900,
			},
			now: () => new Date("2026-06-27T00:00:00.000Z"),
		});

		recordRagRunEvent(report, {
			stage: "search",
			ok: true,
			startedAtIso: "2026-06-27T00:00:01.000Z",
			latencyMs: 123,
			output: {
				retrievedChunkCount: 1,
			},
		});
		finishRagRunReport(report, {
			ok: true,
			result: createResult(),
			now: () => new Date("2026-06-27T00:00:02.000Z"),
		});

		const reportPath = createRagRunReportPath(report, rootDir);
		await saveRagRunReport(report, reportPath);
		const savedReport = JSON.parse(await readFile(reportPath, "utf8"));

		expect(savedReport).toMatchObject({
			query: "invoke 返回什么",
			ok: true,
			durationMs: 2_000,
			options: {
				topK: 2,
				maxChunkCharacters: 900,
			},
			model: {
				provider: "openai",
				model: "gpt-test",
			},
			embedding: {
				provider: "ollama",
				model: "bge-m3",
			},
			answer: {
				text: "invoke 返回 AIMessage。",
				notEnoughEvidence: false,
			},
		});
		expect(savedReport.retrievedChunks[0].contentPreview).toContain("invoke 返回 AIMessage");
		expect(savedReport.retrievedChunks[0].content).toBeUndefined();
		expect(savedReport.events).toHaveLength(1);
		expect(summarizeRagRunReport(report)).toMatchObject({
			ok: true,
			retrievedChunkCount: 1,
			citationCount: 1,
			notEnoughEvidence: false,
		});
	});

	it("infers failed stage from the last failed event", () => {
		const report = createRagRunReport({
			query: "missing",
			options: {
				topK: 4,
				maxChunkCharacters: 1_600,
			},
			now: () => new Date("2026-06-27T00:00:00.000Z"),
		});

		recordRagRunEvent(report, {
			stage: "search",
			ok: false,
			startedAtIso: "2026-06-27T00:00:01.000Z",
			latencyMs: 20,
			errorMessage: "Qdrant unavailable",
		});
		finishRagRunReport(report, {
			ok: false,
			errorMessage: "Qdrant unavailable",
			now: () => new Date("2026-06-27T00:00:02.000Z"),
		});

		expect(report).toMatchObject({
			ok: false,
			failedStage: "search",
			errorMessage: "Qdrant unavailable",
		});
		expect(summarizeRagRunReport(report)).toMatchObject({
			ok: false,
			failedStage: "search",
			errorMessage: "Qdrant unavailable",
		});
	});
});

function createResult(): RagAnswerResult {
	return {
		query: "invoke 返回什么",
		model: {
			provider: "openai",
			model: "gpt-test",
		},
		embedding: {
			provider: "ollama",
			model: "bge-m3",
		},
		answer: "invoke 返回 AIMessage。",
		citations: [
			{
				sourcePath: "phase1/03-summary-review.md",
				chunkIndex: 0,
				quote: "AIMessage",
			},
		],
		notEnoughEvidence: false,
		retrievedChunks: [
			{
				rank: 1,
				score: 0.9,
				sourcePath: "phase1/03-summary-review.md",
				chunkIndex: 0,
				sectionTitle: "Invoke",
				chunkId: "phase1-summary::chunk-0",
				content: "invoke 返回 AIMessage。".repeat(80),
			},
		],
	};
}
