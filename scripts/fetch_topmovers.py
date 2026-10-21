
"""
GANDHIS.CO — Automated Top Movers Fetcher (v2)
Uses free Yahoo Finance API via yfinance (no NSE blocking)
Fetches top 3 gainers + 3 losers from 10 NSE indices
Writes to Google Sheets automatically
"""

import json
import os
import requests
import gspread
from google.oauth2.service_account import Credentials

# ---- CONFIG ----
# NSE index name → list of stock symbols (NSE tickers)
# We fetch each stock's daily change and sort to find top movers

INDICES = {
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
    "BANK NIFTY": [
        "HDFCBANK", "ICICIBANK", "KOTAKBANK", "AXISBANK", "SBIN",
        "INDUSINDBK", "BANKBARODA", "PNB", "FEDERALBNK", "IDFCFIRSTB",
        "AUBANK", "BANDHANBNK"
    ],
    "NIFTY IT": [
        "TCS", "INFY", "HCLTECH", "WIPRO", "TECHM", "LTIM",
        "PERSISTENT", "COFORGE", "MPHASIS", "LTTS"
    ],
    "NIFTY PHARMA": [
        "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "APOLLOHOSP",
        "LUPIN", "AUROPHARMA", "TORNTPHARM", "ZYDUSLIFE", "BIOCON",
        "ALKEM", "IPCALAB", "LAURUSLABS", "GLENMARK", "NATCOPHARMA",
        "GRANULES", "ABBOTINDIA", "SYNGENE", "GLAND", "LALPATHLAB"
    ],
    "NIFTY FMCG": [
        "HINDUNILVR", "ITC", "NESTLEIND", "BRITANNIA", "TATACONSUM",
        "GODREJCP", "DABUR", "MARICO", "COLPAL", "VBL",
        "UBL", "MCDOWELL-N", "EMAMILTD", "RADICO", "PGHH"
    ],
    "NIFTY AUTO": [
        "TATAMOTORS", "M&M", "MARUTI", "BAJAJ-AUTO", "EICHERMOT",
        "HEROMOTOCO", "TVSMOTOR", "ASHOKLEY", "BALKRISIND",
        "BHARATFORG", "BOSCHLTD", "MRF", "MOTHERSON", "EXIDEIND",
        "TIINDIA"
    ],
    "NIFTY METAL": [
        "TATASTEEL", "JSWSTEEL", "HINDALCO", "VEDL", "COALINDIA",
        "NMDC", "SAIL", "NATIONALUM", "JINDALSTEL", "APLAPOLLO",
        "RATNAMANI", "WELCORP", "MOIL", "HINDCOPPER", "JSWENERGY"
    ],
    "NIFTY REALTY": [
        "DLF", "GODREJPROP", "OBEROIRLTY", "PHOENIXLTD", "PRESTIGE",
        "BRIGADE", "SOBHA", "SUNTECK", "MAHLIFE", "LODHA"
    ],
    "NIFTY PSU BANK": [
        "SBIN", "BANKBARODA", "PNB", "CANBK", "UNIONBANK",
        "INDIANB", "IOB", "CENTRALBK", "MAHABANK", "BANKINDIA",
        "PSB", "UCOBANK"
    ],
    "NIFTY MIDCAP 50": [
        "POLYCAB", "PIIND", "MUTHOOTFIN", "PAGEIND", "VOLTAS",
        "ASTRAL", "CUMMINSIND", "AIAENG", "COROMANDEL", "ESCORTS",
        "FEDERALBNK", "GMRINFRA", "IDFCFIRSTB", "INDHOTEL", "JUBLFOOD",
        "LICHSGFIN", "MFSL", "NAM-INDIA", "NAVINFLUOR", "OBEROIRLTY",
        "OFSS", "PETRONET", "PVRINOX", "RAMCOCEM", "SOLARINDS",
        "SUNDARMFIN", "SYNGENE", "TATACOMM", "TATAELXSI", "THERMAX",
        "TORNTPHARM", "UPL", "ZEEL", "CONCOR", "CROMPTON",
        "DEEPAKNTR", "DIXON", "ENDURANCE", "FORTIS", "GLAXO",
        "GODREJPROP", "HONAUT", "IRCTC", "KPITTECH", "L&TFH",
        "LALPATHLAB", "LINDEINDIA", "METROPOLIS", "MPHASIS", "PERSISTENT"
    ],
}

# Free Yahoo Finance API (no key needed, works from cloud)
YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart/"

TOP_N = 3


def fetch_stock_data(symbol):
    """Fetch current price and % change for a single stock via Yahoo Finance."""
    yahoo_symbol = symbol + ".NS"  # NSE suffix for Yahoo
    url = f"{YAHOO_BASE}{yahoo_symbol}?interval=1d&range=2d"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        result = data["chart"]["result"][0]
        meta = result["meta"]
        current = meta.get("regularMarketPrice", 0)
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
    except Exception as e:
        return None


def fetch_index_stocks(index_name, symbols):
    """Fetch data for all stocks in an index."""
    print(f"Fetching: {index_name} ({len(symbols)} stocks)...")
    stocks = []
    for sym in symbols:
        data = fetch_stock_data(sym)
        if data:
            stocks.append(data)
    print(f"  Got data for {len(stocks)}/{len(symbols)} stocks")
    return stocks


def get_top_movers(stocks):
    """Get top N gainers and losers."""
    sorted_stocks = sorted(stocks, key=lambda x: x["changepct"], reverse=True)
    gainers = sorted_stocks[:TOP_N]
    losers = sorted_stocks[-TOP_N:][::-1]
    return gainers, losers


def write_to_sheet(all_data):
    """Write all top movers data to Google Sheets."""
    creds_json = os.environ.get("GOOGLE_SHEETS_CREDS")
    if not creds_json:
        print("ERROR: GOOGLE_SHEETS_CREDS not found")
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

    sheet_url = os.environ.get("GOOGLE_SHEET_URL")
    if not sheet_url:
        print("ERROR: GOOGLE_SHEET_URL not found")
        return

    spreadsheet = client.open_by_url(sheet_url)

    try:
        worksheet = spreadsheet.worksheet("topmovers")
    except gspread.exceptions.WorksheetNotFound:
        worksheet = spreadsheet.add_worksheet(title="topmovers", rows=100, cols=5)

    worksheet.clear()

    rows = [["index", "stock", "price", "changepct", "type"]]

    for index_name, movers in all_data.items():
        gainers, losers = movers
        for g in gainers:
            rows.append([index_name, g["symbol"], g["price"], g["changepct"], "gainer"])
        for l in losers:
            rows.append([index_name, l["symbol"], l["price"], l["changepct"], "loser"])

    worksheet.update(range_name="A1", values=rows)
    print(f"SUCCESS: Wrote {len(rows) - 1} rows to 'topmovers' sheet")


def main():
    print("Gandhis: Starting Top Movers fetch (Yahoo Finance)...")

    all_data = {}
    for index_name, symbols in INDICES.items():
        stocks = fetch_index_stocks(index_name, symbols)
        if stocks:
            gainers, losers = get_top_movers(stocks)
            all_data[index_name] = (gainers, losers)
            g_names = ", ".join([g["symbol"] for g in gainers])
            l_names = ", ".join([l["symbol"] for l in losers])
            print(f"  ✅ {index_name}: Gainers [{g_names}] | Losers [{l_names}]")
        else:
            print(f"  ❌ {index_name}: No data")

    if all_data:
        write_to_sheet(all_data)
    else:
        print("ERROR: No data fetched from any index")


if __name__ == "__main__":
    main()

