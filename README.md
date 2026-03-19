# GitHub topic “effective top repo” Telegram notifier

Polls a GitHub topic page (sorted as you choose in the URL), finds the first listed repository that is not in [`repo-blocklist.json`](repo-blocklist.json), and notifies a Telegram user when that **effective** top repo changes—or on first successful poll after startup.

## Setup

1. Copy `.env.example` to `.env` and fill in:

   - `TELEGRAM_BOT_TOKEN` — from BotFather
   - `TELEGRAM_USER_ID` — numeric ID; open a chat with your bot and send `/start` first
   - `GITHUB_TOPIC_URL_WITH_SORT_QUERY` — e.g. `https://github.com/topics/ai-agent?o=desc&s=updated`
   - `FETCHING_INTERVAL_TIME` — interval in **milliseconds**

2. Edit `repo-blocklist.json`: array of full names `owner/repo` (case-insensitive). Blocked repos are skipped when picking the effective top.

3. Install and run:

   ```bash
   npm install
   npm run build
   npm start
   ```

   For development without a separate build step:

   ```bash
   npm run dev
   ```

## Notes

- GitHub’s HTML is not a stable API; if the topic layout changes, update the parsing logic in `src/githubTopic.ts`.
- `lastTopFullName` is kept **in memory** only; restarting the process sends one notification for the current effective top again.
