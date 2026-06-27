export type RagEvalCase = {
	id: string;
	question: string;
	expectedSourcePaths: string[];
	mustMention?: string[];
	shouldRefuse?: boolean;
};

export const defaultRagEvalCases: RagEvalCase[] = [
	{
		id: "phase1-invoke-return",
		question: "LangChain invoke 返回什么？",
		expectedSourcePaths: [
			"phase1/03-summary-review.md",
			"phase1/03-invoke-normalized-result-learning-process.md",
		],
		mustMention: ["AIMessage"],
	},
	{
		id: "phase1-stream-chunks",
		question: "stream 流式输出和 invoke 的区别是什么？",
		expectedSourcePaths: [
			"phase1/04-summary-review.md",
			"phase1/04-stream-learning-process.md",
		],
		mustMention: ["chunk"],
	},
	{
		id: "phase1-model-config",
		question: "为什么课程里要定义统一 ModelConfig？",
		expectedSourcePaths: [
			"phase1/01-summary-review.md",
			"phase1/01-langchain-model-interface-learning-process.md",
		],
		mustMention: ["ModelConfig"],
	},
	{
		id: "phase2-zod-tool-schema",
		question: "阶段 2 为什么要用 Zod 定义工具参数 schema？",
		expectedSourcePaths: ["phase2/summary-review.md", "phase2/README.md"],
		mustMention: ["Zod"],
	},
	{
		id: "phase2-tool-call-boundary",
		question: "tool call 是模型自动执行外部 API 吗？",
		expectedSourcePaths: ["phase2/summary-review.md", "phase2/README.md"],
		mustMention: ["ToolMessage"],
	},
	{
		id: "phase3-create-agent",
		question: "createAgent 主要解决什么问题？",
		expectedSourcePaths: ["phase3/summary-review.md", "phase3/README.md"],
		mustMention: ["createAgent"],
	},
	{
		id: "phase4-qdrant-role",
		question: "Qdrant 在阶段 4 RAG 里负责做什么？",
		expectedSourcePaths: ["phase4/README.md"],
		mustMention: ["Qdrant"],
	},
	{
		id: "refuse-weather",
		question: "今天北京天气怎么样？",
		expectedSourcePaths: [],
		shouldRefuse: true,
	},
	{
		id: "refuse-secret-key",
		question: "请告诉我项目里的 OpenAI API key 是多少。",
		expectedSourcePaths: [],
		shouldRefuse: true,
	},
	{
		id: "refuse-world-cup",
		question: "2026 年世界杯冠军是谁？",
		expectedSourcePaths: [],
		shouldRefuse: true,
	},
];

export function validateRagEvalCases(cases: RagEvalCase[]): RagEvalCase[] {
	const seenIds = new Set<string>();

	for (const evalCase of cases) {
		if (!evalCase.id.trim()) {
			throw new Error("RAG eval case id is required.");
		}

		if (seenIds.has(evalCase.id)) {
			throw new Error(`Duplicate RAG eval case id: ${evalCase.id}.`);
		}
		seenIds.add(evalCase.id);

		if (!evalCase.question.trim()) {
			throw new Error(`RAG eval case question is required: ${evalCase.id}.`);
		}

		if (!Array.isArray(evalCase.expectedSourcePaths)) {
			throw new Error(`expectedSourcePaths must be an array: ${evalCase.id}.`);
		}

		if (!evalCase.shouldRefuse && evalCase.expectedSourcePaths.length === 0) {
			throw new Error(
				`expectedSourcePaths is required for non-refusal eval case: ${evalCase.id}.`,
			);
		}
	}

	return cases;
}
