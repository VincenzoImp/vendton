import { Request, Response } from "express";

interface Joke {
  id: number;
  setup: string;
  punchline: string;
  category: string;
}

const jokes: Joke[] = [
  {
    id: 1,
    setup: "Why do programmers prefer dark mode?",
    punchline: "Because light attracts bugs.",
    category: "programming",
  },
  {
    id: 2,
    setup: "Why did the blockchain developer break up with the database?",
    punchline: "Too many trust issues.",
    category: "crypto",
  },
  {
    id: 3,
    setup: "What's a TON validator's favorite exercise?",
    punchline: "Running consensus rounds.",
    category: "crypto",
  },
  {
    id: 4,
    setup: "Why was the smart contract feeling lonely?",
    punchline: "It had no friends, only interfaces.",
    category: "crypto",
  },
  {
    id: 5,
    setup: "How many developers does it take to change a light bulb?",
    punchline: "None. That's a hardware problem.",
    category: "programming",
  },
  {
    id: 6,
    setup: "Why do Java developers wear glasses?",
    punchline: "Because they can't C#.",
    category: "programming",
  },
  {
    id: 7,
    setup: "What did the HTTP response say to the client?",
    punchline: "402 — Pay me first.",
    category: "web",
  },
  {
    id: 8,
    setup: "Why did the developer quit his job?",
    punchline: "Because he didn't get arrays. (a raise)",
    category: "programming",
  },
  {
    id: 9,
    setup: "What's a gas fee's favorite song?",
    punchline: "Every Breath You Take (every move you make, I'll be charging you).",
    category: "crypto",
  },
  {
    id: 10,
    setup: "Why don't blockchains ever get lost?",
    punchline: "They always follow the chain.",
    category: "crypto",
  },
];

export function jokeHandler(_req: Request, res: Response): void {
  const joke = jokes[Math.floor(Math.random() * jokes.length)];

  res.json({
    status: "success",
    data: joke,
    timestamp: new Date().toISOString(),
  });
}
