// ============================================================
// GANDHIS.CO — Live Market Data Loader
// Fetches directly from Yahoo Finance via free CORS proxy
// No Netlify Functions needed — runs in the browser
// ============================================================

var CORS_PROXIES = [
  "https://api.allorigins.win/raw?url=",
  "https://corsproxy.io/?",
  "https://api.codetabs.com/v1/proxy?quest=",
];

var proxyIndex = 0;

function getProxy() {
  return CORS_PROXIES[proxyIndex % CORS_PROXIES.length];
}

function nextProxy() {
  proxyIndex++;
  return getProxy();
}

// ---- FETCH WITH PROXY ROTATION ----
async function fetchWithProxy(url) {
  var attempts = CORS_PROXIES.length;
  for (var i = 0; i < attempts; i++) {
    try {
      var proxy = i === 0 ? getProxy() : nextProxy();
      var fullUrl = proxy + encodeURIComponent(url);
      var res = await fetch(fullUrl);
      if (res.ok) {
        var text = await res.text();
        return JSON.parse(text);
      }
    } catch (e) {
      console.warn("Gandhis: Proxy " + (i + 1) + " failed, trying next...");
    }
  }
  throw new Error("All proxies failed");
}

// ---- MAIN LOADER ----
async function loadMarketData() {
  try {
    console.log("Gandhis: Loading live market data...");

    // Step 1: Fetch all indices
    var indexSymbols = [
      "^NSEI", "^NSEBANK", "^CNXIT", "^CNXAUTO",
      "^CNXPHARMA", "^CNXFMCG", "^CNXMETAL", "^CNXREALTY",
      "^NSMIDCP", "^CNXSC", "^CNXPSUBANK", "^BSESN",
      "USDINR=X", "CL=F",
    ];

    var yahooUrl =
      "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
      indexSymbols.join(",") +
      "&fields=symbol,regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName";

    var data = await fetchWithProxy(yahooUrl);
    var quotes = (data.quoteResponse && data.quoteResponse.result) || [];
    console.log("Gandhis: Got " + quotes.length + " index quotes");

    // Name mapping
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

    // Update ticker ribbon
    updateTicker(quotes, nameMap);

    // Update sector map
    updateSectorMap(quotes, nameMap);

    // Update headline
    updateHeadline(quotes);

    // Step 2: Fetch top movers for each index
    await loadTopMovers();

    console.log("Gandhis: All live data loaded successfully!");
  } catch (e) {
    console.warn("Gandhis: Live data fetch failed, using static fallback.", e.message);
  }
}

// ---- TICKER RIBBON ----
function updateTicker(quotes, nameMap) {
  var tickerTrack = document.querySelector(".ticker-track");
  if (!tickerTrack || quotes.length === 0) return;

  var html = "";
  quotes.forEach(function (q) {
    var name = nameMap[q.symbol] || q.shortName || q.symbol;
    var price = q.regularMarketPrice || 0;
    var change = q.regularMarketChangePercent || 0;
    var isUp = change >= 0;
    var arrow = isUp ? "▲" : "▼";
    var cls = isUp ? "tk-up" : "tk-dn";

    html +=
      '<span class="tk-item">' +
      '<span class="tk-name">' + name + "</span> " +
      '<span class="tk-val">' + Number(price).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "</span> " +
      '<span class="' + cls + '">' + arrow + " " + Math.abs(change).toFixed(2) + "%</span>" +
      "</span>";
  });

  // Duplicate for seamless scroll
  tickerTrack.innerHTML = html + html;
}

// ---- HEADLINE ----
function updateHeadline(quotes) {
  var nifty = quotes.find(function (q) { return q.symbol === "^NSEI"; });
  if (!nifty) return;

  var el = document.querySelector("[data-k='nifty-value']");
  if (el) {
    var val = nifty.regularMarketPrice || 0;
    var chg = nifty.regularMarketChangePercent || 0;
    var pts = nifty.regularMarketChange || 0;
    var arrow = chg >= 0 ? "▲" : "▼";
    var sign = pts >= 0 ? "+" : "";
    el.textContent =
      Number(val).toLocaleString("en-IN") +
      " " + arrow + " " +
      Math.abs(chg).toFixed(2) + "% · " +
      sign + Number(pts).toFixed(0) + " pts";
  }
}

// ---- SECTOR MAP ----
function updateSectorMap(quotes, nameMap) {
  var container = document.querySelector(".sector-grid, .sm-grid, [data-sector-map]");
  if (!container) return;

  var sectorSymbols = [
    "^CNXPSUBANK", "^NSEBANK", "^CNXIT", "^CNXPHARMA",
    "^CNXFMCG", "^CNXAUTO", "^CNXMETAL", "^CNXREALTY",
  ];

  var sectors = quotes
    .filter(function (q) { return sectorSymbols.indexOf(q.symbol) !== -1; })
    .map(function (q) {
      return {
        name: nameMap[q.symbol] || q.symbol,
        value: q.regularMarketPrice || 0,
        change: q.regularMarketChangePercent || 0,
      };
    })
    .sort(function (a, b) { return b.change - a.change; });

  var html = "";
  sectors.forEach(function (s) {
    var isUp = s.change >= 0;
    var bg = isUp ? "#e8f5e9" : "#ffebee";
    var color = isUp ? "#2e7d32" : "#c62828";
    var arrow = isUp ? "▲" : "▼";

    html +=
      '<div style="background:' + bg + ";border-radius:10px;padding:12px 14px;text-align:center;\">" +
      '<div style="font-weight:700;font-size:13px;color:#1a1a1a;">' + s.name + "</div>" +
      '<div style="font-size:18px;font-weight:800;color:' + color + ';margin-top:4px;">' +
      arrow + " " + Math.abs(s.change).toFixed(2) + "%" +
      "</div>" +
      '<div style="font-size:11px;color:#888;margin-top:2px;">' +
      Number(s.value).toLocaleString("en-IN") +
      "</div></div>";
  });

  container.innerHTML = html;
}

// ---- TOP MOVERS ----
async function loadTopMovers() {
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

  for (var m = 0; m < moverConfig.length; m++) {
    try {
      var cfg = moverConfig[m];
      var url =
        "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" +
        cfg.symbols +
        "&fields=symbol,shortName,regularMarketPrice,regularMarketChangePercent";

      var data = await fetchWithProxy(url);
      var mQuotes = (data.quoteResponse && data.quoteResponse.result) || [];

      var sorted = mQuotes.slice().sort(function (a, b) {
        return (b.regularMarketChangePercent || 0) - (a.regularMarketChangePercent || 0);
      });

      var gainers = sorted.slice(0, 3);
      var losers = sorted.slice(-3).reverse();

      // Find the panel for this index
      var panel = document.querySelector(
        '[data-index="' + cfg.key + '"]'
      );
      if (!panel) continue;

      var gainerContainer = panel.querySelector(".gainers, [data-gainers]");
      if (gainerContainer) {
        gainerContainer.innerHTML = gainers
          .map(function (q) {
            var sym = q.symbol.replace(".NS", "");
            var price = q.regularMarketPrice || 0;
            var chg = (q.regularMarketChangePercent || 0).toFixed(2);
            return (
              '<div class="mover-row gainer">' +
              '<span class="m-name">' + sym + "</span>" +
              '<span class="m-price">₹' + Number(price).toLocaleString("en-IN") + "</span>" +
              '<span class="m-chg up">▲ ' + chg + "%</span></div>"
            );
          })
          .join("");
      }

      var loserContainer = panel.querySelector(".losers, [data-losers]");
      if (loserContainer) {
        loserContainer.innerHTML = losers
          .map(function (q) {
            var sym = q.symbol.replace(".NS", "");
            var price = q.regularMarketPrice || 0;
            var chg = Math.abs(q.regularMarketChangePercent || 0).toFixed(2);
            return (
              '<div class="mover-row loser">' +
              '<span class="m-name">' + sym + "</span>" +
              '<span class="m-price">₹' + Number(price).toLocaleString("en-IN") + "</span>" +
              '<span class="m-chg dn">▼ ' + chg + "%</span></div>"
            );
          })
          .join("");
      }

      console.log("Gandhis: " + cfg.key + " movers loaded");
    } catch (e) {
      console.warn("Gandhis: " + moverConfig[m].key + " movers failed: " + e.message);
    }
  }
}

// ---- INIT ----
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(loadMarketData, 800);
});

// Manual refresh
window.refreshGandhisData = loadMarketData;
