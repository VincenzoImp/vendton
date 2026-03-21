import { Bot } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://x402-ton.vercel.app";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN environment variable is required");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to x402-TON!\n\n" +
      "The first implementation of Coinbase's x402 payment protocol on TON. " +
      "Watch AI agents pay for HTTP services with USDT in real-time.\n\n" +
      "Tap below to open the app:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open x402-TON",
              web_app: { url: MINI_APP_URL },
            },
          ],
          [
            {
              text: "Live Agent Demo",
              web_app: { url: `${MINI_APP_URL}/agent-demo` },
            },
          ],
        ],
      },
    },
  );
});

bot.command("demo", async (ctx) => {
  await ctx.reply(
    "Watch an AI agent autonomously pay for API services using x402 on TON:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Start Live Demo",
              web_app: { url: `${MINI_APP_URL}/agent-demo` },
            },
          ],
        ],
      },
    },
  );
});

bot.command("pay", async (ctx) => {
  await ctx.reply("Access paid services manually — pay with USDT on TON:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Browse Services",
            web_app: { url: `${MINI_APP_URL}/manual-pay` },
          },
        ],
      ],
    },
  });
});

bot.command("dashboard", async (ctx) => {
  await ctx.reply("View your transaction history and stats:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open Dashboard",
            web_app: { url: `${MINI_APP_URL}/dashboard` },
          },
        ],
      ],
    },
  });
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "x402-TON Bot Commands:\n\n" +
      "/start — Welcome & open app\n" +
      "/demo — Watch AI agent demo\n" +
      "/pay — Access paid services\n" +
      "/dashboard — Transaction history\n" +
      "/help — This message",
  );
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log("Starting x402-TON bot...");
bot.start();
