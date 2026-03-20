import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TopRepo } from "./types.js";

const FILTERS_FILENAME = "repo-filters.json";

/**
 * Initializes filters file with empty object if it doesn't exist.
 */
export function initFiltersFile(projectRoot: string = process.cwd()): void {
  const filePath = path.join(projectRoot, FILTERS_FILENAME);
  if (!existsSync(filePath)) {
    try {
      writeFileSync(filePath, "{}\n", "utf8");
      console.log(`[init] Created ${FILTERS_FILENAME}`);
    } catch (err) {
      console.error(`[init] Failed to create ${FILTERS_FILENAME}:`, err);
    }
  }
}

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

/**
 * Saves filters to repo-filters.json.
 */
export function saveFilters(
  filters: RepoFilters,
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(projectRoot, FILTERS_FILENAME);
      writeFileSync(
        filePath,
        JSON.stringify(filters, null, 2) + "\n",
        "utf8",
      );
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Updates a single filter field.
 */
export function updateFilter(
  field: keyof RepoFilters,
  filter: RangeFilter,
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const current = loadFilters(projectRoot);
      current[field] = filter;
      saveFilters(current, projectRoot)
        .then(() => resolve())
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears a specific filter field.
 */
export function clearFilter(
  field: keyof RepoFilters,
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const current = loadFilters(projectRoot);
      delete current[field];
      saveFilters(current, projectRoot)
        .then(() => resolve())
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}
