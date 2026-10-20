// ============================================================
// GANDHIS.CO — NSE Market Data Fetcher
// Zero dependencies — uses Node 18 built-in fetch
// Runs daily at 4:30 PM IST via Netlify Scheduled Functions
// Also callable: https://gandhis.co/.netlify/functions/fetch-market-data
// ============================================================

const NSE_BASE = "https://www.nseindia.com";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/",
  Connection: "keep-alive",
};

// ---- COOKIE MANAGER ----
async function getSessionCookie() {
  try {
    const res = await fetch(NSE_BASE, {
      headers: HEADERS,
      redirect: "follow",
    });
    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [];
    return setCookies.map((c) => c.split(";")[0]).join("; ");
  } catch (e) {
    console.error("Cookie fetch failed:", e.message);
    return "";
  }
}

// ---- NSE API CALLER ----
async function nseGet(path, cookie) {
  const url = `${NSE_BASE}${path}`;
  let res = await fetch(url, {
    headers: { ...HEADERS, Cookie: cookie },
  });

  // Retry once with fresh cookie if failed
  if (!res.ok) {
    const freshCookie = await getSessionCookie();
    res = await fetch(url, {
      headers: { ...HEADERS, Cookie: freshCookie },
    });
    if (!res.ok) throw new Error(`NSE ${path} failed: ${res.status}`);
  }
  return res.json();
}

// Small delay to respect NSE rate limits
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- GET TOP MOVERS ----
function getMovers(stocks, count = 3) {
  const filtered = stocks.filter(
    (s) => s.symbol && !s.symbol.startsWith("NIFTY")
  );
  const sorted = [...filtered].sort(
    (a, b) => (b.pChange || 0) - (a.pChange || 0)
  );
  return {
    gainers: sorted.slice(0, count).map((s) => ({
      symbol: s.symbol,
      price: s.lastPrice,
      change: (s.pChange || 0).toFixed(2),
    })),
    losers: sorted
      .slice(-count)
      .reverse()
      .map((s) => ({
        symbol: s.symbol,
        price: s.lastPrice,
        change: (s.pChange || 0).toFixed(2),
      })),
  };
}

// ---- MAIN HANDLER ----
export default async function handler(req) {
  try {
    console.log("Gandhis: Starting NSE fetch...");

    // Step 1: Get session cookie
    const cookie = await getSessionCookie();
    console.log("Gandhis: Cookie obtained");

    // Step 2: Fetch all indices
    await sleep(500);
    const allIndices = await nseGet("/api/allIndices", cookie);
    const indices = allIndices.data || [];
    console.log("Gandhis: Got " + indices.length + " indices");

    // Step 3: Ticker ribbon data
    const tickerNames = [
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

    const ticker = indices
      .filter((i) => tickerNames.includes(i.index))
      .map((i) => ({
        name: i.index,
        value: i.last,
        change: i.percentChange,
        pointChange: i.variation,
      }));

    // Step 4: Nifty 50 headline
    const nifty = indices.find((i) => i.index === "NIFTY 50") || {};
    const bankNifty = indices.find((i) => i.index === "NIFTY BANK") || {};

    // Step 5: Sector map
    const sectorNames = [
      "NIFTY PSU BANK",
      "NIFTY BANK",
      "NIFTY IT",
      "NIFTY PHARMA",
      "NIFTY FMCG",
      "NIFTY AUTO",
      "NIFTY METAL",
      "NIFTY REALTY",
    ];

    const sectorMap = indices
      .filter((i) => sectorNames.includes(i.index))
      .map((i) => ({
        name: i.index.replace("NIFTY ", ""),
        value: i.last,
        change: i.percentChange,
      }))
      .sort((a, b) => b.change - a.change);

    // Step 6: Top movers per index
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
    for (const idx of moverIndices) {
      try {
        await sleep(600);
        const encoded = encodeURIComponent(idx);
        const data = await nseGet(
          "/api/equity-stockIndices?index=" + encoded,
          cookie
        );
        topMovers[idx] = getMovers(data.data || [], 3);
        console.log("Gandhis: Movers for " + idx + " done");
      } catch (e) {
        console.warn("Gandhis: " + idx + " failed: " + e.message);
        topMovers[idx] = { gainers: [], losers: [] };
      }
    }

    // Step 7: Build IST timestamp
    var now = new Date();
    var istMs = now.getTime() + 5.5 * 3600000;
    var ist = new Date(istMs);

    // Step 8: Final JSON payload
    var payload = {
      meta: {
        date: ist.toISOString().split("T")[0],
        fetchedAt: ist.toISOString(),
        source: "NSE India",
        note: "Auto-fetched by Gandhis Netlify Function",
      },
      ticker: ticker,
      headline: {
        nifty50: {
          value: nifty.last || 0,
          change: nifty.percentChange || 0,
          pointChange: nifty.variation || 0,
        },
        bankNifty: {
          value: bankNifty.last || 0,
          change: bankNifty.percentChange || 0,
          pointChange: bankNifty.variation || 0,
        },
      },
      sectorMap: sectorMap,
      topMovers: topMovers,
      breadth: {
        advances: nifty.advances || 0,
        declines: nifty.declines || 0,
        unchanged: nifty.unchanged || 0,
      },
    };

    console.log("Gandhis: All done. Returning JSON.");

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("Gandhis: Fatal error:", err);
    return new Response(
      JSON.stringify({
        error: true,
        message: err.message,
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
