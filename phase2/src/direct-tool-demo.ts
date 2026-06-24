import {
	createExternalTools,
	type ExternalToolsOptions,
	type GitHubRepositoryResult,
	type GitHubRepositorySearchResult,
	type NpmPackageResult,
} from "./tools.js";

export type DirectToolDemoResult = {
	repositoryResult: GitHubRepositoryResult;
	searchResult: GitHubRepositorySearchResult;
	npmPackageResult: NpmPackageResult;
	schemaErrorMessage: string;
	toolErrorMessage: string;
};

export async function runDirectToolDemo(
	options: ExternalToolsOptions = {},
): Promise<DirectToolDemoResult> {
	const tools = createExternalTools(options);

	const repositoryResult = await tools.getGitHubRepository.invoke({
		owner: "langchain-ai",
		repo: "langchainjs",
	});
	const searchResult = await tools.searchGitHubRepositories.invoke({
		query: "langchainjs language:typescript",
		limit: 3,
	});
	const npmPackageResult = await tools.getNpmPackage.invoke({
		packageName: "@langchain/core",
	});

	const schemaErrorMessage = await captureErrorMessage(() =>
		tools.getGitHubRepository.invoke({ owner: "", repo: "langchainjs" }),
	);
	const toolErrorMessage = await captureErrorMessage(() =>
		tools.getGitHubRepository.invoke({
			owner: "langchain-ai",
			repo: "aiframe-phase2-missing-repository-demo",
		}),
	);

	return {
		repositoryResult,
		searchResult,
		npmPackageResult,
		schemaErrorMessage,
		toolErrorMessage,
	};
}

async function captureErrorMessage(action: () => Promise<unknown>): Promise<string> {
	try {
		await action();
		return "No error was thrown.";
	} catch (error: unknown) {
		return error instanceof Error ? error.message : String(error);
	}
}

async function main() {
	const result = await runDirectToolDemo();

	console.log("1. get_github_repository");
	console.log(JSON.stringify(result.repositoryResult, null, 2));
	console.log("");

	console.log("2. search_github_repositories");
	console.log(JSON.stringify(result.searchResult.repositories, null, 2));
	console.log("");

	console.log("3. get_npm_package");
	console.log(JSON.stringify(result.npmPackageResult, null, 2));
	console.log("");

	console.log("4. schema error");
	console.log(result.schemaErrorMessage);
	console.log("");

	console.log("5. external tool error");
	console.log(result.toolErrorMessage);
}

function handleCliError(error: unknown) {
	const message = error instanceof Error ? error.message : String(error);
	console.error(`Direct external tool demo failed: ${message}`);
	process.exitCode = 1;
}

function isCliEntryPoint(): boolean {
	return require.main === module;
}

if (isCliEntryPoint()) {
	main().catch(handleCliError);
}
