const city = input.city || input.q || "Lausanne";
const lat = { lausanne: 46.52, paris: 48.86, london: 51.51, tokyo: 35.68, "new york": 40.71, zurich: 47.37 };
const lon = { lausanne: 6.63, paris: 2.35, london: -0.13, tokyo: 139.69, "new york": -74.01, zurich: 8.54 };
const la = lat[city.toLowerCase()] || 46.52;
const lo = lon[city.toLowerCase()] || 6.63;
const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,weather_code&timezone=auto`);
const data = await res.json();
const c = data.current;
return { city, temperature: c.temperature_2m, humidity: c.relative_humidity_2m + "%", wind: c.wind_speed_10m + " km/h", source: "open-meteo.com" };
