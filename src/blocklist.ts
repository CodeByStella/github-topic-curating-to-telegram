import { readFileSync } from "node:fs";
import path from "node:path";

const BLOCKLIST_FILENAME = "repo-blocklist.json";

function normalizeFullName(entry: string): string {
  return entry.trim().toLowerCase();
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
