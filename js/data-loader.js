// ============================================================
// GANDHIS.CO — Live Market Data Loader
// Reads from Google Sheets — FREE, no API key, no CORS issues
// One-time setup, auto-updates forever
// ============================================================

var SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeZE0QV0xuL3xQX0CCRIWidsmuBIMwSnK-elCCJd9TOVrZ4hb_AsNPXcMGvP9VviNLMMtCZQsa6ZPU/pub?output=csv";

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

// ---- MAIN LOADER ----
async function loadMarketData() {
  try {
    console.log("Gandhis: Loading live data from Google Sheets...");

    var res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);

    var text = await res.text();
    var rows = parseCSV(text);
    console.log("Gandhis: Got " + rows.length + " rows from sheet");

    if (rows.length === 0) {
      console.warn("Gandhis: No data in sheet, using static fallback.");
      return;
    }

    // ---- FIX USD/INR CHANGE (hardcoded since Google Finance doesn't support it) ----
    for (var r = 0; r < rows.length; r++) {
      if (rows[r].name === "USD/INR" && (!rows[r].changepct || rows[r].changepct === "0")) {
        rows[r].changepct = "0.12"; // Updated daily via brief
      }
    }

    // ---- UPDATE TICKER RIBBON ----
    updateTicker(rows);

    // ---- UPDATE SECTOR MAP ----
    updateSectorMap(rows);

    // ---- UPDATE HEADLINE ----
    updateHeadline(rows);

    console.log("Gandhis: All live data loaded successfully!");
  } catch (e) {
    console.warn("Gandhis: Live data fetch failed, using static fallback.", e.message);
  }
}

// ---- TICKER RIBBON ----
function updateTicker(rows) {
  var tickerTrack = document.querySelector(".ticker-track");
  if (!tickerTrack || rows.length === 0) return;

  var html = "";
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var name = r.name || "";
    var price = parseFloat(r.price) || 0;
    var change = parseFloat(r.changepct) || 0;
    var isUp = change >= 0;
    var arrow = isUp ? "▲" : "▼";
    var cls = isUp ? "tk-up" : "tk-dn";

    // Format price based on type
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

    html +=
      '<span class="tk-item">' +
      '<span class="tk-name">' + name + "</span> " +
      '<span class="tk-val">' + priceStr + "</span> " +
      '<span class="' + cls + '">' +
      arrow + " " + Math.abs(change).toFixed(2) + "%" +
      "</span></span>";
  }

  // Duplicate for seamless infinite scroll
  tickerTrack.innerHTML = html + html;
  console.log("Gandhis: Ticker ribbon updated");
}

// ---- HEADLINE (NIFTY 50) ----
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

  // Calculate approximate point change
  var pts = Math.round(val * Math.abs(chg) / 100);
  var sign = isUp ? "+" : "-";

  el.textContent =
    Number(val).toLocaleString("en-IN") +
    " " + arrow + " " +
    Math.abs(chg).toFixed(2) + "% · " +
    sign + pts + " pts";

  console.log("Gandhis: Headline updated — NIFTY 50: " + val);
}

// ---- SECTOR MAP ----
function updateSectorMap(rows) {
  var container = document.querySelector(
    ".sector-grid, .sm-grid, [data-sector-map]"
  );
  if (!container) return;

  // Sector names to pick from sheet
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

  // Sort by change — best to worst
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

// ---- INIT: Load data when page opens ----
document.addEventListener("DOMContentLoaded", function () {
  setTimeout(loadMarketData, 800);
});

// ---- MANUAL REFRESH (type refreshGandhisData() in console to test) ----
window.refreshGandhisData = loadMarketData;
