import "dotenv/config";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v.trim() === "") {
    throw new Error(`Missing or empty environment variable: ${name}`);
  }
  return v.trim();
}

export type AppConfig = {
  telegramBotToken: string;
  telegramUserId: string;
  githubTopicUrl: string;
  fetchingIntervalMs: number;
};

export function loadConfig(): AppConfig {
  const telegramBotToken = requireEnv("TELEGRAM_BOT_TOKEN");
  const telegramUserId = requireEnv("TELEGRAM_USER_ID");
  const githubTopicUrl = requireEnv("GITHUB_TOPIC_URL_WITH_SORT_QUERY");
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
    fetchingIntervalMs,
  };
}
