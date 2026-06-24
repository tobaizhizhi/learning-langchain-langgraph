import { z } from "zod";

export const getGitHubRepositoryInputSchema = z.object({
	owner: z.string().trim().min(1, "owner is required."),
	repo: z.string().trim().min(1, "repo is required."),
});

export const searchGitHubRepositoriesInputSchema = z.object({
	query: z.string().trim().min(1, "query is required."),
	limit: z.number().int().min(1).max(10).default(3),
});

export const getNpmPackageInputSchema = z.object({
	packageName: z.string().trim().min(1, "packageName is required."),
});

export type GetGitHubRepositoryInput = z.infer<typeof getGitHubRepositoryInputSchema>;
export type SearchGitHubRepositoriesInput = z.infer<
	typeof searchGitHubRepositoriesInputSchema
>;
export type GetNpmPackageInput = z.infer<typeof getNpmPackageInputSchema>;
