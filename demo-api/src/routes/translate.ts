import { Request, Response } from "express";

const translations: Record<string, Record<string, string>> = {
  fr: {
    "hello": "bonjour",
    "goodbye": "au revoir",
    "thank you": "merci",
    "how are you": "comment allez-vous",
    "good morning": "bonjour",
    "good night": "bonne nuit",
    "please": "s'il vous plait",
    "yes": "oui",
    "no": "non",
    "welcome": "bienvenue",
    "i love blockchain": "j'adore la blockchain",
    "pay per request": "payer par requete",
  },
  de: {
    "hello": "hallo",
    "goodbye": "auf wiedersehen",
    "thank you": "danke",
    "how are you": "wie geht es ihnen",
    "good morning": "guten morgen",
    "good night": "gute nacht",
    "please": "bitte",
    "yes": "ja",
    "no": "nein",
    "welcome": "willkommen",
    "i love blockchain": "ich liebe blockchain",
    "pay per request": "bezahlen pro anfrage",
  },
  es: {
    "hello": "hola",
    "goodbye": "adios",
    "thank you": "gracias",
    "how are you": "como estas",
    "good morning": "buenos dias",
    "good night": "buenas noches",
    "please": "por favor",
    "yes": "si",
    "no": "no",
    "welcome": "bienvenido",
    "i love blockchain": "me encanta la blockchain",
    "pay per request": "pagar por solicitud",
  },
  ja: {
    "hello": "konnichiwa",
    "goodbye": "sayonara",
    "thank you": "arigatou gozaimasu",
    "how are you": "ogenki desu ka",
    "good morning": "ohayou gozaimasu",
    "good night": "oyasuminasai",
    "please": "onegaishimasu",
    "yes": "hai",
    "no": "iie",
    "welcome": "youkoso",
    "i love blockchain": "blockchain ga daisuki desu",
    "pay per request": "rikuesuto goto no shiharai",
  },
};

const supportedLanguages: Record<string, string> = {
  fr: "French",
  de: "German",
  es: "Spanish",
  ja: "Japanese",
};

export function translateHandler(req: Request, res: Response): void {
  const { text, targetLanguage } = req.body as {
    text?: string;
    targetLanguage?: string;
  };

  if (!text || !targetLanguage) {
    res.status(400).json({
      error: "Missing required fields",
      message: "Request body must include 'text' and 'targetLanguage'",
      supportedLanguages,
    });
    return;
  }

  const langKey = targetLanguage.toLowerCase();
  const langTranslations = translations[langKey];

  if (!langTranslations) {
    res.status(400).json({
      error: "Unsupported language",
      message: `Language "${targetLanguage}" is not supported`,
      supportedLanguages,
    });
    return;
  }

  const normalizedText = text.toLowerCase().trim();
  const translated = langTranslations[normalizedText];

  if (!translated) {
    // For unknown phrases, return a mock "transliteration" for demo purposes
    const langName = supportedLanguages[langKey];
    res.json({
      status: "success",
      data: {
        originalText: text,
        translatedText: `[${langName} translation of "${text}"]`,
        targetLanguage: langKey,
        targetLanguageName: langName,
        confidence: 0.65,
        note: "Phrase not in demo dictionary; a real service would provide a full translation.",
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  res.json({
    status: "success",
    data: {
      originalText: text,
      translatedText: translated,
      targetLanguage: langKey,
      targetLanguageName: supportedLanguages[langKey],
      confidence: 0.98,
    },
    timestamp: new Date().toISOString(),
  });
}
