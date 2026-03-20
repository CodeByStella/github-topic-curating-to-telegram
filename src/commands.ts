import { Context, Telegraf } from "telegraf";
import {
  addToBlocklist,
  clearBlocklist,
  getBlocklistArray,
  isBlocked,
  loadBlocklistSet,
  removeFromBlocklist,
} from "./blocklist.js";
import {
  clearFilter,
  loadFilters,
  saveFilters,
  type RepoFilters,
  type RangeFilter,
  updateFilter,
} from "./filters.js";
import {
  getConfigSummary,
  updateConfig,
} from "./configManager.js";

const REPO_NAME_REGEX = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;

function validateRepoName(repoName: string): boolean {
  return REPO_NAME_REGEX.test(repoName.trim());
}

function isAuthorized(ctx: Context, authorizedUserId: string): boolean {
  return ctx.from?.id.toString() === authorizedUserId;
}

async function sendUnauthorized(ctx: Context): Promise<void> {
  await ctx.reply("❌ Unauthorized. Only the configured user can use commands.");
}

export function registerCommands(
  bot: Telegraf,
  authorizedUserId: string,
): void {
  // /start command
  bot.command("start", async (ctx: Context) => {
    if (!isAuthorized(ctx, authorizedUserId)) {
      await sendUnauthorized(ctx);
      return;
    }

    const helpText = [
      "👋 <b>GitHub Topic Monitor Bot</b>",
      "",
      "Available commands:",
      "",
      "📋 <b>Status & Info</b>",
      "  /status - Show current configuration",
      "  /help - Show detailed help",
      "",
      "🚫 <b>Blocklist Management</b>",
      "  /blocklist - List all blocked repositories",
      "  /blocklist add &lt;owner/repo&gt; - Add repo to blocklist",
      "  /blocklist remove &lt;owner/repo&gt; - Remove repo from blocklist",
      "  /blocklist clear - Clear entire blocklist",
      "",
      "🔍 <b>Filter Management</b>",
      "  /filters - Show current filters",
      "  /filters set &lt;field&gt; min &lt;n&gt; max &lt;n&gt; - Set range filter",
      "  /filters clear &lt;field&gt; - Remove filter",
      "  /filters reset - Clear all filters",
      "",
      "⚙️ <b>Config Management</b>",
      "  /config - Show current settings",
      "  /config interval &lt;milliseconds&gt; - Set polling interval",
      "  /config topic &lt;slug&gt; - Change monitored topic",
      "",
      "💡 <b>Tip:</b> Use inline buttons on notifications to quickly block repos!",
    ].join("\n");

    await ctx.reply(helpText, { parse_mode: "HTML" });
  });

  // /help command
  bot.command("help", async (ctx: Context) => {
    if (!isAuthorized(ctx, authorizedUserId)) {
      await sendUnauthorized(ctx);
      return;
    }

    const helpText = [
      "📖 <b>Detailed Help</b>",
      "",
      "<b>Blocklist Commands:</b>",
      "• <code>/blocklist</code> - View all blocked repositories",
      "• <code>/blocklist add owner/repo</code> - Block a repository",
      "• <code>/blocklist remove owner/repo</code> - Unblock a repository",
      "• <code>/blocklist clear</code> - Remove all blocks",
      "",
      "<b>Filter Commands:</b>",
      "Filter fields: stars, forks, subscribers, openIssues, commitCount, contributorsCount, size",
      "",
      "• <code>/filters</code> - View current filters",
      "• <code>/filters set stars min 10 max 500</code> - Set stars range (10-500)",
      "• <code>/filters set forks min 5</code> - Set minimum forks (no max)",
      "• <code>/filters set openIssues max 50</code> - Set maximum issues (no min)",
      "• <code>/filters clear stars</code> - Remove stars filter",
      "• <code>/filters reset</code> - Clear all filters",
      "",
      "<b>Config Commands:</b>",
      "• <code>/config</code> - View current configuration",
      "• <code>/config interval 300000</code> - Set polling to 5 minutes (300000ms)",
      "• <code>/config topic ai-agent</code> - Change topic to monitor",
      "",
      "<b>Examples:</b>",
      "• Block a repo: <code>/blocklist add microsoft/vscode</code>",
      "• Filter by stars: <code>/filters set stars min 100 max 1000</code>",
      "• Change interval: <code>/config interval 600000</code>",
    ].join("\n");

    await ctx.reply(helpText, { parse_mode: "HTML" });
  });

  // /status command
  bot.command("status", async (ctx: Context) => {
    if (!isAuthorized(ctx, authorizedUserId)) {
      await sendUnauthorized(ctx);
      return;
    }

    try {
      const configSummary = getConfigSummary();
      const blocklist = getBlocklistArray();
      const filters = loadFilters();

      const statusText = [
        configSummary,
        "",
        `<b>Blocklist:</b> <code>${blocklist.length}</code> repositories blocked`,
        `<b>Active Filters:</b> <code>${Object.keys(filters).length}</code> filters configured`,
      ].join("\n");

      await ctx.reply(statusText, { parse_mode: "HTML" });
    } catch (err) {
      await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // /blocklist command
  bot.command("blocklist", async (ctx: Context) => {
    if (!isAuthorized(ctx, authorizedUserId)) {
      await sendUnauthorized(ctx);
      return;
    }

    const args = ctx.message && "text" in ctx.message
      ? ctx.message.text.split(" ").slice(1)
      : [];

    if (args.length === 0) {
      // List blocklist
      const blocklist = getBlocklistArray();
      if (blocklist.length === 0) {
        await ctx.reply("📋 Blocklist is empty.");
        return;
      }

      const chunks: string[] = [];
      for (let i = 0; i < blocklist.length; i += 10) {
        const page = blocklist.slice(i, i + 10);
        chunks.push(page.map((repo, idx) => `${i + idx + 1}. <code>${repo}</code>`).join("\n"));
      }

      const text = `<b>Blocklist (${blocklist.length} repos):</b>\n\n${chunks[0]}`;
      await ctx.reply(text, { parse_mode: "HTML" });
      return;
    }

    const action = args[0]?.toLowerCase();

    if (action === "add" && args.length >= 2) {
      const repoName = args.slice(1).join(" ");
      if (!validateRepoName(repoName)) {
        await ctx.reply(`❌ Invalid repo format: <code>${repoName}</code>\nUse format: <code>owner/repo</code>`, {
          parse_mode: "HTML",
        });
        return;
      }

      try {
        await addToBlocklist(repoName);
        await ctx.reply(`✅ Added <code>${repoName}</code> to blocklist.`, {
          parse_mode: "HTML",
        });
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (action === "remove" && args.length >= 2) {
      const repoName = args.slice(1).join(" ");
      if (!validateRepoName(repoName)) {
        await ctx.reply(`❌ Invalid repo format: <code>${repoName}</code>\nUse format: <code>owner/repo</code>`, {
          parse_mode: "HTML",
        });
        return;
      }

      try {
        await removeFromBlocklist(repoName);
        await ctx.reply(`✅ Removed <code>${repoName}</code> from blocklist.`, {
          parse_mode: "HTML",
        });
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (action === "clear") {
      try {
        await clearBlocklist();
        await ctx.reply("✅ Blocklist cleared.");
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      await ctx.reply(
        "Usage:\n• <code>/blocklist</code> - List blocked repos\n• <code>/blocklist add owner/repo</code> - Add to blocklist\n• <code>/blocklist remove owner/repo</code> - Remove from blocklist\n• <code>/blocklist clear</code> - Clear all",
        { parse_mode: "HTML" },
      );
    }
  });

  // /filters command
  bot.command("filters", async (ctx: Context) => {
    if (!isAuthorized(ctx, authorizedUserId)) {
      await sendUnauthorized(ctx);
      return;
    }

    const args = ctx.message && "text" in ctx.message
      ? ctx.message.text.split(" ").slice(1)
      : [];

    if (args.length === 0) {
      // Show current filters
      const filters = loadFilters();
      const keys = Object.keys(filters) as Array<keyof RepoFilters>;
      if (keys.length === 0) {
        await ctx.reply("🔍 No filters configured.");
        return;
      }

      const lines = keys.map((key) => {
        const filter = filters[key];
        const parts: string[] = [];
        if (filter?.min !== null && filter?.min !== undefined) {
          parts.push(`min: ${filter.min}`);
        }
        if (filter?.max !== null && filter?.max !== undefined) {
          parts.push(`max: ${filter.max}`);
        }
        return `• <b>${key}</b>: ${parts.length > 0 ? parts.join(", ") : "no bounds"}`;
      });

      await ctx.reply(`<b>Active Filters:</b>\n\n${lines.join("\n")}`, {
        parse_mode: "HTML",
      });
      return;
    }

    const action = args[0]?.toLowerCase();

    if (action === "set" && args.length >= 2) {
      const field = args[1] as keyof RepoFilters;
      const validFields: Array<keyof RepoFilters> = [
        "stars",
        "forks",
        "subscribers",
        "openIssues",
        "commitCount",
        "contributorsCount",
        "size",
      ];

      if (!validFields.includes(field)) {
        await ctx.reply(
          `❌ Invalid field: <code>${field}</code>\nValid fields: ${validFields.join(", ")}`,
          { parse_mode: "HTML" },
        );
        return;
      }

      let min: number | null = null;
      let max: number | null = null;

      for (let i = 2; i < args.length; i++) {
        if (args[i]?.toLowerCase() === "min" && i + 1 < args.length) {
          const val = Number.parseFloat(args[i + 1] ?? "");
          if (!Number.isFinite(val)) {
            await ctx.reply(`❌ Invalid min value: ${args[i + 1]}`);
            return;
          }
          min = val;
          i++;
        } else if (args[i]?.toLowerCase() === "max" && i + 1 < args.length) {
          const val = Number.parseFloat(args[i + 1] ?? "");
          if (!Number.isFinite(val)) {
            await ctx.reply(`❌ Invalid max value: ${args[i + 1]}`);
            return;
          }
          max = val;
          i++;
        }
      }

      if (min === null && max === null) {
        await ctx.reply("❌ Must specify at least min or max");
        return;
      }

      try {
        const filter: RangeFilter = { min, max };
        await updateFilter(field, filter);
        const parts: string[] = [];
        if (min !== null) parts.push(`min: ${min}`);
        if (max !== null) parts.push(`max: ${max}`);
        await ctx.reply(`✅ Filter <b>${field}</b> set: ${parts.join(", ")}`, {
          parse_mode: "HTML",
        });
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (action === "clear" && args.length >= 2) {
      const field = args[1] as keyof RepoFilters;
      try {
        await clearFilter(field);
        await ctx.reply(`✅ Filter <b>${field}</b> cleared.`, {
          parse_mode: "HTML",
        });
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (action === "reset") {
      try {
        await saveFilters({});
        await ctx.reply("✅ All filters cleared.");
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      await ctx.reply(
        "Usage:\n• <code>/filters</code> - Show filters\n• <code>/filters set &lt;field&gt; min &lt;n&gt; max &lt;n&gt;</code> - Set filter\n• <code>/filters clear &lt;field&gt;</code> - Clear filter\n• <code>/filters reset</code> - Clear all",
        { parse_mode: "HTML" },
      );
    }
  });

  // /config command
  bot.command("config", async (ctx: Context) => {
    if (!isAuthorized(ctx, authorizedUserId)) {
      await sendUnauthorized(ctx);
      return;
    }

    const args = ctx.message && "text" in ctx.message
      ? ctx.message.text.split(" ").slice(1)
      : [];

    if (args.length === 0) {
      // Show config
      const summary = getConfigSummary();
      await ctx.reply(summary, { parse_mode: "HTML" });
      return;
    }

    const setting = args[0]?.toLowerCase();

    if (setting === "interval" && args.length >= 2) {
      const value = args[1];
      try {
        await updateConfig("interval", value);
        const ms = Number.parseInt(value, 10);
        const minutes = (ms / 1000 / 60).toFixed(1);
        await ctx.reply(
          `✅ Polling interval set to <code>${value}ms</code> (${minutes} minutes)\n\nTakes effect on next poll cycle.`,
          { parse_mode: "HTML" },
        );
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else if (setting === "topic" && args.length >= 2) {
      const value = args.slice(1).join(" ");
      try {
        await updateConfig("topic", value);
        await ctx.reply(`✅ Topic set to <code>${value}</code>`, {
          parse_mode: "HTML",
        });
      } catch (err) {
        await ctx.reply(`❌ Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      await ctx.reply(
        "Usage:\n• <code>/config</code> - Show config\n• <code>/config interval &lt;milliseconds&gt;</code> - Set interval\n• <code>/config topic &lt;slug&gt;</code> - Set topic",
        { parse_mode: "HTML" },
      );
    }
  });
}

/**
 * Registers callback query handlers for inline buttons.
 */
export function registerCallbacks(
  bot: Telegraf,
  authorizedUserId: string,
): void {
  bot.on("callback_query", async (ctx: Context) => {
    if (!ctx.from || !isAuthorized(ctx, authorizedUserId)) {
      await ctx.answerCbQuery("❌ Unauthorized");
      return;
    }

    if (!("data" in ctx.callbackQuery!)) {
      await ctx.answerCbQuery();
      return;
    }

    const data = ctx.callbackQuery.data as string;

    if (data.startsWith("block:")) {
      const repoName = data.slice(6); // Remove "block:" prefix
      if (!validateRepoName(repoName)) {
        await ctx.answerCbQuery("❌ Invalid repo format");
        return;
      }

      // Check if already blocked
      const blocked = loadBlocklistSet();
      if (isBlocked(repoName, blocked)) {
        await ctx.answerCbQuery(`ℹ️ ${repoName} already blocked`);
        return;
      }

      try {
        await addToBlocklist(repoName);
        await ctx.answerCbQuery(`✅ ${repoName} blocked`);
        await ctx.editMessageReplyMarkup(undefined); // Remove buttons
        await ctx.reply(`✅ Added <code>${repoName}</code> to blocklist.`, {
          parse_mode: "HTML",
        });
      } catch (err) {
        await ctx.answerCbQuery(
          `❌ Error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      await ctx.answerCbQuery();
    }
  });
}
