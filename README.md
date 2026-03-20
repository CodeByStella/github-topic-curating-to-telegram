# GitHub topic “effective top repo” Telegram notifier
<img width="440" height="372" alt="image" src="https://github.com/user-attachments/assets/f8e59c34-8402-45cc-910f-6fa32e1ce67d" />

Polls a GitHub topic page (sorted as you choose in the URL), finds the first listed repository that is not in [`repo-blocklist.json`](repo-blocklist.json), and notifies a Telegram user when that **effective** top repo changes—or on first successful poll after startup.

## Setup

1. Copy `.env.example` to `.env` and fill in:

   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `TELEGRAM_USER_ID` — numeric ID; open a chat with your bot and send `/start` first
   - `GITHUB_TOPIC_URL_WITH_SORT_QUERY` — topic URL; the topic slug is derived from the path (e.g. `https://github.com/topics/ai-agent?o=desc&s=updated` → topic `ai-agent`). Repos are fetched via GitHub Search API sorted by recently updated.
   - `GITHUB_TOKEN` — optional; [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for higher search rate limit (recommended).
   - `FETCHING_INTERVAL_TIME` — interval in **milliseconds**

2. Config files (`repo-blocklist.json`, `repo-filters.json`, `repo-config.json`) are auto-generated on first run if they don't exist. You can manage them via Telegram commands (see below) or edit manually.

   - `repo-blocklist.json`: array of full names `owner/repo` (case-insensitive). Blocked repos are skipped when picking the effective top.
   - `repo-filters.json`: configure numeric range filters to narrow notifications. Only repos matching all specified ranges will trigger notifications. Example:
   ```json
   {
     "stars": { "min": 10, "max": 500 },
     "forks": { "min": 5, "max": 100 },
     "openIssues": { "min": 0, "max": 50 }
   }
   ```
   - Set `min` and/or `max` for any field (stars, forks, subscribers, openIssues, commitCount, contributorsCount, size)
   - Use `null` to remove a bound (e.g., `{ "min": 10, "max": null }` means "at least 10, no upper limit")
   - Omit a field entirely to disable filtering for that field
   - Size is in KB

4. Install and run:

   ```bash
   npm install
   npm run build
   npm start
   ```

   For development, `npm run dev` runs the app via **nodemon** (restarts only when `src/**/*.ts` changes; config files are managed by the bot and don't trigger restarts) and **tsx** (no `build` step):

   ```bash
   npm run dev
   ```

## Telegram Commands

The bot supports interactive management via Telegram commands. All commands require authorization (only the configured `TELEGRAM_USER_ID` can use them).

### Status & Info
- `/start` - Welcome message with command list
- `/help` - Detailed help with examples
- `/status` - Show current configuration, blocklist count, and active filters

### Blocklist Management
- `/blocklist` - List all blocked repositories
- `/blocklist add <owner/repo>` - Add repository to blocklist
- `/blocklist remove <owner/repo>` - Remove repository from blocklist
- `/blocklist clear` - Clear entire blocklist

### Filter Management
- `/filters` - Show current range filters
- `/filters set <field> min <n> max <n>` - Set range filter (e.g., `stars min 10 max 500`)
- `/filters clear <field>` - Remove a specific filter
- `/filters reset` - Clear all filters

Available filter fields: `stars`, `forks`, `subscribers`, `openIssues`, `commitCount`, `contributorsCount`, `size`

### Config Management
- `/config` - Show current settings
- `/config interval <milliseconds>` - Set polling interval (takes effect on next poll cycle)
- `/config topic <slug>` - Change monitored topic (takes effect on next poll) (takes effect on next poll)

### Inline Buttons

Notification messages include inline buttons:
- **Block** - Quickly add the repository to blocklist
- **Explore** - Open the repository on GitHub

## Notes

- The bot uses **long polling** to receive commands and button clicks. This requires network access to `api.telegram.org`.
- Repositories are fetched via the [GitHub REST Search API](https://docs.github.com/en/rest/search/search#search-repositories) (`topic:<slug>`, sort by updated); no HTML scraping.
- Configuration changes via `/config` are saved to `repo-config.json` (optional override file).
- `lastTopFullName` is kept **in memory** only; restarting the process sends one notification for the current effective top again.
- Polling interval changes require a restart to take effect (the timer is set at startup).
