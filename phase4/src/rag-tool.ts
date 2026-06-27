import { tool } from "@langchain/core/tools";
import { config as loadDotEnv } from "dotenv";
import { z } from "zod";

import {
	type EmbeddingConfig,
	loadEmbeddingConfigFromEnv,
} from "./embedding-config.js";
import { createEmbeddingModel } from "./embedding-model.js";
import {
	retrieveChunks,
	type RagVectorStore,
	type RetrievedChunk,
} from "./rag-answer-demo.js";
import {
	createQdrantVectorStore,
	loadQdrantConfigFromEnv,
	type QdrantConfig,
} from "./vector-store.js";

export const knowledgePhaseNames = ["docs", "phase1", "phase2", "phase3", "phase4"] as const;

export type KnowledgePhaseName = (typeof knowledgePhaseNames)[number];

export const courseKnowledgeSearchInputSchema = z.object({
	query: z.string().trim().min(1, "query is required."),
	topK: z.number().int().min(1).max(8).default(4),
	phaseFilter: z.enum(knowledgePhaseNames).optional(),
});

export type CourseKnowledgeSearchInput = z.infer<typeof courseKnowledgeSearchInputSchema>;

export type CourseKnowledgeSearchMatch = {
	rank: number;
	score: number;
	sourcePath: string;
	sourcePhase?: KnowledgePhaseName;
	chunkIndex: number;
	sectionTitle?: string;
	chunkId?: string;
	citationKey: string;
	contentPreview: string;
};

export type CourseKnowledgeSearchResult = {
	query: string;
	topK: number;
	phaseFilter?: KnowledgePhaseName;
	matchCount: number;
	notEnoughEvidence: boolean;
	matches: CourseKnowledgeSearchMatch[];
};

export type CourseKnowledgeSearchToolOptions = {
	vectorStore?: RagVectorStore;
	embeddingConfig?: EmbeddingConfig;
	qdrantConfig?: QdrantConfig;
	maxContentPreviewCharacters?: number;
};

const defaultMaxContentPreviewCharacters = 700;

export function createCourseKnowledgeSearchTool(
	options: CourseKnowledgeSearchToolOptions = {},
) {
	const vectorStore = options.vectorStore ?? createQdrantVectorStore(
		createEmbeddingModel(options.embeddingConfig ?? loadEmbeddingConfigFromEnv()),
		options.qdrantConfig ?? loadQdrantConfigFromEnv(),
	);
	const maxContentPreviewCharacters = options.maxContentPreviewCharacters ??
		defaultMaxContentPreviewCharacters;

	return tool(
		async (input): Promise<CourseKnowledgeSearchResult> => {
			const rawTopK = input.phaseFilter ? Math.min(input.topK * 3, 24) : input.topK;
			const chunks = await retrieveChunks({
				query: input.query,
				vectorStore,
				topK: rawTopK,
			});
			const filteredChunks = input.phaseFilter
				? chunks.filter((chunk) => inferKnowledgePhase(chunk.sourcePath) === input.phaseFilter)
				: chunks;
			const matches = filteredChunks.slice(0, input.topK).map((chunk, index) =>
				createSearchMatch(chunk, index + 1, maxContentPreviewCharacters),
			);

			return {
				query: input.query,
				topK: input.topK,
				phaseFilter: input.phaseFilter,
				matchCount: matches.length,
				notEnoughEvidence: matches.length === 0,
				matches,
			};
		},
		{
			name: "search_course_knowledge_base",
			description: [
				"Search the local course knowledge base in Qdrant.",
				"Use this read-only tool for questions about the LangChain/LangGraph learning phases, course code, RAG, tools, prompts, or agents.",
				"Return citations from sourcePath and chunkIndex; do not use it for weather, secrets, or live web facts.",
			].join(" "),
			schema: courseKnowledgeSearchInputSchema,
		},
	);
}

export function createPhase4RagToolList(options: CourseKnowledgeSearchToolOptions = {}) {
	return [createCourseKnowledgeSearchTool(options)];
}

export function inferKnowledgePhase(sourcePath: string): KnowledgePhaseName | undefined {
	const firstSegment = sourcePath.split("/")[0];

	return isKnowledgePhaseName(firstSegment) ? firstSegment : undefined;
}

function createSearchMatch(
	chunk: RetrievedChunk,
	rank: number,
	maxContentPreviewCharacters: number,
): CourseKnowledgeSearchMatch {
	return {
		rank,
		score: Number(chunk.score.toFixed(6)),
		sourcePath: chunk.sourcePath,
		sourcePhase: inferKnowledgePhase(chunk.sourcePath),
		chunkIndex: chunk.chunkIndex,
		sectionTitle: chunk.sectionTitle,
		chunkId: chunk.chunkId,
		citationKey: createCitationKey(chunk),
		contentPreview: truncateText(chunk.content.replace(/\s+/g, " ").trim(), maxContentPreviewCharacters),
	};
}

function createCitationKey(chunk: Pick<RetrievedChunk, "sourcePath" | "chunkIndex">): string {
	return `${chunk.sourcePath}#chunk-${chunk.chunkIndex}`;
}

function isKnowledgePhaseName(input: string | undefined): input is KnowledgePhaseName {
	return knowledgePhaseNames.includes(input as KnowledgePhaseName);
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
	const toolInstance = createCourseKnowledgeSearchTool();
	const result = await toolInstance.invoke({
		query: cliOptions.query,
		topK: cliOptions.topK,
		phaseFilter: cliOptions.phaseFilter,
	});

	console.log(JSON.stringify(result, null, 2));
}

function readCliOptions(args: string[]): CourseKnowledgeSearchInput {
	const queryParts: string[] = [];
	let topK = 4;
	let phaseFilter: KnowledgePhaseName | undefined;

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

		if (arg === "--phase") {
			phaseFilter = parseKnowledgePhaseOption(args[index + 1]);
			index += 1;
			continue;
		}

		if (arg.startsWith("--phase=")) {
			phaseFilter = parseKnowledgePhaseOption(arg.split("=", 2)[1]);
			continue;
		}

		queryParts.push(arg);
	}

	const query = queryParts.join(" ").trim();
	if (!query) {
		throw new Error('Query is required. Example: pnpm phase4:rag-tool "LangChain invoke 返回什么"');
	}

	return {
		query,
		topK,
		phaseFilter,
	};
}

function parsePositiveIntegerOption(name: string, raw: string | undefined): number {
	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return value;
}

function parseKnowledgePhaseOption(raw: string | undefined): KnowledgePhaseName {
	if (isKnowledgePhaseName(raw)) {
		return raw;
	}

	throw new Error(`--phase must be one of: ${knowledgePhaseNames.join(", ")}.`);
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 RAG tool demo failed: ${message}`);
	if (
		message.includes("6333") ||
		message.toLowerCase().includes("qdrant") ||
		message.toLowerCase().includes("fetch failed")
	) {
		console.error(`Qdrant checklist: run "docker ps" and "pnpm phase4:index", then retry.`);
	} else if (message.includes("11434") || message.includes("/api/")) {
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
