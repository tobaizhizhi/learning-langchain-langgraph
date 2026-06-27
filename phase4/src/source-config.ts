import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export type SourcePhase = "docs" | "phase1" | "phase2" | "phase3" | "phase4";

export type SourceKind =
	| "course-rule"
	| "learning-process"
	| "phase-readme"
	| "portfolio-plan"
	| "prompt-notes"
	| "reference-doc"
	| "roadmap"
	| "summary-review";

export type SourceTopic =
	| "agent-harness"
	| "course-planning"
	| "invoke"
	| "messages-prompts"
	| "model-interface"
	| "portfolio"
	| "rag"
	| "stream"
	| "structured-output"
	| "tool-calling";

export type RetrievalIntent =
	| "concept-review"
	| "decision-rule"
	| "implementation-guide"
	| "project-plan";

export type SourceAudience = "builder" | "learner" | "portfolio-reviewer";
export type SourceLanguage = "zh" | "en" | "mixed";
export type SourcePriority = 1 | 2 | 3;

export type RagSourceMetadata = {
	sourceId: string;
	sourcePath: string;
	sourceName: string;
	sourceKind: SourceKind;
	phase: SourcePhase;
	title: string;
	format: "markdown";
	language: SourceLanguage;
	topic: SourceTopic;
	retrievalIntent: RetrievalIntent;
	audience: SourceAudience;
	sourcePriority: SourcePriority;
	contentHash: string;
	sectionTitle?: string;
	sectionLevel?: number;
	sectionPath?: string[];
	chunkId?: string;
	chunkIndex?: number;
	chunkStartLine?: number;
	chunkEndLine?: number;
	qdrantPointId?: string;
};

export type SourceFileConfig = {
	sourcePath: string;
	metadata: RagSourceMetadata;
};

const SOURCE_DIRECTORIES: SourcePhase[] = ["docs", "phase1", "phase2", "phase3", "phase4"];

export async function listCandidateSourcePaths(rootDir = process.cwd()): Promise<string[]> {
	const sourceGroups = await Promise.all(
		SOURCE_DIRECTORIES.map((directory) => listTopLevelMarkdownFiles(rootDir, directory)),
	);

	return sourceGroups
		.flat()
		.filter(isIndexableSourcePath)
		.sort((left, right) => left.localeCompare(right));
}

export async function buildSourceFileConfigs(rootDir = process.cwd()): Promise<SourceFileConfig[]> {
	const sourcePaths = await listCandidateSourcePaths(rootDir);

	return Promise.all(
		sourcePaths.map(async (sourcePath) => {
			const content = await readFile(path.join(rootDir, sourcePath), "utf8");

			return {
				sourcePath,
				metadata: createSourceMetadata({
					sourcePath,
					content,
				}),
			};
		}),
	);
}

export function createSourceMetadata(input: {
	sourcePath: string;
	content: string;
}): RagSourceMetadata {
	const sourcePath = normalizeSourcePath(input.sourcePath);
	const sourceName = path.posix.basename(sourcePath);
	const sourceKind = inferSourceKind(sourcePath);
	const title = extractMarkdownTitle(input.content) ?? sourceName;

	return validateSourceMetadata({
		sourceId: createSourceId(sourcePath),
		sourcePath,
		sourceName,
		sourceKind,
		phase: inferSourcePhase(sourcePath),
		title,
		format: "markdown",
		language: detectSourceLanguage(input.content),
		topic: inferSourceTopic(sourcePath, sourceKind),
		retrievalIntent: inferRetrievalIntent(sourceKind),
		audience: inferSourceAudience(sourceKind),
		sourcePriority: inferSourcePriority(sourceKind),
		contentHash: hashContent(input.content),
	});
}

export function validateSourceMetadata(metadata: RagSourceMetadata): RagSourceMetadata {
	if (!metadata.sourceId.trim()) {
		throw new Error("metadata.sourceId is required.");
	}

	if (!metadata.sourcePath.trim()) {
		throw new Error("metadata.sourcePath is required.");
	}

	if (!metadata.title.trim()) {
		throw new Error(`metadata.title is required for ${metadata.sourcePath}.`);
	}

	if (!metadata.contentHash.trim()) {
		throw new Error(`metadata.contentHash is required for ${metadata.sourcePath}.`);
	}

	return metadata;
}

export function extractMarkdownTitle(content: string): string | undefined {
	const heading = content
		.split(/\r?\n/)
		.find((line) => /^#\s+\S/.test(line.trim()));

	return heading?.trim().replace(/^#\s+/, "").trim();
}

export function detectSourceLanguage(content: string): SourceLanguage {
	const chineseCount = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
	const latinCount = content.match(/[A-Za-z]/g)?.length ?? 0;

	if (chineseCount > 0 && latinCount > 0) {
		return "mixed";
	}

	return chineseCount > 0 ? "zh" : "en";
}

export function inferSourcePhase(sourcePath: string): SourcePhase {
	const firstPart = normalizeSourcePath(sourcePath).split("/")[0];

	if (isSourcePhase(firstPart)) {
		return firstPart;
	}

	throw new Error(`Unsupported source phase for path: ${sourcePath}`);
}

export function inferSourceKind(sourcePath: string): SourceKind {
	const normalized = normalizeSourcePath(sourcePath);
	const fileName = path.posix.basename(normalized);

	if (normalized === "docs/course-outline-rules.md") {
		return "course-rule";
	}

	if (normalized === "docs/langchain-langgraph-learning-roadmap.md") {
		return "roadmap";
	}

	if (normalized.startsWith("docs/portfolio-")) {
		return "portfolio-plan";
	}

	if (normalized === "docs/自用提示词.md") {
		return "prompt-notes";
	}

	if (fileName === "README.md") {
		return "phase-readme";
	}

	if (fileName.includes("summary-review")) {
		return "summary-review";
	}

	if (/^\d{2}-.+learning-process\.md$/.test(fileName)) {
		return "learning-process";
	}

	return "reference-doc";
}

export function inferSourceTopic(sourcePath: string, sourceKind = inferSourceKind(sourcePath)): SourceTopic {
	const normalized = normalizeSourcePath(sourcePath);

	if (sourceKind === "portfolio-plan") {
		return "portfolio";
	}

	if (sourceKind === "course-rule" || sourceKind === "roadmap" || sourceKind === "phase-readme") {
		return "course-planning";
	}

	if (normalized.includes("model-interface")) {
		return "model-interface";
	}

	if (normalized.includes("messages-prompt")) {
		return "messages-prompts";
	}

	if (normalized.includes("invoke")) {
		return "invoke";
	}

	if (normalized.includes("stream")) {
		return "stream";
	}

	if (normalized.startsWith("phase2/")) {
		return normalized.includes("structured") ? "structured-output" : "tool-calling";
	}

	if (normalized.startsWith("phase3/")) {
		return "agent-harness";
	}

	if (normalized.startsWith("phase4/")) {
		return "rag";
	}

	return "course-planning";
}

function inferRetrievalIntent(sourceKind: SourceKind): RetrievalIntent {
	if (sourceKind === "course-rule") {
		return "decision-rule";
	}

	if (sourceKind === "portfolio-plan") {
		return "project-plan";
	}

	if (sourceKind === "summary-review") {
		return "concept-review";
	}

	return "implementation-guide";
}

function inferSourceAudience(sourceKind: SourceKind): SourceAudience {
	if (sourceKind === "portfolio-plan") {
		return "portfolio-reviewer";
	}

	return sourceKind === "summary-review" ? "learner" : "builder";
}

function inferSourcePriority(sourceKind: SourceKind): SourcePriority {
	if (sourceKind === "course-rule" || sourceKind === "roadmap" || sourceKind === "summary-review") {
		return 1;
	}

	if (sourceKind === "phase-readme" || sourceKind === "portfolio-plan") {
		return 2;
	}

	return 3;
}

function isIndexableSourcePath(sourcePath: string): boolean {
	return sourcePath.endsWith(".md") && !sourcePath.includes("/src/") && !sourcePath.includes("/tests/");
}

async function listTopLevelMarkdownFiles(rootDir: string, sourcePhase: SourcePhase): Promise<string[]> {
	const directoryPath = path.join(rootDir, sourcePhase);
	const entries = await readdir(directoryPath, { withFileTypes: true }).catch(() => []);

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => `${sourcePhase}/${entry.name}`);
}

function createSourceId(sourcePath: string): string {
	const asciiSlug = normalizeSourcePath(sourcePath)
		.replace(/\.md$/, "")
		.replace(/[^a-zA-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	const hashSuffix = hashContent(sourcePath).slice(0, 8);

	return `${asciiSlug || "source"}-${hashSuffix}`;
}

function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function normalizeSourcePath(sourcePath: string): string {
	return sourcePath.split(path.sep).join("/").replace(/^\.\//, "");
}

function isSourcePhase(value: string | undefined): value is SourcePhase {
	return value !== undefined && SOURCE_DIRECTORIES.includes(value as SourcePhase);
}

async function main() {
	const sources = await buildSourceFileConfigs();

	console.log(`Phase4 source files: ${sources.length}`);
	console.log("");
	for (const source of sources) {
		const metadata = source.metadata;
		console.log(
			`- [${metadata.phase}/${metadata.topic}/${metadata.sourceKind}] ${metadata.sourcePath}`,
		);
		console.log(`  title: ${metadata.title}`);
		console.log(`  intent: ${metadata.retrievalIntent}, priority: ${metadata.sourcePriority}`);
	}
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase4 source config failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
