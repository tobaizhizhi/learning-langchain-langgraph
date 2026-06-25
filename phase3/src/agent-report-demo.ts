import { createAgent } from "langchain";

import { createChatModel } from "../../phase1/src/chat-model-factory.js";
import type { ModelConfig } from "../../phase1/src/model-config.js";
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

export type ObservedAgentResult = AgentResultInspection & {
	report: AgentRunReport;
};

export type RunObservedAgentInput = {
	config: ModelConfig;
	userPrompt: string;
	recursionLimit?: number;
};

export class ObservedAgentError extends Error {
	constructor(
		message: string,
		readonly report: AgentRunReport,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "ObservedAgentError";
	}
}

export async function runObservedAgent(input: RunObservedAgentInput): Promise<ObservedAgentResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase3 requires a real chat model. Set MODEL_ID=openai:<model> in phase3/.env.");
	}

	const model = createChatModel(input.config);
	const tools = createPhase3ToolList();
	const report = createAgentRunReport({
		provider: input.config.provider,
		model: input.config.model,
		userPrompt: input.userPrompt,
	});
	const observationMiddleware = createObservationMiddleware({ report });
	const agent = createAgent({
		model,
		tools,
		systemPrompt: phase3SystemPrompt,
		middleware: [observationMiddleware],
	});
	const agentInput = createAgentInvokeInput(input.userPrompt);

	try {
		const rawResult = await agent.invoke(agentInput, {
			recursionLimit: input.recursionLimit ?? 12,
		});
		const inspection = inspectAgentInvokeResult({
			provider: input.config.provider,
			model: input.config.model,
			userPrompt: input.userPrompt,
			availableTools: tools.map((tool) => tool.name),
			input: agentInput,
			result: rawResult,
		});

		finishAgentRunReport(report, {
			ok: true,
			finalText: inspection.finalText,
			messageCount: inspection.messageCount,
			toolCallCount: inspection.toolCallCount,
			toolResultCount: inspection.toolResultCount,
		});

		return {
			...inspection,
			report,
		};
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		finishAgentRunReport(report, {
			ok: false,
			errorMessage: message,
		});

		throw new ObservedAgentError(message, report, error);
	}
}

async function main() {
	const config = loadPhase3ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase3DefaultUserPrompt;
	const result = await runObservedAgent({ config, userPrompt });

	printObservedAgentResult(result);
}

function printObservedAgentResult(result: ObservedAgentResult) {
	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	console.log("Run report summary:");
	console.log(JSON.stringify(summarizeAgentRunReport(result.report), null, 2));
	console.log("");

	console.log("Run events:");
	for (const event of result.report.events) {
		const status = event.ok ? "ok" : "error";
		const latency = event.latencyMs === undefined ? "" : ` in ${event.latencyMs}ms`;
		console.log(`- [${event.kind}] ${event.name}: ${status}${latency}`);

		if (event.input) {
			console.log(`  input: ${JSON.stringify(event.input)}`);
		}

		if (event.output) {
			console.log(`  output: ${JSON.stringify(event.output)}`);
		}

		if (event.errorMessage) {
			console.log(`  error: ${event.errorMessage}`);
		}
	}
	console.log("");

	console.log("Final answer:");
	console.log(result.finalText || "(empty final text)");
}

function printFailedReport(error: ObservedAgentError) {
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

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase3 observed agent demo failed: ${message}`);
	if (error instanceof ObservedAgentError) {
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
