
"""
GANDHIS.CO — Automated Top Movers Fetcher (v3)
Primary: NSE India API (accurate, auto-updated constituents)
Fallback: Yahoo Finance (improved accuracy)
Writes top 3 gainers + 3 losers per index to Google Sheets
"""

import json
import os
import time
import requests
import gspread
from google.oauth2.service_account import Credentials

# ---- CONFIG ----
TOP_N = 3

# NSE API index names (exact names as NSE expects them)
NSE_INDICES = [
    "NIFTY 50",
    "NIFTY MIDCAP 100",
    "NIFTY SMLCAP 250",
    "NIFTY BANK",
    "NIFTY IT",
    "NIFTY PSU BANK",
    "NIFTY AUTO",
    "NIFTY METAL",
    "NIFTY PHARMA",
    "NIFTY FMCG",
    "NIFTY REALTY",
]

# Display names for your website (what data-loader.js expects)
DISPLAY_NAMES = {
    "NIFTY 50": "NIFTY 50",
    "NIFTY MIDCAP 100": "NIFTY MIDCAP",
    "NIFTY SMLCAP 250": "NIFTY SMALLCAP",
    "NIFTY BANK": "BANK NIFTY",
    "NIFTY IT": "NIFTY IT",
    "NIFTY PSU BANK": "PSU BANK",
    "NIFTY AUTO": "NIFTY AUTO",
    "NIFTY METAL": "NIFTY METAL",
    "NIFTY PHARMA": "NIFTY PHARMA",
    "NIFTY FMCG": "NIFTY FMCG",
    "NIFTY REALTY": "NIFTY REALTY",
}


# ---- NSE INDIA FETCHER (PRIMARY) ----

NSE_BASE = "https://www.nseindia.com"
NSE_API = "https://www.nseindia.com/api/equity-stockIndices?index="

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://www.nseindia.com/market-data/live-equity-market",
    "Connection": "keep-alive",
}


def get_nse_session():
    """Create a session with NSE cookies (required to bypass blocking)."""
    session = requests.Session()
    session.headers.update(NSE_HEADERS)
    try:
        # First hit the main page to get cookies
        r = session.get(NSE_BASE, timeout=15)
        r.raise_for_status()
        time.sleep(1)  # Be polite, wait 1 second
        return session
    except Exception as e:
        print(f"  NSE session failed: {e}")
        return None


def fetch_nse_index(session, index_name):
    """Fetch all constituents + prices for an index from NSE."""
    import urllib.parse
    encoded = urllib.parse.quote(index_name)
    url = f"{NSE_API}{encoded}"

    try:
        time.sleep(1.5)  # Rate limit: max ~1 request per 1.5 sec
        r = session.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()

        stocks = []
        for item in data.get("data", []):
            symbol = item.get("symbol", "")
            # Skip the index row itself (e.g., "Nifty 50" row)
            if symbol == index_name or not symbol:
                continue

            price = item.get("lastPrice", 0)
            change_pct = item.get("pChange", 0)

            if price and price > 0:
                stocks.append({
                    "symbol": symbol,
                    "price": round(float(price), 2),
                    "changepct": round(float(change_pct), 2),
                })

        return stocks

    except Exception as e:
        print(f"  NSE API failed for {index_name}: {e}")
        return None


def fetch_all_nse():
    """Fetch top movers for all indices from NSE."""
    print("Trying NSE India API (primary source)...")
    session = get_nse_session()
    if not session:
        print("  Could not establish NSE session")
        return None

    all_data = {}
    failures = 0

    for index_name in NSE_INDICES:
        display_name = DISPLAY_NAMES.get(index_name, index_name)
        stocks = fetch_nse_index(session, index_name)

        if stocks and len(stocks) >= TOP_N * 2:
            sorted_stocks = sorted(stocks, key=lambda x: x["changepct"], reverse=True)
            gainers = sorted_stocks[:TOP_N]
            losers = sorted_stocks[-TOP_N:][::-1]  # Worst first
            all_data[display_name] = (gainers, losers)

            g_names = ", ".join([g["symbol"] for g in gainers])
            l_names = ", ".join([l["symbol"] for l in losers])
            print(f"  ✅ {display_name}: {len(stocks)} stocks | Gainers [{g_names}] | Losers [{l_names}]")
        else:
            failures += 1
            print(f"  ❌ {display_name}: Failed or insufficient data")

    # If more than half failed, consider NSE blocked — return None to trigger fallback
    if failures > len(NSE_INDICES) // 2:
        print(f"  Too many failures ({failures}/{len(NSE_INDICES)}), NSE likely blocked")
        return None

    return all_data if all_data else None


# ---- YAHOO FINANCE FALLBACK (IMPROVED ACCURACY) ----
# Only used if NSE API is blocked/down
# Fix: Uses quote endpoint instead of chart meta for accurate closing prices

YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"

# Yahoo fallback needs hardcoded lists (unlike NSE which auto-updates)
# Update these quarterly when index constituents change
YAHOO_FALLBACK = {
    "NIFTY 50": [
        "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR",
        "ITC", "SBIN", "BHARTIARTL", "KOTAKBANK", "LT", "AXISBANK",
        "BAJFINANCE", "ASIANPAINT", "MARUTI", "HCLTECH", "SUNPHARMA",
        "TITAN", "ULTRACEMCO", "BAJAJFINSV", "WIPRO", "ONGC",
        "NTPC", "POWERGRID", "M&M", "TATAMOTORS", "ADANIENT",
        "ADANIPORTS", "JSWSTEEL", "TATASTEEL", "TECHM", "INDUSINDBK",
        "NESTLEIND", "GRASIM", "CIPLA", "DRREDDY", "BPCL",
        "DIVISLAB", "APOLLOHOSP", "EICHERMOT", "HEROMOTOCO",
        "COALINDIA", "BRITANNIA", "BAJAJ-AUTO", "TRENT",
        "ETERNAL", "BEL", "SHRIRAMFIN", "TATACONSUM", "HINDALCO"
    ],
    "NIFTY MIDCAP": [
        "POLYCAB", "PIIND", "MUTHOOTFIN", "PAGEIND", "VOLTAS",
        "ASTRAL", "CUMMINSIND", "COROMANDEL", "ESCORTS", "FEDERALBNK",
        "INDHOTEL", "JUBLFOOD", "LICHSGFIN", "OBEROIRLTY", "PETRONET",
        "TATACOMM", "TATAELXSI", "THERMAX", "TORNTPHARM", "DIXON"
    ],
    "NIFTY SMALLCAP": [
        "IIFL", "ROUTE", "KPITTECH", "CDSL", "ANGELONE",
        "BIKAJI", "CAMPUS", "CLEAN", "DATAPATTNS", "FIVESTAR",
        "HAPPSTMNDS", "KALYANKJIL", "KAYNES", "LICI", "MAPMYINDIA",
        "MEDANTA", "RAINBOW", "SYRMA", "TITAGARH", "ZOMATO"
    ],
    "BANK NIFTY": [
        "HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN",
        "INDUSINDBK", "BANKBARODA", "PNB", "FEDERALBNK", "IDFCFIRSTB",
        "AUBANK", "BANDHANBNK"
    ],
    "NIFTY IT": [
        "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM",
        "PERSISTENT", "COFORGE", "MPHASIS", "LTTS"
    ],
    "PSU BANK": [
        "SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK",
        "INDIANB", "IOB", "CENTRALBK", "MAHABANK", "BANKINDIA",
        "PSB", "UCOBANK"
    ],
    "NIFTY AUTO": [
        "TATAMOTORS", "M&M", "MARUTI", "BAJAJ-AUTO", "EICHERMOT",
        "HEROMOTOCO", "TVSMOTOR", "ASHOKLEY", "BALKRISIND", "BHARATFORG"
    ],
    "NIFTY METAL": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA",
        "NMDC", "SAIL", "NATIONALUM", "JINDALSTEL", "APLAPOLLO"
    ],
    "NIFTY PHARMA": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP",
        "LUPIN", "AUROPHARMA", "TORNTPHARM", "ZYDUSLIFE", "BIOCON"
    ],
    "NIFTY FMCG": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "TATACONSUM",
        "GODREJCP", "DABUR", "MARICO", "COLPAL", "VBL"
    ],
    "NIFTY REALTY": [
        "DLF", "GODREJPROP", "OBEROIRLTY", "PHOENIXLTD", "PRESTIGE",
        "BRIGADE", "SOBHA", "SUNTECK", "MAHLIFE", "LODHA"
    ],
}


def fetch_yahoo_batch(symbols):
    """Fetch prices for a batch of stocks using Yahoo quote endpoint."""
    # Convert to Yahoo format: SBIN → SBIN.NS
    yahoo_symbols = [s + ".NS" for s in symbols]
    joined = ",".join(yahoo_symbols)

    url = f"{YAHOO_QUOTE_URL}?symbols={joined}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()

        stocks = []
        for quote in data.get("quoteResponse", {}).get("result", []):
            symbol = quote.get("symbol", "").replace(".NS", "")
            price = quote.get("regularMarketPrice", 0)
            prev_close = quote.get("regularMarketPreviousClose", 0)

            if price and prev_close and prev_close > 0:
                changepct = round(((price - prev_close) / prev_close) * 100, 2)
                stocks.append({
                    "symbol": symbol,
                    "price": round(float(price), 2),
                    "changepct": changepct,
                })

        return stocks

    except Exception as e:
        print(f"  Yahoo batch failed: {e}")
        return []


def fetch_all_yahoo():
    """Fetch top movers for all indices from Yahoo Finance (fallback)."""
    print("Falling back to Yahoo Finance...")
    all_data = {}

    for display_name, symbols in YAHOO_FALLBACK.items():
        time.sleep(0.5)  # Be polite
        stocks = fetch_yahoo_batch(symbols)

        if stocks and len(stocks) >= TOP_N * 2:
            sorted_stocks = sorted(stocks, key=lambda x: x["changepct"], reverse=True)
            gainers = sorted_stocks[:TOP_N]
            losers = sorted_stocks[-TOP_N:][::-1]
            all_data[display_name] = (gainers, losers)

            g_names = ", ".join([g["symbol"] for g in gainers])
            l_names = ", ".join([l["symbol"] for l in losers])
            print(f"  ✅ {display_name}: Gainers [{g_names}] | Losers [{l_names}]")
        else:
            print(f"  ❌ {display_name}: Failed ({len(stocks)} stocks)")

    return all_data if all_data else None


# ---- GOOGLE SHEETS WRITER ----

def write_to_sheet(all_data):
    """Write all top movers data to Google Sheets."""
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDS")
    if not creds_json:
        print("ERROR: GOOGLE_SHEETS_CREDS not found")
        return False

    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ],
    )
    client = gspread.authorize(creds)

    sheet_url = os.environ.get("GOOGLE_SHEET_URL")
    if not sheet_url:
        print("ERROR: GOOGLE_SHEET_URL not found")
        return False

    spreadsheet = client.open_by_url(sheet_url)

    try:
        worksheet = spreadsheet.worksheet("topmovers")
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title="topmovers", rows=200, cols=5)

    # Build rows
    rows = [["index", "stock", "price", "changepct", "type"]]

    for index_name, movers in all_data.items():
        gainers, losers = movers
        for g in gainers:
            rows.append([index_name, g["symbol"], g["price"], g["changepct"], "gainer"])
        for l in losers:
            rows.append([index_name, l["symbol"], l["price"], l["changepct"], "loser"])

    # Only clear and write if we have real data (safety net)
    if len(rows) > 1:
        worksheet.clear()
        worksheet.update(range_name="A1", values=rows)
        print(f"SUCCESS: Wrote {len(rows) - 1} rows to 'topmovers' sheet")
        return True
    else:
        print("ERROR: No rows to write, keeping existing data")
        return False


# ---- MAIN ----

def main():
    print("=" * 50)
    print("GANDHIS.CO — Top Movers Fetcher v3")
    print("=" * 50)

    # LAYER 1: Try NSE India API (accurate, auto-updated constituents)
    all_data = fetch_all_nse()

    # LAYER 2: If NSE failed, fall back to Yahoo Finance
    if not all_data:
        print("\n" + "-" * 50)
        all_data = fetch_all_yahoo()

    # LAYER 3: Safety net — if both failed, don't touch the sheet
    if all_data:
        print("\n" + "-" * 50)
        print(f"Writing {len(all_data)} indices to Google Sheets...")
        write_to_sheet(all_data)
    else:
        print("\n❌ BOTH SOURCES FAILED — keeping existing sheet data untouched")
        print("The website will show yesterday's top movers (better than nothing)")

    print("\n" + "=" * 50)
    print("Done!")


if __name__ == "__main__":
    main()

