import { describe, expect, it } from "vitest";

import {
	createSourceMetadata,
	detectSourceLanguage,
	extractMarkdownTitle,
	inferSourcePhase,
	validateSourceMetadata,
} from "../src/source-config.js";

describe("phase4 source config", () => {
	it("extracts the first markdown h1 as title", () => {
		expect(extractMarkdownTitle("intro\n# 阶段 4 学习大纲\ncontent")).toBe(
			"阶段 4 学习大纲",
		);
	});

	it("detects document language", () => {
		expect(detectSourceLanguage("# Title\nOnly English text")).toBe("en");
		expect(detectSourceLanguage("# 标题\n只有中文内容")).toBe("zh");
		expect(detectSourceLanguage("# 标题 Title\n中文 and English")).toBe("mixed");
	});

	it("creates detailed metadata from source path and content", () => {
		const metadata = createSourceMetadata({
			sourcePath: "phase1/01-langchain-model-interface-learning-process.md",
			content: "# LangChain 模型接口学习过程\n正文",
		});

		expect(metadata).toMatchObject({
			sourcePath: "phase1/01-langchain-model-interface-learning-process.md",
			sourceName: "01-langchain-model-interface-learning-process.md",
			sourceKind: "learning-process",
			phase: "phase1",
			title: "LangChain 模型接口学习过程",
			topic: "model-interface",
			retrievalIntent: "implementation-guide",
			audience: "builder",
			sourcePriority: 3,
			format: "markdown",
			language: "mixed",
		});
		expect(metadata.sourceId).toMatch(/^phase1-01-langchain-model-interface-learning-process-/);
		expect(metadata.contentHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("classifies roadmap and summary documents", () => {
		expect(
			createSourceMetadata({
				sourcePath: "docs/langchain-langgraph-learning-roadmap.md",
				content: "# LangChain.js 与 LangGraph.js 学习路线图",
			}),
		).toMatchObject({
			sourceKind: "roadmap",
			phase: "docs",
			topic: "course-planning",
			retrievalIntent: "implementation-guide",
			sourcePriority: 1,
		});

		expect(
			createSourceMetadata({
				sourcePath: "phase3/summary-review.md",
				content: "# 阶段 3 总结与复习",
			}),
		).toMatchObject({
			sourceKind: "summary-review",
			topic: "agent-harness",
			retrievalIntent: "concept-review",
			audience: "learner",
			sourcePriority: 1,
		});
	});

	it("rejects unsupported phases and missing required metadata", () => {
		expect(() => inferSourcePhase("unknown/readme.md")).toThrow(/Unsupported source phase/);
		expect(() =>
			validateSourceMetadata({
				sourceId: "",
				sourcePath: "",
				sourceName: "missing.md",
				sourceKind: "reference-doc",
				phase: "docs",
				title: "Missing",
				format: "markdown",
				language: "mixed",
				topic: "course-planning",
				retrievalIntent: "implementation-guide",
				audience: "builder",
				sourcePriority: 3,
				contentHash: "abc",
			}),
		).toThrow(/sourceId/);
	});
});
