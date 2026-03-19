import { Telegraf } from "telegraf";

const sendOpts = {
  link_preview_options: { is_disabled: true },
} as const;

/**
 * Outbound-only Telegram helper. We intentionally do **not** call `Telegraf.launch()`:
 * launch starts long-polling (`getUpdates`), which can hang indefinitely behind some
 * networks/firewalls even though `sendMessage` / `getMe` work fine via short HTTP calls.
 */
export type TelegramBotService = {
  /** One-shot Bot API call to confirm the token and log the bot identity at startup. */
  getMe: () => Promise<{ username: string }>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
};

export function createTelegramBotService(token: string): TelegramBotService {
  const bot = new Telegraf(token);
  return {
    getMe: async () => {
      const me = await bot.telegram.getMe();
      return { username: me.username };
    },
    sendMessage: async (chatId, text) => {
      await bot.telegram.sendMessage(chatId, text, sendOpts);
    },
  };
}
