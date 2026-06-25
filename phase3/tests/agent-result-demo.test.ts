import { describe, expect, it } from "vitest";

import {
	createAgentInvokeInput,
	inspectAgentInvokeResult,
} from "../src/agent-result-demo.js";

describe("agent-result-demo", () => {
	it("summarizes agent input, messages, tool calls, and structured response", () => {
		const input = createAgentInvokeInput("请查询 @langchain/core");
		const inspection = inspectAgentInvokeResult({
			provider: "openai",
			model: "gpt-test",
			userPrompt: "请查询 @langchain/core",
			availableTools: ["get_npm_package"],
			input,
			result: {
				messages: [
					{ type: "human", content: "请查询 @langchain/core" },
					{
						type: "ai",
						content: "",
						tool_calls: [
							{
								id: "call_1",
								name: "get_npm_package",
								args: { packageName: "@langchain/core" },
							},
						],
					},
					{
						type: "tool",
						name: "get_npm_package",
						tool_call_id: "call_1",
						content: '{"name":"@langchain/core","latestVersion":"1.2.1"}',
					},
					{
						type: "ai",
						content: "@langchain/core 最新版本是 1.2.1。",
					},
				],
				structuredResponse: {
					answer: "@langchain/core 最新版本是 1.2.1。",
				},
			},
		});

		expect(inspection.input).toEqual({
			messages: [{ role: "user", content: "请查询 @langchain/core" }],
		});
		expect(inspection.resultKeys).toEqual(["messages", "structuredResponse"]);
		expect(inspection.messageCount).toBe(4);
		expect(inspection.toolCallCount).toBe(1);
		expect(inspection.toolResultCount).toBe(1);
		expect(inspection.messages[1]?.toolCalls[0]).toEqual({
			id: "call_1",
			name: "get_npm_package",
			args: { packageName: "@langchain/core" },
		});
		expect(inspection.messages[2]?.toolName).toBe("get_npm_package");
		expect(inspection.messages[2]?.toolCallId).toBe("call_1");
		expect(inspection.finalText).toBe("@langchain/core 最新版本是 1.2.1。");
		expect(inspection.hasStructuredResponse).toBe(true);
		expect(inspection.structuredResponse).toEqual({
			answer: "@langchain/core 最新版本是 1.2.1。",
		});
	});
});
