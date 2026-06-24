import { describe, expect, it } from "vitest";

import {
	getGitHubRepositoryInputSchema,
	getNpmPackageInputSchema,
	searchGitHubRepositoriesInputSchema,
} from "../src/tool-schemas.js";

describe("phase2 external tool input schemas", () => {
	it("validates getGitHubRepository input", () => {
		expect(
			getGitHubRepositoryInputSchema.parse({
				owner: "langchain-ai",
				repo: "langchainjs",
			}),
		).toEqual({
			owner: "langchain-ai",
			repo: "langchainjs",
		});
	});

	it("rejects missing GitHub repository fields", () => {
		expect(() => getGitHubRepositoryInputSchema.parse({ owner: "", repo: "x" })).toThrow(
			/owner/,
		);
		expect(() => getGitHubRepositoryInputSchema.parse({ owner: "x", repo: "" })).toThrow(
			/repo/,
		);
	});

	it("validates searchGitHubRepositories input and applies the default limit", () => {
		expect(
			searchGitHubRepositoriesInputSchema.parse({
				query: "langchainjs language:typescript",
			}),
		).toEqual({
			query: "langchainjs language:typescript",
			limit: 3,
		});
	});

	it("rejects invalid GitHub search limits", () => {
		expect(() =>
			searchGitHubRepositoriesInputSchema.parse({
				query: "langchainjs",
				limit: 99,
			}),
		).toThrow();
	});

	it("validates getNpmPackage input", () => {
		expect(getNpmPackageInputSchema.parse({ packageName: "@langchain/core" })).toEqual({
			packageName: "@langchain/core",
		});
	});
});
