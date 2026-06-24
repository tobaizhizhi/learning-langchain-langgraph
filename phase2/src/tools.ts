import { tool } from "@langchain/core/tools";

import {
	getGitHubRepositoryInputSchema,
	getNpmPackageInputSchema,
	searchGitHubRepositoriesInputSchema,
} from "./tool-schemas.js";

type FetchLike = typeof fetch;

export type ExternalToolsOptions = {
	fetch?: FetchLike;
	githubToken?: string;
	npmRegistryUrl?: string;
};

export type GitHubRepositoryResult = {
	fullName: string;
	description?: string;
	url: string;
	stars: number;
	forks: number;
	openIssues: number;
	defaultBranch: string;
	language?: string;
	updatedAt?: string;
};

export type GitHubRepositorySearchResult = {
	query: string;
	repositories: GitHubRepositoryResult[];
};

export type NpmPackageResult = {
	name: string;
	description?: string;
	latestVersion?: string;
	homepage?: string;
	repository?: string;
	keywords: string[];
	license?: string;
};

export function createExternalTools(options: ExternalToolsOptions = {}) {
	const fetchImpl = options.fetch ?? fetch;
	const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN;
	const npmRegistryUrl = options.npmRegistryUrl ?? "https://registry.npmjs.org";

	const getGitHubRepository = tool(
		async ({ owner, repo }): Promise<GitHubRepositoryResult> => {
			const data = await requestJson<Record<string, unknown>>(
				fetchImpl,
				`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
				{ headers: githubHeaders(githubToken) },
			);

			return mapGitHubRepository(data);
		},
		{
			name: "get_github_repository",
			description: "Fetch public GitHub repository metadata by owner and repo name.",
			schema: getGitHubRepositoryInputSchema,
		},
	);

	const searchGitHubRepositories = tool(
		async ({ query, limit }): Promise<GitHubRepositorySearchResult> => {
			const url = new URL("https://api.github.com/search/repositories");
			url.searchParams.set("q", query);
			url.searchParams.set("per_page", String(limit));

			const data = await requestJson<{ items?: Record<string, unknown>[] }>(fetchImpl, url, {
				headers: githubHeaders(githubToken),
			});

			return {
				query,
				repositories: (data.items ?? []).map(mapGitHubRepository),
			};
		},
		{
			name: "search_github_repositories",
			description: "Search public GitHub repositories using the GitHub REST API.",
			schema: searchGitHubRepositoriesInputSchema,
		},
	);

	const getNpmPackage = tool(
		async ({ packageName }): Promise<NpmPackageResult> => {
			const url = `${npmRegistryUrl.replace(/\/$/, "")}/${encodeURIComponent(packageName)}`;
			const data = await requestJson<Record<string, unknown>>(fetchImpl, url);

			const distTags = readRecord(data["dist-tags"]);
			const latestVersion = readString(distTags?.latest);
			const versions = readRecord(data.versions);
			const latestMetadata = latestVersion ? readRecord(versions?.[latestVersion]) : undefined;

			return {
				name: readString(data.name) ?? packageName,
				description: readString(data.description),
				latestVersion,
				homepage: readString(data.homepage),
				repository: readRepositoryUrl(data.repository ?? latestMetadata?.repository),
				keywords: readStringArray(data.keywords ?? latestMetadata?.keywords),
				license: readString(data.license ?? latestMetadata?.license),
			};
		},
		{
			name: "get_npm_package",
			description: "Fetch package metadata from the public npm registry.",
			schema: getNpmPackageInputSchema,
		},
	);

	return {
		getGitHubRepository,
		searchGitHubRepositories,
		getNpmPackage,
	};
}

async function requestJson<T>(fetchImpl: FetchLike, url: string | URL, init?: RequestInit): Promise<T> {
	const response = await fetchImpl(url, init);
	if (!response.ok) {
		throw new Error(
			`External request failed (${response.status} ${response.statusText}) for ${String(url)}.`,
		);
	}

	return (await response.json()) as T;
}

function githubHeaders(token: string | undefined): Record<string, string> {
	return {
		Accept: "application/vnd.github+json",
		"User-Agent": "aiframe-phase2-tool-demo",
		"X-GitHub-Api-Version": "2022-11-28",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

function mapGitHubRepository(data: Record<string, unknown>): GitHubRepositoryResult {
	return {
		fullName: readString(data.full_name) ?? "",
		description: readString(data.description),
		url: readString(data.html_url) ?? "",
		stars: readNumber(data.stargazers_count) ?? 0,
		forks: readNumber(data.forks_count) ?? 0,
		openIssues: readNumber(data.open_issues_count) ?? 0,
		defaultBranch: readString(data.default_branch) ?? "",
		language: readString(data.language),
		updatedAt: readString(data.updated_at),
	};
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function readStringArray(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function readRepositoryUrl(value: unknown): string | undefined {
	if (typeof value === "string") {
		return value;
	}

	const record = readRecord(value);
	return readString(record?.url);
}
