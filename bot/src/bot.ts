import "dotenv/config";
import { Bot } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://mesh402.vercel.app";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN environment variable is required");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to mesh402!\n\n" +
      "The open marketplace where AI agents discover, use, and pay for services on TON.\n\n" +
      "Deploy your API, set a price in USDT, and start earning — or let an AI agent find and pay for the services you need.\n\n" +
      "Tap below to open the app:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Browse Marketplace",
              web_app: { url: MINI_APP_URL },
            },
          ],
          [
            {
              text: "Deploy a Service",
              web_app: { url: `${MINI_APP_URL}/deploy` },
            },
          ],
          [
            {
              text: "Agent Playground",
              web_app: { url: `${MINI_APP_URL}/playground` },
            },
          ],
        ],
      },
    },
  );
});

bot.command("deploy", async (ctx) => {
  await ctx.reply(
    "Deploy your API to the marketplace and start earning USDT:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Deploy Now",
              web_app: { url: `${MINI_APP_URL}/deploy` },
            },
          ],
        ],
      },
    },
  );
});

bot.command("services", async (ctx) => {
  await ctx.reply("Browse available paid services on the marketplace:", {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Open Marketplace",
            web_app: { url: MINI_APP_URL },
          },
        ],
      ],
    },
  });
});

bot.command("agent", async (ctx) => {
  await ctx.reply(
    "Watch an AI agent autonomously discover, chain, and pay for services:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Agent Playground",
              web_app: { url: `${MINI_APP_URL}/playground` },
            },
          ],
        ],
      },
    },
  );
});

bot.command("dashboard", async (ctx) => {
  await ctx.reply("View your revenue and transaction history:", {
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
    "Bot Commands:\n\n" +
      "/start — Welcome & browse marketplace\n" +
      "/deploy — Deploy your API service\n" +
      "/services — Browse paid services\n" +
      "/agent — Watch AI agent demo\n" +
      "/dashboard — Revenue & transaction history\n" +
      "/help — This message",
  );
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log("Starting bot...");
bot.start();
