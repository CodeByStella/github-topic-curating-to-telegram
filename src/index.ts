import { loadBlocklistSet, pickEffectiveTop } from "./blocklist.js";
import { loadConfig } from "./config.js";
import { fetchTopicHtml, parseRepositories } from "./githubTopic.js";
import { createTelegramBotService } from "./telegramBotService.js";
import type { TopRepo } from "./types.js";

function formatRepoMessage(repo: TopRepo): string {
  const lines: string[] = [`Top repo: ${repo.owner}/${repo.name}`, repo.url];
  if (repo.description) {
    lines.push("", repo.description);
  }
  if (repo.updatedAtIso) {
    lines.push("", `Updated: ${repo.updatedAtIso}`);
  }
  if (repo.language) {
    lines.push(`Language: ${repo.language}`);
  }
  if (repo.topics.length > 0) {
    lines.push(`Topics: ${repo.topics.join(", ")}`);
  }
  return lines.join("\n");
}

async function main(): Promise<void> {
  const config = loadConfig();
  console.log(
    `[startup] polling every ${config.fetchingIntervalMs}ms — ${config.githubTopicUrl}`,
  );
  const telegram = createTelegramBotService(config.telegramBotToken);

  let lastTopFullName: string | null = null;
  let fetching = false;

  const poll = async (): Promise<void> => {
    if (fetching) {
      return;
    }
    fetching = true;
    try {
      console.log("[poll] fetching topic page…");
      const blocked = loadBlocklistSet();
      const html = await fetchTopicHtml(config.githubTopicUrl);
      const repos = parseRepositories(html);
      if (repos.length === 0) {
        console.error("[poll] no repositories parsed from topic page");
        return;
      }
      const effective = pickEffectiveTop(repos, blocked);
      if (!effective) {
        console.warn(
          "[poll] all parsed repositories are blocklisted; skipping update",
        );
        return;
      }

      const shouldNotify =
        lastTopFullName === null || effective.fullName !== lastTopFullName;

      console.log(
        `[poll] effective top: ${effective.owner}/${effective.name} (${repos.length} repos on page)`,
      );

      if (shouldNotify) {
        await telegram.sendMessage(
          config.telegramUserId,
          formatRepoMessage(effective),
        );
        lastTopFullName = effective.fullName;
        console.log("[poll] sent Telegram notification");
      } else {
        console.log("[poll] top unchanged — no Telegram message");
      }
    } catch (err) {
      console.error("[poll] error:", err);
    } finally {
      fetching = false;
    }
  };

  console.log("[startup] verifying Telegram bot token (single getMe, no long polling)…");
  try {
    const { username } = await telegram.getMe();
    console.log(`[startup] Telegram OK — bot @${username}; Ctrl+C to stop`);
  } catch (err) {
    console.error(
      "[startup] Telegram getMe failed (check token, firewall, or api.telegram.org reachability):",
      err,
    );
    process.exit(1);
  }
  await poll();
  const timer = setInterval(() => {
    void poll();
  }, config.fetchingIntervalMs);

  const shutdown = (signal: string): void => {
    clearInterval(timer);
    console.log(`[shutdown] ${signal}`);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
