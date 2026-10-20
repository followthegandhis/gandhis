// ============================================================
// GANDHIS.CO — Market Data Fetcher via Yahoo Finance
// NSE blocks cloud servers, Yahoo Finance works perfectly
// Zero dependencies — Node 18 built-in fetch
// ============================================================

exports.handler = async function (event, context) {
  try {
    console.log("Gandhis: Starting Yahoo Finance fetch...");

    // ---- STEP 1: FETCH ALL INDICES ----
    var indexSymbols = [
      "^NSEI",        // Nifty 50
      "^NSEBANK",     // Nifty Bank
      "^CNXIT",       // Nifty IT
      "^CNXAUTO",     // Nifty Auto
      "^CNXPHARMA",   // Nifty Pharma
      "^CNXFMCG",     // Nifty FMCG
      "^CNXMETAL",    // Nifty Metal
      "^CNXREALTY",   // Nifty Realty
      "^NSMIDCP",     // Nifty Midcap 100
      "^CNXSC",       // Nifty Smallcap
      "^CNXPSUBANK",  // Nifty PSU Bank
      "^BSESN",       // Sensex
      "USDINR=X",     // USD/INR
      "CL=F",         // Crude Oil
    ];

    var indexUrl =
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
      encodeURIComponent(indexSymbols.join(",")) +
      "&fields=symbol,regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName";

    var indexRes = await fetch(indexUrl, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    });

    if (!indexRes.ok) throw new Error("Yahoo indices failed: " + indexRes.status);

    var indexData = await indexRes.json();
    var quotes = (indexData.quoteResponse && indexData.quoteResponse.result) || [];
    console.log("Gandhis: Got " + quotes.length + " index quotes");

    // ---- NAME MAP ----
    var nameMap = {
      "^NSEI": "NIFTY 50",
      "^NSEBANK": "BANK NIFTY",
      "^CNXIT": "IT",
      "^CNXAUTO": "AUTO",
      "^CNXPHARMA": "PHARMA",
      "^CNXFMCG": "FMCG",
      "^CNXMETAL": "METAL",
      "^CNXREALTY": "REALTY",
      "^NSMIDCP": "MIDCAP 100",
      "^CNXSC": "SMALLCAP",
      "^CNXPSUBANK": "PSU BANK",
      "^BSESN": "SENSEX",
      "USDINR=X": "USD/INR",
      "CL=F": "CRUDE OIL",
    };

    // ---- BUILD TICKER ----
    var ticker = quotes.map(function (q) {
      return {
        name: nameMap[q.symbol] || q.shortName || q.symbol,
        value: q.regularMarketPrice || 0,
        change: q.regularMarketChangePercent
          ? q.regularMarketChangePercent.toFixed(2)
          : "0.00",
        pointChange: q.regularMarketChange
          ? q.regularMarketChange.toFixed(2)
          : "0.00",
      };
    });

    // ---- BUILD SECTOR MAP ----
    var sectorSymbols = [
      "^CNXPSUBANK", "^NSEBANK", "^CNXIT", "^CNXPHARMA",
      "^CNXFMCG", "^CNXAUTO", "^CNXMETAL", "^CNXREALTY",
    ];

    var sectorMap = quotes
      .filter(function (q) { return sectorSymbols.indexOf(q.symbol) !== -1; })
      .map(function (q) {
        return {
          name: nameMap[q.symbol] || q.symbol,
          value: q.regularMarketPrice || 0,
          change: q.regularMarketChangePercent
            ? q.regularMarketChangePercent.toFixed(2)
            : "0.00",
        };
      })
      .sort(function (a, b) { return parseFloat(b.change) - parseFloat(a.change); });

    // ---- HEADLINE ----
    var nifty = quotes.find(function (q) { return q.symbol === "^NSEI"; }) || {};
    var bank = quotes.find(function (q) { return q.symbol === "^NSEBANK"; }) || {};
    var sensex = quotes.find(function (q) { return q.symbol === "^BSESN"; }) || {};

    // ---- STEP 2: FETCH TOP MOVERS PER INDEX ----
    var moverConfig = [
      { key: "NIFTY 50", symbols: "RELIANCE.NS,TCS.NS,HDFCBANK.NS,INFY.NS,ICICIBANK.NS,HINDUNILVR.NS,ITC.NS,SBIN.NS,BAJFINANCE.NS,BHARTIARTL.NS,AXISBANK.NS,KOTAKBANK.NS,LT.NS,ASIANPAINT.NS,MARUTI.NS,TITAN.NS,SUNPHARMA.NS,ULTRACEMCO.NS,WIPRO.NS,ONGC.NS,NTPC.NS,POWERGRID.NS,TATAMOTORS.NS,TATASTEEL.NS,JSWSTEEL.NS" },
      { key: "NIFTY BANK", symbols: "HDFCBANK.NS,ICICIBANK.NS,KOTAKBANK.NS,AXISBANK.NS,SBIN.NS,INDUSINDBK.NS,BANDHANBNK.NS,FEDERALBNK.NS,PNB.NS,BANKBARODA.NS,IDFCFIRSTB.NS,AUBANK.NS" },
      { key: "NIFTY IT", symbols: "TCS.NS,INFY.NS,WIPRO.NS,HCLTECH.NS,TECHM.NS,LTIM.NS,MPHASIS.NS,COFORGE.NS,PERSISTENT.NS,LTTS.NS" },
      { key: "NIFTY PHARMA", symbols: "SUNPHARMA.NS,DRREDDY.NS,CIPLA.NS,DIVISLAB.NS,AUROPHARMA.NS,LUPIN.NS,TORNTPHARM.NS,BIOCON.NS,ALKEM.NS,IPCALAB.NS" },
      { key: "NIFTY FMCG", symbols: "HINDUNILVR.NS,ITC.NS,NESTLEIND.NS,BRITANNIA.NS,DABUR.NS,GODREJCP.NS,MARICO.NS,COLPAL.NS,TATACONSUM.NS,VBL.NS" },
      { key: "NIFTY METAL", symbols: "TATASTEEL.NS,JSWSTEEL.NS,HINDALCO.NS,COALINDIA.NS,NMDC.NS,MOIL.NS,NATIONALUM.NS,HINDCOPPER.NS,VEDL.NS,APLAPOLLO.NS" },
      { key: "NIFTY AUTO", symbols: "MARUTI.NS,TATAMOTORS.NS,M%26M.NS,BAJAJ-AUTO.NS,HEROMOTOCO.NS,EICHERMOT.NS,ASHOKLEY.NS,TVSMOTOR.NS,BOSCHLTD.NS,MRF.NS" },
      { key: "NIFTY REALTY", symbols: "DLF.NS,GODREJPROP.NS,OBEROIRLTY.NS,PRESTIGE.NS,BRIGADE.NS,SOBHA.NS,PHOENIXLTD.NS,SUNTECK.NS,IBREALEST.NS,LODHA.NS" },
      { key: "NIFTY MIDCAP", symbols: "IDBI.NS,INDIANB.NS,FEDERALBNK.NS,MPHASIS.NS,LTTS.NS,OBEROIRLTY.NS,PERSISTENT.NS,COFORGE.NS,ALKEM.NS,PIIND.NS" },
      { key: "NIFTY SMALLCAP", symbols: "CENTRALBK.NS,UCOBANK.NS,IOB.NS,KPITTECH.NS,BSOFT.NS,RVNL.NS,IRFC.NS,NBCC.NS,SJVN.NS,BEL.NS" },
    ];

    var topMovers = {};

    for (var m = 0; m < moverConfig.length; m++) {
      try {
        var cfg = moverConfig[m];
        var mUrl =
          "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
          cfg.symbols +
          "&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent";

        var mRes = await fetch(mUrl, {
          headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
        });

        var mData = await mRes.json();
        var mQuotes = (mData.quoteResponse && mData.quoteResponse.result) || [];

        var sorted = mQuotes.slice().sort(function (a, b) {
          return (b.regularMarketChangePercent || 0) - (a.regularMarketChangePercent || 0);
        });

        topMovers[cfg.key] = {
          gainers: sorted.slice(0, 3).map(function (q) {
            return {
              symbol: q.symbol.replace(".NS", ""),
              price: q.regularMarketPrice || 0,
              change: (q.regularMarketChangePercent || 0).toFixed(2),
            };
          }),
          losers: sorted.slice(-3).reverse().map(function (q) {
            return {
              symbol: q.symbol.replace(".NS", ""),
              price: q.regularMarketPrice || 0,
              change: (q.regularMarketChangePercent || 0).toFixed(2),
            };
          }),
        };

        console.log("Gandhis: " + cfg.key + " movers done");
      } catch (e) {
        console.warn("Gandhis: " + moverConfig[m].key + " failed: " + e.message);
        topMovers[moverConfig[m].key] = { gainers: [], losers: [] };
      }
    }

    // ---- TIMESTAMP ----
    var now = new Date();
    var istMs = now.getTime() + 5.5 * 3600000;
    var ist = new Date(istMs);

    // ---- FINAL PAYLOAD ----
    var payload = {
      meta: {
        date: ist.toISOString().split("T")[0],
        fetchedAt: ist.toISOString(),
        source: "Yahoo Finance",
        note: "Auto-fetched by Gandhis Netlify Function",
      },
      ticker: ticker,
      headline: {
        nifty50: {
          value: nifty.regularMarketPrice || 0,
          change: nifty.regularMarketChangePercent
            ? nifty.regularMarketChangePercent.toFixed(2)
            : "0.00",
          pointChange: nifty.regularMarketChange
            ? nifty.regularMarketChange.toFixed(2)
            : "0.00",
        },
        bankNifty: {
          value: bank.regularMarketPrice || 0,
          change: bank.regularMarketChangePercent
            ? bank.regularMarketChangePercent.toFixed(2)
            : "0.00",
          pointChange: bank.regularMarketChange
            ? bank.regularMarketChange.toFixed(2)
            : "0.00",
        },
        sensex: {
          value: sensex.regularMarketPrice || 0,
          change: sensex.regularMarketChangePercent
            ? sensex.regularMarketChangePercent.toFixed(2)
            : "0.00",
          pointChange: sensex.regularMarketChange
            ? sensex.regularMarketChange.toFixed(2)
            : "0.00",
        },
      },
      sectorMap: sectorMap,
      topMovers: topMovers,
    };

    console.log("Gandhis: All done! Returning JSON.");

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
    console.error("Gandhis: Fatal error:", err.message);
    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        error: true,
        message: err.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};
