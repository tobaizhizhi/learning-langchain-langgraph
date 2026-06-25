import { describe, expect, it } from "vitest";

import { createObservationMiddleware } from "../src/middleware.js";
import { createAgentRunReport } from "../src/run-report.js";

describe("observation middleware", () => {
	it("records model and tool events", async () => {
		const report = createAgentRunReport({
			provider: "openai",
			model: "gpt-test",
			userPrompt: "hello",
			now: () => new Date("2026-06-25T00:00:00.000Z"),
		});
		const middleware = createObservationMiddleware({
			report,
			now: () => new Date("2026-06-25T00:00:00.000Z"),
		});

		await middleware.wrapModelCall?.(
			{
				model: { model: "gpt-test" },
				messages: [{ content: "hello" }],
				systemPrompt: "",
				systemMessage: { content: "" } as never,
				tools: [{ name: "get_npm_package" } as never],
				state: { messages: [] } as never,
				runtime: {} as never,
			} as never,
			async () =>
				({
					text: "model response",
					tool_calls: [{ name: "get_npm_package" }],
				}) as never,
		);

		await middleware.wrapToolCall?.(
			{
				toolCall: { id: "call_1", name: "get_npm_package", args: { packageName: "@langchain/core" } },
				tool: { name: "get_npm_package" } as never,
				state: { messages: [] } as never,
				runtime: {} as never,
			} as never,
			async () => ({ content: "tool response" }) as never,
		);

		expect(report.events.map((event) => event.kind)).toEqual(["model", "tool"]);
		expect(report.events[0]).toMatchObject({
			kind: "model",
			name: "gpt-test",
			ok: true,
		});
		expect(report.events[1]).toMatchObject({
			kind: "tool",
			name: "get_npm_package",
			ok: true,
		});
	});
});
