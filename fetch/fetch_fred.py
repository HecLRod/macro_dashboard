# fetch/fetch_fred.py
# Pulls macro series from FRED, computes yield-curve spreads,
# and writes JSON artifacts for the dashboard.

import os, json
from datetime import datetime, timedelta
import requests
import pandas as pd

# -------------------- Config --------------------
FRED_API_KEY = os.environ["FRED_API_KEY"]  # set in repo Settings → Secrets
BASE = "https://api.stlouisfed.org/fred/series/observations"

# Map: FRED series id -> short key used for filenames
SERIES = {
    "DGS10":        "UST_10Y",        # 10y Treasury
    "DGS2":         "UST_2Y",         # 2y Treasury
    "DGS3MO":       "UST_3M",         # 3m Treasury
    "DFII10":       "UST_10Y_TIPS",   # 10y TIPS (real yield)
    "BAMLH0A0HYM2": "HY_OAS",         # High Yield OAS
    "BAMLC0A0CM":   "IG_OAS",         # IG OAS
    "BAMLC0A4CBBB": "BBB_OAS",        # BBB OAS
    "VIXCLS":   "VIX"                 
}

END = datetime.utcnow().date()
START = END - timedelta(days=5*365)  # ~5 years

# -------------------- Helpers --------------------
def fred_series(series_id: str) -> pd.Series:
    """
    Return a pandas Series (float) indexed by datetime for the given FRED id.
    """
    r = requests.get(
        BASE,
        params={
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",
            "observation_start": START.isoformat(),
            "observation_end": END.isoformat(),
        },
        timeout=30,
    )
    r.raise_for_status()
    obs = r.json()["observations"]
    df = pd.DataFrame(obs)[["date", "value"]]
    df["date"] = pd.to_datetime(df["date"])
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    s = df.dropna(subset=["value"]).set_index("date")["value"]
    s.name = series_id
    return s

def last_float(x) -> float:
    """
    Robustly get the latest numeric value from Series/DataFrame/iterable/scalar.
    """
    try:
        if isinstance(x, pd.Series):
            ser = pd.to_numeric(x, errors="coerce").dropna()
            return float(ser.iloc[-1])
        if isinstance(x, pd.DataFrame):
            col = "value" if "value" in x.columns else x.columns[-1]
            ser = pd.to_numeric(x[col], errors="coerce").dropna()
            return float(ser.iloc[-1])
        if hasattr(x, "__iter__") and not isinstance(x, (str, bytes)):
            ser = pd.to_numeric(pd.Series(list(x)), errors="coerce").dropna()
            return float(ser.iloc[-1])
        return float(x)
    except Exception as e:
        raise RuntimeError(f"last_float: could not convert {type(x)} -> {e}")

# -------------------- Download all series --------------------
all_series: dict[str, pd.Series] = {}
for fred_id, short_key in SERIES.items():
    s = fred_series(fred_id)
    s.name = short_key
    all_series[short_key] = s

# Convenience aliases
ust_10y   = all_series["UST_10Y"]
ust_2y    = all_series["UST_2Y"]
ust_3m    = all_series["UST_3M"]
tips10y_s = all_series["UST_10Y_TIPS"]
hy_oas_s  = all_series["HY_OAS"]
ig_oas_s  = all_series["IG_OAS"]
bbb_oas_s = all_series["BBB_OAS"]

# -------------------- Compute spreads (time series) --------------------
yc_10s2s = (ust_10y - ust_2y).rename("YC_10s2s")
yc_10s3m = (ust_10y - ust_3m).rename("YC_10s3m")

# Latest point values (for pills)
ust10   = last_float(ust_10y)
ust2    = last_float(ust_2y)
ust3m   = last_float(ust_3m)
tips10y = last_float(tips10y_s)
hy_oas  = last_float(hy_oas_s)
ig_oas  = last_float(ig_oas_s)
bbb_oas = last_float(bbb_oas_s)
ten2s   = last_float(yc_10s2s)
ten3m   = last_float(yc_10s3m)

# -------------------- Traffic-light thresholds (standards) --------------------
def light_10s2s(x: float) -> str:
    # 10y - 2y: Green > +0.25, Yellow 0..+0.25, Red < 0
    return "green" if x > 0.25 else ("yellow" if x >= 0 else "red")

def light_10s3m(x: float) -> str:
    # 10y - 3m: Green > +0.50, Yellow 0..+0.50, Red < 0
    return "green" if x > 0.50 else ("yellow" if x >= 0 else "red")

def light_hy_oas(x: float) -> str:
    # HY OAS: Green < 4.0, Yellow 4.0..6.0, Red > 6.0
    return "green" if x < 4.0 else ("yellow" if x <= 6.0 else "red")

def light_ig_oas(x: float) -> str:
    # IG OAS: Green < 1.25, Yellow 1.25..2.0, Red > 2.0
    return "green" if x < 1.25 else ("yellow" if x <= 2.0 else "red")

def light_bbb_oas(x: float) -> str:
    # BBB OAS: Green < 1.5, Yellow 1.5..2.5, Red > 2.5
    return "green" if x < 1.5 else ("yellow" if x <= 2.5 else "red")

def light_tips10y(x: float) -> str:
    # 10Y TIPS real yield: Green 0..1.5, Yellow 1.5..2.0, Red >2.0 or <0
    if x < 0 or x > 2.0:
        return "red"
    return "green" if x <= 1.5 else "yellow"

# -------------------- Build snapshot & write artifacts --------------------
as_of = datetime.utcnow().strftime("%Y-%m-%d")

snap = {
    "10s2s":  {"value": round(ten2s, 2),  "light": light_10s2s(ten2s)},
    "10s3m":  {"value": round(ten3m, 2),  "light": light_10s3m(ten3m)},
    "HY_OAS": {"value": round(hy_oas, 2), "light": light_hy_oas(hy_oas)},
    "IG_OAS": {"value": round(ig_oas, 2), "light": light_ig_oas(ig_oas)},
    "BBB_OAS":{"value": round(bbb_oas,2), "light": light_bbb_oas(bbb_oas)},
    "TIPS10Y":{"value": round(tips10y,2), "light": light_tips10y(tips10y)},
}

summary = {"as_of": as_of, "snapshot": snap}

os.makedirs("data", exist_ok=True)

# Save individual series
for key, s in all_series.items():
    s.to_json(f"data/{key}.json", orient="table", date_format="iso")

# Save spreads time series
pd.concat([yc_10s2s, yc_10s3m], axis=1).to_json(
    "data/yield_curve.json", orient="table", date_format="iso"
)

# Save summary used by the pills
with open("data/summary.json", "w") as f:
    # ---- VIX time series from FRED (VIXCLS) ----
vix_df = fred_df("VIXCLS")
vix_df["value"] = pd.to_numeric(vix_df["value"], errors="coerce").dropna()

# Write VIX time series for the front-end chart
vix_ts = [
    {"t": idx.strftime("%Y-%m-%d"), "v": float(val)}
    for idx, val in zip(vix_df.index, vix_df["value"])
]
with open("data/VIX.json", "w") as f:
    json.dump(vix_ts, f)

# Determine color coding for VIX
def light_vix(x):
    # Green = calm, Yellow = moderate, Red = high volatility
    if x >= 25:
        return "red"
    elif x >= 15:
        return "yellow"
    else:
        return "green"

# Latest VIX value
vix_last = float(vix_df["value"].iloc[-1])
snap["VIX"] = {"value": round(vix_last, 2), "light": light_vix(vix_last)}

# Optional fallback snapshot file for dashboard.js
with open("data/vix_snapshot.json", "w") as f:
    json.dump({"value": round(vix_last, 2), "light": light_vix(vix_last)}, f)    json.dump(summary, f, indent=2)

print("Wrote data artifacts:", list(SERIES.values()) + ["yield_curve.json", "summary.json"])
