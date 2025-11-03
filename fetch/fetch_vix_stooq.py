import os, io, json, time
from datetime import datetime, timedelta
import pandas as pd
import requests

os.makedirs("data", exist_ok=True)

def fetch_stooq():
    url = "https://stooq.com/q/d/l/?s=^vix&i=d"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    text = r.text.strip()
    # Bail if it's HTML or empty
    if not text or text.lstrip().startswith("<"):
        return None
    # Try with header; if missing, provide names
    try:
        df = pd.read_csv(io.StringIO(text))
        if "Date" not in df.columns or "Close" not in df.columns:
            df = pd.read_csv(
                io.StringIO(text),
                header=None,
                names=["Date", "Open", "High", "Low", "Close", "Volume"],
            )
    except Exception:
        return None
    if "Date" not in df.columns or "Close" not in df.columns:
        return None
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    if df.empty:
        return None
    return df.set_index("Date")[["Close"]].rename(columns={"Close": "VIX"})

def fetch_yahoo():
    # Full-range VIX from Yahoo; fallback if Stooq is empty
    # period1=0 (Unix epoch) to now
    period1 = 0
    period2 = int(time.time())
    url = (
        "https://query1.finance.yahoo.com/v7/finance/download/%5EVIX"
        f"?period1={period1}&period2={period2}&interval=1d&events=history&includeAdjustedClose=true"
    )
    r = requests.get(url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    text = r.text.strip()
    if not text or text.lstrip().startswith("<"):
        return None
    try:
        df = pd.read_csv(io.StringIO(text))
    except Exception:
        return None
    if "Date" not in df.columns or "Close" not in df.columns:
        return None
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    df = df.dropna(subset=["Date"])
    if df.empty:
        return None
    return df.set_index("Date")[["Close"]].rename(columns={"Close": "VIX"})

# Try Stooq first, then Yahoo
df = fetch_stooq()
if df is None or df.empty:
    df = fetch_yahoo()

if df is None or df.empty:
    raise RuntimeError("Unable to fetch VIX from Stooq or Yahoo (empty dataframe).")

# Save artifacts
df.to_json("data/VIX.json", orient="table", date_format="iso")
v = float(df["VIX"].iloc[-1])
with open("data/vix_snapshot.json", "w") as f:
    json.dump(
        {"value": v, "light": "red" if v >= 30 else ("yellow" if v >= 20 else "green")},
        f,
        indent=2,
    )
