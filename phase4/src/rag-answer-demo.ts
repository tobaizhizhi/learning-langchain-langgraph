import { Document } from "@langchain/core/documents";
import type { BaseMessageLike } from "@langchain/core/messages";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import {
	type ModelConfig,
	loadModelConfigFromEnv,
} from "../../phase1/src/model-config.js";
import {
	type EmbeddingConfig,
	loadEmbeddingConfigFromEnv,
} from "./embedding-config.js";
import { createEmbeddingModel } from "./embedding-model.js";
import {
	createRagRunReport,
	createRagRunReportPath,
	defaultRagRunReportDir,
	finishRagRunReport,
	recordRagRunEvent,
	saveRagRunReport,
	summarizeRagRunReport,
	type RagRunReport,
} from "./rag-run-report.js";
import {
	createQdrantVectorStore,
	loadQdrantConfigFromEnv,
	type QdrantConfig,
} from "./vector-store.js";

export const ragCitationSchema = z.object({
	sourcePath: z.string().min(1),
	chunkIndex: z.number().int().min(0),
	quote: z.string().min(1).optional(),
});

export const ragAnswerSchema = z.object({
	answer: z.string().min(1),
	citations: z.array(ragCitationSchema),
	notEnoughEvidence: z.boolean(),
});

export type RagCitation = z.infer<typeof ragCitationSchema>;
export type RagAnswer = z.infer<typeof ragAnswerSchema>;

export type RagAnswerResult = RagAnswer & {
	query: string;
	model: {
		provider: ModelConfig["provider"];
		model: string;
	};
	embedding: {
		provider: EmbeddingConfig["provider"];
		model: string;
	};
	retrievedChunks: RetrievedChunk[];
};

export type RetrievedChunk = {
	rank: number;
	score: number;
	sourcePath: string;
	chunkIndex: number;
	sectionTitle?: string;
	chunkId?: string;
	content: string;
};

export type RagAnswerOptions = {
	topK: number;
	maxChunkCharacters: number;
};

export type RagAnswerStage = "load" | "search" | "answer" | "validate";

export type RagAnswerEvent = {
	stage: RagAnswerStage;
	ok: boolean;
	startedAtIso: string;
	latencyMs: number;
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
	errorMessage?: string;
};

export type RagVectorStore = {
	similaritySearchWithScore(
		query: string,
		k: number,
	): Promise<Array<[Document<Record<string, unknown>>, number]>>;
};

export type StructuredRagRunnable = {
	invoke(input: BaseMessageLike[]): Promise<unknown>;
};

export const defaultRagAnswerOptions: RagAnswerOptions = {
	topK: 4,
	maxChunkCharacters: 1_600,
};

export async function answerWithRag(input: {
	query: string;
	modelConfig?: ModelConfig;
	embeddingConfig?: EmbeddingConfig;
	qdrantConfig?: QdrantConfig;
	vectorStore?: RagVectorStore;
	structuredModel?: StructuredRagRunnable;
	options?: Partial<RagAnswerOptions>;
	onEvent?: (event: RagAnswerEvent) => void;
}): Promise<RagAnswerResult> {
	let query = "";
	let options: RagAnswerOptions;
	let modelConfig: ModelConfig;
	let embeddingConfig: EmbeddingConfig;
	let qdrantConfig: QdrantConfig;
	let vectorStore: RagVectorStore;

	const loadStartedAt = Date.now();
	try {
		query = input.query.trim();
		if (!query) {
			throw new Error("RAG query is required.");
		}

		options = resolveRagAnswerOptions(input.options);
		modelConfig = input.modelConfig ?? loadModelConfigFromEnv();
		if (modelConfig.provider === "mock") {
			throw new Error("Phase4 RAG answer requires a real chat model. Set MODEL_ID=openai:<model>.");
		}

		embeddingConfig = input.embeddingConfig ?? loadEmbeddingConfigFromEnv();
		qdrantConfig = input.qdrantConfig ?? loadQdrantConfigFromEnv();
		vectorStore = input.vectorStore ?? createQdrantVectorStore(
			createEmbeddingModel(embeddingConfig),
			qdrantConfig,
		);
		input.onEvent?.(createRagAnswerEvent("load", loadStartedAt, true, {
			output: {
				modelProvider: modelConfig.provider,
				model: modelConfig.model,
				embeddingProvider: embeddingConfig.provider,
				embeddingModel: embeddingConfig.model,
				qdrantUrl: qdrantConfig.url,
				qdrantCollection: qdrantConfig.collectionName,
				topK: options.topK,
				maxChunkCharacters: options.maxChunkCharacters,
			},
		}));
	} catch (error) {
		input.onEvent?.(createRagAnswerEvent("load", loadStartedAt, false, {
			errorMessage: readErrorMessage(error),
		}));
		throw error;
	}

	const searchStartedAt = Date.now();
	let retrievedChunks: RetrievedChunk[];
	try {
		retrievedChunks = await retrieveChunks({
			query,
			vectorStore,
			topK: options.topK,
		});
		input.onEvent?.(createRagAnswerEvent("search", searchStartedAt, true, {
			input: {
				topK: options.topK,
			},
			output: {
				retrievedChunkCount: retrievedChunks.length,
				retrievedChunks: summarizeRetrievedChunksForEvent(retrievedChunks),
			},
		}));
	} catch (error) {
		input.onEvent?.(createRagAnswerEvent("search", searchStartedAt, false, {
			input: {
				topK: options.topK,
			},
			errorMessage: readErrorMessage(error),
		}));
		throw error;
	}

	if (retrievedChunks.length === 0) {
		return {
			query,
			model: {
				provider: modelConfig.provider,
				model: modelConfig.model,
			},
			embedding: {
				provider: embeddingConfig.provider,
				model: embeddingConfig.model,
			},
			answer: "没有检索到可用资料，因此不能基于当前知识库回答这个问题。",
			citations: [],
			notEnoughEvidence: true,
			retrievedChunks,
		};
	}

	const answerStartedAt = Date.now();
	let rawAnswer: unknown;
	try {
		const structuredModel = input.structuredModel ?? createStructuredRagModel(modelConfig);
		rawAnswer = await structuredModel.invoke(
			buildRagAnswerMessages({
				query,
				retrievedChunks,
				maxChunkCharacters: options.maxChunkCharacters,
			}),
		);
		input.onEvent?.(createRagAnswerEvent("answer", answerStartedAt, true, {
			input: {
				contextChunkCount: retrievedChunks.length,
				maxChunkCharacters: options.maxChunkCharacters,
			},
			output: {
				rawOutputType: typeof rawAnswer,
			},
		}));
	} catch (error) {
		input.onEvent?.(createRagAnswerEvent("answer", answerStartedAt, false, {
			input: {
				contextChunkCount: retrievedChunks.length,
				maxChunkCharacters: options.maxChunkCharacters,
			},
			errorMessage: readErrorMessage(error),
		}));
		throw error;
	}

	const validateStartedAt = Date.now();
	let answer: RagAnswer;
	try {
		answer = validateRagAnswer(rawAnswer, retrievedChunks);
		input.onEvent?.(createRagAnswerEvent("validate", validateStartedAt, true, {
			output: {
				citationCount: answer.citations.length,
				notEnoughEvidence: answer.notEnoughEvidence,
				answerCharacters: answer.answer.length,
			},
		}));
	} catch (error) {
		input.onEvent?.(createRagAnswerEvent("validate", validateStartedAt, false, {
			errorMessage: readErrorMessage(error),
		}));
		throw error;
	}

	return {
		query,
		model: {
			provider: modelConfig.provider,
			model: modelConfig.model,
		},
		embedding: {
			provider: embeddingConfig.provider,
			model: embeddingConfig.model,
		},
		...answer,
		retrievedChunks,
	};
}

export async function retrieveChunks(input: {
	query: string;
	vectorStore: RagVectorStore;
	topK: number;
}): Promise<RetrievedChunk[]> {
	const matches = await input.vectorStore.similaritySearchWithScore(input.query, input.topK);

	return matches.map(([document, score], index) => ({
		rank: index + 1,
		score,
		sourcePath: readRequiredMetadataString(document.metadata, "sourcePath"),
		chunkIndex: readRequiredMetadataNumber(document.metadata, "chunkIndex"),
		sectionTitle: readMetadataString(document.metadata, "sectionTitle"),
		chunkId: readMetadataString(document.metadata, "chunkId"),
		content: document.pageContent,
	}));
}

export function buildRagAnswerMessages(input: {
	query: string;
	retrievedChunks: RetrievedChunk[];
	maxChunkCharacters: number;
}): BaseMessageLike[] {
	return [
		{
			role: "system",
			content: [
				"You answer questions using only the provided RAG context.",
				"If the context does not contain enough evidence, set notEnoughEvidence=true and say what is missing.",
				"Every citation must exactly match a sourcePath and chunkIndex from the provided context.",
				"Do not invent citations, files, line numbers, APIs, or facts that are not in the context.",
			].join(" "),
		},
		{
			role: "user",
			content: JSON.stringify(
				{
					question: input.query,
					context: input.retrievedChunks.map((chunk) => ({
						citation: {
							sourcePath: chunk.sourcePath,
							chunkIndex: chunk.chunkIndex,
						},
						rank: chunk.rank,
						score: chunk.score,
						sectionTitle: chunk.sectionTitle,
						content: truncateText(chunk.content, input.maxChunkCharacters),
					})),
					requiredOutputShape: {
						answer: "string",
						citations: [
							{
								sourcePath: "string from context",
								chunkIndex: "number from context",
								quote: "optional short exact phrase from the cited chunk",
							},
						],
						notEnoughEvidence: "boolean",
					},
				},
				null,
				2,
			),
		},
	];
}

export function validateRagAnswer(rawAnswer: unknown, retrievedChunks: RetrievedChunk[]): RagAnswer {
	const answer = ragAnswerSchema.parse(rawAnswer);
	const allowedCitationKeys = new Set(retrievedChunks.map(createRetrievedChunkCitationKey));

	for (const citation of answer.citations) {
		if (!allowedCitationKeys.has(createCitationKey(citation))) {
			throw new Error(
				`RAG answer cited a chunk that was not retrieved: ${citation.sourcePath}#chunk-${citation.chunkIndex}.`,
			);
		}
	}

	if (!answer.notEnoughEvidence && answer.citations.length === 0) {
		throw new Error("RAG answer must include at least one citation when evidence is sufficient.");
	}

	return answer;
}

export function resolveRagAnswerOptions(
	options: Partial<RagAnswerOptions> = {},
): RagAnswerOptions {
	const resolvedOptions = {
		...defaultRagAnswerOptions,
		...options,
	};

	if (!Number.isInteger(resolvedOptions.topK) || resolvedOptions.topK <= 0) {
		throw new Error("topK must be a positive integer.");
	}

	if (!Number.isInteger(resolvedOptions.maxChunkCharacters) || resolvedOptions.maxChunkCharacters <= 0) {
		throw new Error("maxChunkCharacters must be a positive integer.");
	}

	return resolvedOptions;
}

function createRagAnswerEvent(
	stage: RagAnswerStage,
	startedAtMs: number,
	ok: boolean,
	details: {
		input?: Record<string, unknown>;
		output?: Record<string, unknown>;
		errorMessage?: string;
	} = {},
): RagAnswerEvent {
	return {
		stage,
		ok,
		startedAtIso: new Date(startedAtMs).toISOString(),
		latencyMs: Date.now() - startedAtMs,
		input: details.input,
		output: details.output,
		errorMessage: details.errorMessage,
	};
}

function summarizeRetrievedChunksForEvent(chunks: RetrievedChunk[]): Array<Record<string, unknown>> {
	return chunks.map((chunk) => ({
		rank: chunk.rank,
		score: chunk.score,
		sourcePath: chunk.sourcePath,
		chunkIndex: chunk.chunkIndex,
		sectionTitle: chunk.sectionTitle,
		chunkId: chunk.chunkId,
		contentPreview: truncateText(chunk.content.replace(/\s+/g, " ").trim(), 220),
	}));
}

function readErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function createStructuredRagModel(config: ModelConfig): StructuredRagRunnable {
	const model = createChatModel(config);

	return model.withStructuredOutput<RagAnswer>(ragAnswerSchema, {
		name: "RagAnswer",
		method: "functionCalling",
	});
}

function createRetrievedChunkCitationKey(chunk: RetrievedChunk): string {
	return `${chunk.sourcePath}#chunk-${chunk.chunkIndex}`;
}

function createCitationKey(citation: RagCitation): string {
	return `${citation.sourcePath}#chunk-${citation.chunkIndex}`;
}

function readRequiredMetadataString(metadata: Record<string, unknown>, key: string): string {
	const value = readMetadataString(metadata, key);
	if (!value) {
		throw new Error(`Retrieved chunk metadata is missing ${key}.`);
	}

	return value;
}

function readRequiredMetadataNumber(metadata: Record<string, unknown>, key: string): number {
	const value = readMetadataNumber(metadata, key);
	if (value === undefined) {
		throw new Error(`Retrieved chunk metadata is missing ${key}.`);
	}

	return value;
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
	const value = metadata[key];
	return typeof value === "string" ? value : undefined;
}

function readMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
	const value = metadata[key];
	return typeof value === "number" ? value : undefined;
}

function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) {
		return text;
	}

	return `${text.slice(0, maxLength)}...`;
}

async function main() {
	loadDotEnv({ quiet: true });
	loadDotEnv({ path: "phase4/.env", override: false, quiet: true });

	const cliOptions = readCliOptions(process.argv.slice(2));
	const options = {
		topK: cliOptions.topK ?? readPositiveIntegerEnv("PHASE4_RAG_TOP_K", defaultRagAnswerOptions.topK),
		maxChunkCharacters: cliOptions.maxChunkCharacters ?? readPositiveIntegerEnv(
			"PHASE4_RAG_MAX_CHUNK_CHARS",
			defaultRagAnswerOptions.maxChunkCharacters,
		),
	};
	const report = createRagRunReport({
		query: cliOptions.query,
		options,
	});
	const reportPath = resolveReportPath(report);
	let savedReportPath: string | undefined;
	let result: RagAnswerResult;

	try {
		result = await answerWithRag({
			query: cliOptions.query,
			options,
			onEvent: (event) => recordRagRunEvent(report, event),
		});
		finishRagRunReport(report, {
			ok: true,
			result,
		});
		savedReportPath = await saveReportIfEnabled(report, reportPath);
	} catch (error) {
		finishRagRunReport(report, {
			ok: false,
			errorMessage: readErrorMessage(error),
		});
		savedReportPath = await saveReportIfEnabled(report, reportPath);
		console.error("Run report summary:");
		console.error(JSON.stringify(summarizeRagRunReport(report), null, 2));
		if (savedReportPath) {
			console.error(`Report: ${savedReportPath}`);
		}
		throw error;
	}

	console.log(`Query: ${result.query}`);
	console.log(`Model: ${result.model.provider}:${result.model.model}`);
	console.log(`Embedding: ${result.embedding.provider}:${result.embedding.model}`);
	console.log(`Retrieved chunks: ${result.retrievedChunks.length}`);
	console.log(`Not enough evidence: ${result.notEnoughEvidence ? "yes" : "no"}`);
	console.log("");

	console.log("Answer:");
	console.log(result.answer);
	console.log("");

	console.log("Citations:");
	if (result.citations.length === 0) {
		console.log("- none");
	} else {
		for (const citation of result.citations) {
			const quote = citation.quote ? ` quote="${citation.quote}"` : "";
			console.log(`- ${citation.sourcePath}#chunk-${citation.chunkIndex}${quote}`);
		}
	}
	console.log("");

	console.log("Retrieved context:");
	for (const chunk of result.retrievedChunks) {
		console.log(
			`- #${chunk.rank} score=${chunk.score} ${chunk.sourcePath}#chunk-${chunk.chunkIndex}`,
		);
		if (chunk.sectionTitle) {
			console.log(`  section: ${chunk.sectionTitle}`);
		}
		console.log(`  preview: ${truncateText(chunk.content.replace(/\s+/g, " ").trim(), 220)}`);
	}
	console.log("");
	console.log("Run report summary:");
	console.log(JSON.stringify(summarizeRagRunReport(report), null, 2));
	if (savedReportPath) {
		console.log(`Report: ${savedReportPath}`);
	}
}

function readCliOptions(args: string[]): {
	query: string;
	topK?: number;
	maxChunkCharacters?: number;
} {
	const queryParts: string[] = [];
	let topK: number | undefined;
	let maxChunkCharacters: number | undefined;

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

		queryParts.push(arg);
	}

	const query = queryParts.join(" ").trim();
	if (!query) {
		throw new Error(
			`Usage: pnpm phase4:answer "your question" [--topK 4] [--maxChunkChars 1600]`,
		);
	}

	return {
		query,
		topK,
		maxChunkCharacters,
	};
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return fallback;
	}

	return parsePositiveIntegerOption(name, raw);
}

function resolveReportPath(report: RagRunReport): string | undefined {
	const reportDir = process.env.PHASE4_RAG_REPORT_DIR?.trim();
	if (reportDir === "off") {
		return undefined;
	}

	return createRagRunReportPath(report, reportDir || defaultRagRunReportDir);
}

async function saveReportIfEnabled(
	report: RagRunReport,
	reportPath: string | undefined,
): Promise<string | undefined> {
	if (!reportPath) {
		return undefined;
	}

	try {
		return await saveRagRunReport(report, reportPath);
	} catch (error) {
		console.error(`Save RAG run report failed: ${readErrorMessage(error)}`);
		return undefined;
	}
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
	console.error(`Phase4 RAG answer failed: ${message}`);
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
