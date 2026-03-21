import { Request, Response } from "express";

interface WeatherData {
  city: string;
  temperature: number;
  unit: string;
  condition: string;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  forecast: string;
}

const weatherDatabase: Record<string, WeatherData> = {
  london: {
    city: "London",
    temperature: 14,
    unit: "celsius",
    condition: "Overcast with light drizzle",
    humidity: 82,
    windSpeed: 18,
    windDirection: "SW",
    forecast: "Clearing skies expected by evening",
  },
  tokyo: {
    city: "Tokyo",
    temperature: 22,
    unit: "celsius",
    condition: "Partly cloudy",
    humidity: 58,
    windSpeed: 12,
    windDirection: "E",
    forecast: "Warm and pleasant through the week",
  },
  "new york": {
    city: "New York",
    temperature: 18,
    unit: "celsius",
    condition: "Sunny with scattered clouds",
    humidity: 45,
    windSpeed: 22,
    windDirection: "NW",
    forecast: "Chance of thunderstorms tomorrow afternoon",
  },
  paris: {
    city: "Paris",
    temperature: 16,
    unit: "celsius",
    condition: "Clear skies",
    humidity: 55,
    windSpeed: 10,
    windDirection: "N",
    forecast: "Mild temperatures continuing through midweek",
  },
  sydney: {
    city: "Sydney",
    temperature: 26,
    unit: "celsius",
    condition: "Bright sunshine",
    humidity: 40,
    windSpeed: 15,
    windDirection: "SE",
    forecast: "Hot and dry, UV index high",
  },
  zurich: {
    city: "Zurich",
    temperature: 10,
    unit: "celsius",
    condition: "Fog lifting to partly cloudy",
    humidity: 74,
    windSpeed: 8,
    windDirection: "W",
    forecast: "Cool with possible frost overnight",
  },
};

export function weatherHandler(req: Request, res: Response): void {
  const city = (req.query.city as string || "london").toLowerCase();
  const data = weatherDatabase[city];

  if (!data) {
    const availableCities = Object.values(weatherDatabase).map((w) => w.city);
    res.status(404).json({
      error: "City not found",
      message: `Weather data not available for "${city}". Try one of: ${availableCities.join(", ")}`,
    });
    return;
  }

  res.json({
    status: "success",
    data,
    timestamp: new Date().toISOString(),
  });
}
