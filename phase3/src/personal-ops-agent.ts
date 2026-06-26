import { createAgent, modelCallLimitMiddleware, toolCallLimitMiddleware, toolStrategy } from "langchain";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import type { ModelConfig } from "../../phase1/src/model-config.js";
import {
	externalLookupOutputSchema,
	type ExternalLookupOutput,
} from "../../phase2/src/structured-output.js";
import {
	createAgentInvokeInput,
	inspectAgentInvokeResult,
	type AgentResultInspection,
} from "./agent-result-demo.js";
import {
	loadPhase3ModelConfig,
	phase3DefaultUserPrompt,
	phase3SystemPrompt,
} from "./agent-demo.js";
import { createPhase3ToolList } from "./agent-tools.js";
import { createObservationMiddleware } from "./middleware.js";
import {
	createAgentRunReport,
	finishAgentRunReport,
	summarizeAgentRunReport,
	type AgentRunReport,
} from "./run-report.js";

export type PersonalOpsAgentLimits = {
	modelCallRunLimit: number;
	toolCallRunLimit: number;
	recursionLimit: number;
};

export type RunPersonalOpsAgentInput = {
	config: ModelConfig;
	userPrompt: string;
	limits?: Partial<PersonalOpsAgentLimits>;
};

export type PersonalOpsAgentResult = AgentResultInspection & {
	limits: PersonalOpsAgentLimits;
	structuredOutput: ExternalLookupOutput;
	report: AgentRunReport;
	usedToolNames: string[];
};

export class PersonalOpsAgentError extends Error {
	constructor(
		message: string,
		readonly report: AgentRunReport,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "PersonalOpsAgentError";
	}
}

export const defaultPersonalOpsAgentLimits: PersonalOpsAgentLimits = {
	modelCallRunLimit: 6,
	toolCallRunLimit: 8,
	recursionLimit: 24,
};

export async function runPersonalOpsAgent(
	input: RunPersonalOpsAgentInput,
): Promise<PersonalOpsAgentResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase3 requires a real chat model. Set MODEL_ID=openai:<model> in phase3/.env.");
	}

	const limits = {
		...defaultPersonalOpsAgentLimits,
		...input.limits,
	};
	const model = createChatModel(input.config);
	const tools = createPhase3ToolList();
	const report = createAgentRunReport({
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
	});
	const agent = createAgent({
		model,
		tools,
		systemPrompt: [
			phase3SystemPrompt,
			"Return a structured final response based only on tool results and conversation facts.",
			"Set needsHumanReview to true when required facts are missing, uncertain, or a tool failed.",
		].join(" "),
		responseFormat: toolStrategy(externalLookupOutputSchema),
		middleware: [
			createObservationMiddleware({ report }),
			modelCallLimitMiddleware({
				runLimit: limits.modelCallRunLimit,
				exitBehavior: "error",
			}),
			toolCallLimitMiddleware({
				runLimit: limits.toolCallRunLimit,
				exitBehavior: "error",
			}),
		],
	});
	const agentInput = createAgentInvokeInput(input.userPrompt);

	try {
		const rawResult = await agent.invoke(agentInput, {
			recursionLimit: limits.recursionLimit,
		});
		const inspection = inspectAgentInvokeResult({
			provider: input.config.provider,
			model: input.config.model,
			userPrompt: input.userPrompt,
			availableTools: tools.map((tool) => tool.name),
			input: agentInput,
			result: rawResult,
		});
		const structuredOutput = externalLookupOutputSchema.parse(inspection.structuredResponse);

		finishAgentRunReport(report, {
			ok: true,
			finalText: structuredOutput.answer,
			messageCount: inspection.messageCount,
			toolCallCount: inspection.toolCallCount,
			toolResultCount: inspection.toolResultCount,
		});

		return {
			...inspection,
			limits,
			structuredOutput,
			report,
			usedToolNames: readUsedToolNames(
				inspection,
				tools.map((tool) => tool.name),
			),
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		finishAgentRunReport(report, {
			ok: false,
			errorMessage: message,
		});

		throw new PersonalOpsAgentError(message, report, error);
	}
}

export function readUsedToolNames(
	inspection: Pick<AgentResultInspection, "messages">,
	allowedToolNames?: string[],
): string[] {
	const names = Array.from(
		new Set(
			inspection.messages.flatMap((message) =>
				message.toolCalls.map((toolCall) => toolCall.name),
			),
		),
	);

	return allowedToolNames
		? names.filter((toolName) => allowedToolNames.includes(toolName))
		: names;
}

export function loadPersonalOpsAgentLimits(
	env: Record<string, string | undefined> = process.env,
): PersonalOpsAgentLimits {
	return {
		modelCallRunLimit: readPositiveIntegerEnv(
			env,
			"PHASE3_MODEL_CALL_LIMIT",
			defaultPersonalOpsAgentLimits.modelCallRunLimit,
		),
		toolCallRunLimit: readPositiveIntegerEnv(
			env,
			"PHASE3_TOOL_CALL_LIMIT",
			defaultPersonalOpsAgentLimits.toolCallRunLimit,
		),
		recursionLimit: readPositiveIntegerEnv(
			env,
			"PHASE3_RECURSION_LIMIT",
			defaultPersonalOpsAgentLimits.recursionLimit,
		),
	};
}

async function main() {
	const config = loadPhase3ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase3DefaultUserPrompt;
	const result = await runPersonalOpsAgent({
		config,
		userPrompt,
		limits: loadPersonalOpsAgentLimits(),
	});

	printPersonalOpsAgentResult(result);
}

function printPersonalOpsAgentResult(result: PersonalOpsAgentResult) {
	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	console.log("Limits:");
	console.log(`- model calls per run: ${result.limits.modelCallRunLimit}`);
	console.log(`- tool calls per run: ${result.limits.toolCallRunLimit}`);
	console.log(`- recursion limit: ${result.limits.recursionLimit}`);
	console.log("");

	console.log("Run report summary:");
	console.log(JSON.stringify(summarizeAgentRunReport(result.report), null, 2));
	console.log("");

	console.log("Tools used:");
	for (const toolName of result.usedToolNames) {
		console.log(`- ${toolName}`);
	}
	if (result.usedToolNames.length === 0) {
		console.log("- none");
	}
	console.log("");

	console.log("Run events:");
	for (const event of result.report.events) {
		const latency = event.latencyMs === undefined ? "" : ` in ${event.latencyMs}ms`;
		console.log(`- [${event.kind}] ${event.name}: ${event.ok ? "ok" : "error"}${latency}`);
	}
	console.log("");

	console.log("Structured output:");
	console.log(JSON.stringify(result.structuredOutput, null, 2));
}

function printFailedReport(error: PersonalOpsAgentError) {
	console.error("Run report summary:");
	console.error(JSON.stringify(summarizeAgentRunReport(error.report), null, 2));
	console.error("");
	console.error("Run events:");
	for (const event of error.report.events) {
		console.error(`- [${event.kind}] ${event.name}: ${event.ok ? "ok" : "error"}`);
		if (event.errorMessage) {
			console.error(`  error: ${event.errorMessage}`);
		}
	}
}

function readPositiveIntegerEnv(
	env: Record<string, string | undefined>,
	name: string,
	fallback: number,
): number {
	const raw = env[name]?.trim();
	if (!raw) {
		return fallback;
	}

	const value = Number(raw);
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${name} must be a positive integer.`);
	}

	return value;
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase3 personal ops agent failed: ${message}`);
	if (error instanceof PersonalOpsAgentError) {
		printFailedReport(error);
	}
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
