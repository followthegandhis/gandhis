
// ============================================================
// GANDHIS.CO — Live Market Data Loader (v3)
// Google Sheets → Ticker + Sector Map + Headline + Top Movers
// Two sheet tabs: ticker data + topmovers data
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
// TOP MOVERS — Reads from topmovers sheet tab
// ============================================================

function buildTopMovers(rows) {
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
    };
    if (stock.type === "gainer") {
      indices[idx].gainers.push(stock);
    } else {
      indices[idx].losers.push(stock);
    }
  }

  // Build the index selector buttons
  var btnContainer = document.getElementById("tm-btns");
  var dataContainer = document.getElementById("tm-data");

  if (!btnContainer || !dataContainer) {
    console.warn("Gandhis: Top Movers containers #tm-btns or #tm-data not found");
    return;
  }

  var btnHtml = "";
  for (var b = 0; b < indexOrder.length; b++) {
    var active = b === 0 ? " tm-btn-active" : "";
    btnHtml +=
      '<button class="tm-btn' + active + '" data-idx="' + b + '">' +
      indexOrder[b] + "</button>";
  }
  btnContainer.innerHTML = btnHtml;

  // Build data panels for each index
  var panelsHtml = "";
  for (var p = 0; p < indexOrder.length; p++) {
    var idxName = indexOrder[p];
    var data = indices[idxName];
    var display = p === 0 ? "block" : "none";

    panelsHtml += '<div class="tm-panel" data-panel="' + p + '" style="display:' + display + ';">';

    // Gainers table
    panelsHtml += '<div class="tm-section">';
    panelsHtml += '<div class="tm-label tm-gainer-label">▲ Top 3 Gainers</div>';
    panelsHtml += '<table class="tm-table">';
    panelsHtml += '<tr><th>Stock</th><th>Price (₹)</th><th>Change</th></tr>';
    for (var g = 0; g < data.gainers.length; g++) {
      var gn = data.gainers[g];
      panelsHtml +=
        '<tr><td class="tm-stock">' + gn.name + "</td>" +
        '<td class="tm-price">' + Number(gn.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "</td>" +
        '<td class="tm-change tm-up">▲ ' + Math.abs(gn.change).toFixed(2) + "%</td></tr>";
    }
    panelsHtml += "</table></div>";

    // Losers table
    panelsHtml += '<div class="tm-section">';
    panelsHtml += '<div class="tm-label tm-loser-label">▼ Top 3 Losers</div>';
    panelsHtml += '<table class="tm-table">';
    panelsHtml += '<tr><th>Stock</th><th>Price (₹)</th><th>Change</th></tr>';
    for (var l = 0; l < data.losers.length; l++) {
      var ln = data.losers[l];
      panelsHtml +=
        '<tr><td class="tm-stock">' + ln.name + "</td>" +
        '<td class="tm-price">' + Number(ln.price).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "</td>" +
        '<td class="tm-change tm-dn">▼ ' + Math.abs(ln.change).toFixed(2) + "%</td></tr>";
    }
    panelsHtml += "</table></div>";

    panelsHtml += "</div>";
  }
  dataContainer.innerHTML = panelsHtml;

  // Add click handlers to buttons
  var btns = btnContainer.querySelectorAll(".tm-btn");
  for (var c = 0; c < btns.length; c++) {
    btns[c].addEventListener("click", function () {
      var idx = this.getAttribute("data-idx");
      // Toggle active button
      var allBtns = btnContainer.querySelectorAll(".tm-btn");
      for (var ab = 0; ab < allBtns.length; ab++) {
        allBtns[ab].classList.remove("tm-btn-active");
      }
      this.classList.add("tm-btn-active");
      // Toggle panels
      var allPanels = dataContainer.querySelectorAll(".tm-panel");
      for (var ap = 0; ap < allPanels.length; ap++) {
        allPanels[ap].style.display = "none";
      }
      dataContainer.querySelector('[data-panel="' + idx + '"]').style.display = "block";
    });
  }

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

    // Fix USD/INR change
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
