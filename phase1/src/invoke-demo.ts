import { config as loadDotEnv } from "dotenv";

import { defaultModelRunLogPath } from "./model-run-log.js";
import { loadModelConfigFromEnv } from "./model-config.js";
import { runSinglePrompt } from "./run-single-prompt.js";
import { loadSystemPromptFromEnv } from "./system-prompts.js";

loadDotEnv({ quiet: true });
loadDotEnv({ path: "phase1/.env", override: false, quiet: true });

const defaultUserPrompt = "请用三句话解释 Solidity 里的 reentrancy。";

async function main() {
	const config = loadModelConfigFromEnv();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() || process.env.USER_PROMPT || defaultUserPrompt;
	const systemPrompt = loadSystemPromptFromEnv();
	const logPath =
		process.env.MODEL_RUN_LOG_PATH === "off"
			? undefined
			: process.env.MODEL_RUN_LOG_PATH || defaultModelRunLogPath;

	const result = await runSinglePrompt({
		config,
		systemPrompt,
		userPrompt,
		logPath,
	});

	console.log(`Run ID: ${result.runId}`);
	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log(`Latency: ${result.latencyMs}ms`);
	if (logPath) {
		console.log(`Log: ${logPath}`);
	}
	console.log("");
	console.log("Answer:");
	console.log(result.text);
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Invoke demo failed: ${message}`);
	process.exitCode = 1;
});
