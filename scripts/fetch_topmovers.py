
"""
GANDHIS.CO — Automated Top Movers Fetcher
Fetches top 3 gainers + 3 losers from 10 NSE indices
Writes to Google Sheets automatically
Runs via GitHub Actions every trading day at 4:30 PM IST
"""

import json
import os
import requests
import gspread
from google.oauth2.service_account import Credentials

# ---- CONFIG ----
INDICES = {
    "NIFTY 50": "NIFTY 50",
    "BANK NIFTY": "NIFTY BANK",
    "NIFTY IT": "NIFTY IT",
    "NIFTY PHARMA": "NIFTY PHARMA",
    "NIFTY FMCG": "NIFTY FMCG",
    "NIFTY AUTO": "NIFTY AUTO",
    "NIFTY METAL": "NIFTY METAL",
    "NIFTY REALTY": "NIFTY REALTY",
    "NIFTY PSU BANK": "NIFTY PSU BANK",
    "NIFTY MIDCAP 50": "NIFTY MIDCAP 50",
}

NSE_BASE = "https://www.nseindia.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}

TOP_N = 3  # top 3 gainers + 3 losers


def get_nse_session():
    """Create a session with NSE cookies."""
    session = requests.Session()
    session.headers.update(HEADERS)
    # Hit the homepage first to get cookies
    session.get(NSE_BASE, timeout=10)
    return session


def fetch_index_stocks(session, index_name):
    """Fetch all stocks in an index with their % change."""
    url = f"{NSE_BASE}/api/equity-stockIndices?index={index_name}"
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        stocks = []
        for item in data.get("data", []):
            symbol = item.get("symbol", "")
            # Skip the index row itself
            if symbol == index_name or symbol == "":
                continue
            stocks.append({
                "symbol": symbol,
                "price": round(item.get("lastPrice", 0), 2),
                "changepct": round(item.get("pChange", 0), 2),
            })
        return stocks
    except Exception as e:
        print(f"Error fetching {index_name}: {e}")
        return []


def get_top_movers(stocks):
    """Get top N gainers and losers from a list of stocks."""
    sorted_stocks = sorted(stocks, key=lambda x: x["changepct"], reverse=True)
    gainers = sorted_stocks[:TOP_N]
    losers = sorted_stocks[-TOP_N:][::-1]  # worst first
    return gainers, losers


def write_to_sheet(all_data):
    """Write all top movers data to Google Sheets."""
    # Load credentials from GitHub Secret
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDS")
    if not creds_json:
        print("ERROR: GOOGLE_SHEETS_CREDS not found in environment")
        return

    creds_dict = json.loads(creds_json)
    creds = Credentials.from_service_account_info(
        creds_dict,
        scopes=[
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ],
    )
    client = gspread.authorize(creds)

    # Open your existing sheet by URL
    sheet_url = os.environ.get("GOOGLE_SHEET_URL")
    if not sheet_url:
        print("ERROR: GOOGLE_SHEET_URL not found in environment")
        return

    spreadsheet = client.open_by_url(sheet_url)

    # Get or create the 'topmovers' tab
    try:
        worksheet = spreadsheet.worksheet("topmovers")
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title="topmovers", rows=100, cols=5)

    # Clear old data
    worksheet.clear()

    # Write headers
    rows = [["index", "stock", "price", "changepct", "type"]]

    # Write data
    for index_name, movers in all_data.items():
        gainers, losers = movers
        for g in gainers:
            rows.append([index_name, g["symbol"], g["price"], g["changepct"], "gainer"])
        for l in losers:
            rows.append([index_name, l["symbol"], l["price"], l["changepct"], "loser"])

    worksheet.update(range_name="A1", values=rows)
    print(f"SUCCESS: Wrote {len(rows) - 1} rows to 'topmovers' sheet")


def main():
    print("Gandhis: Starting Top Movers fetch...")
    session = get_nse_session()

    all_data = {}
    for display_name, nse_name in INDICES.items():
        print(f"Fetching: {display_name}...")
        stocks = fetch_index_stocks(session, nse_name)
        if stocks:
            gainers, losers = get_top_movers(stocks)
            all_data[display_name] = (gainers, losers)
            print(f"  ✅ {display_name}: {len(stocks)} stocks, top movers found")
        else:
            print(f"  ❌ {display_name}: No data")

    if all_data:
        write_to_sheet(all_data)
    else:
        print("ERROR: No data fetched from any index")


if __name__ == "__main__":
    main()


