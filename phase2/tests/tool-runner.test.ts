import { describe, expect, it } from "vitest";

import {
	createToolRegistry,
	executeToolCall,
	executeToolCalls,
	ToolExecutionError,
	type RunnableTool,
} from "../src/tool-runner.js";

describe("tool-runner", () => {
	it("executes a tool call and wraps the output in a ToolMessage", async () => {
		const registry = createToolRegistry([
			createFakeTool("get_example", async (input) => ({ ok: true, input })),
		]);

		const result = await executeToolCall(
			{
				type: "tool_call",
				id: "call_1",
				name: "get_example",
				args: { value: 123 },
			},
			registry,
		);

		expect(result.output).toEqual({ ok: true, input: { value: 123 } });
		expect(result.toolMessage.name).toBe("get_example");
		expect(result.toolMessage.tool_call_id).toBe("call_1");
		expect(result.toolMessage.status).toBe("success");
		expect(result.toolMessage.text).toContain('"ok": true');
		expect(result.log).toMatchObject({
			toolName: "get_example",
			toolCallId: "call_1",
			argsPreview: { value: 123 },
			ok: true,
		});
		expect(result.log.latencyMs).toBeGreaterThanOrEqual(0);
	});

	it("executes multiple tool calls in order", async () => {
		const registry = createToolRegistry([
			createFakeTool("first_tool", async () => "first result"),
			createFakeTool("second_tool", async () => "second result"),
		]);

		const results = await executeToolCalls(
			[
				{ type: "tool_call", id: "call_1", name: "first_tool", args: {} },
				{ type: "tool_call", id: "call_2", name: "second_tool", args: {} },
			],
			registry,
		);

		expect(results.map((result) => result.toolMessage.text)).toEqual([
			"first result",
			"second result",
		]);
	});

	it("rejects unknown tool names", async () => {
		const registry = createToolRegistry([]);

		await expect(
			executeToolCall(
				{ type: "tool_call", id: "call_1", name: "missing_tool", args: {} },
				registry,
			),
		).rejects.toThrow(/Unknown tool "missing_tool"/);
	});

	it("attaches a run log to unknown tool errors", async () => {
		const registry = createToolRegistry([]);

		try {
			await executeToolCall(
				{ type: "tool_call", id: "call_1", name: "missing_tool", args: { query: "x" } },
				registry,
			);
			throw new Error("Expected executeToolCall to fail.");
		} catch (error: unknown) {
			expect(error).toBeInstanceOf(ToolExecutionError);
			const toolError = error as ToolExecutionError;
			expect(toolError.log).toMatchObject({
				toolName: "missing_tool",
				toolCallId: "call_1",
				argsPreview: { query: "x" },
				ok: false,
				errorMessage: 'Unknown tool "missing_tool".',
			});
		}
	});

	it("rejects tool calls without id because ToolMessage needs tool_call_id", async () => {
		const registry = createToolRegistry([createFakeTool("get_example", async () => "ok")]);

		await expect(
			executeToolCall({ type: "tool_call", name: "get_example", args: {} }, registry),
		).rejects.toThrow(/missing id/);
	});

	it("does not hide tool execution errors", async () => {
		const registry = createToolRegistry([
			createFakeTool("failing_tool", async () => {
				throw new Error("external API failed");
			}),
		]);

		await expect(
			executeToolCall(
				{ type: "tool_call", id: "call_1", name: "failing_tool", args: {} },
				registry,
			),
		).rejects.toThrow(/external API failed/);
	});

	it("rejects duplicate tool names", () => {
		expect(() =>
			createToolRegistry([
				createFakeTool("duplicate_tool", async () => "one"),
				createFakeTool("duplicate_tool", async () => "two"),
			]),
		).toThrow(/Duplicate tool name "duplicate_tool"/);
	});
});

function createFakeTool(name: string, invoke: (input: unknown) => Promise<unknown>): RunnableTool {
	return {
		name,
		invoke,
	};
}
