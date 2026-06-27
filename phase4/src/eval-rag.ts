import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { config as loadDotEnv } from "dotenv";

import {
	type EmbeddingConfig,
	loadEmbeddingConfigFromEnv,
} from "./embedding-config.js";
import { createEmbeddingModel } from "./embedding-model.js";
import {
	defaultRagEvalCases,
	type RagEvalCase,
	validateRagEvalCases,
} from "./eval-cases.js";
import {
	answerWithRag,
	defaultRagAnswerOptions,
	type RagAnswerOptions,
	type RagAnswerResult,
} from "./rag-answer-demo.js";
import {
	createQdrantVectorStore,
	loadQdrantConfigFromEnv,
	type QdrantConfig,
} from "./vector-store.js";
import {
	type ModelConfig,
	loadModelConfigFromEnv,
} from "../../phase1/src/model-config.js";

export type RagEvalOptions = RagAnswerOptions & {
	caseLimit?: number;
};

export type RagEvalCaseResult = {
	id: string;
	question: string;
	shouldRefuse: boolean;
	expectedSourcePaths: string[];
	mustMention: string[];
	passed: boolean;
	retrievalHit: boolean;
	citationHit: boolean;
	mustMentionHit: boolean;
	refusalHit: boolean;
	citationValid: boolean;
	latencyMs: number;
	model?: {
		provider: string;
		model: string;
	};
	embedding?: {
		provider: string;
		model: string;
	};
	retrievedSources: string[];
	citations: Array<{
		sourcePath: string;
		chunkIndex: number;
		quote?: string;
	}>;
	answerPreview?: string;
	notEnoughEvidence?: boolean;
	errorMessage?: string;
	failReasons: string[];
};

export type RagEvalSummary = {
	total: number;
	passed: number;
	failed: number;
	passRate: number;
	retrievalHitRate: number;
	citationHitRate: number;
	mustMentionHitRate: number;
	refusalHitRate: number;
	durationMs: number;
};

export type RagEvalReport = {
	runId: string;
	startedAtIso: string;
	endedAtIso: string;
	options: RagEvalOptions;
	model?: {
		provider: string;
		model: string;
	};
	embedding?: {
		provider: string;
		model: string;
	};
	summary: RagEvalSummary;
	results: RagEvalCaseResult[];
	failures: RagEvalCaseResult[];
};

export type RagEvalAnswerRunner = (evalCase: RagEvalCase) => Promise<RagAnswerResult>;

export const defaultRagEvalOptions: RagEvalOptions = {
	topK: defaultRagAnswerOptions.topK,
	maxChunkCharacters: defaultRagAnswerOptions.maxChunkCharacters,
};

export const defaultRagEvalReportDir = "phase4/runs/eval";

export async function runRagEval(input: {
	cases?: RagEvalCase[];
	options?: Partial<RagEvalOptions>;
	answerRunner?: RagEvalAnswerRunner;
	modelConfig?: ModelConfig;
	embeddingConfig?: EmbeddingConfig;
	qdrantConfig?: QdrantConfig;
	now?: () => Date;
} = {}): Promise<RagEvalReport> {
	const startedAt = input.now?.() ?? new Date();
	const startedAtMs = Date.now();
	const options = resolveRagEvalOptions(input.options);
	const cases = selectEvalCases(validateRagEvalCases(input.cases ?? defaultRagEvalCases), options);
	const answerRunner = input.answerRunner ?? createDefaultAnswerRunner({
		options,
		modelConfig: input.modelConfig,
		embeddingConfig: input.embeddingConfig,
		qdrantConfig: input.qdrantConfig,
	});
	const results: RagEvalCaseResult[] = [];

	for (const evalCase of cases) {
		results.push(await runSingleEvalCase(evalCase, answerRunner));
	}

	const endedAt = input.now?.() ?? new Date();
	const report: RagEvalReport = {
		runId: createEvalRunId(startedAt),
		startedAtIso: startedAt.toISOString(),
		endedAtIso: endedAt.toISOString(),
		options,
		model: readModelFromResults(results),
		embedding: readEmbeddingFromResults(results),
		summary: summarizeEvalResults(results, Date.now() - startedAtMs),
		results,
		failures: results.filter((result) => !result.passed),
	};

	return report;
}

export async function runSingleEvalCase(
	evalCase: RagEvalCase,
	answerRunner: RagEvalAnswerRunner,
): Promise<RagEvalCaseResult> {
	const startedAt = Date.now();

	try {
		const result = await answerRunner(evalCase);

		return evaluateRagAnswerResult({
			evalCase,
			result,
			latencyMs: Date.now() - startedAt,
		});
	} catch (error) {
		return createErroredEvalResult(evalCase, Date.now() - startedAt, readErrorMessage(error));
	}
}

export function evaluateRagAnswerResult(input: {
	evalCase: RagEvalCase;
	result: RagAnswerResult;
	latencyMs: number;
}): RagEvalCaseResult {
	const shouldRefuse = input.evalCase.shouldRefuse === true;
	const expectedSourcePaths = input.evalCase.expectedSourcePaths;
	const mustMention = input.evalCase.mustMention ?? [];
	const retrievedSources = unique(input.result.retrievedChunks.map((chunk) => chunk.sourcePath));
	const citationSources = unique(input.result.citations.map((citation) => citation.sourcePath));
	const retrievalHit = shouldRefuse
		? true
		: retrievedSources.some((sourcePath) => expectedSourcePaths.includes(sourcePath));
	const citationHit = shouldRefuse
		? input.result.citations.length === 0
		: citationSources.some((sourcePath) => expectedSourcePaths.includes(sourcePath));
	const mustMentionHit = shouldRefuse
		? true
		: mustMention.every((text) => includesLoose(input.result.answer, text));
	const refusalHit = shouldRefuse
		? input.result.notEnoughEvidence && input.result.citations.length === 0
		: !input.result.notEnoughEvidence;
	const citationValid = input.result.citations.every((citation) =>
		input.result.retrievedChunks.some(
			(chunk) =>
				chunk.sourcePath === citation.sourcePath && chunk.chunkIndex === citation.chunkIndex,
		),
	);
	const failReasons = collectFailReasons({
		shouldRefuse,
		retrievalHit,
		citationHit,
		mustMentionHit,
		refusalHit,
		citationValid,
	});

	return {
		id: input.evalCase.id,
		question: input.evalCase.question,
		shouldRefuse,
		expectedSourcePaths,
		mustMention,
		passed: failReasons.length === 0,
		retrievalHit,
		citationHit,
		mustMentionHit,
		refusalHit,
		citationValid,
		latencyMs: input.latencyMs,
		model: input.result.model,
		embedding: input.result.embedding,
		retrievedSources,
		citations: input.result.citations,
		answerPreview: previewText(input.result.answer, 360),
		notEnoughEvidence: input.result.notEnoughEvidence,
		failReasons,
	};
}

export function summarizeEvalResults(
	results: RagEvalCaseResult[],
	durationMs: number,
): RagEvalSummary {
	const total = results.length;
	const refusalCases = results.filter((result) => result.shouldRefuse);

	return {
		total,
		passed: countBy(results, (result) => result.passed),
		failed: countBy(results, (result) => !result.passed),
		passRate: ratio(countBy(results, (result) => result.passed), total),
		retrievalHitRate: ratio(countBy(results, (result) => result.retrievalHit), total),
		citationHitRate: ratio(countBy(results, (result) => result.citationHit), total),
		mustMentionHitRate: ratio(countBy(results, (result) => result.mustMentionHit), total),
		refusalHitRate: ratio(
			countBy(refusalCases, (result) => result.refusalHit),
			refusalCases.length,
		),
		durationMs,
	};
}

export function resolveRagEvalOptions(options: Partial<RagEvalOptions> = {}): RagEvalOptions {
	const resolvedOptions = {
		...defaultRagEvalOptions,
		...options,
	};

	if (!Number.isInteger(resolvedOptions.topK) || resolvedOptions.topK <= 0) {
		throw new Error("topK must be a positive integer.");
	}

	if (!Number.isInteger(resolvedOptions.maxChunkCharacters) || resolvedOptions.maxChunkCharacters <= 0) {
		throw new Error("maxChunkCharacters must be a positive integer.");
	}

	if (
		resolvedOptions.caseLimit !== undefined &&
		(!Number.isInteger(resolvedOptions.caseLimit) || resolvedOptions.caseLimit <= 0)
	) {
		throw new Error("caseLimit must be a positive integer.");
	}

	return resolvedOptions;
}

export function createRagEvalReportPath(
	report: Pick<RagEvalReport, "runId">,
	reportDir = defaultRagEvalReportDir,
): string {
	return path.join(reportDir, `${report.runId}.json`);
}

export async function saveRagEvalReport(
	report: RagEvalReport,
	reportPath = createRagEvalReportPath(report),
): Promise<string> {
	await mkdir(path.dirname(reportPath), { recursive: true });
	await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

	return reportPath;
}

function createDefaultAnswerRunner(input: {
	options: RagEvalOptions;
	modelConfig?: ModelConfig;
	embeddingConfig?: EmbeddingConfig;
	qdrantConfig?: QdrantConfig;
}): RagEvalAnswerRunner {
	const modelConfig = input.modelConfig ?? loadModelConfigFromEnv();
	const embeddingConfig = input.embeddingConfig ?? loadEmbeddingConfigFromEnv();
	const qdrantConfig = input.qdrantConfig ?? loadQdrantConfigFromEnv();
	const vectorStore = createQdrantVectorStore(createEmbeddingModel(embeddingConfig), qdrantConfig);

	return (evalCase) =>
		answerWithRag({
			query: evalCase.question,
			modelConfig,
			embeddingConfig,
			qdrantConfig,
			vectorStore,
			options: input.options,
		});
}

function selectEvalCases(cases: RagEvalCase[], options: RagEvalOptions): RagEvalCase[] {
	return options.caseLimit === undefined ? cases : cases.slice(0, options.caseLimit);
}

function createErroredEvalResult(
	evalCase: RagEvalCase,
	latencyMs: number,
	errorMessage: string,
): RagEvalCaseResult {
	return {
		id: evalCase.id,
		question: evalCase.question,
		shouldRefuse: evalCase.shouldRefuse === true,
		expectedSourcePaths: evalCase.expectedSourcePaths,
		mustMention: evalCase.mustMention ?? [],
		passed: false,
		retrievalHit: false,
		citationHit: false,
		mustMentionHit: false,
		refusalHit: false,
		citationValid: false,
		latencyMs,
		retrievedSources: [],
		citations: [],
		errorMessage,
		failReasons: ["runtime-error"],
	};
}

function collectFailReasons(input: {
	shouldRefuse: boolean;
	retrievalHit: boolean;
	citationHit: boolean;
	mustMentionHit: boolean;
	refusalHit: boolean;
	citationValid: boolean;
}): string[] {
	const reasons: string[] = [];

	if (!input.retrievalHit && !input.shouldRefuse) {
		reasons.push("retrieval-miss");
	}

	if (!input.citationHit) {
		reasons.push(input.shouldRefuse ? "unexpected-citation" : "citation-miss");
	}

	if (!input.mustMentionHit) {
		reasons.push("must-mention-miss");
	}

	if (!input.refusalHit) {
		reasons.push(input.shouldRefuse ? "should-refuse" : "unexpected-refusal");
	}

	if (!input.citationValid) {
		reasons.push("invalid-citation");
	}

	return reasons;
}

function readModelFromResults(results: RagEvalCaseResult[]): RagEvalReport["model"] {
	return results.find((result) => result.model !== undefined)?.model;
}

function readEmbeddingFromResults(results: RagEvalCaseResult[]): RagEvalReport["embedding"] {
	return results.find((result) => result.embedding !== undefined)?.embedding;
}

function unique(values: string[]): string[] {
	return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function includesLoose(text: string, needle: string): boolean {
	return normalizeForMatch(text).includes(normalizeForMatch(needle));
}

function normalizeForMatch(text: string): string {
	return text.toLowerCase().replace(/\s+/g, "");
}

function countBy<T>(items: T[], predicate: (item: T) => boolean): number {
	return items.filter(predicate).length;
}

function ratio(numerator: number, denominator: number): number {
	if (denominator === 0) {
		return 0;
	}

	return Number((numerator / denominator).toFixed(4));
}

function previewText(text: string, maxLength: number): string {
	const compactText = text.replace(/\s+/g, " ").trim();

	if (compactText.length <= maxLength) {
		return compactText;
	}

	return `${compactText.slice(0, maxLength)}...`;
}

function createEvalRunId(now: Date): string {
	const timestamp = now.toISOString().replace(/[:.]/g, "-");

	return `phase4-eval-${timestamp}-${randomUUID()}`;
}

function readErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

async function main() {
	loadDotEnv({ quiet: true });
	loadDotEnv({ path: "phase4/.env", override: false, quiet: true });

	const cliOptions = readCliOptions(process.argv.slice(2));
	const report = await runRagEval({
		options: {
			topK: cliOptions.topK ?? readPositiveIntegerEnv("PHASE4_EVAL_TOP_K", defaultRagEvalOptions.topK),
			maxChunkCharacters: cliOptions.maxChunkCharacters ?? readPositiveIntegerEnv(
				"PHASE4_EVAL_MAX_CHUNK_CHARS",
				defaultRagEvalOptions.maxChunkCharacters,
			),
			caseLimit: cliOptions.caseLimit ?? readOptionalPositiveIntegerEnv("PHASE4_EVAL_CASE_LIMIT"),
		},
	});
	const reportPath = await saveReportIfEnabled(report, resolveReportPath(report));

	console.log("RAG eval summary:");
	console.log(JSON.stringify(report.summary, null, 2));
	if (report.failures.length > 0) {
		console.log("");
		console.log("Failures:");
		for (const failure of report.failures) {
			console.log(`- ${failure.id}: ${failure.failReasons.join(", ")}`);
			if (failure.errorMessage) {
				console.log(`  error: ${failure.errorMessage}`);
			}
			if (failure.retrievedSources.length > 0) {
				console.log(`  retrieved: ${failure.retrievedSources.join(", ")}`);
			}
			if (failure.citations.length > 0) {
				console.log(
					`  citations: ${failure.citations.map((citation) => `${citation.sourcePath}#chunk-${citation.chunkIndex}`).join(", ")}`,
				);
			}
		}
	}

	if (reportPath) {
		console.log("");
		console.log(`Report: ${reportPath}`);
	}
}

function readCliOptions(args: string[]): {
	topK?: number;
	maxChunkCharacters?: number;
	caseLimit?: number;
} {
	let topK: number | undefined;
	let maxChunkCharacters: number | undefined;
	let caseLimit: number | undefined;

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg) {
			continue;
		}

		if (arg === "--topK" || arg === "--top-k") {
			topK = parsePositiveIntegerOption(arg, args[index + 1]);
			index += 1;
			continue;
		}

		if (arg.startsWith("--topK=") || arg.startsWith("--top-k=")) {
			topK = parsePositiveIntegerOption("--topK", arg.split("=", 2)[1]);
			continue;
		}

		if (arg === "--maxChunkChars" || arg === "--max-chunk-chars") {
			maxChunkCharacters = parsePositiveIntegerOption(arg, args[index + 1]);
			index += 1;
			continue;
		}

		if (arg.startsWith("--maxChunkChars=") || arg.startsWith("--max-chunk-chars=")) {
			maxChunkCharacters = parsePositiveIntegerOption("--maxChunkChars", arg.split("=", 2)[1]);
			continue;
		}

		if (arg === "--limit") {
			caseLimit = parsePositiveIntegerOption(arg, args[index + 1]);
			index += 1;
			continue;
		}

		if (arg.startsWith("--limit=")) {
			caseLimit = parsePositiveIntegerOption("--limit", arg.split("=", 2)[1]);
		}
	}

	return {
		topK,
		maxChunkCharacters,
		caseLimit,
	};
}

function resolveReportPath(report: RagEvalReport): string | undefined {
	const reportDir = process.env.PHASE4_EVAL_REPORT_DIR?.trim();
	if (reportDir === "off") {
		return undefined;
	}

	return createRagEvalReportPath(report, reportDir || defaultRagEvalReportDir);
}

async function saveReportIfEnabled(
	report: RagEvalReport,
	reportPath: string | undefined,
): Promise<string | undefined> {
	if (!reportPath) {
		return undefined;
	}

	return saveRagEvalReport(report, reportPath);
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return fallback;
	}

	return parsePositiveIntegerOption(name, raw);
}

function readOptionalPositiveIntegerEnv(name: string): number | undefined {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return undefined;
	}

	return parsePositiveIntegerOption(name, raw);
}

function parsePositiveIntegerOption(name: string, raw: string | undefined): number {
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return value;
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 RAG eval failed: ${message}`);
	if (
		message.includes("6333") ||
		message.toLowerCase().includes("qdrant") ||
		message.toLowerCase().includes("fetch failed") ||
		message.toLowerCase().includes("server version")
	) {
		console.error(`Qdrant checklist: run "docker ps" and "pnpm phase4:index", then retry.`);
	} else if (message.includes("11434") || message.includes("/tokenize")) {
		console.error(`Ollama checklist: run "ollama ps" and verify EMBEDDING_MODEL in phase4/.env.`);
	}
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
