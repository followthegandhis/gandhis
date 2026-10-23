
"""
GANDHIS.CO — Automated Top Movers Fetcher (v5)
Primary: NSE India API (accurate, auto-updated constituents)
Fallback: Yahoo Finance (improved accuracy)
Writes top 3 gainers + 3 losers per index to Google Sheets
Includes: advances, declines, total per index
Auto-updates: Crude Oil + USD/INR in Indices tab
"""

import json
import os
import time
import requests
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime


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
        r = session.get(NSE_BASE, timeout=15)
        r.raise_for_status()
        time.sleep(1)
        return session
    except Exception as e:
        print(f"  NSE session failed: {e}")
        return None


def fetch_nse_index(session, index_name):
    """Fetch all constituents + prices for an index from NSE.
    Returns: (stocks_list, advances, declines, total) or (None, 0, 0, 0)
    """
    import urllib.parse
    encoded = urllib.parse.quote(index_name)
    url = f"{NSE_API}{encoded}"

    try:
        time.sleep(1.5)
        r = session.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()

        stocks = []
        advances = 0
        declines = 0

        for item in data.get("data", []):
            symbol = item.get("symbol", "")
            if symbol == index_name or not symbol:
                continue

            price = item.get("lastPrice", 0)
            change_pct = item.get("pChange", 0)

            if price and price > 0:
                change_val = float(change_pct)
                stocks.append({
                    "symbol": symbol,
                    "price": round(float(price), 2),
                    "changepct": round(change_val, 2),
                })
                if change_val >= 0:
                    advances += 1
                else:
                    declines += 1

        total = advances + declines
        return stocks, advances, declines, total

    except Exception as e:
        print(f"  NSE API failed for {index_name}: {e}")
        return None, 0, 0, 0


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
        stocks, advances, declines, total = fetch_nse_index(session, index_name)

        if stocks and len(stocks) >= TOP_N * 2:
            sorted_stocks = sorted(stocks, key=lambda x: x["changepct"], reverse=True)
            gainers = sorted_stocks[:TOP_N]
            losers = sorted_stocks[-TOP_N:][::-1]
            all_data[display_name] = (gainers, losers, advances, declines, total)

            g_names = ", ".join([g["symbol"] for g in gainers])
            l_names = ", ".join([l["symbol"] for l in losers])
            print(f"  ✅ {display_name}: {total} stocks (▲{advances} ▼{declines}) | Gainers [{g_names}] | Losers [{l_names}]")
        else:
            failures += 1
            print(f"  ❌ {display_name}: Failed or insufficient data")

    if failures > len(NSE_INDICES) // 2:
        print(f"  Too many failures ({failures}/{len(NSE_INDICES)}), NSE likely blocked")
        return None

    return all_data if all_data else None

# ---- YAHOO FINANCE FALLBACK ----

YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/"

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


def fetch_stock_yahoo(symbol):
    """Fetch a single stock's close price and % change via Yahoo v8 chart."""
    yahoo_symbol = symbol + ".NS"
    url = f"{YAHOO_CHART_URL}{yahoo_symbol}?interval=1d&range=5d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"][0]

        closes = result["indicators"]["quote"][0]["close"]
        valid_closes = [c for c in closes if c is not None]

        if len(valid_closes) >= 2:
            current = valid_closes[-1]
            previous = valid_closes[-2]
            changepct = round(((current - previous) / previous) * 100, 2)
            return {
                "symbol": symbol,
                "price": round(current, 2),
                "changepct": changepct,
            }
        elif len(valid_closes) == 1:
            meta = result["meta"]
            current = valid_closes[0]
            previous = meta.get("chartPreviousClose", 0)
            if previous and previous > 0:
                changepct = round(((current - previous) / previous) * 100, 2)
            else:
                changepct = 0
            return {
                "symbol": symbol,
                "price": round(current, 2),
                "changepct": changepct,
            }

    except Exception:
        pass

    return None


def fetch_all_yahoo():
    """Fetch top movers for all indices from Yahoo Finance (fallback)."""
    print("Falling back to Yahoo Finance (v8 chart)...")
    all_data = {}

    for display_name, symbols in YAHOO_FALLBACK.items():
        print(f"  Fetching: {display_name} ({len(symbols)} stocks)...")
        stocks = []

        for sym in symbols:
            time.sleep(0.3)
            data = fetch_stock_yahoo(sym)
            if data:
                stocks.append(data)

        print(f"    Got data for {len(stocks)}/{len(symbols)} stocks")

        if stocks and len(stocks) >= TOP_N * 2:
            advances = sum(1 for s in stocks if s["changepct"] >= 0)
            declines = sum(1 for s in stocks if s["changepct"] < 0)
            total = advances + declines

            sorted_stocks = sorted(stocks, key=lambda x: x["changepct"], reverse=True)
            gainers = sorted_stocks[:TOP_N]
            losers = sorted_stocks[-TOP_N:][::-1]
            all_data[display_name] = (gainers, losers, advances, declines, total)

            g_names = ", ".join([g["symbol"] for g in gainers])
            l_names = ", ".join([l["symbol"] for l in losers])
            print(f"    ✅ {total} stocks (▲{advances} ▼{declines}) | Gainers [{g_names}] | Losers [{l_names}]")
        else:
            print(f"    ❌ Failed ({len(stocks)} stocks)")

    return all_data if all_data else None


# ---- CRUDE OIL + USD/INR FETCHER (for Indices tab) ----

def fetch_crude_oil():
    """Fetch Brent Crude Oil price and % change from Yahoo Finance."""
    url = f"{YAHOO_CHART_URL}BZ%3DF?interval=1d&range=5d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"][0]

        closes = result["indicators"]["quote"][0]["close"]
        valid_closes = [c for c in closes if c is not None]

        if len(valid_closes) >= 2:
            current = valid_closes[-1]
            previous = valid_closes[-2]
            changepct = round(((current - previous) / previous) * 100, 2)
            print(f"  ✅ Crude Oil (Brent): ${round(current, 2)} ({changepct:+.2f}%)")
            return round(current, 2), changepct
        elif len(valid_closes) == 1:
            meta = result["meta"]
            current = valid_closes[0]
            previous = meta.get("chartPreviousClose", 0)
            if previous and previous > 0:
                changepct = round(((current - previous) / previous) * 100, 2)
            else:
                changepct = 0
            print(f"  ✅ Crude Oil (Brent): ${round(current, 2)} ({changepct:+.2f}%)")
            return round(current, 2), changepct

    except Exception as e:
        print(f"  ❌ Crude Oil fetch failed: {e}")

    return None, None


def fetch_usdinr_change():
    """Fetch USD/INR % change from Yahoo Finance."""
    url = f"{YAHOO_CHART_URL}INR%3DX?interval=1d&range=5d"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"][0]

        closes = result["indicators"]["quote"][0]["close"]
        valid_closes = [c for c in closes if c is not None]

        if len(valid_closes) >= 2:
            current = valid_closes[-1]
            previous = valid_closes[-2]
            changepct = round(((current - previous) / previous) * 100, 2)
            print(f"  ✅ USD/INR: {round(current, 2)} ({changepct:+.2f}%)")
            return changepct

    except Exception as e:
        print(f"  ❌ USD/INR fetch failed: {e}")

    return None


def update_indices_tab(spreadsheet):
    """Update Crude Oil and USD/INR in the Indices tab.
    CRITICAL: Uses cell-level updates to preserve GOOGLEFINANCE formulas.
    """
    print("\nUpdating Indices tab (Crude Oil + USD/INR)...")

    try:
        ws = spreadsheet.worksheet("Indices")
    except Exception as e:
        print(f"  ❌ Could not open Indices tab: {e}")
        return

    all_values = ws.get_all_values()

    crude_row = None
    usdinr_row = None

    for i, row in enumerate(all_values):
        if len(row) >= 2:
            if row[0].strip().upper() in ("CRUDEOIL", "INDEXNSE:CRUDEOIL", "CRUDE OIL") or row[1].strip().upper() == "CRUDE OIL":
                crude_row = i + 1
            if row[0].strip().upper() in ("USDINR", "CURRENCY:USDINR", "USD/INR") or row[1].strip().upper() == "USD/INR":
                usdinr_row = i + 1

    crude_price, crude_change = fetch_crude_oil()
    if crude_row and crude_price is not None:
        ws.update_acell(f"C{crude_row}", crude_price)
        ws.update_acell(f"D{crude_row}", crude_change)
        print(f"  ✅ Crude Oil updated in row {crude_row}: ${crude_price} ({crude_change:+.2f}%)")
    elif crude_row:
        print(f"  ⚠️ Crude Oil row found ({crude_row}) but fetch failed — keeping existing values")
    else:
        print("  ⚠️ Crude Oil row not found in Indices tab")

    usdinr_change = fetch_usdinr_change()
    if usdinr_row and usdinr_change is not None:
        ws.update_acell(f"D{usdinr_row}", usdinr_change)
        print(f"  ✅ USD/INR changepct updated in row {usdinr_row}: {usdinr_change:+.2f}%")
    elif usdinr_row:
        print(f"  ⚠️ USD/INR row found ({usdinr_row}) but fetch failed — keeping existing value")
    else:
        print("  ⚠️ USD/INR row not found in Indices tab")

# ---- GOOGLE SHEETS WRITER ----

def write_to_sheet(all_data):
    """Write all top movers data to Google Sheets.
    Returns the spreadsheet object for reuse by update_indices_tab.
    """
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDS")
    if not creds_json:
        print("ERROR: GOOGLE_SHEETS_CREDS not found")
        return None

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
        return None

    spreadsheet = client.open_by_url(sheet_url)

    try:
        worksheet = spreadsheet.worksheet("topmovers")
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title="topmovers", rows=200, cols=8)

    rows = [["index", "stock", "price", "changepct", "type", "advances", "declines", "total"]]

    for index_name, movers in all_data.items():
        gainers, losers, advances, declines, total = movers
        for g in gainers:
            rows.append([index_name, g["symbol"], g["price"], g["changepct"], "gainer", advances, declines, total])
        for l in losers:
            rows.append([index_name, l["symbol"], l["price"], l["changepct"], "loser", advances, declines, total])

     if len(rows) > 1:
        worksheet.clear()
        # Row 1: today's date for the website to read
        from datetime import datetime
        date_row = [[datetime.now().strftime('%d %B %Y · %A').upper()]]
        worksheet.update(range_name="A1", values=date_row)
        # Row 2 onwards: header + data
        worksheet.update(range_name="A2", values=rows)
        print(f"SUCCESS: Wrote {len(rows) - 1} rows to 'topmovers' sheet (with breadth data)")
    else:
        print("ERROR: No rows to write, keeping existing data")

    return spreadsheet


# ---- MAIN ----

def main():
    print("=" * 50)
    print("GANDHIS.CO — Top Movers Fetcher v5")
    print("Now with auto Crude Oil + USD/INR updates!")
    print("=" * 50)

    # LAYER 1: Try NSE India API
    all_data = fetch_all_nse()

    # LAYER 2: If NSE failed, fall back to Yahoo Finance
    if not all_data:
        print("\n" + "-" * 50)
        all_data = fetch_all_yahoo()

    # LAYER 3: Write top movers to Google Sheets
    spreadsheet = None
    if all_data:
        print("\n" + "-" * 50)
        print(f"Writing {len(all_data)} indices to Google Sheets...")
        spreadsheet = write_to_sheet(all_data)
    else:
        print("\n❌ BOTH SOURCES FAILED — keeping existing sheet data untouched")

    # LAYER 4: Update Crude Oil + USD/INR in Indices tab
    # Runs even if top movers failed — these are independent
    if spreadsheet:
        update_indices_tab(spreadsheet)
    else:
        print("\nConnecting to Google Sheets for Indices tab update...")
        try:
            creds_json = os.environ.get("GOOGLE_SHEETS_CREDS")
            sheet_url = os.environ.get("GOOGLE_SHEET_URL")
            if creds_json and sheet_url:
                creds_dict = json.loads(creds_json)
                creds = Credentials.from_service_account_info(
                    creds_dict,
                    scopes=[
                        "https://www.googleapis.com/auth/spreadsheets",
                        "https://www.googleapis.com/auth/drive",
                    ],
                )
                client = gspread.authorize(creds)
                spreadsheet = client.open_by_url(sheet_url)
                update_indices_tab(spreadsheet)
        except Exception as e:
            print(f"  ❌ Could not connect for Indices update: {e}")

    print("\n" + "=" * 50)
    print("Done!")


if __name__ == "__main__":
    main()

