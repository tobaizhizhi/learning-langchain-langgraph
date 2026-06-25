import { describe, expect, it } from "vitest";

import {
	createAgentRunReport,
	finishAgentRunReport,
	recordAgentRunEvent,
	summarizeAgentRunReport,
} from "../src/run-report.js";

describe("run-report", () => {
	it("records events and builds a compact summary", () => {
		const report = createAgentRunReport({
			provider: "openai",
			model: "gpt-test",
			userPrompt: "hello",
			now: () => new Date("2026-06-25T00:00:00.000Z"),
		});

		recordAgentRunEvent(report, {
			kind: "model",
			name: "gpt-test",
			ok: true,
			startedAtIso: "2026-06-25T00:00:01.000Z",
			latencyMs: 123,
		});
		recordAgentRunEvent(report, {
			kind: "tool",
			name: "get_npm_package",
			ok: false,
			startedAtIso: "2026-06-25T00:00:02.000Z",
			latencyMs: 50,
			errorMessage: "network failed",
		});
		finishAgentRunReport(report, {
			ok: false,
			errorMessage: "network failed",
			messageCount: 2,
			toolCallCount: 1,
			toolResultCount: 0,
			now: () => new Date("2026-06-25T00:00:03.000Z"),
		});

		expect(report.provider).toBe("openai");
		expect(report.endedAtIso).toBe("2026-06-25T00:00:03.000Z");
		expect(report.events).toHaveLength(2);
		expect(summarizeAgentRunReport(report)).toMatchObject({
			ok: false,
			provider: "openai",
			model: "gpt-test",
			messageCount: 2,
			modelCallCount: 1,
			toolCallCount: 1,
			failedEventCount: 1,
		});
	});
});
