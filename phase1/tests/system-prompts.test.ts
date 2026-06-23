import { describe, expect, it } from "vitest";

import {
	getSystemPrompt,
	loadSystemPromptFromEnv,
	parseSystemPromptName,
	systemPromptNames,
} from "../src/system-prompts.js";

describe("system prompts", () => {
	it("defines stable reusable system prompt names", () => {
		expect(systemPromptNames).toEqual(["study", "solidity-security"]);
	});

	it("loads the default study system prompt", () => {
		expect(getSystemPrompt()).toContain("AI 工程学习助手");
		expect(getSystemPrompt()).toContain("不要编造");
	});

	it("loads the solidity security system prompt", () => {
		expect(getSystemPrompt("solidity-security")).toContain("Solidity 安全学习助手");
		expect(getSystemPrompt("solidity-security")).toContain("风险");
		expect(getSystemPrompt("solidity-security")).toContain("证据");
	});

	it("allows SYSTEM_PROMPT to override named prompts", () => {
		expect(
			loadSystemPromptFromEnv({
				SYSTEM_PROMPT: "自定义 system prompt",
				SYSTEM_PROMPT_NAME: "solidity-security",
			}),
		).toBe("自定义 system prompt");
	});

	it("loads a named system prompt from env", () => {
		expect(
			loadSystemPromptFromEnv({
				SYSTEM_PROMPT_NAME: "solidity-security",
			}),
		).toBe(getSystemPrompt("solidity-security"));
	});

	it("throws for unsupported system prompt names", () => {
		expect(() => parseSystemPromptName("audit")).toThrow(/Unsupported system prompt/);
	});
});
