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
      "The open marketplace for paid AI skills on TON.\n\n" +
      "Browse skills, deploy your own API to earn USDT, or use the AI Playground to call paid skills with your Claude API key.\n\n" +
      "Tap below to get started:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Browse Skills",
              web_app: { url: MINI_APP_URL },
            },
          ],
          [
            {
              text: "Deploy a Skill",
              web_app: { url: `${MINI_APP_URL}/deploy` },
            },
          ],
          [
            {
              text: "AI Playground",
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
    "Deploy your API as a paid skill and start earning USDT:",
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

bot.command("skills", async (ctx) => {
  await ctx.reply("Browse available paid skills on the marketplace:", {
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

bot.command("playground", async (ctx) => {
  await ctx.reply(
    "Use the AI Playground — bring your Claude API key and explore paid skills:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open Playground",
              web_app: { url: `${MINI_APP_URL}/playground` },
            },
          ],
        ],
      },
    },
  );
});

bot.command("dashboard", async (ctx) => {
  await ctx.reply("View your earnings and spending:", {
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
    "mesh402 Bot Commands:\n\n" +
      "/start — Welcome & open app\n" +
      "/skills — Browse paid skills\n" +
      "/deploy — Publish your API as a skill\n" +
      "/playground — AI Playground with Claude\n" +
      "/dashboard — Earnings & spending\n" +
      "/help — This message",
  );
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log("Starting mesh402 bot...");
bot.start();
