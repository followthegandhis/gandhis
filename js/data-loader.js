
/**
 * GANDHIS.CO — Live Market Data Loader v6
 * Fetches data from Google Sheets and auto-updates:
 * - Ticker ribbon, Headline, Sector map, Top movers
 * - Date bar, Edition number, Pulse board, Sector strip, Macro strip
 */

// ---- GOOGLE SHEETS CSV URLS ----
var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEYQHN0mUGbr7OOJ3LhRFSFzHgrVfWWMYxBk3CSZV_aEEqXkOXGasXaMGvHfCGQ/pub?gid=0&single=true&output=csv";
var MOVERS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTEYQHN0mUGbr7OOJ3LhRFSFzHgrVfWWMYxBk3CSZV_aEEqXkOXGasXaMGvHfCGQ/pub?gid=1974553267&single=true&output=csv";


// ---- CSV PARSER ----
function parseCSV(text) {
  var lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  var headers = lines[0].split(",");
  for (var h = 0; h < headers.length; h++) {
    headers[h] = headers[h].trim().replace(/"/g, "");
  }
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var vals = lines[i].split(",");
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = vals[j] ? vals[j].trim().replace(/"/g, "") : "";
    }
    rows.push(obj);
  }
  return rows;
}


// ---- DATE BAR + EDITION (from GANDHIS_CONFIG) ----
function updateDateBar() {
  if (typeof GANDHIS_CONFIG === "undefined") return;

  var parts = GANDHIS_CONFIG.date.split("-");
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var months = ["January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December"];
  var monthsUpper = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
                     "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

  var dayName = days[d.getDay()];
  var dayNum = d.getDate();
  var monthName = months[d.getMonth()];
  var monthUpper = monthsUpper[d.getMonth()];
  var year = d.getFullYear();

  // Update date bar: "Thursday, 22 October 2026"
  var dateEl = document.querySelector('[data-k="date"]');
  if (dateEl) dateEl.innerHTML = dayName + ", " + dayNum + " " + monthName + " " + year;

  // Update edition: "EDITION #3 · 8:00 PM IST"
  var edEl = document.querySelector('[data-k="edition"]');
  if (edEl) edEl.innerHTML = "EDITION #" + GANDHIS_CONFIG.edition + " · 8:00 PM IST";

  // Update top movers date: "22 OCTOBER 2026 · THURSDAY"
  var tmDate = document.querySelector(".tm-date");
  if (tmDate) tmDate.innerHTML = dayNum + " " + monthUpper + " " + year + " · " + dayName.toUpperCase();
}


// ---- TICKER RIBBON ----
function buildTicker(rows) {
  var container = document.getElementById("tkT");
  if (!container || !rows || rows.length === 0) return;

  var html = "";
  for (var i = 0; i < rows.length; i++) {
    var name = rows[i].name || "";
    var price = parseFloat(rows[i].price) || 0;
    var change = parseFloat(rows[i].changepct) || 0;
    var arrow = change >= 0 ? "▲" : "▼";
    var cls = change >= 0 ? "up" : "dn";

    var priceStr;
    if (name === "USD/INR") {
      priceStr = "₹" + price.toFixed(2);
    } else if (name === "CRUDE OIL") {
      priceStr = "$" + price.toFixed(2);
    } else if (price >= 100000) {
      priceStr = (price / 100000).toFixed(2) + "L";
    } else if (price >= 1000) {
      priceStr = price.toLocaleString("en-IN", { maximumFractionDigits: 0 });
    } else {
      priceStr = price.toFixed(2);
    }

    html += '<div class="ti">';
    html += '<span class="tn">' + name + '</span>';
    html += '<span class="tp">' + priceStr + '</span>';
    html += '<span class="tc ' + cls + '">' + arrow + " " + Math.abs(change).toFixed(2) + "%</span>";
    html += "</div>";
  }

  // Duplicate for infinite scroll
  container.innerHTML = html + html;
}


// ---- HEADLINE (NIFTY 50) ----
function buildHeadline(rows) {
  var nifty = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name === "NIFTY 50") { nifty = rows[i]; break; }
  }
  if (!nifty) return;

  var price = parseFloat(nifty.price) || 0;
  var change = parseFloat(nifty.changepct) || 0;
  var cls = change >= 0 ? "up" : "dn";
  var arrow = change >= 0 ? "▲" : "▼";

  var el = document.getElementById("headline");
  if (el) {
    el.innerHTML = '<span class="hl-val ' + cls + '">' + price.toLocaleString("en-IN", { maximumFractionDigits: 0 }) + '</span>' +
      '<span class="hl-chg ' + cls + '">' + arrow + " " + Math.abs(change).toFixed(2) + "%</span>";
  }
}


// ---- SECTOR MAP (8 sectors below ticker) ----
function buildSectorMap(rows) {
  var container = document.getElementById("sectorMap");
  if (!container) return;

  var sectors = [];
  var sectorNames = ["PSU BANK", "BANK NIFTY", "NIFTY IT", "NIFTY PHARMA", "NIFTY FMCG", "NIFTY AUTO", "NIFTY METAL", "NIFTY REALTY"];
  var displayNames = {
    "PSU BANK": "PSU BANK", "BANK NIFTY": "BANK NIFTY", "NIFTY IT": "IT",
    "NIFTY PHARMA": "PHARMA", "NIFTY FMCG": "FMCG", "NIFTY AUTO": "AUTO",
    "NIFTY METAL": "METAL", "NIFTY REALTY": "REALTY"
  };

  for (var i = 0; i < rows.length; i++) {
    var n = rows[i].name || "";
    if (sectorNames.indexOf(n) !== -1) {
      sectors.push({ name: displayNames[n] || n, change: parseFloat(rows[i].changepct) || 0 });
    }
  }

  sectors.sort(function (a, b) { return b.change - a.change; });

  var html = "";
  for (var s = 0; s < sectors.length; s++) {
    var cls = sectors[s].change >= 0 ? "sm-up" : "sm-dn";
    var sign = sectors[s].change >= 0 ? "+" : "";
    html += '<div class="sm-item ' + cls + '">';
    html += '<div class="sm-name">' + sectors[s].name + "</div>";
    html += '<div class="sm-val">' + sign + sectors[s].change.toFixed(2) + "%</div>";
    html += "</div>";
  }
  container.innerHTML = html;
}

// ---- PULSE BOARD: NIFTY 50 VALUE ----
function updatePulseNifty(rows) {
  var nifty = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name === "NIFTY 50") { nifty = rows[i]; break; }
  }
  if (!nifty) return;

  var price = parseFloat(nifty.price) || 0;
  var change = parseFloat(nifty.changepct) || 0;
  var cls = change >= 0 ? "up" : "dn";
  var arrow = change >= 0 ? "▲" : "▼";

  // Calculate approximate points change
  var prevPrice = price / (1 + change / 100);
  var pts = Math.round(price - prevPrice);
  var ptsStr = pts >= 0 ? "+" + pts : "" + pts;

  // Update NIFTY value
  var nv = document.querySelector(".p-nv");
  if (nv) {
    nv.className = "p-nv " + cls;
    nv.innerHTML = price.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  // Update NIFTY change
  var nc = document.querySelector(".p-nc");
  if (nc) {
    nc.className = "p-nc " + cls;
    nc.innerHTML = arrow + " " + Math.abs(change).toFixed(2) + "% · " + ptsStr + " pts";
  }
}


// ---- PULSE BOARD: SECTOR STRIP (8 chips sorted by performance) ----
function updateSectorStrip(rows) {
  var container = document.querySelector(".s-row");
  if (!container) return;

  var sectorMap = {
    "NIFTY PHARMA": "Pharma",
    "PSU BANK": "PSU Bank",
    "BANK NIFTY": "Bank Nifty",
    "NIFTY METAL": "Metal",
    "NIFTY AUTO": "Auto",
    "NIFTY REALTY": "Realty",
    "NIFTY IT": "IT",
    "NIFTY FMCG": "FMCG"
  };

  var sectors = [];
  for (var i = 0; i < rows.length; i++) {
    var n = rows[i].name || "";
    if (sectorMap[n]) {
      sectors.push({
        name: sectorMap[n],
        change: parseFloat(rows[i].changepct) || 0
      });
    }
  }

  // Sort best to worst
  sectors.sort(function (a, b) { return b.change - a.change; });

  var html = "";
  for (var s = 0; s < sectors.length; s++) {
    var val = sectors[s].change;
    var chipClass;

    if (val >= 0) {
      chipClass = "sg";           // green
    } else if (val > -0.5) {
      chipClass = "sr1";          // light red
    } else if (val > -1.0) {
      chipClass = "sr2";          // medium red
    } else {
      chipClass = "sr3";          // deep red
    }

    var sign = val >= 0 ? "+" : "";
    html += '<div class="s-chip ' + chipClass + '">';
    html += '<div class="s-cn">' + sectors[s].name + '</div>';
    html += '<div class="s-cv">' + sign + val.toFixed(2) + '%</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}


// ---- PULSE BOARD: MACRO STRIP (Brent, USD/INR, US 10Y, Gold, DXY) ----
function updateMacroStrip(rows) {
  var container = document.querySelector(".m-strip");
  if (!container) return;

  // Build a lookup from sheet data
  var lookup = {};
  for (var i = 0; i < rows.length; i++) {
    lookup[rows[i].name] = rows[i];
  }

  var macros = [
    { key: "CRUDE OIL", icon: "🛢", label: "BRENT", prefix: "$", suffix: "" },
    { key: "USD/INR",   icon: "💵", label: "USD/INR", prefix: "₹", suffix: "" },
    { key: "US 10Y",    icon: "🏦", label: "US 10Y", prefix: "", suffix: "%" },
    { key: "GOLD",      icon: "🥇", label: "GOLD", prefix: "$", suffix: "" },
    { key: "DXY",       icon: "📊", label: "DXY", prefix: "", suffix: "" }
  ];

  var html = "";
  for (var m = 0; m < macros.length; m++) {
    var item = macros[m];
    var data = lookup[item.key];

    if (data) {
      var price = parseFloat(data.price) || 0;
      var change = parseFloat(data.changepct) || 0;
      var arrow = change >= 0 ? "▲" : "▼";
      var cls = "dn"; // For macro items, red/green based on context

      var priceStr;
      if (item.key === "GOLD") {
        priceStr = item.prefix + price.toLocaleString("en-US", { maximumFractionDigits: 0 });
      } else if (item.key === "US 10Y") {
        priceStr = price.toFixed(3) + item.suffix;
      } else {
        priceStr = item.prefix + price.toFixed(2) + item.suffix;
      }

      html += '<div class="m-item">';
      html += '<span class="m-icon">' + item.icon + '</span>';
      html += '<span class="m-name">' + item.label + '</span>';
      html += '<span class="m-val">' + priceStr + '</span>';
      html += '<span class="m-chg ' + cls + '">' + arrow + Math.abs(change).toFixed(2) + '%</span>';
      html += '</div>';
    }
  }

  if (html) container.innerHTML = html;
}


// ---- TOP MOVERS ----
function buildTopMovers(moversRows) {
  var container = document.getElementById("movers-container");
  if (!container || !moversRows || moversRows.length === 0) return;

  // Group by index
  var indices = {};
  var indexOrder = [];
  for (var i = 0; i < moversRows.length; i++) {
    var idx = moversRows[i].index || "";
    if (!indices[idx]) {
      indices[idx] = { gainers: [], losers: [], advances: 0, declines: 0, total: 0 };
      indexOrder.push(idx);
    }
    var stock = {
      symbol: moversRows[i].stock || "",
      price: parseFloat(moversRows[i].price) || 0,
      change: parseFloat(moversRows[i].changepct) || 0
    };
    if (moversRows[i].type === "gainer") {
      indices[idx].gainers.push(stock);
    } else {
      indices[idx].losers.push(stock);
    }
    // Read advances/declines from the row (same for all rows of same index)
    var adv = parseInt(moversRows[i].advances);
    var dec = parseInt(moversRows[i].declines);
    var tot = parseInt(moversRows[i].total);
    if (!isNaN(adv) && adv > 0) indices[idx].advances = adv;
    if (!isNaN(dec) && dec > 0) indices[idx].declines = dec;
    if (!isNaN(tot) && tot > 0) indices[idx].total = tot;
  }

  var icons = {
    "NIFTY 50": "📈", "NIFTY MIDCAP": "📊", "NIFTY SMALLCAP": "🔻",
    "BANK NIFTY": "🏦", "NIFTY IT": "💻", "PSU BANK": "🏛️",
    "NIFTY AUTO": "🚗", "NIFTY METAL": "⛏️", "NIFTY PHARMA": "💊",
    "NIFTY FMCG": "🛒", "NIFTY REALTY": "🏗️"
  };

  var fullNames = {
    "NIFTY 50": "NSE Benchmark · 50 Stocks",
    "NIFTY MIDCAP": "Mid-Cap Universe · 100 Stocks",
    "NIFTY SMALLCAP": "Small-Cap Universe · 250 Stocks",
    "BANK NIFTY": "Banking Sector · 12 Stocks",
    "NIFTY IT": "Technology Sector · 10 Stocks",
    "PSU BANK": "Public Sector Banks · 12 Stocks",
    "NIFTY AUTO": "Automobile Sector · 15 Stocks",
    "NIFTY METAL": "Metals & Mining · 15 Stocks",
    "NIFTY PHARMA": "Pharmaceutical Sector · 20 Stocks",
    "NIFTY FMCG": "Consumer Goods · 15 Stocks",
    "NIFTY REALTY": "Real Estate Sector · 10 Stocks"
  };

  var html = "";

  for (var x = 0; x < indexOrder.length; x++) {
    var idxName = indexOrder[x];
    var data = indices[idxName];

    var adv = data.advances;
    var dec = data.declines;
    var tot = data.total;
    var isGreen = adv >= dec;
    var barClass = isGreen ? "bar-green" : "bar-red";
    var iconClass = isGreen ? "ig" : "ir";
    var breadthPct = tot > 0 ? Math.round((adv / tot) * 100) : 0;

    html += '<div class="idx-section">';

    // Index bar
    html += '<div class="idx-bar ' + barClass + '">';
    html += '<div class="idx-left">';
    html += '<div class="idx-icon ' + iconClass + '">' + (icons[idxName] || "📊") + '</div>';
    html += '<div><div class="idx-name">' + idxName + '</div>';
    html += '<div class="idx-full">' + (fullNames[idxName] || "") + '</div></div>';
    html += '</div>';
    html += '</div>';

    // Gainers and Losers grid
    html += '<div class="gl-grid">';

    // Gainers column
    html += '<div class="gl-col">';
    var allGreen = data.losers.length === 0 || (data.losers[0] && data.losers[0].change >= 0);
    html += '<div class="gl-label up">▲ TOP 3 GAINERS</div>';
    for (var g = 0; g < data.gainers.length; g++) {
      var gStock = data.gainers[g];
      var gSign = gStock.change >= 0 ? "+" : "";
      html += '<div class="stk green"><span class="stk-rank">' + (g + 1) + '</span>';
      html += '<div class="stk-info"><div class="stk-name">' + gStock.symbol + '</div>';
      html += '<div class="stk-price">₹' + gStock.price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + '</div></div>';
      html += '<div class="stk-chg up">' + gSign + gStock.change.toFixed(2) + '%</div></div>';
    }
    html += '</div>';

    // Losers column
    html += '<div class="gl-col">';
    if (allGreen) {
      html += '<div class="gl-label up">▲ LEAST GAINERS</div>';
    } else {
      html += '<div class="gl-label dn">▼ TOP 3 LOSERS</div>';
    }
    for (var l = 0; l < data.losers.length; l++) {
      var lStock = data.losers[l];
      var lSign = lStock.change >= 0 ? "+" : "";
      var lColor = lStock.change >= 0 ? "green" : "red";
      var lChgCls = lStock.change >= 0 ? "up" : "dn";
      html += '<div class="stk ' + lColor + '"><span class="stk-rank">' + (l + 1) + '</span>';
      html += '<div class="stk-info"><div class="stk-name">' + lStock.symbol + '</div>';
      html += '<div class="stk-price">₹' + lStock.price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + '</div></div>';
      html += '<div class="stk-chg ' + lChgCls + '">' + lSign + lStock.change.toFixed(2) + '%</div></div>';
    }
    html += '</div>';

    html += '</div>'; // close gl-grid

    // Summary with advances/declines
    if (tot > 0) {
      html += '<div class="idx-summary">Advances: ' + adv + ' · Declines: ' + dec;
      html += '<span class="breadth-pct">Breadth: ' + breadthPct + '% ▲</span></div>';
    } else {
      html += '<div class="idx-summary">Top 3 Gainers · Top 3 Losers</div>';
    }

    html += '</div>'; // close idx-section
  }

  container.innerHTML = html;
}

// ---- TIMESTAMP ----
function buildTimestamp() {
  var el = document.querySelector(".tk-time");
  if (!el) return;

  var now = new Date();
  var istOffset = 5.5 * 60 * 60 * 1000;
  var ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);

  var hours = ist.getHours();
  var mins = ist.getMinutes();
  var ampm = hours >= 12 ? "PM" : "AM";
  var h12 = hours % 12 || 12;
  var timeStr = h12 + ":" + (mins < 10 ? "0" : "") + mins + " " + ampm + " IST";

  var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var dateStr = days[ist.getDay()] + ", " + ist.getDate() + " " + months[ist.getMonth()] + " " + ist.getFullYear();

  var marketHour = ist.getHours();
  var marketMin = ist.getMinutes();
  var dayOfWeek = ist.getDay();
  var isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  var marketTime = marketHour * 60 + marketMin;
  var isOpen = isWeekday && marketTime >= 555 && marketTime <= 930; // 9:15 AM to 3:30 PM

  var statusText = isOpen ? "🟢 Market Open" : "🔴 Market Closed";

  el.innerHTML = timeStr + " · " + dateStr + " · " + statusText;
}


// ---- MAIN LOADER ----
function loadMarketData() {

  // Step 0: Update date bar and edition from config (no fetch needed)
  updateDateBar();

  // Step 1: Fetch ticker data (Indices tab)
  fetch(SHEET_CSV_URL)
    .then(function (r) { return r.text(); })
    .then(function (csv) {
      var rows = parseCSV(csv);
      if (rows.length > 0) {
        buildTicker(rows);
        buildHeadline(rows);
        buildSectorMap(rows);
        buildTimestamp();

        // NEW: Auto-update pulse board from sheet data
        updatePulseNifty(rows);
        updateSectorStrip(rows);
        updateMacroStrip(rows);
      }
    })
    .catch(function (err) {
      console.error("Ticker data fetch failed:", err);
    });

  // Step 2: Fetch top movers data (topmovers tab)
  fetch(MOVERS_CSV_URL)
    .then(function (r) { return r.text(); })
    .then(function (csv) {
      var moversRows = parseCSV(csv);
      if (moversRows.length > 0) {
        buildTopMovers(moversRows);
      }
    })
    .catch(function (err) {
      console.error("Top movers fetch failed:", err);
    });
}


// ---- INIT ----
document.addEventListener("DOMContentLoaded", loadMarketData);


// ---- MANUAL REFRESH ----
window.refreshGandhisData = loadMarketData;

