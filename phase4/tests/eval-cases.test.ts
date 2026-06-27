import { describe, expect, it } from "vitest";

import {
	defaultRagEvalCases,
	type RagEvalCase,
	validateRagEvalCases,
} from "../src/eval-cases.js";

describe("phase4 RAG eval cases", () => {
	it("keeps a small default dataset with positive and refusal cases", () => {
		const cases = validateRagEvalCases(defaultRagEvalCases);
		const refusalCases = cases.filter((evalCase) => evalCase.shouldRefuse);

		expect(cases.length).toBeGreaterThanOrEqual(10);
		expect(refusalCases).toHaveLength(3);
		expect(cases.some((evalCase) => evalCase.mustMention?.includes("AIMessage"))).toBe(true);
	});

	it("rejects duplicate ids", () => {
		const evalCase = createCase({ id: "duplicate" });

		expect(() => validateRagEvalCases([evalCase, evalCase])).toThrow(/Duplicate/);
	});

	it("requires expected sources for non-refusal cases", () => {
		expect(() =>
			validateRagEvalCases([
				createCase({
					id: "missing-source",
					expectedSourcePaths: [],
				}),
			]),
		).toThrow(/expectedSourcePaths/);
	});

	it("allows refusal cases without expected sources", () => {
		expect(() =>
			validateRagEvalCases([
				createCase({
					id: "refuse",
					expectedSourcePaths: [],
					shouldRefuse: true,
				}),
			]),
		).not.toThrow();
	});
});

function createCase(overrides: Partial<RagEvalCase> = {}): RagEvalCase {
	return {
		id: "case-1",
		question: "LangChain invoke 返回什么？",
		expectedSourcePaths: ["phase1/03-summary-review.md"],
		...overrides,
	};
}
