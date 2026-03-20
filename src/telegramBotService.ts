import { Telegraf } from "telegraf";
import type { InlineKeyboardMarkup } from "telegraf/types";

const sendOpts = {
  link_preview_options: { is_disabled: true },
} as const;

/**
 * Enhanced Telegram bot service with command and callback support.
 * Now uses long polling to receive updates for interactive management.
 */
export type TelegramBotService = {
  /** One-shot Bot API call to confirm the token and log the bot identity at startup. */
  getMe: () => Promise<{ username: string }>;
  sendMessage: (
    chatId: string,
    text: string,
    options?: {
      parse_mode?: "HTML" | "Markdown";
      reply_markup?: InlineKeyboardMarkup;
    },
  ) => Promise<void>;
  launch: () => Promise<void>;
  getBot: () => Telegraf;
};

export function createTelegramBotService(token: string): TelegramBotService {
  const bot = new Telegraf(token);
  return {
    getMe: async () => {
      const me = await bot.telegram.getMe();
      return { username: me.username };
    },
    sendMessage: async (chatId, text, options) => {
      await bot.telegram.sendMessage(chatId, text, {
        ...sendOpts,
        ...options,
      });
    },
    launch: async () => {
      await bot.launch();
    },
    getBot: () => bot,
  };
}
