import { Document } from "@langchain/core/documents";
import { MarkdownTextSplitter } from "@langchain/textsplitters";

import {
	loadPhase4Documents,
	type Phase4Document,
} from "./document-loader.js";
import type { RagSourceMetadata } from "./source-config.js";

export type Phase4Chunk = Document<RagSourceMetadata>;

export type SplitDocumentsOptions = {
	chunkSize: number;
	chunkOverlap: number;
};

export type ChunkSummary = {
	sourceDocumentCount: number;
	chunkCount: number;
	totalCharacters: number;
	averageChunkCharacters: number;
	longestChunkCharacters: number;
	byPhase: Record<string, number>;
	bySourcePath: Record<string, number>;
	samples: Array<{
		sourcePath: string;
		chunkIndex: number;
		characters: number;
		sectionTitle?: string;
		preview: string;
	}>;
};

export type ChunkSummaryOptions = {
	sampleCount: number;
	previewCharacters: number;
};

export const defaultSplitDocumentsOptions: SplitDocumentsOptions = {
	chunkSize: 1_000,
	chunkOverlap: 150,
};

export const defaultChunkSummaryOptions: ChunkSummaryOptions = {
	sampleCount: 5,
	previewCharacters: 180,
};

export async function splitPhase4Documents(
	documents: Phase4Document[],
	options: Partial<SplitDocumentsOptions> = {},
): Promise<Phase4Chunk[]> {
	const resolvedOptions = resolveSplitDocumentsOptions(options);
	const splitter = new MarkdownTextSplitter(resolvedOptions);
	const nestedChunks = await Promise.all(
		documents.map((document) => splitSingleDocument(document, splitter)),
	);

	return nestedChunks.flat();
}

export function summarizeDocumentChunks(
	sourceDocumentCount: number,
	chunks: Phase4Chunk[],
	options: Partial<ChunkSummaryOptions> = {},
): ChunkSummary {
	const resolvedOptions = {
		...defaultChunkSummaryOptions,
		...options,
	};
	const totalCharacters = chunks.reduce((total, chunk) => total + chunk.pageContent.length, 0);

	return {
		sourceDocumentCount,
		chunkCount: chunks.length,
		totalCharacters,
		averageChunkCharacters: chunks.length === 0 ? 0 : Math.round(totalCharacters / chunks.length),
		longestChunkCharacters: chunks.reduce(
			(longest, chunk) => Math.max(longest, chunk.pageContent.length),
			0,
		),
		byPhase: countBy(chunks, (chunk) => chunk.metadata.phase),
		bySourcePath: countBy(chunks, (chunk) => chunk.metadata.sourcePath),
		samples: chunks.slice(0, resolvedOptions.sampleCount).map((chunk) => ({
			sourcePath: chunk.metadata.sourcePath,
			chunkIndex: chunk.metadata.chunkIndex ?? 0,
			characters: chunk.pageContent.length,
			sectionTitle: chunk.metadata.sectionTitle,
			preview: previewText(chunk.pageContent, resolvedOptions.previewCharacters),
		})),
	};
}

export function resolveSplitDocumentsOptions(
	options: Partial<SplitDocumentsOptions> = {},
): SplitDocumentsOptions {
	const resolvedOptions = {
		...defaultSplitDocumentsOptions,
		...options,
	};

	if (!Number.isInteger(resolvedOptions.chunkSize) || resolvedOptions.chunkSize <= 0) {
		throw new Error("chunkSize must be a positive integer.");
	}

	if (!Number.isInteger(resolvedOptions.chunkOverlap) || resolvedOptions.chunkOverlap < 0) {
		throw new Error("chunkOverlap must be a non-negative integer.");
	}

	if (resolvedOptions.chunkOverlap >= resolvedOptions.chunkSize) {
		throw new Error("chunkOverlap must be smaller than chunkSize.");
	}

	return resolvedOptions;
}

async function splitSingleDocument(
	document: Phase4Document,
	splitter: MarkdownTextSplitter,
): Promise<Phase4Chunk[]> {
	const rawChunks = await splitter.splitDocuments([document]);
	let searchOffset = 0;

	return rawChunks.map((rawChunk, chunkIndex) => {
		const chunkId = `${document.metadata.sourceId}::chunk-${chunkIndex}`;
		const location = locateChunk(document.pageContent, rawChunk.pageContent, searchOffset);
		if (location.startOffset !== undefined) {
			searchOffset = location.startOffset + 1;
		}

		const section = location.startOffset === undefined
			? undefined
			: findNearestMarkdownHeading(document.pageContent, location.startOffset);

		return new Document<RagSourceMetadata>({
			id: chunkId,
			pageContent: rawChunk.pageContent,
			metadata: {
				...document.metadata,
				chunkId,
				chunkIndex,
				chunkStartLine: location.startLine,
				chunkEndLine: location.endLine,
				sectionTitle: section?.title,
				sectionLevel: section?.level,
				sectionPath: section ? [section.title] : undefined,
			},
		});
	});
}

function locateChunk(
	sourceText: string,
	chunkText: string,
	searchOffset: number,
): { startOffset?: number; startLine?: number; endLine?: number } {
	const trimmedChunk = chunkText.trim();
	if (!trimmedChunk) {
		return {};
	}

	const startOffset = sourceText.indexOf(trimmedChunk, searchOffset);
	if (startOffset === -1) {
		return {};
	}

	const endOffset = startOffset + trimmedChunk.length;

	return {
		startOffset,
		startLine: countLines(sourceText.slice(0, startOffset)) + 1,
		endLine: countLines(sourceText.slice(0, endOffset)) + 1,
	};
}

function findNearestMarkdownHeading(
	sourceText: string,
	offset: number,
): { title: string; level: number } | undefined {
	const lines = sourceText.slice(0, offset).split("\n");

	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const match = /^(#{1,6})\s+(.+)$/.exec(lines[index]?.trim() ?? "");
		if (match) {
			return {
				level: match[1].length,
				title: match[2].trim(),
			};
		}
	}

	return undefined;
}

function countLines(text: string): number {
	if (text.length === 0) {
		return 0;
	}

	return text.split("\n").length - 1;
}

function countBy(
	chunks: Phase4Chunk[],
	readKey: (chunk: Phase4Chunk) => string,
): Record<string, number> {
	return chunks.reduce<Record<string, number>>((counts, chunk) => {
		const key = readKey(chunk);
		counts[key] = (counts[key] ?? 0) + 1;

		return counts;
	}, {});
}

function previewText(text: string, maxLength: number): string {
	const compactText = text.replace(/\s+/g, " ").trim();

	if (compactText.length <= maxLength) {
		return compactText;
	}

	return `${compactText.slice(0, maxLength)}...`;
}

async function main() {
	const documents = await loadPhase4Documents();
	const chunks = await splitPhase4Documents(documents, {
		chunkSize: readPositiveIntegerEnv("PHASE4_CHUNK_SIZE", defaultSplitDocumentsOptions.chunkSize),
		chunkOverlap: readPositiveIntegerEnv(
			"PHASE4_CHUNK_OVERLAP",
			defaultSplitDocumentsOptions.chunkOverlap,
		),
	});
	const summary = summarizeDocumentChunks(documents.length, chunks, {
		sampleCount: readPositiveIntegerEnv(
			"PHASE4_CHUNK_SAMPLE_COUNT",
			defaultChunkSummaryOptions.sampleCount,
		),
		previewCharacters: readPositiveIntegerEnv(
			"PHASE4_CHUNK_PREVIEW_CHARS",
			defaultChunkSummaryOptions.previewCharacters,
		),
	});

	console.log(`Source documents: ${summary.sourceDocumentCount}`);
	console.log(`Chunks: ${summary.chunkCount}`);
	console.log(`Total chunk characters: ${summary.totalCharacters}`);
	console.log(`Average chunk characters: ${summary.averageChunkCharacters}`);
	console.log(`Longest chunk characters: ${summary.longestChunkCharacters}`);
	console.log("");

	console.log("By phase:");
	for (const [phase, count] of Object.entries(summary.byPhase)) {
		console.log(`- ${phase}: ${count}`);
	}
	console.log("");

	console.log("Sample chunks:");
	for (const sample of summary.samples) {
		console.log(`- ${sample.sourcePath}#chunk-${sample.chunkIndex} (${sample.characters} chars)`);
		if (sample.sectionTitle) {
			console.log(`  section: ${sample.sectionTitle}`);
		}
		console.log(`  preview: ${sample.preview}`);
	}
}

function readPositiveIntegerEnv(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) {
		return fallback;
	}

	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return value;
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 split documents failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
