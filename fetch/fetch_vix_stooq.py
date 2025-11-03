import os, io, json
import pandas as pd
import requests

os.makedirs("data", exist_ok=True)

def fetch_stooq():
    url = "https://stooq.com/q/d/l/?s=^vix&i=d"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    text = r.text.strip()
    if not text or text.lstrip().startswith("<"):
        return None
    # try headered, then headerless
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

def fetch_cboe():
    # Official CBOE VIX daily history (CSV)
    url = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv"
    r = requests.get(url, timeout=20)
    r.raise_for_status()
    text = r.text.strip()
    if not text or text.lstrip().startswith("<"):
        return None
    df = pd.read_csv(io.StringIO(text))
    # CBOE headers are typically: DATE, OPEN, HIGH, LOW, CLOSE
    for c in df.columns:
        if c.strip().lower() == "date":
            df.rename(columns={c: "Date"}, inplace=True)
        if c.strip().lower() == "close":
            df.rename(columns={c: "Close"}, inplace=True)
    if "Date" not in df.columns or "Close" not in df.columns:
        return None
    # CBOE date format is usually mm/dd/yyyy
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce", infer_datetime_format=True)
    df = df.dropna(subset=["Date"])
    if df.empty:
        return None
    return df.set_index("Date")[["Close"]].rename(columns={"Close": "VIX"})

# Try Stooq first (fast), then CBOE (authoritative)
df = fetch_stooq()
if df is None or df.empty:
    df = fetch_cboe()

if df is None or df.empty:
    raise RuntimeError("Unable to fetch VIX from Stooq or CBOE (empty dataframe).")

# Save artifacts
df.to_json("data/VIX.json", orient="table", date_format="iso")
v = float(df["VIX"].iloc[-1])
with open("data/vix_snapshot.json", "w") as f:
    json.dump(
        {"value": v, "light": "red" if v >= 30 else ("yellow" if v >= 20 else "green")},
        f,
        indent=2,
    )
