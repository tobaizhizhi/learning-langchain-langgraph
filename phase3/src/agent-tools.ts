import { tool } from "@langchain/core/tools";
import { z } from "zod";

import {
	createExternalTools,
	type ExternalToolsOptions,
} from "../../phase2/src/tools.js";

type FetchLike = typeof fetch;

export type Phase3ExternalToolsOptions = ExternalToolsOptions & {
	fetch?: FetchLike;
};

export type GitHubUserResult = {
	login: string;
	name?: string;
	url: string;
	publicRepos: number;
	followers: number;
	following: number;
	company?: string;
	blog?: string;
	location?: string;
	createdAt?: string;
};

export type NpmDownloadsResult = {
	packageName: string;
	period: "last-day" | "last-week" | "last-month";
	downloads: number;
	start?: string;
	end?: string;
};

export type CurrentTimeResult = {
	timezone: string;
	datetime: string;
	utcOffset?: string;
	abbreviation?: string;
	dayOfWeek?: number;
};

const getGitHubUserInputSchema = z.object({
	username: z.string().trim().min(1, "username is required."),
});

const getNpmDownloadsInputSchema = z.object({
	packageName: z.string().trim().min(1, "packageName is required."),
	period: z.enum(["last-day", "last-week", "last-month"]).default("last-week"),
});

const getCurrentTimeInputSchema = z.object({
	timezone: z
		.string()
		.trim()
		.min(1, "timezone is required.")
		.default("Etc/UTC")
		.describe('IANA timezone name, for example "Etc/UTC" or "Asia/Shanghai".'),
});

export function createPhase3ExternalTools(options: Phase3ExternalToolsOptions = {}) {
	const fetchImpl = options.fetch ?? fetch;
	const githubToken = options.githubToken ?? process.env.GITHUB_TOKEN;
	const phase2Tools = createExternalTools(options);

	const getGitHubUser = tool(
		async ({ username }): Promise<GitHubUserResult> => {
			const data = await requestJson<Record<string, unknown>>(
				fetchImpl,
				`https://api.github.com/users/${encodeURIComponent(username)}`,
				{ headers: githubHeaders(githubToken) },
			);

			return {
				login: readString(data.login) ?? username,
				name: readString(data.name),
				url: readString(data.html_url) ?? "",
				publicRepos: readNumber(data.public_repos) ?? 0,
				followers: readNumber(data.followers) ?? 0,
				following: readNumber(data.following) ?? 0,
				company: readString(data.company),
				blog: readString(data.blog),
				location: readString(data.location),
				createdAt: readString(data.created_at),
			};
		},
		{
			name: "get_github_user",
			description: "Fetch public GitHub user profile metadata by username.",
			schema: getGitHubUserInputSchema,
		},
	);

	const getNpmPackageDownloads = tool(
		async ({ packageName, period }): Promise<NpmDownloadsResult> => {
			const url = `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(packageName)}`;
			const data = await requestJson<Record<string, unknown>>(fetchImpl, url);

			return {
				packageName: readString(data.package) ?? packageName,
				period,
				downloads: readNumber(data.downloads) ?? 0,
				start: readString(data.start),
				end: readString(data.end),
			};
		},
		{
			name: "get_npm_package_downloads",
			description:
				"Fetch public npm download counts for a package over last-day, last-week, or last-month.",
			schema: getNpmDownloadsInputSchema,
		},
	);

	const getCurrentTime = tool(
		async ({ timezone }): Promise<CurrentTimeResult> => {
			const url = `https://worldtimeapi.org/api/timezone/${encodeTimezonePath(timezone)}`;
			const data = await requestJson<Record<string, unknown>>(fetchImpl, url);

			return {
				timezone: readString(data.timezone) ?? timezone,
				datetime: readString(data.datetime) ?? "",
				utcOffset: readString(data.utc_offset),
				abbreviation: readString(data.abbreviation),
				dayOfWeek: readNumber(data.day_of_week),
			};
		},
		{
			name: "get_current_time",
			description: "Fetch current time for an IANA timezone from a public time API.",
			schema: getCurrentTimeInputSchema,
		},
	);

	return {
		...phase2Tools,
		getGitHubUser,
		getNpmPackageDownloads,
		getCurrentTime,
	};
}

export function createPhase3ToolList(options: Phase3ExternalToolsOptions = {}) {
	const tools = createPhase3ExternalTools(options);

	return [
		tools.getGitHubRepository,
		tools.searchGitHubRepositories,
		tools.getGitHubUser,
		tools.getNpmPackage,
		tools.getNpmPackageDownloads,
		tools.getCurrentTime,
	];
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
		"User-Agent": "aiframe-phase3-agent-demo",
		"X-GitHub-Api-Version": "2022-11-28",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};
}

function encodeTimezonePath(timezone: string): string {
	return timezone
		.split("/")
		.map((part) => encodeURIComponent(part))
		.join("/");
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}
