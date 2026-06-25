import { randomUUID } from "node:crypto";

export type AgentRunEventKind = "agent" | "model" | "tool";

export type AgentRunEvent = {
	kind: AgentRunEventKind;
	name: string;
	ok: boolean;
	startedAtIso: string;
	latencyMs?: number;
	input?: Record<string, unknown>;
	output?: Record<string, unknown>;
	errorMessage?: string;
};

export type AgentRunReport = {
	runId: string;
	provider: string;
	model: string;
	userPrompt: string;
	startedAtIso: string;
	endedAtIso?: string;
	ok?: boolean;
	errorMessage?: string;
	finalText?: string;
	messageCount?: number;
	toolCallCount?: number;
	toolResultCount?: number;
	events: AgentRunEvent[];
};

export type CreateAgentRunReportInput = {
	provider: string;
	model: string;
	userPrompt: string;
	now?: () => Date;
};

export type FinishAgentRunReportInput = {
	ok: boolean;
	finalText?: string;
	messageCount?: number;
	toolCallCount?: number;
	toolResultCount?: number;
	errorMessage?: string;
	now?: () => Date;
};

export function createAgentRunReport(input: CreateAgentRunReportInput): AgentRunReport {
	const now = input.now?.() ?? new Date();

	return {
		runId: createRunId(now),
		provider: input.provider,
		model: input.model,
		userPrompt: input.userPrompt,
		startedAtIso: now.toISOString(),
		events: [],
	};
}

export function recordAgentRunEvent(report: AgentRunReport, event: AgentRunEvent): void {
	report.events.push(event);
}

export function finishAgentRunReport(
	report: AgentRunReport,
	input: FinishAgentRunReportInput,
): AgentRunReport {
	const now = input.now?.() ?? new Date();

	report.endedAtIso = now.toISOString();
	report.ok = input.ok;
	report.finalText = input.finalText;
	report.messageCount = input.messageCount;
	report.toolCallCount = input.toolCallCount;
	report.toolResultCount = input.toolResultCount;
	report.errorMessage = input.errorMessage;

	return report;
}

export function summarizeAgentRunReport(report: AgentRunReport) {
	return {
		runId: report.runId,
		ok: report.ok,
		provider: report.provider,
		model: report.model,
		messageCount: report.messageCount ?? 0,
		modelCallCount: report.events.filter((event) => event.kind === "model").length,
		toolCallCount: report.events.filter((event) => event.kind === "tool").length,
		failedEventCount: report.events.filter((event) => !event.ok).length,
	};
}

function createRunId(now: Date): string {
	const randomSuffix = randomUUID();

	return `phase3-${now.toISOString()}-${randomSuffix}`;
}
