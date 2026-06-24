import { describe, expect, it } from "vitest";

import {
	formatToolUseDecision,
	step1ToolUseCases,
} from "../src/tool-decision-examples.js";

describe("step1 external tool use decisions", () => {
	it("includes one direct-answer example", () => {
		expect(step1ToolUseCases).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					decision: expect.objectContaining({
						kind: "direct_answer",
					}),
				}),
			]),
		);
	});

	it("includes all first external tools as tool-call examples", () => {
		const toolNames = step1ToolUseCases
			.map((useCase) => useCase.decision)
			.filter((decision) => decision.kind === "tool_call")
			.map((decision) => decision.toolName);

		expect(toolNames).toEqual([
			"get_github_repository",
			"search_github_repositories",
			"get_npm_package",
		]);
	});

	it("formats decisions for CLI review", () => {
		expect(formatToolUseDecision(step1ToolUseCases[1])).toContain(
			"Decision: tool_call -> get_github_repository",
		);
	});
});
