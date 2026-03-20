# GitHub topic “effective top repo” Telegram notifier

Polls a GitHub topic page (sorted as you choose in the URL), finds the first listed repository that is not in [`repo-blocklist.json`](repo-blocklist.json), and notifies a Telegram user when that **effective** top repo changes—or on first successful poll after startup.

## Setup

1. Copy `.env.example` to `.env` and fill in:

   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `TELEGRAM_USER_ID` — numeric ID; open a chat with your bot and send `/start` first
   - `GITHUB_TOPIC_URL_WITH_SORT_QUERY` — topic URL; the topic slug is derived from the path (e.g. `https://github.com/topics/ai-agent?o=desc&s=updated` → topic `ai-agent`). Repos are fetched via GitHub Search API sorted by recently updated.
   - `GITHUB_TOKEN` — optional; [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) for higher search rate limit (recommended).
   - `FETCHING_INTERVAL_TIME` — interval in **milliseconds**

2. Edit `repo-blocklist.json`: array of full names `owner/repo` (case-insensitive). Blocked repos are skipped when picking the effective top.

3. Edit `repo-filters.json` (optional): configure numeric range filters to narrow notifications. Only repos matching all specified ranges will trigger notifications. Example:
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

   For development, `npm run dev` runs the app via **nodemon** (restarts when `src/**/*.ts`, `repo-blocklist.json`, or `repo-filters.json` changes) and **tsx** (no `build` step):

   ```bash
   npm run dev
   ```

## Notes

- The process does **not** start Telegraf long polling (`getUpdates`). It only calls the Bot API for `getMe` at startup and `sendMessage` when needed—so it avoids hanging on long-lived update connections that some networks block or throttle.
- Repositories are fetched via the [GitHub REST Search API](https://docs.github.com/en/rest/search/search#search-repositories) (`topic:<slug>`, sort by updated); no HTML scraping.
- `lastTopFullName` is kept **in memory** only; restarting the process sends one notification for the current effective top again.
