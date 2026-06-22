import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
	BaseChatModel,
	SimpleChatModel,
} from "@langchain/core/language_models/chat_models";
import type { BaseMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import type { ModelConfig } from "./model-config.js";

export function createChatModel(config: ModelConfig): BaseChatModel {
	if (config.provider === "mock") {
		return new MockChatModel(config);
	}

	if (config.provider === "openai") {
		return new ChatOpenAI({
			model: config.model,
			temperature: config.temperature,
			maxTokens: config.maxTokens,
			timeout: config.timeoutMs,
			maxRetries: config.maxRetries,
			configuration: config.baseUrl ? { baseURL: config.baseUrl } : undefined,
		});
	}

	throw new Error(
		`Provider "${config.provider}" is not implemented yet. Step 4 currently supports: mock, openai.`,
	);
}

export class MockChatModel extends SimpleChatModel {
	constructor(private readonly config: ModelConfig) {
		super({});
	}

	_llmType(): string {
		return "phase1_mock_chat_model";
	}

	async _call(
		messages: BaseMessage[],
		_options: this["ParsedCallOptions"],
		_runManager?: CallbackManagerForLLMRun,
	): Promise<string> {
		const lastMessage = messages.at(-1);
		const prompt = lastMessage?.text.trim();
		const echo = prompt ? ` You asked: ${prompt}` : "";

		return `[mock:${this.config.model}] This is a deterministic mock response.${echo}`;
	}
}
