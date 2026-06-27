import { Document } from "@langchain/core/documents";
import { config as loadDotEnv } from "dotenv";

import {
	type EmbeddingConfig,
	loadEmbeddingConfigFromEnv,
} from "./embedding-config.js";
import { createEmbeddingModel } from "./embedding-model.js";
import type { RagSourceMetadata } from "./source-config.js";
import {
	createQdrantVectorStore,
	loadQdrantConfigFromEnv,
	type QdrantConfig,
} from "./vector-store.js";

export type SearchVectorStore = {
	similaritySearchWithScore(
		query: string,
		k: number,
	): Promise<Array<[Document<RagSourceMetadata>, number]>>;
};

export type SearchOptions = {
	topK: number;
	previewCharacters: number;
};

export type SearchResultItem = {
	rank: number;
	score: number;
	sourcePath?: string;
	chunkIndex?: number;
	sectionTitle?: string;
	chunkId?: string;
	preview: string;
};

export type SearchResult = {
	query: string;
	embedding: {
		provider: EmbeddingConfig["provider"];
		model: string;
	};
	qdrant: {
		url: string;
		collectionName: string;
	};
	topK: number;
	results: SearchResultItem[];
};

export const defaultSearchOptions: SearchOptions = {
	topK: 4,
	previewCharacters: 260,
};

export async function searchPhase4Index(input: {
	query: string;
	vectorStore?: SearchVectorStore;
	embeddingConfig?: EmbeddingConfig;
	qdrantConfig?: QdrantConfig;
	options?: Partial<SearchOptions>;
}): Promise<SearchResult> {
	const query = input.query.trim();
	if (!query) {
		throw new Error("Search query is required.");
	}

	const options = resolveSearchOptions(input.options);
	const embeddingConfig = input.embeddingConfig ?? loadEmbeddingConfigFromEnv();
	const qdrantConfig = input.qdrantConfig ?? loadQdrantConfigFromEnv();
	const vectorStore = input.vectorStore ?? createQdrantVectorStore(
		createEmbeddingModel(embeddingConfig),
		qdrantConfig,
	);
	const matches = await vectorStore.similaritySearchWithScore(query, options.topK);

	return {
		query,
		embedding: {
			provider: embeddingConfig.provider,
			model: embeddingConfig.model,
		},
		qdrant: {
			url: qdrantConfig.url,
			collectionName: qdrantConfig.collectionName,
		},
		topK: options.topK,
		results: matches.map(([document, score], index) => ({
			rank: index + 1,
			score,
			sourcePath: readMetadataString(document.metadata, "sourcePath"),
			chunkIndex: readMetadataNumber(document.metadata, "chunkIndex"),
			sectionTitle: readMetadataString(document.metadata, "sectionTitle"),
			chunkId: readMetadataString(document.metadata, "chunkId"),
			preview: previewText(document.pageContent, options.previewCharacters),
		})),
	};
}

export function resolveSearchOptions(options: Partial<SearchOptions> = {}): SearchOptions {
	const resolvedOptions = {
		...defaultSearchOptions,
		...options,
	};

	if (!Number.isInteger(resolvedOptions.topK) || resolvedOptions.topK <= 0) {
		throw new Error("topK must be a positive integer.");
	}

	if (
		!Number.isInteger(resolvedOptions.previewCharacters) ||
		resolvedOptions.previewCharacters <= 0
	) {
		throw new Error("previewCharacters must be a positive integer.");
	}

	return resolvedOptions;
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | undefined {
	const value = metadata[key];
	return typeof value === "string" ? value : undefined;
}

function readMetadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
	const value = metadata[key];
	return typeof value === "number" ? value : undefined;
}

function previewText(text: string, maxLength: number): string {
	const compactText = text.replace(/\s+/g, " ").trim();

	if (compactText.length <= maxLength) {
		return compactText;
	}

	return `${compactText.slice(0, maxLength)}...`;
}

async function main() {
	loadDotEnv({ quiet: true });
	loadDotEnv({ path: "phase4/.env", override: false, quiet: true });

	const cliOptions = readCliOptions(process.argv.slice(2));
	const result = await searchPhase4Index({
		query: cliOptions.query,
		options: {
			topK: cliOptions.topK ?? readPositiveIntegerEnv("PHASE4_SEARCH_TOP_K", defaultSearchOptions.topK),
			previewCharacters: cliOptions.previewCharacters ?? readPositiveIntegerEnv(
				"PHASE4_SEARCH_PREVIEW_CHARS",
				defaultSearchOptions.previewCharacters,
			),
		},
	});

	console.log(`Query: ${result.query}`);
	console.log(`Embedding: ${result.embedding.provider}:${result.embedding.model}`);
	console.log(`Qdrant: ${result.qdrant.url}`);
	console.log(`Collection: ${result.qdrant.collectionName}`);
	console.log(`TopK: ${result.topK}`);
	console.log("");

	if (result.results.length === 0) {
		console.log("No results. Run `pnpm phase4:index` first, then retry the search.");
		return;
	}

	for (const item of result.results) {
		console.log(`#${item.rank} score=${item.score}`);
		console.log(`source: ${item.sourcePath ?? "unknown"}#chunk-${item.chunkIndex ?? "?"}`);
		if (item.sectionTitle) {
			console.log(`section: ${item.sectionTitle}`);
		}
		if (item.chunkId) {
			console.log(`chunkId: ${item.chunkId}`);
		}
		console.log(`preview: ${item.preview}`);
		console.log("");
	}
}

function readCliOptions(args: string[]): {
	query: string;
	topK?: number;
	previewCharacters?: number;
} {
	const queryParts: string[] = [];
	let topK: number | undefined;
	let previewCharacters: number | undefined;

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

		if (arg === "--preview" || arg === "--preview-chars") {
			previewCharacters = parsePositiveIntegerOption(arg, args[index + 1]);
			index += 1;
			continue;
		}

		if (arg.startsWith("--preview=") || arg.startsWith("--preview-chars=")) {
			previewCharacters = parsePositiveIntegerOption("--preview", arg.split("=", 2)[1]);
			continue;
		}

		queryParts.push(arg);
	}

	const query = queryParts.join(" ").trim();
	if (!query) {
		throw new Error(`Usage: pnpm phase4:search "your question" [--topK 4] [--preview 260]`);
	}

	return {
		query,
		topK,
		previewCharacters,
	};
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return fallback;
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
	console.error(`Phase4 search failed: ${message}`);
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
