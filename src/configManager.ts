import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadConfig, type AppConfig } from "./config.js";

const CONFIG_FILENAME = "repo-config.json";

/**
 * Initializes config file with empty object if it doesn't exist.
 */
export function initConfigFile(projectRoot: string = process.cwd()): void {
  const filePath = path.join(projectRoot, CONFIG_FILENAME);
  if (!existsSync(filePath)) {
    try {
      writeFileSync(filePath, "{}\n", "utf8");
      console.log(`[init] Created ${CONFIG_FILENAME}`);
    } catch (err) {
      console.error(`[init] Failed to create ${CONFIG_FILENAME}:`, err);
    }
  }
}

export type RuntimeConfig = {
  pollingIntervalMs?: number;
  githubTopicSlug?: string;
};

/**
 * Loads runtime config from repo-config.json (optional override for .env settings).
 */
export function loadRuntimeConfig(
  projectRoot: string = process.cwd(),
): RuntimeConfig {
  const filePath = path.join(projectRoot, CONFIG_FILENAME);
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed as RuntimeConfig;
  } catch {
    // File doesn't exist or invalid - return empty (use .env defaults)
    return {};
  }
}

/**
 * Merges .env config with runtime overrides from repo-config.json.
 */
export function getMergedConfig(): AppConfig & { runtimeOverrides: RuntimeConfig } {
  const envConfig = loadConfig();
  const runtimeOverrides = loadRuntimeConfig();
  return {
    ...envConfig,
    fetchingIntervalMs:
      runtimeOverrides.pollingIntervalMs ?? envConfig.fetchingIntervalMs,
    githubTopicSlug:
      runtimeOverrides.githubTopicSlug ?? envConfig.githubTopicSlug,
    runtimeOverrides,
  };
}

/**
 * Updates a runtime config setting and persists to file.
 */
export function updateConfig(
  setting: "interval" | "topic",
  value: string | number,
  projectRoot: string = process.cwd(),
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const current = loadRuntimeConfig(projectRoot);
      const filePath = path.join(projectRoot, CONFIG_FILENAME);

      if (setting === "interval") {
        const ms = typeof value === "number" ? value : Number.parseInt(value, 10);
        if (!Number.isFinite(ms) || ms <= 0) {
          reject(new Error("Interval must be a positive number (milliseconds)"));
          return;
        }
        current.pollingIntervalMs = ms;
      } else if (setting === "topic") {
        const slug = typeof value === "string" ? value.trim() : String(value).trim();
        if (slug.length === 0) {
          reject(new Error("Topic slug cannot be empty"));
          return;
        }
        current.githubTopicSlug = slug;
      } else {
        reject(new Error(`Unknown setting: ${setting}`));
        return;
      }

      writeFileSync(
        filePath,
        JSON.stringify(current, null, 2) + "\n",
        "utf8",
      );
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Formats current config for display in Telegram.
 */
export function getConfigSummary(): string {
  const merged = getMergedConfig();
  const lines: string[] = [
    "<b>Current Configuration</b>",
    "",
    `📊 Topic: <code>${merged.githubTopicSlug}</code>`,
    `⏱️ Polling Interval: <code>${merged.fetchingIntervalMs}ms</code> (${(merged.fetchingIntervalMs / 1000 / 60).toFixed(1)} minutes)`,
    `🔗 GitHub URL: ${merged.githubTopicUrl}`,
  ];

  if (merged.githubToken) {
    lines.push(`🔑 GitHub Token: <i>configured</i>`);
  } else {
    lines.push(`🔑 GitHub Token: <i>not set</i> (using unauthenticated API)`);
  }

  const runtime = merged.runtimeOverrides;
  if (Object.keys(runtime).length > 0) {
    lines.push("", "<b>Runtime Overrides:</b>");
    if (runtime.pollingIntervalMs) {
      lines.push(`  • Interval: ${runtime.pollingIntervalMs}ms`);
    }
    if (runtime.githubTopicSlug) {
      lines.push(`  • Topic: ${runtime.githubTopicSlug}`);
    }
  }

  return lines.join("\n");
}
