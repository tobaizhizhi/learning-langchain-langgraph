import { describe, expect, it } from "vitest";

import { runDirectToolDemo } from "../src/direct-tool-demo.js";

describe("runDirectToolDemo", () => {
	it("directly invokes external tools and captures important paths", async () => {
		const result = await runDirectToolDemo({ fetch: createFakeFetch() });

		expect(result.repositoryResult.fullName).toBe("langchain-ai/langchainjs");
		expect(result.searchResult.repositories[0]?.fullName).toBe("langchain-ai/langchainjs");
		expect(result.npmPackageResult.name).toBe("@langchain/core");
		expect(result.schemaErrorMessage).toContain("owner");
		expect(result.toolErrorMessage).toContain("External request failed");
	});
});

function createFakeFetch(): typeof fetch {
	return (async (input: string | URL | Request) => {
		const url = String(input);

		if (url.includes("aiframe-phase2-missing-repository-demo")) {
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
				"dist-tags": { latest: "1.2.0" },
				versions: { "1.2.0": {} },
				keywords: ["langchain"],
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
		html_url: "https://github.com/langchain-ai/langchainjs",
		stargazers_count: 123,
		forks_count: 45,
		open_issues_count: 6,
		default_branch: "main",
		language: "TypeScript",
	};
}
