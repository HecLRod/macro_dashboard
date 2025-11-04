# fetch_fred.py  — full, self-contained script

import os, json
from datetime import datetime, timedelta
from pathlib import Path

import requests
import pandas as pd

# ---------- Config ----------
FRED_API_KEY = os.environ["FRED_API_KEY"]  # set in GitHub → Settings → Secrets
BASE = "https://api.stlouisfed.org/fred/series/observations"

# FRED series we use
SERIES = {
    "DGS10":   "UST_10Y",      # 10-year Treasury yield (%)
    "DGS2":    "UST_2Y",       # 2-year Treasury yield (%)
    "DGS3MO":  "UST_3M",       # 3-month Treasury yield (%)
    "DFII10":  "TIPS10Y",      # 10-year TIPS (real yield, %)
    "BAMLH0A0HYM2": "HY_OAS",  # HY OAS (%, spread)
    "BAMLC0A0CM":   "IG_OAS",  # IG OAS (%, spread)
    "BAMLC0A4CBBB": "BBB_OAS", # BBB OAS (%, spread)
}

# VIX from FRED
VIX_SERIES_ID = "VIXCLS"

# Date window
END = datetime.utcnow().date()
START = END - timedelta(days=5 * 365)  # last ~5 years

DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)


# ---------- Helpers ----------
def fred_df(series_id: str) -> pd.DataFrame:
    """Download one FRED series as a DataFrame indexed by date with a numeric 'value' column."""
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
    df = pd.DataFrame(obs)
    df["date"] = pd.to_datetime(df["date"])
    df.set_index("date", inplace=True)
    # Coerce to numeric; keep NaNs for now (we'll drop them when we need latest)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    return df


def last_float(s: pd.Series | pd.DataFrame | list | tuple | float | int | str) -> float:
    """Return the latest non-NaN numeric value from various inputs."""
    if isinstance(s, pd.DataFrame):
        s = s["value"] if "value" in s.columns else s.iloc[:, -1]
    if isinstance(s, pd.Series):
        s = pd.to_numeric(s, errors="coerce").dropna()
        return float(s.iloc[-1])
    if isinstance(s, (list, tuple)):
        s = pd.to_numeric(pd.Series(s), errors="coerce").dropna()
        return float(s.iloc[-1])
    return float(pd.to_numeric(pd.Series([s]), errors="coerce").dropna().iloc[-1])


# Traffic-light rules (economist/market standards you chose)
def light_10s2s(x: float) -> str:
    # Green > +0.25, Yellow 0..+0.25, Red < 0
    return "green" if x > 0.25 else ("yellow" if x >= 0.0 else "red")


def light_10s3m(x: float) -> str:
    # Green > +0.50, Yellow 0..+0.50, Red < 0
    return "green" if x > 0.50 else ("yellow" if x >= 0.0 else "red")


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


def light_vix(x: float) -> str:
    # VIX: Green <15, Yellow 15..24.99, Red >=25
    return "red" if x >= 25 else ("yellow" if x >= 15 else "green")


# ---------- Download all core series ----------
frames = {}
for sid, name in SERIES.items():
    df = fred_df(sid)
    frames[name] = df
    # also persist each raw series for debugging/optionally other charts
    DATA_DIR.joinpath(f"{name}.json").write_text(
        json.dumps(
            [{"t": d.strftime("%Y-%m-%d"), "v": float(v)} for d, v in df["value"].dropna().items()]
        )
    )

# Compose yield-curve spreads (percentage points)
ust_10y = frames["UST_10Y"]["value"]
ust_2y = frames["UST_2Y"]["value"]
ust_3m = frames["UST_3M"]["value"]

yc_10s2s = (ust_10y - ust_2y).dropna()
yc_10s3m = (ust_10y - ust_3m).dropna()

# Save combined yield curve file used by the front-end
yield_curve = {
    "10s-2s": [{"t": d.strftime("%Y-%m-%d"), "v": float(v)} for d, v in yc_10s2s.items()],
    "10s-3m": [{"t": d.strftime("%Y-%m-%d"), "v": float(v)} for d, v in yc_10s3m.items()],
}
DATA_DIR.joinpath("yield_curve.json").write_text(json.dumps(yield_curve))

# ---------- VIX from FRED ----------
vix_df = fred_df(VIX_SERIES_ID)
vix_series_clean = vix_df["value"].dropna()

vix_ts = [{"t": d.strftime("%Y-%m-%d"), "v": float(v)} for d, v in vix_series_clean.items()]
DATA_DIR.joinpath("VIX.json").write_text(json.dumps(vix_ts))

vix_last = last_float(vix_series_clean)
DATA_DIR.joinpath("vix_snapshot.json").write_text(
    json.dumps({"value": round(vix_last, 2), "light": light_vix(vix_last)})
)

# ---------- Traffic-light snapshot for header pills ----------
ten2s_last = last_float(yc_10s2s)
ten3m_last = last_float(yc_10s3m)
tips10y_last = last_float(frames["TIPS10Y"]["value"])
hy_oas_last = last_float(frames["HY_OAS"]["value"])
ig_oas_last = last_float(frames["IG_OAS"]["value"])
bbb_oas_last = last_float(frames["BBB_OAS"]["value"])

snap = {
    "10s-2s":   {"value": round(ten2s_last, 2),   "light": light_10s2s(ten2s_last)},
    "10s-3m":   {"value": round(ten3m_last, 2),   "light": light_10s3m(ten3m_last)},
    "TIPS10Y":  {"value": round(tips10y_last, 2), "light": light_tips10y(tips10y_last)},
    "HY_OAS":   {"value": round(hy_oas_last, 2),  "light": light_hy_oas(hy_oas_last)},
    "IG_OAS":   {"value": round(ig_oas_last, 2),  "light": light_ig_oas(ig_oas_last)},
    "BBB_OAS":  {"value": round(bbb_oas_last, 2), "light": light_bbb_oas(bbb_oas_last)},
    "VIX":      {"value": round(vix_last, 2),     "light": light_vix(vix_last)},
}

summary = {
    "as_of": datetime.utcnow().strftime("%Y-%m-%d"),
    "snapshot": snap,
}

DATA_DIR.joinpath("summary.json").write_text(json.dumps(summary))

print("OK")
