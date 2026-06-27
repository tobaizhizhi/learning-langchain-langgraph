import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document } from "@langchain/core/documents";

import {
	buildSourceFileConfigs,
	type RagSourceMetadata,
	type SourceFileConfig,
} from "./source-config.js";

export type Phase4Document = Document<RagSourceMetadata>;

export type LoadedDocumentSummary = {
	documentCount: number;
	totalCharacters: number;
	byPhase: Record<string, number>;
	bySourceKind: Record<string, number>;
	documents: Array<{
		sourcePath: string;
		title: string;
		characters: number;
		phase: string;
		sourceKind: string;
		topic: string;
	}>;
};

export async function loadPhase4Documents(rootDir = process.cwd()): Promise<Phase4Document[]> {
	const sources = await buildSourceFileConfigs(rootDir);

	return Promise.all(sources.map((source) => loadPhase4Document(source, rootDir)));
}

export async function loadPhase4Document(
	source: SourceFileConfig,
	rootDir = process.cwd(),
): Promise<Phase4Document> {
	const absolutePath = path.join(rootDir, source.sourcePath);
	const pageContent = normalizePageContent(await readFile(absolutePath, "utf8"));

	if (!pageContent.trim()) {
		throw new Error(`Document content is empty: ${source.sourcePath}`);
	}

	return new Document<RagSourceMetadata>({
		id: source.metadata.sourceId,
		pageContent,
		metadata: source.metadata,
	});
}

export function summarizeLoadedDocuments(documents: Phase4Document[]): LoadedDocumentSummary {
	return {
		documentCount: documents.length,
		totalCharacters: documents.reduce((total, document) => total + document.pageContent.length, 0),
		byPhase: countBy(documents, (document) => document.metadata.phase),
		bySourceKind: countBy(documents, (document) => document.metadata.sourceKind),
		documents: documents.map((document) => ({
			sourcePath: document.metadata.sourcePath,
			title: document.metadata.title,
			characters: document.pageContent.length,
			phase: document.metadata.phase,
			sourceKind: document.metadata.sourceKind,
			topic: document.metadata.topic,
		})),
	};
}

function normalizePageContent(content: string): string {
	return content.replace(/\r\n/g, "\n");
}

function countBy(
	documents: Phase4Document[],
	readKey: (document: Phase4Document) => string,
): Record<string, number> {
	return documents.reduce<Record<string, number>>((counts, document) => {
		const key = readKey(document);
		counts[key] = (counts[key] ?? 0) + 1;

		return counts;
	}, {});
}

async function main() {
	const documents = await loadPhase4Documents();
	const summary = summarizeLoadedDocuments(documents);

	console.log(`Phase4 loaded documents: ${summary.documentCount}`);
	console.log(`Total characters: ${summary.totalCharacters}`);
	console.log("");

	console.log("By phase:");
	for (const [phase, count] of Object.entries(summary.byPhase)) {
		console.log(`- ${phase}: ${count}`);
	}
	console.log("");

	console.log("Documents:");
	for (const document of summary.documents) {
		console.log(
			`- [${document.phase}/${document.topic}/${document.sourceKind}] ${document.sourcePath}`,
		);
		console.log(`  title: ${document.title}`);
		console.log(`  characters: ${document.characters}`);
	}
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 document loader failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
