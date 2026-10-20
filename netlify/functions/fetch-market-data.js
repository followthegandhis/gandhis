
// ============================================================
// GANDHIS.CO — NSE Market Data Fetcher
// Zero dependencies — uses Node 18 built-in fetch
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

async function getSessionCookie() {
  try {
    const res = await fetch(NSE_BASE, {
      headers: HEADERS,
      redirect: "follow",
    });
    const setCookies = res.headers.getSetCookie
      ? res.headers.getSetCookie()
      : [];
    return setCookies.map(function (c) {
      return c.split(";")[0];
    }).join("; ");
  } catch (e) {
    console.error("Cookie fetch failed:", e.message);
    return "";
  }
}

async function nseGet(path, cookie) {
  var url = NSE_BASE + path;
  var res = await fetch(url, {
    headers: Object.assign({}, HEADERS, { Cookie: cookie }),
  });
  if (!res.ok) {
    var freshCookie = await getSessionCookie();
    res = await fetch(url, {
      headers: Object.assign({}, HEADERS, { Cookie: freshCookie }),
    });
    if (!res.ok) throw new Error("NSE " + path + " failed: " + res.status);
  }
  return res.json();
}

function sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function getMovers(stocks, count) {
  count = count || 3;
  var filtered = stocks.filter(function (s) {
    return s.symbol && !s.symbol.startsWith("NIFTY");
  });
  var sorted = filtered.slice().sort(function (a, b) {
    return (b.pChange || 0) - (a.pChange || 0);
  });
  return {
    gainers: sorted.slice(0, count).map(function (s) {
      return {
        symbol: s.symbol,
        price: s.lastPrice,
        change: (s.pChange || 0).toFixed(2),
      };
    }),
    losers: sorted
      .slice(-count)
      .reverse()
      .map(function (s) {
        return {
          symbol: s.symbol,
          price: s.lastPrice,
          change: (s.pChange || 0).toFixed(2),
        };
      }),
  };
}

exports.handler = async function (event, context) {
  try {
    console.log("Gandhis: Starting NSE fetch...");

    var cookie = await getSessionCookie();
    console.log("Gandhis: Cookie obtained");

    await sleep(500);
    var allIndices = await nseGet("/api/allIndices", cookie);
    var indices = allIndices.data || [];
    console.log("Gandhis: Got " + indices.length + " indices");

    var tickerNames = [
      "NIFTY 50", "NIFTY BANK", "NIFTY IT",
      "NIFTY MIDCAP 100", "NIFTY SMLCAP 100",
      "NIFTY AUTO", "NIFTY METAL", "NIFTY PHARMA",
      "NIFTY FMCG", "NIFTY REALTY", "NIFTY PSU BANK",
    ];

    var ticker = indices
      .filter(function (i) { return tickerNames.indexOf(i.index) !== -1; })
      .map(function (i) {
        return {
          name: i.index,
          value: i.last,
          change: i.percentChange,
          pointChange: i.variation,
        };
      });

    var nifty = indices.find(function (i) { return i.index === "NIFTY 50"; }) || {};
    var bankNifty = indices.find(function (i) { return i.index === "NIFTY BANK"; }) || {};

    var sectorNames = [
      "NIFTY PSU BANK", "NIFTY BANK", "NIFTY IT",
      "NIFTY PHARMA", "NIFTY FMCG", "NIFTY AUTO",
      "NIFTY METAL", "NIFTY REALTY",
    ];

    var sectorMap = indices
      .filter(function (i) { return sectorNames.indexOf(i.index) !== -1; })
      .map(function (i) {
        return {
          name: i.index.replace("NIFTY ", ""),
          value: i.last,
          change: i.percentChange,
        };
      })
      .sort(function (a, b) { return b.change - a.change; });

    var moverIndices = [
      "NIFTY 50", "NIFTY BANK", "NIFTY MIDCAP 100",
      "NIFTY SMLCAP 100", "NIFTY IT", "NIFTY PHARMA",
      "NIFTY FMCG", "NIFTY METAL", "NIFTY AUTO", "NIFTY REALTY",
    ];

    var topMovers = {};
    for (var m = 0; m < moverIndices.length; m++) {
      var idx = moverIndices[m];
      try {
        await sleep(600);
        var encoded = encodeURIComponent(idx);
        var data = await nseGet(
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

    var now = new Date();
    var istMs = now.getTime() + 5.5 * 3600000;
    var ist = new Date(istMs);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
      body: JSON.stringify(payload, null, 2),
    };
  } catch (err) {
    console.error("Gandhis: Fatal error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: true,
        message: err.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
