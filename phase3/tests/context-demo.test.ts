import { describe, expect, it } from "vitest";

import {
	countApproxTokens,
	createDemoConversationMessages,
	prepareShortTermContext,
} from "../src/context-demo.js";

describe("context-demo", () => {
	it("compresses long tool results before trimming messages", async () => {
		const result = await prepareShortTermContext(
			createDemoConversationMessages("现在请查询 @langchain/core 最近一周下载量。"),
			{
				maxApproxTokens: 1_200,
				maxToolResultChars: 120,
			},
		);

		expect(result.compressedToolResultCount).toBeGreaterThan(0);
		expect(result.preparedMessages.some((message) => message.text.includes("truncated"))).toBe(
			true,
		);
	});

	it("keeps system guidance and the latest user message while dropping older context", async () => {
		const result = await prepareShortTermContext(
			createDemoConversationMessages("现在只需要告诉我 UTC 当前时间。"),
			{
				maxApproxTokens: 180,
				maxToolResultChars: 120,
			},
		);

		expect(result.preparedMessageCount).toBeLessThan(result.originalMessageCount);
		expect(result.preparedSummary[0]?.type).toBe("system");
		expect(result.preparedSummary.at(-1)).toMatchObject({
			type: "human",
			textPreview: "现在只需要告诉我 UTC 当前时间。",
		});
		expect(countApproxTokens(result.preparedMessages)).toBeLessThanOrEqual(180);
	});
});
