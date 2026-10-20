// ============================================================
// GANDHIS.CO — Data Loader
// Fetches market data from Netlify Function and populates the site
// ============================================================

const DATA_URL = "/.netlify/functions/fetch-market-data";

// ---- MAIN LOADER ----
async function loadMarketData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("Data fetch failed");
    const data = await res.json();

    if (data.error) {
      console.warn("Gandhis: API returned error, using fallback data");
      return;
    }

    updateTicker(data.ticker);
    updateHeadline(data.headline);
    updateSectorMap(data.sectorMap);
    updateTopMovers(data.topMovers);
    updateBreadth(data.breadth);
    updateDate(data.meta.date);

    console.log("Gandhis: Live data loaded successfully for", data.meta.date);
  } catch (e) {
    console.warn("Gandhis: Could not load live data, using static fallback.", e.message);
    // Website still works with hardcoded data as fallback
  }
}

// ---- TICKER RIBBON ----
function updateTicker(tickerData) {
  if (!tickerData || tickerData.length === 0) return;

  const tickerTrack = document.querySelector(".ticker-track");
  if (!tickerTrack) return;

  let tickerHTML = "";
  tickerData.forEach((item) => {
    const isUp = parseFloat(item.change) >= 0;
    const arrow = isUp ? "▲" : "▼";
    const colorClass = isUp ? "tk-up" : "tk-dn";
    const shortName = item.name
      .replace("NIFTY ", "")
      .replace("NIFTY", "NIFTY 50")
      .replace("SMLCAP", "SMALLCAP");

    tickerHTML += `<span class="tk-item">
      <span class="tk-name">${shortName}</span>
      <span class="tk-val">${Number(item.value).toLocaleString("en-IN")}</span>
      <span class="${colorClass}">${arrow} ${Math.abs(item.change).toFixed(2)}%</span>
    </span>`;
  });

  // Duplicate for seamless scroll
  tickerTrack.innerHTML = tickerHTML + tickerHTML;
}

// ---- HEADLINE (NIFTY 50 main number) ----
function updateHeadline(headline) {
  if (!headline) return;

  const niftyEl = document.querySelector("[data-k='nifty-value']");
  if (niftyEl) {
    const n = headline.nifty50;
    const arrow = n.change >= 0 ? "▲" : "▼";
    const sign = n.pointChange >= 0 ? "+" : "";
    niftyEl.textContent = `${Number(n.value).toLocaleString("en-IN")} ${arrow} ${Math.abs(n.change).toFixed(2)}% · ${sign}${Number(n.pointChange).toFixed(0)} pts`;
  }
}

// ---- SECTOR MAP ----
function updateSectorMap(sectorMap) {
  if (!sectorMap || sectorMap.length === 0) return;

  const container = document.querySelector(".sector-grid, .sm-grid, [data-sector-map]");
  if (!container) return;

  let html = "";
  sectorMap.forEach((s) => {
    const isUp = parseFloat(s.change) >= 0;
    const bg = isUp ? "#e8f5e9" : "#ffebee";
    const color = isUp ? "#2e7d32" : "#c62828";
    const arrow = isUp ? "▲" : "▼";

    html += `<div style="background:${bg};border-radius:10px;padding:12px 14px;text-align:center;">
      <div style="font-weight:700;font-size:13px;color:#1a1a1a;">${s.name}</div>
      <div style="font-size:18px;font-weight:800;color:${color};margin-top:4px;">
        ${arrow} ${Math.abs(s.change).toFixed(2)}%
      </div>
      <div style="font-size:11px;color:#888;margin-top:2px;">${Number(s.value).toLocaleString("en-IN")}</div>
    </div>`;
  });

  container.innerHTML = html;
}

// ---- TOP MOVERS ----
function updateTopMovers(topMovers) {
  if (!topMovers) return;

  // For each index, find the corresponding container and populate
  Object.keys(topMovers).forEach((indexName) => {
    const shortName = indexName
      .replace("NIFTY ", "")
      .replace("SMLCAP", "SMALLCAP")
      .toUpperCase();

    // Find the panel for this index
    const panel = document.querySelector(`[data-index="${indexName}"], [data-index="${shortName}"]`);
    if (!panel) return;

    const { gainers, losers } = topMovers[indexName];

    // Populate gainers
    const gainerContainer = panel.querySelector(".gainers, [data-gainers]");
    if (gainerContainer && gainers.length > 0) {
      gainerContainer.innerHTML = gainers
        .map(
          (g) => `<div class="mover-row gainer">
          <span class="m-name">${g.symbol}</span>
          <span class="m-price">₹${Number(g.price).toLocaleString("en-IN")}</span>
          <span class="m-chg up">▲ ${g.change}%</span>
        </div>`
        )
        .join("");
    }

    // Populate losers
    const loserContainer = panel.querySelector(".losers, [data-losers]");
    if (loserContainer && losers.length > 0) {
      loserContainer.innerHTML = losers
        .map(
          (l) => `<div class="mover-row loser">
          <span class="m-name">${l.symbol}</span>
          <span class="m-price">₹${Number(l.price).toLocaleString("en-IN")}</span>
          <span class="m-chg dn">▼ ${Math.abs(l.change)}%</span>
        </div>`
        )
        .join("");
    }
  });
}

// ---- BREADTH ----
function updateBreadth(breadth) {
  if (!breadth) return;

  const el = document.querySelector("[data-breadth]");
  if (el) {
    const total = breadth.advances + breadth.declines + breadth.unchanged;
    const advPct = total > 0 ? ((breadth.advances / total) * 100).toFixed(0) : 0;
    const decPct = total > 0 ? ((breadth.declines / total) * 100).toFixed(0) : 0;
    el.innerHTML = `<span style="color:#2e7d32;">▲ ${breadth.advances} (${advPct}%)</span> · <span style="color:#c62828;">▼ ${breadth.declines} (${decPct}%)</span> · <span style="color:#888;">— ${breadth.unchanged}</span>`;
  }
}

// ---- DATE ----
function updateDate(dateStr) {
  if (!dateStr) return;

  const dateEls = document.querySelectorAll("[data-k='brief-date'], [data-date]");
  const d = new Date(dateStr + "T00:00:00");
  const options = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
  const formatted = d.toLocaleDateString("en-IN", options);

  dateEls.forEach((el) => {
    el.textContent = formatted;
  });
}

// ---- INIT ----
// Load data when page loads
document.addEventListener("DOMContentLoaded", function () {
  // Small delay to let the static HTML render first
  setTimeout(loadMarketData, 500);
});

// Also expose for manual refresh
window.refreshGandhisData = loadMarketData;
