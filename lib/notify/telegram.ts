/**
 * Telegram Bot API sender for ops notifications.
 *
 * Setup (one-off, ~2 minutes):
 *   1. Message @BotFather → /newbot → copy the token into TELEGRAM_BOT_TOKEN.
 *   2. Add the bot to the ops group. For groups, also turn off privacy mode
 *      (@BotFather → /setprivacy → Disable) if you later want it to read messages;
 *      posting works either way.
 *   3. Get the chat id: send any message in the group, then open
 *      https://api.telegram.org/bot<TOKEN>/getUpdates and read
 *      `result[].message.chat.id` — group ids are negative, e.g. -1001234567890.
 *      Put it in TELEGRAM_CHAT_ID.
 */

export interface SendResult {
  ok: boolean;
  error?: string;
}

const TELEGRAM_API = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" };
  }

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      // Telegram is occasionally slow; do not let the cron hang on it.
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      // Telegram puts the real reason in the body ("chat not found", "bot was
      // blocked"), which is what you actually need when the digest goes quiet.
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `telegram ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown send error" };
  }
}
