import { Telegraf } from "telegraf";
import { loadBlocklistSet, pickEffectiveTop } from "./blocklist.js";
import { loadConfig } from "./config.js";
import { fetchTopicHtml, parseRepositories } from "./githubTopic.js";
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
  const bot = new Telegraf(config.telegramBotToken);

  let lastTopFullName: string | null = null;
  let fetching = false;

  const poll = async (): Promise<void> => {
    if (fetching) {
      return;
    }
    fetching = true;
    try {
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

      if (shouldNotify) {
        await bot.telegram.sendMessage(
          config.telegramUserId,
          formatRepoMessage(effective),
          {
            link_preview_options: { is_disabled: true },
          },
        );
        lastTopFullName = effective.fullName;
      }
    } catch (err) {
      console.error("[poll] error:", err);
    } finally {
      fetching = false;
    }
  };

  await bot.launch();
  await poll();
  const timer = setInterval(() => {
    void poll();
  }, config.fetchingIntervalMs);

  const shutdown = async (signal: string): Promise<void> => {
    clearInterval(timer);
    await bot.stop(signal);
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
