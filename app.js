/* ===== GANDHIS — APP ENGINE ===== */
/* Ticker builder, tab switching, language toggle */

/* ----- TAB SWITCHING ----- */
function go(t) {
  var pages = ['brief', 'movers', 'week', 'archive', 'about'];
  for (var i = 0; i < pages.length; i++) {
    /* Hide all pages */
    document.getElementById('pg-' + pages[i]).style.display = 'none';
    /* Reset all tab buttons */
    var btn = document.querySelector('[data-t="' + pages[i] + '"]');
    if (btn) {
      btn.style.color = '#777';
      btn.style.borderBottomColor = 'transparent';
    }
  }
  /* Show selected page */
  document.getElementById('pg-' + t).style.display = 'block';
  /* Highlight selected tab */
  var active = document.querySelector('[data-t="' + t + '"]');
  if (active) {
    active.style.color = '#007A3F';
    active.style.borderBottomColor = '#007A3F';
  }
  /* Scroll to top */
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ----- LANGUAGE TOGGLE ----- */
function setLang(lang) {
  /* Update EN/HI button styles */
  var btnEn = document.getElementById('btnEn');
  var btnHi = document.getElementById('btnHi');

  btnEn.style.background = lang === 'en' ? '#007A3F' : 'none';
  btnEn.style.color = lang === 'en' ? '#fff' : '#777';
  btnHi.style.background = lang === 'hi' ? '#007A3F' : 'none';
  btnHi.style.color = lang === 'hi' ? '#fff' : '#777';

  /* Swap all text elements that have data-k attribute */
  var els = document.querySelectorAll('[data-k]');
  for (var i = 0; i < els.length; i++) {
    var key = els[i].getAttribute('data-k');
    if (T[key] && T[key][lang]) {
      els[i].innerHTML = T[key][lang];
    }
  }
}

/* ----- TICKER BUILDER ----- */
function buildTicker() {
  /* ================================================
     DAILY UPDATE: Change these values every evening.
     This is the ONLY section you edit daily.
     ================================================ */
  var data = [
    { n: 'SENSEX',    v: '73,852',      c: '\u25BC 1.17%',  d: 0 },
    { n: 'NIFTY 50',  v: '22,889',      c: '\u25BC 1.11%',  d: 0 },
    { n: 'BANK NIFTY', v: '55,488',     c: '\u25BC 0.64%',  d: 0 },
    { n: 'NIFTY IT',  v: '31,413',      c: '\u25BC 1.60%',  d: 0 },
    { n: 'PSU BANK',  v: '6,842',       c: '\u25B2 2.48%',  d: 1 },
    { n: 'MIDCAP',    v: '52,105',      c: '\u25BC 0.89%',  d: 0 },
    { n: 'VIX',       v: '15.22',       c: '\u25B2 8.40%',  d: 1 },
    { n: 'FII',       v: '-\u20B95,285Cr', c: 'SOLD',       d: 0 },
    { n: 'DII',       v: '+\u20B94,120Cr', c: 'BOUGHT',     d: 1 },
    { n: 'ADV:DEC',   v: '1211:2717',   c: 'WEAK',          d: 0 },
    { n: 'USD/INR',   v: '\u20B995.02', c: '\u25B2 0.12%',  d: 0 },
    { n: 'DXY',       v: '103.46',      c: '\u25B2 0.21%',  d: 1 },
    { n: 'US 10Y',    v: '5.10%',       c: '\u25B2 0.18%',  d: 0 },
    { n: 'BRENT',     v: '$108.20',     c: '\u25BC 1.51%',  d: 0 },
    { n: 'GOLD',      v: '\u20B974,850', c: '\u25B2 0.33%', d: 1 },
    { n: 'DJIA',      v: '52,002',      c: '\u25BC 0.34%',  d: 0 },
    { n: 'NASDAQ',    v: '26,140',      c: '\u25BC 2.14%',  d: 0 },
    { n: 'S&P 500',   v: '7,659',       c: '\u25BC 1.09%',  d: 0 },
    { n: 'DAX',       v: '23,596',      c: '\u25BC 0.57%',  d: 0 },
    { n: 'STOXX 50',  v: '4,895',       c: '\u25BC 0.66%',  d: 0 }
  ];
  /* ================================================
     END OF DAILY UPDATE SECTION
     ================================================ */

  var el = document.getElementById('tkT');
  var html = '';

  /* Build ticker twice for seamless infinite scroll */
  for (var r = 0; r < 3; r++) {
    for (var i = 0; i < data.length; i++) {
      var x = data[i];
      html += '<span class="ti">';
      html += '<span class="tn">' + x.n + '</span> ';
      html += '<span class="tv">' + x.v + '</span> ';
      html += '<span class="tc ' + (x.d ? 'u' : 'd') + '">' + x.c + '</span>';
      html += '</span>';
    }
  }

  el.innerHTML = html;
}

/* ----- INITIALIZE ON PAGE LOAD ----- */
window.onload = function () {
  buildTicker();
};