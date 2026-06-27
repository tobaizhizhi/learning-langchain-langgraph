export const embeddingProviderNames = ["openai", "ollama"] as const;

export type EmbeddingProviderName = (typeof embeddingProviderNames)[number];

export type EmbeddingConfig = {
	provider: EmbeddingProviderName;
	model: string;
	apiKey?: string;
	baseUrl?: string;
	timeoutMs: number;
	maxRetries: number;
	batchSize: number;
	dimensions?: number;
};

type EnvLike = Record<string, string | undefined>;

export const defaultOllamaEmbeddingConfig: EmbeddingConfig = {
	provider: "ollama",
	model: "bge-m3",
	baseUrl: "http://localhost:11434",
	timeoutMs: 30_000,
	maxRetries: 2,
	batchSize: 16,
};

export const defaultOpenAIEmbeddingConfig: EmbeddingConfig = {
	provider: "openai",
	model: "text-embedding-3-small",
	timeoutMs: 30_000,
	maxRetries: 2,
	batchSize: 16,
};

export const defaultEmbeddingConfig = defaultOllamaEmbeddingConfig;

export function isEmbeddingProviderName(input: string): input is EmbeddingProviderName {
	return embeddingProviderNames.includes(input as EmbeddingProviderName);
}

export function loadEmbeddingConfigFromEnv(env: EnvLike = process.env): EmbeddingConfig {
	const provider = parseEmbeddingProviderName(
		readOptionalString(env.EMBEDDING_PROVIDER) ?? defaultEmbeddingConfig.provider,
	);
	const providerDefaults = getDefaultEmbeddingConfigForProvider(provider);

	const candidate: EmbeddingConfig = {
		...providerDefaults,
		provider,
		model: readOptionalString(env.EMBEDDING_MODEL) ?? providerDefaults.model,
		timeoutMs: parseIntegerEnv(
			"EMBEDDING_TIMEOUT_MS",
			env.EMBEDDING_TIMEOUT_MS,
			providerDefaults.timeoutMs,
			{ min: 1 },
		),
		maxRetries: parseIntegerEnv(
			"EMBEDDING_MAX_RETRIES",
			env.EMBEDDING_MAX_RETRIES,
			providerDefaults.maxRetries,
			{ min: 0 },
		),
		batchSize: parseIntegerEnv(
			"EMBEDDING_BATCH_SIZE",
			env.EMBEDDING_BATCH_SIZE,
			providerDefaults.batchSize,
			{ min: 1 },
		),
	};

	const apiKey = readOptionalString(env.EMBEDDING_API_KEY);
	if (apiKey !== undefined) {
		candidate.apiKey = apiKey;
	}

	const baseUrl = readOptionalString(env.EMBEDDING_BASE_URL);
	if (baseUrl !== undefined) {
		candidate.baseUrl = baseUrl;
	}

	const dimensions = parseOptionalIntegerEnv("EMBEDDING_DIMENSIONS", env.EMBEDDING_DIMENSIONS);
	if (dimensions !== undefined) {
		candidate.dimensions = dimensions;
	}

	return validateEmbeddingConfig(candidate);
}

export function validateEmbeddingConfig(config: EmbeddingConfig): EmbeddingConfig {
	const provider = parseEmbeddingProviderName(config.provider);
	const model = parseRequiredString("model", config.model);
	const apiKey =
		config.apiKey === undefined ? undefined : parseRequiredString("apiKey", config.apiKey);
	const baseUrl =
		config.baseUrl === undefined ? undefined : parseRequiredString("baseUrl", config.baseUrl);

	if (provider === "openai" && apiKey === undefined) {
		throw new Error("EMBEDDING_API_KEY is required when EMBEDDING_PROVIDER=openai.");
	}

	if (provider === "ollama" && baseUrl === undefined) {
		throw new Error("EMBEDDING_BASE_URL is required when EMBEDDING_PROVIDER=ollama.");
	}

	return {
		provider,
		model,
		apiKey,
		baseUrl,
		timeoutMs: assertInteger("timeoutMs", config.timeoutMs, { min: 1 }),
		maxRetries: assertInteger("maxRetries", config.maxRetries, { min: 0 }),
		batchSize: assertInteger("batchSize", config.batchSize, { min: 1 }),
		dimensions:
			config.dimensions === undefined
				? undefined
				: assertInteger("dimensions", config.dimensions, { min: 1 }),
	};
}

export function parseEmbeddingProviderName(input: string): EmbeddingProviderName {
	const provider = input.trim();

	if (!isEmbeddingProviderName(provider)) {
		throw new Error(
			`Unsupported embedding provider "${input}". Supported providers: ${embeddingProviderNames.join(", ")}.`,
		);
	}

	return provider;
}

function getDefaultEmbeddingConfigForProvider(provider: EmbeddingProviderName): EmbeddingConfig {
	if (provider === "openai") {
		return defaultOpenAIEmbeddingConfig;
	}

	return defaultOllamaEmbeddingConfig;
}

function parseRequiredString(name: string, input: string): string {
	const value = input.trim();
	if (!value) {
		throw new Error(`${name} is required.`);
	}

	return value;
}

function readOptionalString(input: string | undefined): string | undefined {
	const value = input?.trim();
	return value ? value : undefined;
}

function parseIntegerEnv(
	name: string,
	input: string | undefined,
	fallback: number,
	range: { min: number },
): number {
	const value = readOptionalString(input);
	if (!value) {
		return fallback;
	}

	return assertInteger(name, Number(value), range);
}

function parseOptionalIntegerEnv(name: string, input: string | undefined): number | undefined {
	const value = readOptionalString(input);
	if (!value) {
		return undefined;
	}

	return assertInteger(name, Number(value), { min: 1 });
}

function assertInteger(name: string, value: number, range: { min: number }): number {
	if (!Number.isFinite(value)) {
		throw new Error(`${name} must be a finite number.`);
	}

	if (!Number.isInteger(value)) {
		throw new Error(`${name} must be an integer.`);
	}

	if (value < range.min) {
		throw new Error(`${name} must be greater than or equal to ${range.min}.`);
	}

	return value;
}
