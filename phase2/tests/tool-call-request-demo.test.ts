import { describe, expect, it } from "vitest";

import { requestToolCall } from "../src/tool-call-request-demo.js";

describe("requestToolCall", () => {
	it("rejects mock config because Phase2 requires a real chat model", async () => {
		await expect(
			requestToolCall({
				config: {
					provider: "mock",
					model: "mock-chat",
					temperature: 0,
					timeoutMs: 30_000,
					maxRetries: 0,
				},
				userPrompt: "请搜索 phase2 课程文档。",
			}),
		).rejects.toThrow(/requires a real chat model/);
	});
});
