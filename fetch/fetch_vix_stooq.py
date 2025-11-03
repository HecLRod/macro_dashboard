import os, io, json
import pandas as pd
import requests

os.makedirs("data", exist_ok=True)

url = "https://stooq.com/q/d/l/?s=^vix&i=d"
r = requests.get(url, timeout=20)
r.raise_for_status()
text = r.text.strip()

# If Stooq is having a hiccup and returns HTML or empty, fail clearly
if not text or text.lstrip().startswith("<"):
    raise RuntimeError(f"Unexpected response from Stooq; first 120 chars: {text[:120]}")

# Try normal CSV with header; if that fails, try headerless fallback
try:
    df = pd.read_csv(io.StringIO(text))
    if "Date" not in df.columns:
        # sometimes Stooq omits headers; fall back to names
        df = pd.read_csv(
            io.StringIO(text),
            header=None,
            names=["Date", "Open", "High", "Low", "Close", "Volume"],
        )
except Exception:
    df = pd.read_csv(
        io.StringIO(text),
        header=None,
        names=["Date", "Open", "High", "Low", "Close", "Volume"],
    )

# Ensure we have Date and Close; coerce/clean
if "Date" not in df.columns:
    # last resort: assume first column is date
    first = df.columns[0]
    df = df.rename(columns={first: "Date"})
if "Close" not in df.columns:
    # assume last column is close
    df = df.rename(columns={df.columns[-1]: "Close"})

df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
df = df.dropna(subset=["Date"])

df = df.set_index("Date")[["Close"]].rename(columns={"Close": "VIX"})

# Save artifacts
df.to_json("data/VIX.json", orient="table", date_format="iso")
v = float(df["VIX"].iloc[-1])
with open("data/vix_snapshot.json", "w") as f:
    json.dump(
        {"value": v, "light": "red" if v >= 30 else ("yellow" if v >= 20 else "green")},
        f,
        indent=2,
    )
