import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { RagEvalCase } from "../src/eval-cases.js";
import {
	createRagEvalReportPath,
	evaluateRagAnswerResult,
	resolveRagEvalOptions,
	runRagEval,
	saveRagEvalReport,
	type RagEvalAnswerRunner,
} from "../src/eval-rag.js";
import type { RagAnswerResult } from "../src/rag-answer-demo.js";

describe("phase4 RAG eval runner", () => {
	let rootDir: string;

	beforeEach(async () => {
		rootDir = await mkdtemp(path.join(tmpdir(), "aiframe-rag-eval-"));
	});

	afterEach(async () => {
		await rm(rootDir, { recursive: true, force: true });
	});

	it("passes when retrieval, citation, and required words match", () => {
		const result = evaluateRagAnswerResult({
			evalCase: createEvalCase({
				mustMention: ["AIMessage"],
			}),
			result: createAnswerResult({
				answer: "invoke 返回 AIMessage。",
			}),
			latencyMs: 120,
		});

		expect(result).toMatchObject({
			passed: true,
			retrievalHit: true,
			citationHit: true,
			mustMentionHit: true,
			refusalHit: true,
			citationValid: true,
			model: {
				provider: "openai",
				model: "gpt-test",
			},
			embedding: {
				provider: "ollama",
				model: "bge-m3",
			},
		});
		expect(result.failReasons).toEqual([]);
	});

	it("records concrete failure reasons instead of only returning false", () => {
		const result = evaluateRagAnswerResult({
			evalCase: createEvalCase({
				expectedSourcePaths: ["phase2/summary-review.md"],
				mustMention: ["ToolMessage"],
			}),
			result: createAnswerResult({
				answer: "invoke 返回 AIMessage。",
			}),
			latencyMs: 100,
		});

		expect(result.passed).toBe(false);
		expect(result.failReasons).toEqual([
			"retrieval-miss",
			"citation-miss",
			"must-mention-miss",
		]);
	});

	it("passes refusal cases only when the answer says evidence is insufficient and has no citations", () => {
		const result = evaluateRagAnswerResult({
			evalCase: createEvalCase({
				id: "refuse-weather",
				question: "今天北京天气怎么样？",
				expectedSourcePaths: [],
				shouldRefuse: true,
			}),
			result: createAnswerResult({
				answer: "当前知识库没有天气数据，不能回答这个问题。",
				citations: [],
				notEnoughEvidence: true,
			}),
			latencyMs: 80,
		});

		expect(result).toMatchObject({
			passed: true,
			refusalHit: true,
			citationHit: true,
		});
	});

	it("runs cases, summarizes pass rate, and saves a report with failures", async () => {
		const cases = [
			createEvalCase({ id: "pass" }),
			createEvalCase({
				id: "fail",
				expectedSourcePaths: ["phase2/summary-review.md"],
			}),
			createEvalCase({
				id: "refuse",
				expectedSourcePaths: [],
				shouldRefuse: true,
			}),
		];
		const answerRunner: RagEvalAnswerRunner = async (evalCase) => {
			if (evalCase.id === "refuse") {
				return createAnswerResult({
					query: evalCase.question,
					answer: "知识库没有足够证据回答。",
					citations: [],
					notEnoughEvidence: true,
				});
			}

			return createAnswerResult({
				query: evalCase.question,
				answer: "invoke 返回 AIMessage。",
			});
		};

		const report = await runRagEval({
			cases,
			answerRunner,
			options: {
				caseLimit: 3,
				topK: 2,
			},
		});
		const reportPath = createRagEvalReportPath(report, rootDir);
		await saveRagEvalReport(report, reportPath);
		const savedReport = JSON.parse(await readFile(reportPath, "utf8"));

		expect(report.summary).toMatchObject({
			total: 3,
			passed: 2,
			failed: 1,
			passRate: 0.6667,
		});
		expect(report.failures).toHaveLength(1);
		expect(report.failures[0]?.id).toBe("fail");
		expect(report.model).toEqual({
			provider: "openai",
			model: "gpt-test",
		});
		expect(report.embedding).toEqual({
			provider: "ollama",
			model: "bge-m3",
		});
		expect(savedReport.failures[0].failReasons).toContain("retrieval-miss");
	});

	it("validates eval options", () => {
		expect(() => resolveRagEvalOptions({ topK: 0 })).toThrow(/topK/);
		expect(() => resolveRagEvalOptions({ maxChunkCharacters: 0 })).toThrow(
			/maxChunkCharacters/,
		);
		expect(() => resolveRagEvalOptions({ caseLimit: 0 })).toThrow(/caseLimit/);
	});
});

function createEvalCase(overrides: Partial<RagEvalCase> = {}): RagEvalCase {
	return {
		id: "phase1-invoke-return",
		question: "LangChain invoke 返回什么？",
		expectedSourcePaths: ["phase1/03-summary-review.md"],
		...overrides,
	};
}

function createAnswerResult(overrides: Partial<RagAnswerResult> = {}): RagAnswerResult {
	return {
		query: "LangChain invoke 返回什么？",
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
				score: 0.91,
				sourcePath: "phase1/03-summary-review.md",
				chunkIndex: 0,
				sectionTitle: "Invoke",
				chunkId: "phase1-summary::chunk-0",
				content: "invoke 返回 AIMessage。",
			},
		],
		...overrides,
	};
}
