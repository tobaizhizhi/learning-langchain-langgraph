import { describe, expect, it } from "vitest";

import { createExternalTools } from "../src/tools.js";

describe("phase2 external API tools", () => {
	it("defines external tools with clear names", () => {
		const tools = createExternalTools({ fetch: createFakeFetch() });

		expect(tools.getGitHubRepository.name).toBe("get_github_repository");
		expect(tools.searchGitHubRepositories.name).toBe("search_github_repositories");
		expect(tools.getNpmPackage.name).toBe("get_npm_package");
	});

	it("fetches GitHub repository metadata", async () => {
		const tools = createExternalTools({ fetch: createFakeFetch() });

		const result = await tools.getGitHubRepository.invoke({
			owner: "langchain-ai",
			repo: "langchainjs",
		});

		expect(result).toMatchObject({
			fullName: "langchain-ai/langchainjs",
			url: "https://github.com/langchain-ai/langchainjs",
			stars: 123,
			defaultBranch: "main",
		});
	});

	it("searches GitHub repositories", async () => {
		const tools = createExternalTools({ fetch: createFakeFetch() });

		const result = await tools.searchGitHubRepositories.invoke({
			query: "langchainjs language:typescript",
			limit: 2,
		});

		expect(result.repositories).toHaveLength(1);
		expect(result.repositories[0]?.fullName).toBe("langchain-ai/langchainjs");
	});

	it("fetches npm package metadata", async () => {
		const tools = createExternalTools({ fetch: createFakeFetch() });

		const result = await tools.getNpmPackage.invoke({
			packageName: "@langchain/core",
		});

		expect(result).toMatchObject({
			name: "@langchain/core",
			latestVersion: "1.2.0",
			repository: "git+https://github.com/langchain-ai/langchainjs.git",
		});
	});

	it("surfaces external API errors clearly", async () => {
		const tools = createExternalTools({ fetch: createFakeFetch({ failGitHubRepo: true }) });

		await expect(
			tools.getGitHubRepository.invoke({
				owner: "langchain-ai",
				repo: "missing",
			}),
		).rejects.toThrow(/External request failed \(404 Not Found\)/);
	});
});

function createFakeFetch(options: { failGitHubRepo?: boolean } = {}): typeof fetch {
	return (async (input: string | URL | Request) => {
		const url = String(input);

		if (options.failGitHubRepo && url.includes("/repos/")) {
			return jsonResponse({ message: "Not Found" }, 404, "Not Found");
		}

		if (url.includes("api.github.com/repos/langchain-ai/langchainjs")) {
			return jsonResponse(githubRepoFixture());
		}

		if (url.includes("api.github.com/search/repositories")) {
			return jsonResponse({ items: [githubRepoFixture()] });
		}

		if (url.includes("registry.npmjs.org/%40langchain%2Fcore")) {
			return jsonResponse({
				name: "@langchain/core",
				description: "Core LangChain package",
				"dist-tags": { latest: "1.2.0" },
				versions: {
					"1.2.0": {
						repository: {
							url: "git+https://github.com/langchain-ai/langchainjs.git",
						},
						keywords: ["langchain"],
						license: "MIT",
					},
				},
			});
		}

		return jsonResponse({ message: `Unexpected URL: ${url}` }, 500, "Unexpected URL");
	}) as typeof fetch;
}

function jsonResponse(body: unknown, status = 200, statusText = "OK"): Response {
	return new Response(JSON.stringify(body), {
		status,
		statusText,
		headers: { "content-type": "application/json" },
	});
}

function githubRepoFixture() {
	return {
		full_name: "langchain-ai/langchainjs",
		description: "LangChain.js",
		html_url: "https://github.com/langchain-ai/langchainjs",
		stargazers_count: 123,
		forks_count: 45,
		open_issues_count: 6,
		default_branch: "main",
		language: "TypeScript",
		updated_at: "2026-06-01T00:00:00Z",
	};
}
