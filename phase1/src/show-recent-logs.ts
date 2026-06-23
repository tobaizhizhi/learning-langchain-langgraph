import { config as loadDotEnv } from "dotenv";

import { defaultModelRunLogPath, readRecentModelRunLogs } from "./model-run-log.js";

loadDotEnv({ quiet: true });
loadDotEnv({ path: "phase1/.env", override: false, quiet: true });

async function main() {
	if (process.env.MODEL_RUN_LOG_PATH === "off") {
		console.log("Model run logging is disabled with MODEL_RUN_LOG_PATH=off.");
		return;
	}

	const logPath = process.env.MODEL_RUN_LOG_PATH || defaultModelRunLogPath;
	const logs = await readRecentModelRunLogs(logPath, 5);

	if (logs.length === 0) {
		console.log(`No model run logs found at ${logPath}.`);
		return;
	}

	for (const log of logs) {
		const status = log.ok ? "ok" : `error:${log.errorType ?? "unknown"}`;
		console.log(
			`${log.startedAt} ${status} ${log.provider}:${log.model} ${log.latencyMs}ms ${log.runId}`,
		);
		console.log(`  input: ${log.inputPreview}`);

		if (log.outputPreview) {
			console.log(`  output: ${log.outputPreview}`);
		}

		const tokenSummary = [
			log.inputTokens === undefined ? undefined : `input=${log.inputTokens}`,
			log.outputTokens === undefined ? undefined : `output=${log.outputTokens}`,
		]
			.filter(Boolean)
			.join(" ");

		if (tokenSummary) {
			console.log(`  tokens: ${tokenSummary}`);
		}

		if (log.finishReason) {
			console.log(`  finish: ${log.finishReason}`);
		}

		if (log.errorMessage) {
			console.log(`  error: ${log.errorMessage}`);
		}
	}
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Show logs failed: ${message}`);
	process.exitCode = 1;
});
