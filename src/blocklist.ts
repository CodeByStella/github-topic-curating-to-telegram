import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BLOCKLIST_FILENAME = "repo-blocklist.json";

function normalizeFullName(entry: string): string {
  return entry.trim().toLowerCase();
}

/**
 * Initializes blocklist file with empty array if it doesn't exist.
 */
export function initBlocklistFile(
  projectRoot: string = process.cwd(),
): void {
  const filePath = path.join(projectRoot, BLOCKLIST_FILENAME);
  if (!existsSync(filePath)) {
    try {
      writeFileSync(filePath, "[]\n", "utf8");
      console.log(`[init] Created ${BLOCKLIST_FILENAME}`);
    } catch (err) {
      console.error(`[init] Failed to create ${BLOCKLIST_FILENAME}:`, err);
    }
  }
}

/** Reads blocklist from project root on each call (small file; edits apply without restart). */
export function loadBlocklistSet(projectRoot: string = process.cwd()): Set<string> {
  const filePath = path.join(projectRoot, BLOCKLIST_FILENAME);
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.error(`[blocklist] ${BLOCKLIST_FILENAME} must be a JSON array of strings`);
      return new Set();
    }
    const set = new Set<string>();
    for (const item of parsed) {
      if (typeof item === "string" && item.includes("/")) {
        set.add(normalizeFullName(item));
      }
    }
    return set;
  } catch (err) {
    console.error(`[blocklist] could not read ${filePath}:`, err);
    return new Set();
  }
}

export function isBlocked(fullName: string, blocked: Set<string>): boolean {
  return blocked.has(fullName.toLowerCase());
}

export function pickEffectiveTop<T extends { fullName: string }>(
  repos: readonly T[],
  blocked: Set<string>,
): T | null {
  for (const r of repos) {
    if (!isBlocked(r.fullName, blocked)) {
      return r;
    }
  }
  return null;
}

/**
 * Returns the current blocklist as an array of strings (for listing/display).
 */
export function getBlocklistArray(
  projectRoot: string = process.cwd(),
): string[] {
  const filePath = path.join(projectRoot, BLOCKLIST_FILENAME);
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (item): item is string => typeof item === "string" && item.includes("/"),
    );
  } catch {
    return [];
  }
}

/**
 * Adds a repository to the blocklist and persists to file.
 */
export function addToBlocklist(
  fullName: string,
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeFullName(fullName);
      if (!fullName.includes("/")) {
        reject(new Error(`Invalid repo format: ${fullName} (must be owner/repo)`));
        return;
      }

      const current = getBlocklistArray(projectRoot);
      const normalizedSet = new Set(current.map(normalizeFullName));

      if (normalizedSet.has(normalized)) {
        resolve(); // Already blocked, no error
        return;
      }

      // Add original format (preserve casing) if not already present
      const originalFormat = fullName.trim();
      if (!current.some((item) => normalizeFullName(item) === normalized)) {
        current.push(originalFormat);
      }

      const filePath = path.join(projectRoot, BLOCKLIST_FILENAME);
      writeFileSync(filePath, JSON.stringify(current, null, 2) + "\n", "utf8");
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Removes a repository from the blocklist and persists to file.
 */
export function removeFromBlocklist(
  fullName: string,
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const normalized = normalizeFullName(fullName);
      const current = getBlocklistArray(projectRoot);
      const filtered = current.filter(
        (item) => normalizeFullName(item) !== normalized,
      );

      if (filtered.length === current.length) {
        resolve(); // Not in blocklist, no error
        return;
      }

      const filePath = path.join(projectRoot, BLOCKLIST_FILENAME);
      writeFileSync(filePath, JSON.stringify(filtered, null, 2) + "\n", "utf8");
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Clears the entire blocklist.
 */
export function clearBlocklist(
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(projectRoot, BLOCKLIST_FILENAME);
      writeFileSync(filePath, "[]\n", "utf8");
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}
