
/* ===== GANDHIS.CO — App Engine v2 ===== */

/* ----- TAB SWITCHING ----- */
function go(t) {
  var pages = ['brief', 'movers', 'week', 'archive', 'about'];
  for (var i = 0; i < pages.length; i++) {
    var pg = document.getElementById('pg-' + pages[i]);
    if (pg) pg.style.display = 'none';
    var btn = document.querySelector('[data-t="' + pages[i] + '"]');
    if (btn) {
      btn.style.color = '#777';
      btn.style.borderBottomColor = 'transparent';
    }
  }
  var activePg = document.getElementById('pg-' + t);
  if (activePg) activePg.style.display = 'block';
  var activeBtn = document.querySelector('[data-t="' + t + '"]');
  if (activeBtn) {
    activeBtn.style.color = '#007A3F';
    activeBtn.style.borderBottomColor = '#007A3F';
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ----- LANGUAGE TOGGLE ----- */
function setLang(lang) {
  var btnEn = document.getElementById('btnEn');
  var btnHi = document.getElementById('btnHi');

  if (btnEn) {
    btnEn.style.background = lang === 'en' ? '#007A3F' : 'transparent';
    btnEn.style.color = lang === 'en' ? '#fff' : '#777';
    btnEn.style.borderColor = lang === 'en' ? '#007A3F' : '#ddd';
  }
  if (btnHi) {
    btnHi.style.background = lang === 'hi' ? '#007A3F' : 'transparent';
    btnHi.style.color = lang === 'hi' ? '#fff' : '#777';
    btnHi.style.borderColor = lang === 'hi' ? '#007A3F' : '#ddd';
  }

  /* Swap text using translations.js */
  if (typeof T !== 'undefined') {
    var els = document.querySelectorAll('[data-k]');
    for (var i = 0; i < els.length; i++) {
      var key = els[i].getAttribute('data-k');
      if (T[key] && T[key][lang]) {
        els[i].innerHTML = T[key][lang];
      }
    }
  }
}

/* ----- TICKER BUILDER (fallback if data-loader fails) ----- */
function buildTicker() {
  var data = [
    { n: 'SENSEX',     v: '73,710',     c: '▼ 0.19%',  d: 0 },
    { n: 'NIFTY 50',   v: '22,811',     c: '▼ 0.34%',  d: 0 },
    { n: 'BANK NIFTY', v: '54,977',     c: '▼ 0.92%',  d: 0 },
    { n: 'NIFTY IT',   v: '32,423',     c: '▲ 2.88%',  d: 1 },
    { n: 'PSU BANK',   v: '6,672',      c: '▼ 0.45%',  d: 0 },
    { n: 'MIDCAP',     v: '51,284',     c: '▼ 1.58%',  d: 0 },
    { n: 'VIX',        v: '15.70',      c: '▲ 6.29%',  d: 1 },
    { n: 'FII',        v: '-₹413Cr',    c: 'SOLD',      d: 0 },
    { n: 'DII',        v: '+₹3,201Cr',  c: 'BOUGHT',    d: 1 },
    { n: 'ADV:DEC',    v: '962:3476',   c: 'WEAK',      d: 0 },
    { n: 'USD/INR',    v: '₹95.02',     c: '▲ 0.12%',  d: 0 },
    { n: 'DXY',        v: '103.46',     c: '▲ 0.21%',  d: 1 },
    { n: 'US 10Y',     v: '5.10%',      c: '▲ 0.18%',  d: 0 },
    { n: 'BRENT',      v: '$110.80',    c: '▲ 1.85%',  d: 0 },
    { n: 'GOLD',       v: '₹75,120',    c: '▼ 0.10%',  d: 0 },
    { n: 'DJIA',       v: '52,180',     c: '▲ 0.34%',  d: 1 },
    { n: 'NASDAQ',     v: '26,580',     c: '▲ 1.68%',  d: 1 },
    { n: 'S&P 500',    v: '7,742',      c: '▲ 1.08%',  d: 1 },
    { n: 'DAX',        v: '23,730',     c: '▲ 0.57%',  d: 1 },
    { n: 'STOXX 50',   v: '4,928',      c: '▲ 0.67%',  d: 1 }
  ];

  var el = document.getElementById('tkT');
  if (!el) return;
  var html = '';

  /* Build 3 copies for infinite scroll */
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

/* ----- PAGE LOAD ----- */
window.onload = function () {
  buildTicker();
  go('brief');
  setLang('en');
};

