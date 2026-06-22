export const providerNames = ["openai", "anthropic", "google", "mock"] as const;

export type ProviderName = (typeof providerNames)[number];

export type ModelConfig = {
	provider: ProviderName;
	model: string;
	temperature: number;
	maxTokens?: number;
	baseUrl?: string;
	timeoutMs: number;
	maxRetries: number;
};

export type ModelId = Pick<ModelConfig, "provider" | "model">;

type EnvLike = Record<string, string | undefined>;

export const defaultModelConfig: ModelConfig = {
	provider: "mock",
	model: "mock-chat",
	temperature: 0,
	timeoutMs: 30_000,
	maxRetries: 2,
};

export function isProviderName(input: string): input is ProviderName {
	return providerNames.includes(input as ProviderName);
}

export function parseModelId(input: string): ModelId {
	const raw = input.trim();

	if (raw.length === 0) {
		throw new Error("Model id is required. Expected format: <provider>:<model>.");
	}

	const separatorIndex = raw.indexOf(":");
	if (separatorIndex === -1) {
		throw new Error(`Invalid model id "${input}". Expected format: <provider>:<model>.`);
	}

	const provider = raw.slice(0, separatorIndex).trim();
	const model = raw.slice(separatorIndex + 1).trim();

	return {
		provider: parseProviderName(provider),
		model: parseRequiredString("model", model),
	};
}

export function loadModelConfigFromEnv(env: EnvLike = process.env): ModelConfig {
	const modelId = readOptionalString(env.MODEL_ID);
	const providerFromEnv = readOptionalString(env.MODEL_PROVIDER);
	const modelFromEnv = readOptionalString(env.MODEL_NAME);

	const parsedModelId = modelId ? parseModelId(modelId) : undefined;

	if (!parsedModelId && providerFromEnv && !modelFromEnv) {
		throw new Error("MODEL_NAME is required when MODEL_PROVIDER is set.");
	}

	const candidate: ModelConfig = {
		...defaultModelConfig,
		...parsedModelId,
		provider: providerFromEnv
			? parseProviderName(providerFromEnv)
			: parsedModelId?.provider ?? defaultModelConfig.provider,
		model: modelFromEnv ?? parsedModelId?.model ?? defaultModelConfig.model,
		temperature: parseNumberEnv(
			"MODEL_TEMPERATURE",
			env.MODEL_TEMPERATURE,
			defaultModelConfig.temperature,
		),
		timeoutMs: parseIntegerEnv(
			"MODEL_TIMEOUT_MS",
			env.MODEL_TIMEOUT_MS,
			defaultModelConfig.timeoutMs,
		),
		maxRetries: parseIntegerEnv(
			"MODEL_MAX_RETRIES",
			env.MODEL_MAX_RETRIES,
			defaultModelConfig.maxRetries,
		),
	};

	const maxTokens = parseOptionalIntegerEnv("MODEL_MAX_TOKENS", env.MODEL_MAX_TOKENS);
	if (maxTokens !== undefined) {
		candidate.maxTokens = maxTokens;
	}

	const baseUrl = readOptionalString(env.MODEL_BASE_URL);
	if (baseUrl !== undefined) {
		candidate.baseUrl = baseUrl;
	}

	return validateModelConfig(candidate);
}

export function validateModelConfig(config: ModelConfig): ModelConfig {
	return {
		provider: parseProviderName(config.provider),
		model: parseRequiredString("model", config.model),
		temperature: assertFiniteNumber("temperature", config.temperature, {
			min: 0,
			max: 2,
		}),
		maxTokens:
			config.maxTokens === undefined
				? undefined
				: assertInteger("maxTokens", config.maxTokens, { min: 1 }),
		baseUrl:
			config.baseUrl === undefined ? undefined : parseRequiredString("baseUrl", config.baseUrl),
		timeoutMs: assertInteger("timeoutMs", config.timeoutMs, { min: 1 }),
		maxRetries: assertInteger("maxRetries", config.maxRetries, { min: 0 }),
	};
}

function parseProviderName(input: string): ProviderName {
	const provider = input.trim();

	if (!isProviderName(provider)) {
		throw new Error(
			`Unsupported provider "${input}". Supported providers: ${providerNames.join(", ")}.`,
		);
	}

	return provider;
}

function parseRequiredString(name: string, input: string): string {
	const value = input.trim();
	if (value.length === 0) {
		throw new Error(`${name} is required.`);
	}

	return value;
}

function readOptionalString(input: string | undefined): string | undefined {
	const value = input?.trim();
	return value ? value : undefined;
}

function parseNumberEnv(name: string, input: string | undefined, fallback: number): number {
	const value = readOptionalString(input);
	if (!value) {
		return fallback;
	}

	return assertFiniteNumber(name, Number(value));
}

function parseIntegerEnv(name: string, input: string | undefined, fallback: number): number {
	const value = readOptionalString(input);
	if (!value) {
		return fallback;
	}

	return assertInteger(name, Number(value), { min: 0 });
}

function parseOptionalIntegerEnv(name: string, input: string | undefined): number | undefined {
	const value = readOptionalString(input);
	if (!value) {
		return undefined;
	}

	return assertInteger(name, Number(value), { min: 1 });
}

function assertFiniteNumber(
	name: string,
	value: number,
	range?: { min?: number; max?: number },
): number {
	if (!Number.isFinite(value)) {
		throw new Error(`${name} must be a finite number.`);
	}

	if (range?.min !== undefined && value < range.min) {
		throw new Error(`${name} must be greater than or equal to ${range.min}.`);
	}

	if (range?.max !== undefined && value > range.max) {
		throw new Error(`${name} must be less than or equal to ${range.max}.`);
	}

	return value;
}

function assertInteger(name: string, value: number, range?: { min?: number }): number {
	assertFiniteNumber(name, value);

	if (!Number.isInteger(value)) {
		throw new Error(`${name} must be an integer.`);
	}

	if (range?.min !== undefined && value < range.min) {
		throw new Error(`${name} must be greater than or equal to ${range.min}.`);
	}

	return value;
}
