import { loadBlocklistSet, pickEffectiveTop } from "./blocklist.js";
import { loadConfig } from "./config.js";
import { loadFilters, matchesFilters } from "./filters.js";
import {
  fetchCommitCount,
  fetchContributorsCount,
  fetchRepoDetails,
  fetchTopicRepos,
} from "./githubTopic.js";
import { createTelegramBotService } from "./telegramBotService.js";
import type { TopRepo } from "./types.js";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatSize(sizeKB: number): string {
  if (sizeKB >= 1024 * 1024) {
    return (sizeKB / (1024 * 1024)).toFixed(1) + " GB";
  }
  if (sizeKB >= 1024) {
    return (sizeKB / 1024).toFixed(1) + " MB";
  }
  return sizeKB + " KB";
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

function formatRepoMessage(repo: TopRepo): string {
  const lines: string[] = [];
  
  // Header with status badges
  const badges: string[] = [];
  if (repo.archived) badges.push("📦 Archived");
  if (repo.fork) badges.push("🍴 Fork");
  if (repo.private) badges.push("🔒 Private");
  else if (repo.visibility) badges.push(`👁️ ${repo.visibility}`);
  
  // Enhanced repo name formatting with better visual separation - name is clickable
  const ownerPart = `<b>${repo.owner}</b>`;
  const namePart = `<b>${repo.name}</b>`;
  const repoName = `${ownerPart}<code>/</code>${namePart}`;
  const clickableRepoName = `<a href="${repo.url}">${repoName}</a>`;
  const header = `🔥 ${clickableRepoName}${badges.length > 0 ? `  ${badges.join(" ")}` : ""}`;
  lines.push(header);

  if (repo.description) {
    lines.push("", `📝 ${repo.description}`);
  }

  // Engagement stats (grouped together)
  const engagement: string[] = [];
  if (repo.stars !== undefined) {
    engagement.push(`⭐ <b>${formatNumber(repo.stars)}</b> stars`);
  }
  if (repo.forks !== undefined) {
    engagement.push(`🍴 <b>${formatNumber(repo.forks)}</b> forks`);
  }
  if (repo.subscribers !== undefined && repo.subscribers > 0) {
    engagement.push(`👀 <b>${formatNumber(repo.subscribers)}</b> watchers`);
  }
  if (engagement.length > 0) {
    lines.push("", engagement.join("  •  "));
  }

  // Activity stats (grouped together)
  const activity: string[] = [];
  if (repo.commitCount !== undefined && repo.commitCount > 0) {
    activity.push(`📝 <b>${formatNumber(repo.commitCount)}</b> commits`);
  }
  if (repo.contributorsCount !== undefined && repo.contributorsCount > 0) {
    activity.push(`👥 <b>${repo.contributorsCount}+</b> contributors`);
  }
  if (repo.openIssues !== undefined) {
    activity.push(`🐛 <b>${formatNumber(repo.openIssues)}</b> open issues`);
  }
  if (activity.length > 0) {
    lines.push("", activity.join("  •  "));
  }

  // Repository metadata (single line, less emphasis)
  const metadata: string[] = [];
  if (repo.language) {
    metadata.push(`💻 ${repo.language}`);
  }
  if (repo.size !== undefined && repo.size > 0) {
    metadata.push(`📦 ${formatSize(repo.size)}`);
  }
  if (repo.license) {
    metadata.push(`📄 ${repo.license}`);
  }
  if (metadata.length > 0) {
    lines.push("", metadata.join("  •  "));
  }

  // Timeline (one per line for better readability)
  if (repo.createdAt || repo.updatedAtIso || repo.pushedAt) {
    lines.push("");
    if (repo.createdAt) {
      lines.push(`📅 Created: ${formatDate(repo.createdAt)}`);
    }
    if (repo.updatedAtIso) {
      lines.push(`🕒 Updated: ${formatDate(repo.updatedAtIso)}`);
    }
    if (repo.pushedAt) {
      lines.push(`⬆️ Pushed: ${formatDate(repo.pushedAt)}`);
    }
  }

  // Additional resources (all as clickable links)
  const resources: string[] = [];
  if (repo.homepage) {
    resources.push(`🌐 <a href="${repo.homepage}">Homepage</a>`);
  }
  if (repo.hasIssues) {
    resources.push(`<a href="${repo.url}/issues">Issues</a>`);
  }
  if (repo.hasProjects) {
    resources.push(`<a href="${repo.url}/projects">Projects</a>`);
  }
  if (repo.hasWiki) {
    resources.push(`<a href="${repo.url}/wiki">Wiki</a>`);
  }
  if (repo.hasPages) {
    resources.push(`<a href="${repo.url}/settings/pages">Pages</a>`);
  }
  if (repo.hasDownloads) {
    resources.push(`<a href="${repo.url}/releases">Downloads</a>`);
  }
  if (resources.length > 0) {
    lines.push("", `🛠️ ${resources.join(" • ")}`);
  }

  // Topics (formatted for easy copying)
  if (repo.topics.length > 0) {
    const topicsList = repo.topics.slice(0, 8).join(", ");
    lines.push("", `🏷️ Topics:`, `<code>${topicsList}</code>`);
  }

  return lines.join("\n");
}

async function main(): Promise<void> {
  const config = loadConfig();
  console.log(
    `[startup] polling every ${config.fetchingIntervalMs}ms — topic: ${config.githubTopicSlug}${config.githubToken ? " (with token)" : ""}`,
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
      console.log("[poll] fetching topic via GitHub API…");
      const blocked = loadBlocklistSet();
      const filters = loadFilters();
      const repos = await fetchTopicRepos(
        config.githubTopicSlug,
        config.githubToken,
      );
      if (repos.length === 0) {
        console.error("[poll] no repositories returned from GitHub API");
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
        // Fetch detailed stats for the effective top repo
        try {
          const details = await fetchRepoDetails(
            effective.owner,
            effective.name,
            config.githubToken,
          );
          
          // Assign all basic stats
          effective.stars = details.stars;
          effective.forks = details.forks;
          effective.networkCount = details.networkCount;
          effective.subscribers = details.subscribers;
          effective.openIssues = details.openIssues;
          effective.createdAt = details.createdAt;
          effective.pushedAt = details.pushedAt;
          effective.size = details.size;
          effective.license = details.license;
          effective.homepage = details.homepage;
          effective.archived = details.archived;
          effective.fork = details.fork;
          effective.private = details.private;
          effective.visibility = details.visibility;
          effective.hasIssues = details.hasIssues;
          effective.hasProjects = details.hasProjects;
          effective.hasWiki = details.hasWiki;
          effective.hasPages = details.hasPages;
          effective.hasDownloads = details.hasDownloads;

          // Fetch contributors and commit count in parallel
          const [contributorsCount, commitCount] = await Promise.all([
            fetchContributorsCount(
              effective.owner,
              effective.name,
              config.githubToken,
            ),
            fetchCommitCount(
              effective.owner,
              effective.name,
              details.defaultBranch,
              config.githubToken,
            ),
          ]);
          effective.contributorsCount = contributorsCount;
          effective.commitCount = commitCount;
        } catch (err) {
          console.warn(
            "[poll] failed to fetch repo details (continuing with basic info):",
            err,
          );
        }

        // Check if repo matches configured range filters
        if (!matchesFilters(effective, filters)) {
          console.log(
            `[poll] ${effective.owner}/${effective.name} does not match range filters; skipping notification`,
          );
          // Still update lastTopFullName to avoid repeated checks
          lastTopFullName = effective.fullName;
          return;
        }

        await telegram.sendMessage(
          config.telegramUserId,
          formatRepoMessage(effective),
          { parse_mode: "HTML" },
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
