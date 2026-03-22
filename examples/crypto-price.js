const coin = (input.coin || input.q || "bitcoin").toLowerCase();
const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=usd,eur&include_24hr_change=true`);
if (!res.ok) throw new Error("Price service unavailable");
const data = await res.json();
const info = data[coin];
if (!info) throw new Error("Coin not found: " + coin + ". Try: bitcoin, ethereum, the-open-network");
return { coin, price_usd: info.usd, price_eur: info.eur, change_24h: (info.usd_24h_change || 0).toFixed(2) + "%" };
