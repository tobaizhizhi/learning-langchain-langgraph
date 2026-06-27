import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	loadPhase4Document,
	loadPhase4Documents,
	summarizeLoadedDocuments,
} from "../src/document-loader.js";
import { createSourceMetadata } from "../src/source-config.js";

describe("phase4 document loader", () => {
	let rootDir: string;

	beforeEach(async () => {
		rootDir = await mkdtemp(path.join(tmpdir(), "aiframe-phase4-"));
		await mkdir(path.join(rootDir, "docs"), { recursive: true });
		await mkdir(path.join(rootDir, "phase1"), { recursive: true });
	});

	afterEach(async () => {
		await rm(rootDir, { recursive: true, force: true });
	});

	it("loads real markdown files into LangChain Documents", async () => {
		await writeFile(
			path.join(rootDir, "docs", "course-outline-rules.md"),
			"# 课程大纲生成规则\n\n规则正文",
			"utf8",
		);
		await writeFile(
			path.join(rootDir, "phase1", "README.md"),
			"# 阶段 1 学习大纲\n\n阶段正文",
			"utf8",
		);

		const documents = await loadPhase4Documents(rootDir);
		const summary = summarizeLoadedDocuments(documents);

		expect(documents).toHaveLength(2);
		expect(documents[0]?.pageContent).toContain("# 课程大纲生成规则");
		expect(documents[0]?.metadata.sourcePath).toBe("docs/course-outline-rules.md");
		expect(documents[0]?.metadata.title).toBe("课程大纲生成规则");
		expect(documents[0]?.id).toBe(documents[0]?.metadata.sourceId);
		expect(summary).toMatchObject({
			documentCount: 2,
			byPhase: {
				docs: 1,
				phase1: 1,
			},
		});
	});

	it("rejects empty document content", async () => {
		const sourcePath = "docs/empty.md";
		await writeFile(path.join(rootDir, "docs", "empty.md"), "   ", "utf8");

		await expect(
			loadPhase4Document(
				{
					sourcePath,
					metadata: createSourceMetadata({
						sourcePath,
						content: "   ",
					}),
				},
				rootDir,
			),
		).rejects.toThrow(/Document content is empty/);
	});
});
