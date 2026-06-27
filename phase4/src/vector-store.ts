import { createHash } from "node:crypto";

import { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";
import { QdrantVectorStore } from "@langchain/qdrant";

import type { Phase4Chunk } from "./split-documents.js";
import type { RagSourceMetadata } from "./source-config.js";

export type QdrantConfig = {
	url: string;
	collectionName: string;
	apiKey?: string;
	resetCollection: boolean;
	indexBatchSize: number;
};

type EnvLike = Record<string, string | undefined>;

export const defaultQdrantConfig: QdrantConfig = {
	url: "http://localhost:6333",
	collectionName: "aiframe_phase4",
	resetCollection: false,
	indexBatchSize: 4,
};

export function loadQdrantConfigFromEnv(env: EnvLike = process.env): QdrantConfig {
	const candidate: QdrantConfig = {
		...defaultQdrantConfig,
		url: readOptionalString(env.QDRANT_URL) ?? defaultQdrantConfig.url,
		collectionName: readOptionalString(env.QDRANT_COLLECTION) ?? defaultQdrantConfig.collectionName,
		resetCollection: parseBooleanEnv(
			"QDRANT_RESET_COLLECTION",
			env.QDRANT_RESET_COLLECTION,
			defaultQdrantConfig.resetCollection,
		),
		indexBatchSize: parseIntegerEnv(
			"QDRANT_INDEX_BATCH_SIZE",
			env.QDRANT_INDEX_BATCH_SIZE,
			defaultQdrantConfig.indexBatchSize,
			{ min: 1 },
		),
	};

	const apiKey = readOptionalString(env.QDRANT_API_KEY);
	if (apiKey !== undefined) {
		candidate.apiKey = apiKey;
	}

	return validateQdrantConfig(candidate);
}

export function validateQdrantConfig(config: QdrantConfig): QdrantConfig {
	return {
		url: parseRequiredString("url", config.url),
		collectionName: parseRequiredString("collectionName", config.collectionName),
		apiKey:
			config.apiKey === undefined ? undefined : parseRequiredString("apiKey", config.apiKey),
		resetCollection: config.resetCollection,
		indexBatchSize: assertInteger("indexBatchSize", config.indexBatchSize, { min: 1 }),
	};
}

export function createQdrantVectorStore(
	embeddings: EmbeddingsInterface,
	config: QdrantConfig,
): QdrantVectorStore {
	return new QdrantVectorStore(embeddings, {
		url: config.url,
		apiKey: config.apiKey,
		collectionName: config.collectionName,
		contentPayloadKey: "content",
		metadataPayloadKey: "metadata",
	});
}

export async function qdrantCollectionExists(vectorStore: QdrantVectorStore): Promise<boolean> {
	const collections = await vectorStore.client.getCollections();

	return collections.collections.some((collection) => collection.name === vectorStore.collectionName);
}

export async function resetQdrantCollection(vectorStore: QdrantVectorStore): Promise<void> {
	if (await qdrantCollectionExists(vectorStore)) {
		await vectorStore.client.deleteCollection(vectorStore.collectionName);
	}
}

export function prepareChunksForQdrant(chunks: Phase4Chunk[]): Document<RagSourceMetadata>[] {
	return chunks.map((chunk) => {
		const chunkId = readChunkId(chunk);
		const qdrantPointId = createStableQdrantPointId(chunkId);

		return new Document<RagSourceMetadata>({
			id: qdrantPointId,
			pageContent: chunk.pageContent,
			metadata: {
				...chunk.metadata,
				chunkId,
				qdrantPointId,
			},
		});
	});
}

export function createStableQdrantPointId(input: string): string {
	const hex = createHash("sha256").update(input).digest("hex").slice(0, 32).split("");

	hex[12] = "4";
	hex[16] = ((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16);

	return [
		hex.slice(0, 8).join(""),
		hex.slice(8, 12).join(""),
		hex.slice(12, 16).join(""),
		hex.slice(16, 20).join(""),
		hex.slice(20, 32).join(""),
	].join("-");
}

function readChunkId(chunk: Phase4Chunk): string {
	if (chunk.metadata.chunkId) {
		return chunk.metadata.chunkId;
	}

	if (chunk.id) {
		return String(chunk.id);
	}

	return `${chunk.metadata.sourceId}::chunk-${chunk.metadata.chunkIndex ?? 0}`;
}

function parseRequiredString(name: string, input: string): string {
	const value = input.trim();
	if (!value) {
		throw new Error(`${name} is required.`);
	}

	return value;
}

function readOptionalString(input: string | undefined): string | undefined {
	const value = input?.trim();
	return value ? value : undefined;
}

function parseBooleanEnv(name: string, input: string | undefined, fallback: boolean): boolean {
	const value = readOptionalString(input);
	if (!value) {
		return fallback;
	}

	if (["1", "true", "yes", "on"].includes(value.toLowerCase())) {
		return true;
	}

	if (["0", "false", "no", "off"].includes(value.toLowerCase())) {
		return false;
	}

	throw new Error(`${name} must be a boolean.`);
}

function parseIntegerEnv(
	name: string,
	input: string | undefined,
	fallback: number,
	range: { min: number },
): number {
	const value = readOptionalString(input);
	if (!value) {
		return fallback;
	}

	return assertInteger(name, Number(value), range);
}

function assertInteger(name: string, value: number, range: { min: number }): number {
	if (!Number.isFinite(value)) {
		throw new Error(`${name} must be a finite number.`);
	}

	if (!Number.isInteger(value)) {
		throw new Error(`${name} must be an integer.`);
	}

	if (value < range.min) {
		throw new Error(`${name} must be greater than or equal to ${range.min}.`);
	}

	return value;
}
