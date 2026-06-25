import { createAgent, toolStrategy } from "langchain";

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

export type Phase3StructuredAgentResult = AgentResultInspection & {
	structuredOutput: ExternalLookupOutput;
};

export type RunStructuredAgentInput = {
	config: ModelConfig;
	userPrompt: string;
	recursionLimit?: number;
};

export async function runStructuredAgent(
	input: RunStructuredAgentInput,
): Promise<Phase3StructuredAgentResult> {
	if (input.config.provider === "mock") {
		throw new Error("Phase3 requires a real chat model. Set MODEL_ID=openai:<model> in phase3/.env.");
	}

	const model = createChatModel(input.config);
	const tools = createPhase3ToolList();
	const agent = createAgent({
		model,
		tools,
		systemPrompt: [
			phase3SystemPrompt,
			"Your final structured response must use only facts from tool results or the conversation.",
			"Set needsHumanReview to true if a needed tool failed, a source is missing, or the answer is uncertain.",
		].join(" "),
		responseFormat: toolStrategy(externalLookupOutputSchema),
	});
	const agentInput = createAgentInvokeInput(input.userPrompt);
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
	const structuredOutput = externalLookupOutputSchema.parse(inspection.structuredResponse);

	return {
		...inspection,
		structuredOutput,
	};
}

async function main() {
	const config = loadPhase3ModelConfig();
	const userPrompt =
		process.argv.slice(2).join(" ").trim() ||
		process.env.USER_PROMPT ||
		phase3DefaultUserPrompt;
	const result = await runStructuredAgent({ config, userPrompt });

	console.log(`Provider: ${result.provider}`);
	console.log(`Model: ${result.model}`);
	console.log("");

	console.log("Agent result keys:");
	for (const key of result.resultKeys) {
		console.log(`- ${key}`);
	}
	console.log("");

	console.log("Tool calls used during agent loop:");
	for (const message of result.messages) {
		for (const toolCall of message.toolCalls) {
			console.log(`- ${toolCall.name} args=${JSON.stringify(toolCall.args)}`);
		}
	}
	console.log("");

	console.log("Natural language final text:");
	console.log(result.finalText || "(empty final text)");
	console.log("");

	console.log("Structured response:");
	console.log(JSON.stringify(result.structuredOutput, null, 2));
	console.log("");

	console.log("Boundary summary:");
	console.log(`- messages: ${result.messageCount}`);
	console.log(`- tool calls: ${result.toolCallCount}`);
	console.log(`- tool results: ${result.toolResultCount}`);
	console.log("- structured response: present");
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Phase3 structured agent demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
