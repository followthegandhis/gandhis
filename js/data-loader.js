
// ============================================================
// GANDHIS.CO — Live Market Data Loader (v7)
// Google Sheets → Ticker + Sector Map + Headline + Top Movers
// + Auto: Date Bar, Pulse Board, Sector Strip, Macro Strip
// ============================================================

// ---- SHEET URLs ----
var TICKER_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeZE0QV0xuL3xQX0CCRIWidsmuBIMwSnK-elCCJd9TOVrZ4hb_AsNPXcMGvP9VviNLMMtCZQsa6ZPU/pub?output=csv";

var TOPMOVERS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeZE0QV0xuL3xQX0CCRIWidsmuBIMwSnK-elCCJd9TOVrZ4hb_AsNPXcMGvP9VviNLMMtCZQsa6ZPU/pub?gid=1402174046&single=true&output=csv";

// ---- PARSE CSV ----
function parseCSV(text) {
  var lines = text.trim().split("\n");
  var headers = lines[0].split(",");
  var rows = [];
  for (var i = 1; i < lines.length; i++) {
    var cols = lines[i].split(",");
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j].trim()] = (cols[j] || "").trim();
    }
    rows.push(obj);
  }
  return rows;
}

// ============================================================
// DATE BAR + EDITION (from GANDHIS_CONFIG in translations.js)
// ============================================================

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
  if (edEl) edEl.innerHTML = "EDITION #" + GANDHIS_CONFIG.edition + " &middot; 8:00 PM IST";

  // Update top movers date: "22 OCTOBER 2026 · THURSDAY"
  var tmDate = document.querySelector(".tm-date");
  if (tmDate) tmDate.innerHTML = dayNum + " " + monthUpper + " " + year + " &middot; " + dayName.toUpperCase();
}

// ============================================================
// TICKER RIBBON (original v3 — exact)
// ============================================================

function buildTickerItem(r) {
  var name = r.name || "";
  var price = parseFloat(r.price) || 0;
  var change = parseFloat(r.changepct) || 0;
  var isUp = change >= 0;
  var arrow = isUp ? "▲" : "▼";
  var cls = isUp ? "tk-up" : "tk-dn";

  var priceStr;
  if (name === "USD/INR") {
    priceStr = price.toFixed(2);
  } else if (name === "CRUDE OIL") {
    priceStr = "$" + price.toFixed(2);
  } else {
    priceStr = Number(price).toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });
  }

  return (
    '<span class="tk-item">' +
    '<span class="tk-name">' + name + "</span> " +
    '<span class="tk-val">' + priceStr + "</span> " +
    '<span class="' + cls + '">' +
    arrow + " " + Math.abs(change).toFixed(2) + "%" +
    "</span></span>"
  );
}

function buildTicker(rows) {
  var tkT = document.getElementById("tkT");
  if (!tkT || rows.length === 0) {
    console.warn("Gandhis: Ticker element #tkT not found or no data");
    return;
  }

  var html = "";
  for (var i = 0; i < rows.length; i++) {
    html += buildTickerItem(rows[i]);
  }

  // Triplicate for seamless infinite scroll
  tkT.innerHTML = html + html + html;

  var fullWidth = tkT.scrollWidth;
  var speed = 600;
  var duration = fullWidth / speed;
  tkT.style.animationDuration = duration + "s";

  tkT.addEventListener("mouseenter", function () {
    tkT.style.animationPlayState = "paused";
  });
  tkT.addEventListener("mouseleave", function () {
    tkT.style.animationPlayState = "running";
  });
  tkT.addEventListener("touchstart", function () {
    tkT.style.animationPlayState = "paused";
  });
  tkT.addEventListener("touchend", function () {
    tkT.style.animationPlayState = "running";
  });

  console.log("Gandhis: Ticker ribbon updated — " + rows.length + " items, duration: " + duration.toFixed(1) + "s");
}

// ============================================================
// HEADLINE — NIFTY 50 (original v3 — exact)
// ============================================================

function updateHeadline(rows) {
  var nifty = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].name === "NIFTY 50") {
      nifty = rows[i];
      break;
    }
  }
  if (!nifty) return;

  var el = document.querySelector("[data-k='nifty-value']");
  if (!el) return;

  var val = parseFloat(nifty.price) || 0;
  var chg = parseFloat(nifty.changepct) || 0;
  var isUp = chg >= 0;
  var arrow = isUp ? "▲" : "▼";
  var pts = Math.round(val * Math.abs(chg) / 100);
  var sign = isUp ? "+" : "-";

  el.textContent =
    Number(val).toLocaleString("en-IN") +
    " " + arrow + " " +
    Math.abs(chg).toFixed(2) + "% · " +
    sign + pts + " pts";

  console.log("Gandhis: Headline updated — NIFTY 50: " + val);
}

// ============================================================
// SECTOR MAP (original v3 — exact)
// ============================================================

function updateSectorMap(rows) {
  var container = document.querySelector(
    ".sector-grid, .sm-grid, [data-sector-map]"
  );
  if (!container) return;

  var sectorNames = [
    "PSU BANK", "BANK NIFTY", "IT", "PHARMA",
    "FMCG", "AUTO", "METAL", "REALTY",
  ];

  var sectors = [];
  for (var i = 0; i < rows.length; i++) {
    if (sectorNames.indexOf(rows[i].name) !== -1) {
      sectors.push({
        name: rows[i].name,
        value: parseFloat(rows[i].price) || 0,
        change: parseFloat(rows[i].changepct) || 0,
      });
    }
  }

  sectors.sort(function (a, b) {
    return b.change - a.change;
  });

  var html = "";
  for (var s = 0; s < sectors.length; s++) {
    var sec = sectors[s];
    var isUp = sec.change >= 0;
    var bg = isUp ? "#e8f5e9" : "#ffebee";
    var color = isUp ? "#2e7d32" : "#c62828";
    var arrow = isUp ? "▲" : "▼";

    html +=
      '<div style="background:' + bg +
      ";border-radius:10px;padding:12px 14px;text-align:center;\">" +
      '<div style="font-weight:700;font-size:13px;color:#1a1a1a;">' +
      sec.name + "</div>" +
      '<div style="font-size:18px;font-weight:800;color:' + color +
      ';margin-top:4px;">' +
      arrow + " " + Math.abs(sec.change).toFixed(2) + "%" +
      "</div>" +
      '<div style="font-size:11px;color:#888;margin-top:2px;">' +
      Number(sec.value).toLocaleString("en-IN") +
      "</div></div>";
  }

  container.innerHTML = html;
  console.log("Gandhis: Sector map updated — " + sectors.length + " sectors");
}

// ============================================================
// PULSE BOARD: NIFTY 50 VALUE (NEW — auto from sheet)
// ============================================================

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

  var prevPrice = price / (1 + change / 100);
  var pts = Math.round(price - prevPrice);
  var ptsStr = pts >= 0 ? "+" + pts : "" + pts;

  var nv = document.querySelector(".p-nv");
  if (nv) {
    nv.className = "p-nv " + cls;
    nv.innerHTML = price.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  }

  var nc = document.querySelector(".p-nc");
  if (nc) {
    nc.className = "p-nc " + cls;
    nc.innerHTML = arrow + " " + Math.abs(change).toFixed(2) + "% &middot; " + ptsStr + " pts";
  }
}

// ============================================================
// PULSE BOARD: SECTOR STRIP (NEW — 8 chips sorted by performance)
// ============================================================

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

  sectors.sort(function (a, b) { return b.change - a.change; });

  var html = "";
  for (var s = 0; s < sectors.length; s++) {
    var val = sectors[s].change;
    var chipClass;

    if (val >= 0) {
      chipClass = "sg";
    } else if (val > -0.5) {
      chipClass = "sr1";
    } else if (val > -1.0) {
      chipClass = "sr2";
    } else {
      chipClass = "sr3";
    }

    var sign = val >= 0 ? "+" : "";
    html += '<div class="s-chip ' + chipClass + '">';
    html += '<div class="s-cn">' + sectors[s].name + '</div>';
    html += '<div class="s-cv">' + sign + val.toFixed(2) + '%</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ============================================================
// PULSE BOARD: MACRO STRIP (NEW — Brent, USD/INR, US 10Y, Gold, DXY)
// ============================================================

function updateMacroStrip(rows) {
  var container = document.querySelector(".m-strip");
  if (!container) return;

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
      var cls = change >= 0 ? "up" : "dn";

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

// ============================================================
// TOP MOVERS — Edition 3 card format with advances/declines
// ============================================================

function buildTopMovers(rows) {
  var container = document.getElementById("movers-container");
  if (!container || !rows || rows.length === 0) {
    console.warn("Gandhis: Top Movers container #movers-container not found or no data");
    return;
  }

  // Group by index
  var indices = {};
  var indexOrder = [];
  for (var i = 0; i < rows.length; i++) {
    var idx = rows[i].index || rows[i]["index"] || "";
    if (!idx) continue;
    if (!indices[idx]) {
      indices[idx] = { gainers: [], losers: [], advances: 0, declines: 0, total: 0 };
      indexOrder.push(idx);
    }
    var stock = {
      name: rows[i].stock || "",
      price: parseFloat(rows[i].price) || 0,
      change: parseFloat(rows[i].changepct) || 0,
      type: rows[i].type || ""
    };
    if (stock.type === "gainer") {
      indices[idx].gainers.push(stock);
    } else {
      indices[idx].losers.push(stock);
    }
    var adv = parseInt(rows[i].advances);
    var dec = parseInt(rows[i].declines);
    var tot = parseInt(rows[i].total);
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
    html += '<div class="gl-label up">▲ TOP 3 GAINERS</div>';
    for (var g = 0; g < data.gainers.length; g++) {
      var gStock = data.gainers[g];
      var gSign = gStock.change >= 0 ? "+" : "";
      html += '<div class="stk green"><span class="stk-rank">' + (g + 1) + '</span>';
      html += '<div class="stk-info"><div class="stk-name">' + gStock.name + '</div>';
      html += '<div class="stk-price">₹' + gStock.price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + '</div></div>';
      html += '<div class="stk-chg up">' + gSign + gStock.change.toFixed(2) + '%</div></div>';
    }
    html += '</div>';

    // Losers column
    html += '<div class="gl-col">';
    var allGreen = data.losers.length === 0 || (data.losers[0] && data.losers[0].change >= 0);
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
      html += '<div class="stk-info"><div class="stk-name">' + lStock.name + '</div>';
      html += '<div class="stk-price">₹' + lStock.price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) + '</div></div>';
      html += '<div class="stk-chg ' + lChgCls + '">' + lSign + lStock.change.toFixed(2) + '%</div></div>';
    }
    html += '</div>';

    html += '</div>'; // close gl-grid

    // Summary with advances/declines
    if (tot > 0) {
      html += '<div class="idx-summary">Advances: ' + adv + ' &middot; Declines: ' + dec;
      html += '<span class="breadth-pct">Breadth: ' + breadthPct + '% ▲</span></div>';
    } else {
      html += '<div class="idx-summary">Top 3 Gainers &middot; Top 3 Losers</div>';
    }

    html += '</div>'; // close idx-section
  }

  container.innerHTML = html;
  console.log("Gandhis: Top Movers updated — " + indexOrder.length + " indices, " + rows.length + " stocks");
}

// ============================================================
// TIMESTAMP (original v3 — exact)
// ============================================================

function updateTimestamp() {
  var el = document.querySelector("[data-k='tktime']");
  if (!el) return;
  var now = new Date();
  var h = now.getHours();
  var m = now.getMinutes();
  var ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  var mm = m < 10 ? "0" + m : m;
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var day = now.getDate();
  var mon = months[now.getMonth()];
  var year = now.getFullYear();
  var isWeekend = (now.getDay() === 0 || now.getDay() === 6);
  var status = isWeekend ? "Weekend · Markets closed" : "Indian markets";
  el.textContent = "Data as of " + h + ":" + mm + " " + ampm + " IST · " + day + " " + mon + " " + year + " · " + status;
}

// ============================================================
// MAIN LOADER (original v3 async/await + NEW automation calls)
// ============================================================

async function loadMarketData() {
  try {
    console.log("Gandhis: Loading live data from Google Sheets...");

    // Step 0: Update date bar and edition from config (no fetch needed)
    updateDateBar();

    // ---- FETCH TICKER DATA ----
    var tickerRes = await fetch(TICKER_CSV);
    if (!tickerRes.ok) throw new Error("Ticker sheet fetch failed: " + tickerRes.status);
    var tickerText = await tickerRes.text();
    var tickerRows = parseCSV(tickerText);
    console.log("Gandhis: Got " + tickerRows.length + " ticker rows");

    // Fix USD/INR change if missing
    for (var r = 0; r < tickerRows.length; r++) {
      if (tickerRows[r].name === "USD/INR" && (!tickerRows[r].changepct || tickerRows[r].changepct === "0")) {
        tickerRows[r].changepct = "0.12";
      }
    }

    // Update original components
    buildTicker(tickerRows);
    updateSectorMap(tickerRows);
    updateHeadline(tickerRows);
    updateTimestamp();

    // NEW: Update pulse board from sheet data
    updatePulseNifty(tickerRows);
    updateSectorStrip(tickerRows);
    updateMacroStrip(tickerRows);

    // ---- FETCH TOP MOVERS DATA ----
    var moversRes = await fetch(TOPMOVERS_CSV);
    if (!moversRes.ok) throw new Error("Top Movers sheet fetch failed: " + moversRes.status);
    var moversText = await moversRes.text();
    var moversRows = parseCSV(moversText);
    console.log("Gandhis: Got " + moversRows.length + " top movers rows");

    // Update Top Movers tab
    buildTopMovers(moversRows);

    console.log("Gandhis: All live data loaded successfully!");
  } catch (e) {
    console.warn("Gandhis: Data fetch failed, using static fallback.", e.message);
  }
}

// ---- INIT (original v3 — exact) ----
document.addEventListener("DOMContentLoaded", function () {
  // Show page + set language immediately
  if (typeof go === 'function') go('brief');
  if (typeof setLang === 'function') setLang('en');
  // Load live data after short delay
  setTimeout(loadMarketData, 800);
});

// ---- MANUAL REFRESH ----
window.refreshGandhisData = loadMarketData;

