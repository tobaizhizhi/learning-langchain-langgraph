import { describe, expect, it } from "vitest";

import {
	defaultPersonalOpsAgentLimits,
	loadPersonalOpsAgentLimits,
	readUsedToolNames,
} from "../src/personal-ops-agent.js";

describe("personal-ops-agent", () => {
	it("loads agent limits from env with safe defaults", () => {
		expect(loadPersonalOpsAgentLimits({})).toEqual(defaultPersonalOpsAgentLimits);

		expect(
			loadPersonalOpsAgentLimits({
				PHASE3_MODEL_CALL_LIMIT: "4",
				PHASE3_TOOL_CALL_LIMIT: "5",
				PHASE3_RECURSION_LIMIT: "9",
			}),
		).toEqual({
			modelCallRunLimit: 4,
			toolCallRunLimit: 5,
			recursionLimit: 9,
		});
	});

	it("rejects invalid agent limits", () => {
		expect(() =>
			loadPersonalOpsAgentLimits({
				PHASE3_MODEL_CALL_LIMIT: "0",
			}),
		).toThrow(/PHASE3_MODEL_CALL_LIMIT/);
	});

	it("deduplicates tool names used by agent messages", () => {
		const usedToolNames = readUsedToolNames({
			messages: [
				{
					index: 0,
					type: "human",
					text: "hello",
					toolCalls: [],
				},
				{
					index: 1,
					type: "ai",
					text: "",
					toolCalls: [
						{ name: "get_npm_package", args: { packageName: "@langchain/core" } },
						{ name: "get_npm_package_downloads", args: { packageName: "@langchain/core" } },
					],
				},
				{
					index: 2,
					type: "ai",
					text: "",
					toolCalls: [
						{ name: "get_npm_package", args: { packageName: "langchain" } },
						{ name: "extract-1", args: { answer: "structured output" } },
					],
				},
			],
		}, ["get_npm_package", "get_npm_package_downloads"]);

		expect(usedToolNames).toEqual(["get_npm_package", "get_npm_package_downloads"]);
	});
});
