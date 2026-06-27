import { Embeddings } from "@langchain/core/embeddings";
import { OllamaEmbeddings } from "@langchain/ollama";
import { OpenAIEmbeddings } from "@langchain/openai";
import { config as loadDotEnv } from "dotenv";

import {
	type EmbeddingConfig,
	defaultEmbeddingConfig,
	loadEmbeddingConfigFromEnv,
} from "./embedding-config.js";

export type EmbeddingClient = Pick<Embeddings, "embedDocuments" | "embedQuery">;

export type EmbeddingSmokeResult = {
	provider: EmbeddingConfig["provider"];
	model: string;
	query: string;
	queryDimension: number;
	documentCount: number;
	documentDimensions: number[];
	queryVectorPreview: number[];
};

export function createEmbeddingModel(config: EmbeddingConfig): Embeddings {
	if (config.provider === "openai") {
		return new OpenAIEmbeddings({
			model: config.model,
			apiKey: config.apiKey,
			timeout: config.timeoutMs,
			maxRetries: config.maxRetries,
			batchSize: config.batchSize,
			dimensions: config.dimensions,
			configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
		});
	}

	if (config.provider === "ollama") {
		return new OllamaEmbeddings({
			model: config.model,
			baseUrl: config.baseUrl,
			maxRetries: config.maxRetries,
			dimensions: config.dimensions,
		});
	}

	throw new Error(`Unsupported embedding provider: ${String(config.provider)}`);
}

export async function runEmbeddingSmoke(input: {
	config?: EmbeddingConfig;
	embeddings?: EmbeddingClient;
	query?: string;
	documents?: string[];
} = {}): Promise<EmbeddingSmokeResult> {
	const config = input.config ?? loadEmbeddingConfigFromEnv();
	const embeddings = input.embeddings ?? createEmbeddingModel(config);
	const query = input.query ?? "LangChain invoke 是什么？";
	const documents = input.documents ?? [
		"LangChain invoke 用来对模型、链或 runnable 做一次调用。",
		"RAG 会先把文档切成 chunk，再用 embedding model 生成向量。",
	];

	const queryEmbedding = await embeddings.embedQuery(query);
	const documentEmbeddings = await embeddings.embedDocuments(documents);
	const documentDimensions = documentEmbeddings.map((embedding) => embedding.length);

	if (queryEmbedding.length === 0) {
		throw new Error("Embedding query returned an empty vector.");
	}

	if (documentDimensions.some((dimension) => dimension === 0)) {
		throw new Error("Embedding documents returned an empty vector.");
	}

	return {
		provider: config.provider,
		model: config.model,
		query,
		queryDimension: queryEmbedding.length,
		documentCount: documents.length,
		documentDimensions,
		queryVectorPreview: queryEmbedding.slice(0, 5).map((value) => Number(value.toFixed(6))),
	};
}

async function main() {
	loadDotEnv({ quiet: true });
	loadDotEnv({ path: "phase4/.env", override: false, quiet: true });

	const query = process.argv.slice(2).join(" ").trim() || undefined;
	const config = loadEmbeddingConfigFromEnv();
	const result = await runEmbeddingSmoke({ config, query });

	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log(`Query: ${result.query}`);
	console.log(`Query vector dimension: ${result.queryDimension}`);
	console.log(`Document vectors: ${result.documentCount}`);
	console.log(`Document dimensions: ${result.documentDimensions.join(", ")}`);
	console.log(`Query vector preview: [${result.queryVectorPreview.join(", ")}]`);
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 embedding smoke failed: ${message}`);

	const provider = process.env.EMBEDDING_PROVIDER?.trim() || defaultEmbeddingConfig.provider;
	if (provider === "ollama") {
		console.error(
			`Ollama checklist: run "ollama serve", then "ollama pull ${process.env.EMBEDDING_MODEL || defaultEmbeddingConfig.model}".`,
		);
	}

	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
