import { randomUUID } from "node:crypto";
import { mkdir, readFile, appendFile } from "node:fs/promises";
import { dirname } from "node:path";

export const defaultModelRunLogPath = "phase1/runs/model-runs.jsonl";

type BaseModelRunLog = {
	runId: string;
	provider: string;
	model: string;
	startedAt: string;
	latencyMs: number;
	inputPreview: string;
};

export type SuccessfulModelRunLog = BaseModelRunLog & {
	ok: true;
	outputPreview: string;
	inputTokens?: number;
	outputTokens?: number;
	finishReason?: string;
	errorType?: never;
	errorMessage?: never;
};

export type FailedModelRunLog = BaseModelRunLog & {
	ok: false;
	errorType: string;
	errorMessage: string;
	outputPreview?: never;
	inputTokens?: never;
	outputTokens?: never;
	finishReason?: never;
};

export type ModelRunLog = SuccessfulModelRunLog | FailedModelRunLog;

export function createRunId(): string {
	return randomUUID();
}

export function createTextPreview(input: string, maxLength = 200): string {
	const normalized = input.replace(/\s+/g, " ").trim();
	return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

export function getErrorType(error: unknown): string {
	if (error instanceof Error) {
		return error.name || "Error";
	}

	return typeof error;
}

export function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return createTextPreview(error.message);
	}

	return createTextPreview(String(error));
}

export async function appendModelRunLog(
	log: ModelRunLog,
	logPath = defaultModelRunLogPath,
): Promise<void> {
	await mkdir(dirname(logPath), { recursive: true });
	await appendFile(logPath, `${JSON.stringify(log)}\n`, "utf8");
}

export async function readRecentModelRunLogs(
	logPath = defaultModelRunLogPath,
	limit = 5,
): Promise<ModelRunLog[]> {
	try {
		const content = await readFile(logPath, "utf8");
		const logs = content
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as ModelRunLog);

		return logs.slice(-limit);
	} catch (error: unknown) {
		if (isFileNotFoundError(error)) {
			return [];
		}

		throw error;
	}
}

function isFileNotFoundError(error: unknown): boolean {
	return (
		error instanceof Error &&
		"code" in error &&
		(error as NodeJS.ErrnoException).code === "ENOENT"
	);
}
