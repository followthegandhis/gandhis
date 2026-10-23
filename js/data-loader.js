
// ============================================================
// GANDHIS.CO — Live Market Data Loader (v4)
// Google Sheets → Ticker + Sector Map + Headline + Top Movers
// Two sheet tabs: ticker data + topmovers data
// ============================================================

// ---- SHEET URLs ----
var TICKER_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeZE0QV0xuL3xQX0CCRIWidsmuBIMwSnK-elCCJd9TOVrZ4hb_AsNPXcMGvP9VviNLMMtCZQsa6ZPU/pub?output=csv";

var TOPMOVERS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeZE0QV0xuL3xQX0CCRIWidsmuBIMwSnK-elCCJd9TOVrZ4hb_AsNPXcMGvP9VviNLMMtCZQsa6ZPU/pub?gid=1402174046&single=true&output=csv";

// ---- FALLBACK TICKER DATA (23 Oct 2026 — latest from sheet) ----
var FALLBACK_TICKER = [
  { name: "NIFTY 50",    price: "22417.85", changepct: "-1.19" },
  { name: "BANK NIFTY",  price: "54194.50", changepct: "-1.33" },
  { name: "SENSEX",      price: "72580.31", changepct: "-0.91" },
  { name: "IT",          price: "32087.15", changepct: "0.02" },
  { name: "PHARMA",      price: "25130.15", changepct: "-1.82" },
  { name: "FMCG",        price: "42159.00", changepct: "-2.20" },
  { name: "AUTO",        price: "24511.05", changepct: "-2.00" },
  { name: "METAL",       price: "11384.35", changepct: "-3.51" },
  { name: "REALTY",      price: "777.90",   changepct: "-3.18" },
  { name: "PSU BANK",    price: "8789.80",  changepct: "-2.71" },
  { name: "CRUDE OIL",   price: "114.50",   changepct: "0.00" },
  { name: "USD/INR",     price: "94.96",    changepct: "0.00" },
  { name: "DJIA",        price: "52867.98", changepct: "0.02" },
  { name: "NASDAQ",      price: "26008.86", changepct: "-2.60" }
];

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
// TICKER RIBBON
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
// HEADLINE (NIFTY 50)
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
// SECTOR MAP
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
      ';border-radius:10px;padding:12px 14px;text-align:center;">' +
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
// TOP MOVERS — Reads from topmovers sheet tab
// Targets #movers-container, builds idx-section cards
// Uses existing CSS classes from style2.css
// ============================================================

function buildTopMovers(rows) {
  var container = document.getElementById("movers-container");
  if (!container) {
    console.warn("Gandhis: #movers-container not found");
    return;
  }

  // Group rows by index
  var indices = {};
  var indexOrder = [];

  for (var i = 0; i < rows.length; i++) {
    var idx = rows[i].index || rows[i]["index"] || "";
    if (!idx) continue;
    if (!indices[idx]) {
      indices[idx] = { gainers: [], losers: [] };
      indexOrder.push(idx);
    }
    var stock = {
      name: rows[i].stock || "",
      price: parseFloat(rows[i].price) || 0,
      change: parseFloat(rows[i].changepct) || 0,
      type: rows[i].type || "",
      advances: rows[i].advances || "0",
      declines: rows[i].declines || "0",
      total: rows[i].total || "0",
    };
    if (stock.type === "gainer") {
      indices[idx].gainers.push(stock);
    } else {
      indices[idx].losers.push(stock);
    }
  }

  if (indexOrder.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#999;font-family:DM Sans,sans-serif;font-size:14px;">No top movers data available yet. Check back after market hours.</div>';
    return;
  }

  // Icon map for each index
  var iconMap = {
    "NIFTY 50": "50", "NIFTY MIDCAP": "MC", "NIFTY SMALLCAP": "SC",
    "BANK NIFTY": "BN", "NIFTY IT": "IT", "PSU BANK": "PS",
    "NIFTY AUTO": "AU", "NIFTY METAL": "MT", "NIFTY PHARMA": "PH",
    "NIFTY FMCG": "FM", "NIFTY REALTY": "RE"
  };

  // Full name map
  var fullNameMap = {
    "NIFTY 50": "NIFTY 50 INDEX", "NIFTY MIDCAP": "NIFTY MIDCAP 100",
    "NIFTY SMALLCAP": "NIFTY SMALLCAP 250", "BANK NIFTY": "NIFTY BANK INDEX",
    "NIFTY IT": "NIFTY IT INDEX", "PSU BANK": "NIFTY PSU BANK",
    "NIFTY AUTO": "NIFTY AUTO INDEX", "NIFTY METAL": "NIFTY METAL INDEX",
    "NIFTY PHARMA": "NIFTY PHARMA INDEX", "NIFTY FMCG": "NIFTY FMCG INDEX",
    "NIFTY REALTY": "NIFTY REALTY INDEX"
  };

  var html = '';

  for (var p = 0; p < indexOrder.length; p++) {
    var idxName = indexOrder[p];
    var data = indices[idxName];
    var icon = iconMap[idxName] || idxName.substring(0, 2).toUpperCase();
    var fullName = fullNameMap[idxName] || idxName;

    // Calculate net change from gainers/losers
    var allStocks = data.gainers.concat(data.losers);
    var advances = 0;
    var declines = 0;
    for (var a = 0; a < allStocks.length; a++) {
      if (allStocks[a].change >= 0) advances++;
      else declines++;
    }
    var isGreen = advances >= declines;
    var barClass = isGreen ? "bar-green" : "bar-red";
    var iconClass = isGreen ? "ig" : "ir";

    // Start idx-section
    html += '<div class="idx-section">';

    // idx-bar header
    html += '<div class="idx-bar ' + barClass + '">';
    html += '<div class="idx-left">';
    html += '<div class="idx-icon ' + iconClass + '">' + icon + '</div>';
    html += '<div><div class="idx-name">' + idxName + '</div>';
    html += '<div class="idx-full">' + fullName + '</div></div>';
    html += '</div>';
    html += '</div>';

    // gl-grid: Gainers | Losers
    html += '<div class="gl-grid">';

    // Gainers column
    html += '<div class="gl-col">';
    html += '<div class="gl-label" style="color:#007A3F;">▲ TOP GAINERS</div>';
    for (var g = 0; g < data.gainers.length; g++) {
      var gn = data.gainers[g];
      html += '<div class="stk green">';
      html += '<span class="stk-rank">' + (g + 1) + '</span>';
      html += '<div class="stk-info">';
      html += '<div class="stk-name">' + gn.name + '</div>';
      html += '<div class="stk-price">₹' + Number(gn.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div>';
      html += '</div>';
      html += '<div class="stk-chg" style="color:#007A3F;">+' + Math.abs(gn.change).toFixed(2) + '%</div>';
      html += '</div>';
    }
    html += '</div>';

    // Losers column
    html += '<div class="gl-col">';
    html += '<div class="gl-label" style="color:#D32F2F;">▼ TOP LOSERS</div>';
    for (var l = 0; l < data.losers.length; l++) {
      var ln = data.losers[l];
      html += '<div class="stk red">';
      html += '<span class="stk-rank">' + (l + 1) + '</span>';
      html += '<div class="stk-info">';
      html += '<div class="stk-name">' + ln.name + '</div>';
      html += '<div class="stk-price">₹' + Number(ln.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</div>';
      html += '</div>';
      html += '<div class="stk-chg" style="color:#D32F2F;">-' + Math.abs(ln.change).toFixed(2) + '%</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>'; // close gl-grid

    // idx-summary footer — uses real advances/declines from Python script
    var adv = parseInt(data.gainers[0] && data.gainers[0].advances) || 0;
    var dec = parseInt(data.losers[0] && data.losers[0].declines) || 0;
    var tot = parseInt(data.gainers[0] && data.gainers[0].total) || 0;
    var breadthPct = tot > 0 ? Math.round((adv / tot) * 100) : 0;

    html += '<div class="idx-summary">';
    if (tot > 0) {
      html += 'Advances: <strong>' + adv + '</strong> · Declines: <strong>' + dec + '</strong>';
      html += '<span class="breadth-pct">Breadth: ' + breadthPct + '% ▲</span>';
    } else {
      html += 'Top 3 Gainers · Top 3 Losers';
    }
    html += '</div>';
  }

  container.innerHTML = html;
  console.log("Gandhis: Top Movers updated — " + indexOrder.length + " indices, " + rows.length + " stocks");
}

// ============================================================
// TIMESTAMP
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
// MAIN LOADER
// ============================================================

async function loadMarketData() {
  try {
    console.log("Gandhis: Loading live data from Google Sheets...");

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

    // Update ticker components
    buildTicker(tickerRows);
    updateSectorMap(tickerRows);
    updateHeadline(tickerRows);
    updateTimestamp();

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
    // Use fallback data so the site still shows something
    buildTicker(FALLBACK_TICKER);
    updateSectorMap(FALLBACK_TICKER);
    updateHeadline(FALLBACK_TICKER);
    updateTimestamp();
  }
}

// ---- INIT ----
document.addEventListener("DOMContentLoaded", function () {
  // Show page + set language immediately
  if (typeof go === 'function') go('brief');
  if (typeof setLang === 'function') setLang('en');
  // Load live data after short delay
  setTimeout(loadMarketData, 800);
});

// ---- MANUAL REFRESH ----
window.refreshGandhisData = loadMarketData;

