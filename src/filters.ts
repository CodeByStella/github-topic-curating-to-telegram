import { readFileSync } from "node:fs";
import path from "node:path";
import type { TopRepo } from "./types.js";

const FILTERS_FILENAME = "repo-filters.json";

export type RangeFilter = {
  min?: number | null;
  max?: number | null;
};

export type RepoFilters = {
  stars?: RangeFilter;
  forks?: RangeFilter;
  subscribers?: RangeFilter;
  openIssues?: RangeFilter;
  commitCount?: RangeFilter;
  contributorsCount?: RangeFilter;
  size?: RangeFilter;
};

function checkRange(
  value: number | undefined,
  filter: RangeFilter | undefined,
): boolean {
  if (filter === undefined) return true; // No filter = pass
  if (value === undefined) return false; // Value missing = fail

  if (filter.min !== null && filter.min !== undefined && value < filter.min) {
    return false;
  }
  if (filter.max !== null && filter.max !== undefined && value > filter.max) {
    return false;
  }
  return true;
}

/**
 * Loads range filters from repo-filters.json (reloaded on each call).
 */
export function loadFilters(projectRoot: string = process.cwd()): RepoFilters {
  const filePath = path.join(projectRoot, FILTERS_FILENAME);
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      console.error(
        `[filters] ${FILTERS_FILENAME} must be a JSON object with optional range filters`,
      );
      return {};
    }
    return parsed as RepoFilters;
  } catch (err) {
    console.error(`[filters] could not read ${filePath}:`, err);
    return {};
  }
}

/**
 * Checks if a repository matches all configured range filters.
 * Returns true if the repo passes all filters (or if no filters are configured).
 */
export function matchesFilters(repo: TopRepo, filters: RepoFilters): boolean {
  if (
    !checkRange(repo.stars, filters.stars) ||
    !checkRange(repo.forks, filters.forks) ||
    !checkRange(repo.subscribers, filters.subscribers) ||
    !checkRange(repo.openIssues, filters.openIssues) ||
    !checkRange(repo.commitCount, filters.commitCount) ||
    !checkRange(repo.contributorsCount, filters.contributorsCount) ||
    !checkRange(repo.size, filters.size)
  ) {
    return false;
  }
  return true;
}
