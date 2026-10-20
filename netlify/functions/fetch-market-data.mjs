// ============================================================
// GANDHIS.CO — NSE Market Data Fetcher
// Runs daily at 4:30 PM IST via Netlify Scheduled Functions
// Also callable on-demand: https://gandhis.co/.netlify/functions/fetch-market-data
// ============================================================

const NSE_BASE = "https://www.nseindia.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Referer": "https://www.nseindia.com/",
  "Connection": "keep-alive",
};

// ---- COOKIE MANAGER ----
// NSE requires a valid session cookie before any API call
let sessionCookies = "";

async function getSessionCookie() {
  try {
    const res = await fetch(NSE_BASE, {
      headers: HEADERS,
      redirect: "follow",
    });
    const setCookies = res.headers.getSetCookie?.() || [];
    sessionCookies = setCookies.map((c) => c.split(";")[0]).join("; ");
    return sessionCookies;
  } catch (e) {
    console.error("Cookie fetch failed:", e.message);
    return "";
  }
}

// ---- NSE API CALLER ----
async function nseGet(path) {
  if (!sessionCookies) await getSessionCookie();

  const url = `${NSE_BASE}${path}`;
  const res = await fetch(url, {
    headers: { ...HEADERS, Cookie: sessionCookies },
  });

  if (!res.ok) {
    // Retry once with fresh cookie
    await getSessionCookie();
    const retry = await fetch(url, {
      headers: { ...HEADERS, Cookie: sessionCookies },
    });
    if (!retry.ok) throw new Error(`NSE API ${path} failed: ${retry.status}`);
    return retry.json();
  }
  return res.json();
}

// Small delay to respect NSE rate limits (3 req/sec)
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- DATA FETCHERS ----

// 1. All indices (for ticker ribbon + sector map)
async function fetchAllIndices() {
  const data = await nseGet("/api/allIndices");
  return data.data || [];
}

// 2. Index stocks (gainers/losers for a specific index)
async function fetchIndexStocks(indexName) {
  const encoded = encodeURIComponent(indexName);
  const data = await nseGet(`/api/equity-stockIndices?index=${encoded}`);
  return data.data || [];
}

// 3. Advance/Decline data
async function fetchAdvanceDecline() {
  const data = await nseGet("/api/market-data-pre-open?key=NIFTY%2050");
  return data;
}

// ---- PROCESS SECTOR DATA ----
function getTopMovers(stocks, count = 3) {
  // Filter out the index summary row
  const filtered = stocks.filter(
    (s) => s.symbol && s.symbol !== "NIFTY 50" && !s.symbol.startsWith("NIFTY")
  );

  const sorted = [...filtered].sort(
    (a, b) => (b.pChange || 0) - (a.pChange || 0)
  );

  const gainers = sorted.slice(0, count).map((s) => ({
    symbol: s.symbol,
    name: s.meta?.companyName || s.symbol,
    price: s.lastPrice,
    change: s.pChange ? s.pChange.toFixed(2) : "0.00",
    absChange: s.change ? s.change.toFixed(2) : "0.00",
  }));

  const losers = sorted
    .slice(-count)
    .reverse()
    .map((s) => ({
      symbol: s.symbol,
      name: s.meta?.companyName || s.symbol,
      price: s.lastPrice,
      change: s.pChange ? s.pChange.toFixed(2) : "0.00",
      absChange: s.change ? s.change.toFixed(2) : "0.00",
    }));

  return { gainers, losers };
}

// ---- MAIN HANDLER ----
export default async function handler(req) {
  try {
    console.log("Gandhis: Starting NSE data fetch...");

    // Step 1: Get session cookie
    await getSessionCookie();
    console.log("Gandhis: Session cookie obtained");

    // Step 2: Fetch all indices (for ticker + sector overview)
    const allIndices = await fetchAllIndices();
    await sleep(400);

    // Step 3: Extract key indices for ticker ribbon
    const tickerIndices = [
      "NIFTY 50",
      "NIFTY BANK",
      "NIFTY IT",
      "NIFTY MIDCAP 100",
      "NIFTY SMLCAP 100",
      "NIFTY AUTO",
      "NIFTY METAL",
      "NIFTY PHARMA",
      "NIFTY FMCG",
      "NIFTY REALTY",
      "NIFTY PSU BANK",
    ];

    const ticker = allIndices
      .filter((idx) => tickerIndices.includes(idx.index))
      .map((idx) => ({
        name: idx.index,
        value: idx.last,
        change: idx.percentChange,
        pointChange: idx.variation,
      }));

    // Also extract SENSEX from BSE if available, or mark for manual
    // NSE API only has NSE indices — Sensex comes from BSE
    // We'll add a placeholder that the frontend can override

    console.log(`Gandhis: Got ${ticker.length} ticker indices`);

    // Step 4: Fetch sector data for sector map
    const sectorIndices = [
      "NIFTY BANK",
      "NIFTY IT",
      "NIFTY PHARMA",
      "NIFTY FMCG",
      "NIFTY AUTO",
      "NIFTY METAL",
      "NIFTY REALTY",
      "NIFTY PSU BANK",
    ];

    const sectorMap = allIndices
      .filter((idx) => sectorIndices.includes(idx.index))
      .map((idx) => ({
        name: idx.index.replace("NIFTY ", ""),
        value: idx.last,
        change: idx.percentChange,
      }));

    console.log(`Gandhis: Got ${sectorMap.length} sectors for map`);

    // Step 5: Fetch top movers for each index
    // These are the 10 indices for the Top Movers tab
    const moverIndices = [
      "NIFTY 50",
      "NIFTY BANK",
      "NIFTY MIDCAP 100",
      "NIFTY SMLCAP 100",
      "NIFTY IT",
      "NIFTY PHARMA",
      "NIFTY FMCG",
      "NIFTY METAL",
      "NIFTY AUTO",
      "NIFTY REALTY",
    ];

    const topMovers = {};

    for (const indexName of moverIndices) {
      try {
        await sleep(500); // Respect NSE rate limit
        const stocks = await fetchIndexStocks(indexName);
        topMovers[indexName] = getTopMovers(stocks, 3);
        console.log(
          `Gandhis: Got movers for ${indexName} — ${stocks.length} stocks`
        );
      } catch (e) {
        console.error(`Gandhis: Failed to fetch ${indexName}:`, e.message);
        topMovers[indexName] = { gainers: [], losers: [] };
      }
    }

    // Step 6: Get Nifty 50 summary for the main card
    const nifty50Summary = allIndices.find((idx) => idx.index === "NIFTY 50");
    const bankNiftySummary = allIndices.find(
      (idx) => idx.index === "NIFTY BANK"
    );

    // Step 7: Build the final JSON
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istNow = new Date(now.getTime() + istOffset);

    const marketData = {
      // Metadata
      meta: {
        date: istNow.toISOString().split("T")[0],
        fetchedAt: istNow.toISOString(),
        tradingDay: true,
        source: "NSE India",
        note: "Auto-fetched by Gandhis Netlify Function",
      },

      // Ticker ribbon data
      ticker: ticker,

      // Main headline numbers
      headline: {
        nifty50: {
          value: nifty50Summary?.last || 0,
          change: nifty50Summary?.percentChange || 0,
          pointChange: nifty50Summary?.variation || 0,
        },
        bankNifty: {
          value: bankNiftySummary?.last || 0,
          change: bankNiftySummary?.percentChange || 0,
          pointChange: bankNiftySummary?.variation || 0,
        },
      },

      // Sector map for Today's Brief
      sectorMap: sectorMap,

      // Top Movers by index
      topMovers: topMovers,

      // Market breadth (from allIndices advance/decline if available)
      breadth: {
        advances: nifty50Summary?.advances || 0,
        declines: nifty50Summary?.declines || 0,
        unchanged: nifty50Summary?.unchanged || 0,
      },
    };

    console.log("Gandhis: Data fetch complete! Returning JSON...");

    // Return the data as JSON
    return new Response(JSON.stringify(marketData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Gandhis: Fatal error:", error);

    return new Response(
      JSON.stringify({
        error: true,
        message: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

// Netlify scheduled function config
export const config = {
  schedule: "0 11 * * 1-5",
};
