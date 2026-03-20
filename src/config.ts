import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") {
    throw new Error(`Missing or empty environment variable: ${name}`);
  }
  return v.trim();
}

function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") return undefined;
  return v.trim();
}

const TOPIC_PATH = /^\/topics\/([^/]+)\/?$/;

function parseTopicSlugFromUrl(topicUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(topicUrl).pathname;
  } catch {
    throw new Error(
      "GITHUB_TOPIC_URL_WITH_SORT_QUERY must be a valid URL (e.g. https://github.com/topics/ai-agent?o=desc&s=updated)",
    );
  }
  const m = pathname.match(TOPIC_PATH);
  if (!m || !m[1]) {
    throw new Error(
      "GITHUB_TOPIC_URL_WITH_SORT_QUERY must be a topic URL like https://github.com/topics/ai-agent",
    );
  }
  return m[1];
}

export type AppConfig = {
  telegramBotToken: string;
  telegramUserId: string;
  githubTopicUrl: string;
  githubTopicSlug: string;
  githubToken: string | undefined;
  fetchingIntervalMs: number;
};

export function loadConfig(): AppConfig {
  const telegramBotToken = requireEnv("TELEGRAM_BOT_TOKEN");
  const telegramUserId = requireEnv("TELEGRAM_USER_ID");
  const githubTopicUrl = requireEnv("GITHUB_TOPIC_URL_WITH_SORT_QUERY");
  const githubTopicSlug = parseTopicSlugFromUrl(githubTopicUrl);
  const githubToken = optionalEnv("GITHUB_TOKEN");
  const intervalRaw = requireEnv("FETCHING_INTERVAL_TIME");
  const fetchingIntervalMs = Number(intervalRaw);
  if (!Number.isFinite(fetchingIntervalMs) || fetchingIntervalMs <= 0) {
    throw new Error(
      "FETCHING_INTERVAL_TIME must be a positive number (milliseconds)",
    );
  }
  return {
    telegramBotToken,
    telegramUserId,
    githubTopicUrl,
    githubTopicSlug,
    githubToken,
    fetchingIntervalMs,
  };
}
