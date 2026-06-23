import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createTextPreview, readRecentModelRunLogs } from "../src/model-run-log.js";
import { runSinglePrompt } from "../src/run-single-prompt.js";

async function createTempLogPath() {
	const directory = await mkdtemp(join(tmpdir(), "phase1-model-runs-"));
	return join(directory, "model-runs.jsonl");
}

describe("model run logs", () => {
	it("creates short text previews", () => {
		expect(createTextPreview(" hello\n\nworld ", 8)).toBe("hello wo...");
	});

	it("writes a successful model call to JSONL", async () => {
		const logPath = await createTempLogPath();
		const result = await runSinglePrompt({
			config: {
				provider: "mock",
				model: "mock-chat",
				temperature: 0,
				timeoutMs: 30_000,
				maxRetries: 0,
			},
			systemPrompt: "You are concise.",
			userPrompt: "Explain reentrancy.",
			logPath,
		});

		const logs = await readRecentModelRunLogs(logPath);

		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			runId: result.runId,
			provider: "mock",
			model: "mock-chat",
			ok: true,
			inputPreview: "Explain reentrancy.",
		});
		expect(logs[0]?.startedAt).toEqual(expect.any(String));
		expect(logs[0]?.latencyMs).toBeGreaterThanOrEqual(0);
		expect(logs[0]?.outputPreview).toContain("[mock:mock-chat]");
		expect(logs[0]?.errorType).toBeUndefined();
		expect(logs[0]?.errorMessage).toBeUndefined();
	});

	it("writes a failed model call to JSONL", async () => {
		const logPath = await createTempLogPath();

		await expect(
			runSinglePrompt({
				config: {
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					temperature: 0,
					timeoutMs: 30_000,
					maxRetries: 0,
				},
				systemPrompt: "You are concise.",
				userPrompt: "Explain reentrancy.",
				logPath,
			}),
		).rejects.toThrow(/not implemented yet/);

		const logs = await readRecentModelRunLogs(logPath);

		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			provider: "anthropic",
			model: "claude-sonnet-4-5",
			ok: false,
			errorType: "Error",
			inputPreview: "Explain reentrancy.",
		});
		expect(logs[0]?.runId).toEqual(expect.any(String));
		expect(logs[0]?.startedAt).toEqual(expect.any(String));
		expect(logs[0]?.latencyMs).toBeGreaterThanOrEqual(0);
		expect(logs[0]?.errorMessage).toContain("not implemented yet");
		expect(logs[0]?.outputPreview).toBeUndefined();
	});

	it("does not hide the original model error when writing a failure log fails", async () => {
		const directoryPath = await mkdtemp(join(tmpdir(), "phase1-model-runs-"));

		await expect(
			runSinglePrompt({
				config: {
					provider: "anthropic",
					model: "claude-sonnet-4-5",
					temperature: 0,
					timeoutMs: 30_000,
					maxRetries: 0,
				},
				systemPrompt: "You are concise.",
				userPrompt: "Explain reentrancy.",
				logPath: directoryPath,
			}),
		).rejects.toThrow(/not implemented yet/);
	});
});
