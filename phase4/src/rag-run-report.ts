import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type {
	RagAnswerEvent,
	RagAnswerOptions,
	RagAnswerResult,
	RagAnswerStage,
	RagCitation,
	RetrievedChunk,
} from "./rag-answer-demo.js";

export type RagRunReportChunk = {
	rank: number;
	score: number;
	sourcePath: string;
	chunkIndex: number;
	sectionTitle?: string;
	chunkId?: string;
	contentPreview: string;
};

export type RagRunReport = {
	runId: string;
	query: string;
	startedAtIso: string;
	endedAtIso?: string;
	durationMs?: number;
	ok?: boolean;
	failedStage?: RagAnswerStage | "unknown";
	errorMessage?: string;
	options: RagAnswerOptions;
	model?: {
		provider: string;
		model: string;
	};
	embedding?: {
		provider: string;
		model: string;
	};
	retrievedChunks: RagRunReportChunk[];
	answer?: {
		text: string;
		notEnoughEvidence: boolean;
		citations: RagCitation[];
	};
	events: RagAnswerEvent[];
};

export type CreateRagRunReportInput = {
	query: string;
	options: RagAnswerOptions;
	now?: () => Date;
};

export type FinishRagRunReportInput = {
	ok: boolean;
	result?: RagAnswerResult;
	errorMessage?: string;
	failedStage?: RagAnswerStage | "unknown";
	now?: () => Date;
};

export const defaultRagRunReportDir = "phase4/runs/rag";

const chunkPreviewCharacters = 360;

export function createRagRunReport(input: CreateRagRunReportInput): RagRunReport {
	const now = input.now?.() ?? new Date();

	return {
		runId: createRunId(now),
		query: input.query,
		startedAtIso: now.toISOString(),
		options: input.options,
		retrievedChunks: [],
		events: [],
	};
}

export function recordRagRunEvent(report: RagRunReport, event: RagAnswerEvent): void {
	report.events.push(event);
}

export function finishRagRunReport(
	report: RagRunReport,
	input: FinishRagRunReportInput,
): RagRunReport {
	const now = input.now?.() ?? new Date();

	report.endedAtIso = now.toISOString();
	report.durationMs = Date.parse(report.endedAtIso) - Date.parse(report.startedAtIso);
	report.ok = input.ok;
	report.errorMessage = input.errorMessage;

	if (input.result) {
		report.model = input.result.model;
		report.embedding = input.result.embedding;
		report.retrievedChunks = summarizeRetrievedChunks(input.result.retrievedChunks);
		report.answer = {
			text: input.result.answer,
			notEnoughEvidence: input.result.notEnoughEvidence,
			citations: input.result.citations,
		};
	}

	if (!input.ok) {
		report.failedStage = input.failedStage ?? inferFailedStage(report);
	}

	return report;
}

export function summarizeRagRunReport(report: RagRunReport): Record<string, unknown> {
	return {
		runId: report.runId,
		ok: report.ok,
		failedStage: report.failedStage,
		query: report.query,
		model: report.model,
		embedding: report.embedding,
		topK: report.options.topK,
		retrievedChunkCount: report.retrievedChunks.length,
		citationCount: report.answer?.citations.length ?? 0,
		notEnoughEvidence: report.answer?.notEnoughEvidence,
		durationMs: report.durationMs,
		errorMessage: report.errorMessage,
	};
}

export function createRagRunReportPath(
	report: Pick<RagRunReport, "runId">,
	reportDir = defaultRagRunReportDir,
): string {
	return path.join(reportDir, `${report.runId}.json`);
}

export async function saveRagRunReport(
	report: RagRunReport,
	reportPath = createRagRunReportPath(report),
): Promise<string> {
	await mkdir(path.dirname(reportPath), { recursive: true });
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

	return reportPath;
}

export function summarizeRetrievedChunks(chunks: RetrievedChunk[]): RagRunReportChunk[] {
	return chunks.map((chunk) => ({
		rank: chunk.rank,
		score: chunk.score,
		sourcePath: chunk.sourcePath,
		chunkIndex: chunk.chunkIndex,
		sectionTitle: chunk.sectionTitle,
		chunkId: chunk.chunkId,
		contentPreview: previewText(chunk.content, chunkPreviewCharacters),
	}));
}

function inferFailedStage(report: RagRunReport): RagAnswerStage | "unknown" {
	const failedEvent = [...report.events].reverse().find((event) => !event.ok);

	return failedEvent?.stage ?? "unknown";
}

function createRunId(now: Date): string {
	const timestamp = now.toISOString().replace(/[:.]/g, "-");

	return `phase4-rag-${timestamp}-${randomUUID()}`;
}

function previewText(text: string, maxLength: number): string {
	const compactText = text.replace(/\s+/g, " ").trim();

	if (compactText.length <= maxLength) {
		return compactText;
	}

	return `${compactText.slice(0, maxLength)}...`;
}
