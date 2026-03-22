import "dotenv/config";
import { Bot } from "grammy";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://vendton.vercel.app";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN environment variable is required");
  process.exit(1);
}

const bot = new Bot(BOT_TOKEN);

bot.command("start", async (ctx) => {
  await ctx.reply(
    "Welcome to VendTON!\n\nDeploy paid API endpoints, earn USDT, or ask AI to use them.",
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open VendTON",
              web_app: { url: MINI_APP_URL },
            },
          ],
        ],
      },
    },
  );
});

bot.catch((err) => {
  console.error("Bot error:", err);
});

console.log("Starting VendTON bot...");
bot.start();
