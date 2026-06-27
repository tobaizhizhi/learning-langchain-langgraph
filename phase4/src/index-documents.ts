import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { config as loadDotEnv } from "dotenv";

import { loadPhase4Documents, type Phase4Document } from "./document-loader.js";
import {
	createEmbeddingModel,
} from "./embedding-model.js";
import {
	type EmbeddingConfig,
	loadEmbeddingConfigFromEnv,
} from "./embedding-config.js";
import {
	type Phase4Chunk,
	splitPhase4Documents,
	summarizeDocumentChunks,
} from "./split-documents.js";
import type { RagSourceMetadata } from "./source-config.js";
import {
	createQdrantVectorStore,
	loadQdrantConfigFromEnv,
	prepareChunksForQdrant,
	qdrantCollectionExists,
	resetQdrantCollection,
	type QdrantConfig,
} from "./vector-store.js";

export type IndexVectorStore = {
	addDocuments(documents: Document<RagSourceMetadata>[]): Promise<void>;
	similaritySearchWithScore(query: string, k: number): Promise<Array<[Document, number]>>;
};

export type IndexDocumentsResult = {
	embedding: {
		provider: EmbeddingConfig["provider"];
		model: string;
	};
	qdrant: {
		url: string;
		collectionName: string;
		collectionExisted: boolean;
		resetCollection: boolean;
		indexBatchSize: number;
	};
	sourceDocumentCount: number;
	chunkCount: number;
	indexedPointCount: number;
	durationMs: number;
	byPhase: Record<string, number>;
	verification?: {
		query: string;
		score: number;
		sourcePath?: string;
		chunkIndex?: number;
		sectionTitle?: string;
		preview: string;
	};
};

export type IndexProgressEvent = {
	batchIndex: number;
	batchCount: number;
	indexedPointCount: number;
	totalPointCount: number;
};

export async function indexPhase4Documents(input: {
	documents?: Phase4Document[];
	chunks?: Phase4Chunk[];
	embeddings?: EmbeddingsInterface;
	embeddingConfig?: EmbeddingConfig;
	qdrantConfig?: QdrantConfig;
	vectorStore?: IndexVectorStore;
	collectionExisted?: boolean;
	resetVectorStore?: () => Promise<void>;
	verificationQuery?: string;
	rootDir?: string;
	onProgress?: (event: IndexProgressEvent) => void;
} = {}): Promise<IndexDocumentsResult> {
	const startedAt = Date.now();
	const embeddingConfig = input.embeddingConfig ?? loadEmbeddingConfigFromEnv();
	const qdrantConfig = input.qdrantConfig ?? loadQdrantConfigFromEnv();
	const embeddings = input.embeddings ?? createEmbeddingModel(embeddingConfig);
	const documents = input.documents ?? await loadPhase4Documents(input.rootDir);
	const chunks = input.chunks ?? await splitPhase4Documents(documents);
	const chunkSummary = summarizeDocumentChunks(documents.length, chunks);
	const qdrantReadyChunks = prepareChunksForQdrant(chunks);
	const vectorStore = input.vectorStore ?? createQdrantVectorStore(embeddings, qdrantConfig);
	const collectionExisted = input.collectionExisted ?? await readCollectionExists(vectorStore);

	if (qdrantConfig.resetCollection) {
		if (input.resetVectorStore) {
			await input.resetVectorStore();
		} else {
			await resetQdrantVectorStore(vectorStore);
		}
	}

	const batches = chunkArray(qdrantReadyChunks, qdrantConfig.indexBatchSize);
	let indexedPointCount = 0;
	for (const [batchIndex, batch] of batches.entries()) {
		await vectorStore.addDocuments(batch);
		indexedPointCount += batch.length;
		input.onProgress?.({
			batchIndex: batchIndex + 1,
			batchCount: batches.length,
			indexedPointCount,
			totalPointCount: qdrantReadyChunks.length,
		});
	}

	const verification = await verifyIndexedMetadata(
		vectorStore,
		input.verificationQuery ?? "LangChain invoke 是什么",
	);

	return {
		embedding: {
			provider: embeddingConfig.provider,
			model: embeddingConfig.model,
		},
		qdrant: {
			url: qdrantConfig.url,
			collectionName: qdrantConfig.collectionName,
			collectionExisted,
			resetCollection: qdrantConfig.resetCollection,
			indexBatchSize: qdrantConfig.indexBatchSize,
		},
		sourceDocumentCount: documents.length,
		chunkCount: chunks.length,
		indexedPointCount,
		durationMs: Date.now() - startedAt,
		byPhase: chunkSummary.byPhase,
		verification,
	};
}

async function readCollectionExists(vectorStore: IndexVectorStore): Promise<boolean> {
	if ("client" in vectorStore && "collectionName" in vectorStore) {
		return qdrantCollectionExists(vectorStore as ReturnType<typeof createQdrantVectorStore>);
	}

	return false;
}

async function resetQdrantVectorStore(vectorStore: IndexVectorStore): Promise<void> {
	if ("client" in vectorStore && "collectionName" in vectorStore) {
		await resetQdrantCollection(vectorStore as ReturnType<typeof createQdrantVectorStore>);
		return;
	}

	throw new Error("resetCollection requires a Qdrant vector store or a custom resetVectorStore().");
}

async function verifyIndexedMetadata(
	vectorStore: IndexVectorStore,
	query: string,
): Promise<IndexDocumentsResult["verification"]> {
	const [bestMatch] = await vectorStore.similaritySearchWithScore(query, 1);
	if (!bestMatch) {
		return undefined;
	}

	const [document, score] = bestMatch;

	return {
		query,
		score,
		sourcePath: readMetadataString(document.metadata, "sourcePath"),
		chunkIndex: readMetadataNumber(document.metadata, "chunkIndex"),
		sectionTitle: readMetadataString(document.metadata, "sectionTitle"),
		preview: previewText(document.pageContent, 160),
	};
}

function chunkArray<T>(items: T[], batchSize: number): T[][] {
	const batches: T[][] = [];

	for (let index = 0; index < items.length; index += batchSize) {
		batches.push(items.slice(index, index + batchSize));
	}

	return batches;
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
	const baseQdrantConfig = loadQdrantConfigFromEnv();
	const qdrantConfig = {
		...baseQdrantConfig,
		resetCollection: cliOptions.resetCollection ?? baseQdrantConfig.resetCollection,
	};
	const result = await indexPhase4Documents({
		qdrantConfig,
		onProgress: (event) => {
			console.log(
				`Indexed batch ${event.batchIndex}/${event.batchCount}: ${event.indexedPointCount}/${event.totalPointCount} chunks`,
			);
		},
	});

	console.log(`Embedding: ${result.embedding.provider}:${result.embedding.model}`);
	console.log(`Qdrant: ${result.qdrant.url}`);
	console.log(`Collection: ${result.qdrant.collectionName}`);
	console.log(`Collection existed: ${result.qdrant.collectionExisted ? "yes" : "no"}`);
	console.log(`Reset collection: ${result.qdrant.resetCollection ? "yes" : "no"}`);
	console.log(`Source documents: ${result.sourceDocumentCount}`);
	console.log(`Chunks indexed: ${result.indexedPointCount}`);
	console.log(`Batch size: ${result.qdrant.indexBatchSize}`);
	console.log(`Duration: ${result.durationMs}ms`);
	console.log("");

	console.log("By phase:");
	for (const [phase, count] of Object.entries(result.byPhase)) {
		console.log(`- ${phase}: ${count}`);
	}

	if (result.verification) {
		console.log("");
		console.log("Verification search:");
		console.log(`- query: ${result.verification.query}`);
		console.log(`- score: ${result.verification.score}`);
		console.log(
			`- source: ${result.verification.sourcePath ?? "unknown"}#chunk-${result.verification.chunkIndex ?? "?"}`,
		);
		if (result.verification.sectionTitle) {
			console.log(`- section: ${result.verification.sectionTitle}`);
		}
		console.log(`- preview: ${result.verification.preview}`);
	}
}

function readCliOptions(args: string[]): { resetCollection?: boolean } {
	return {
		resetCollection: args.includes("--reset") ? true : undefined,
	};
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 index failed: ${message}`);
	if (message.includes("/tokenize") || message.includes("11434")) {
		console.error(`Ollama checklist: run "ollama ps" and "ollama list", then retry the index.`);
	} else if (message.includes("6333") || message.toLowerCase().includes("qdrant")) {
		console.error(
			`Qdrant checklist: run "docker run -d --name aiframe-qdrant -p 6333:6333 qdrant/qdrant", then try again.`,
		);
	} else {
		console.error(`Check both services: "curl http://localhost:11434/api/tags" and "curl http://localhost:6333/collections".`);
	}
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
