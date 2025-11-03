import os, json, time
from datetime import datetime, timedelta
import requests
import pandas as pd

FRED_API_KEY = os.environ["FRED_API_KEY"]
BASE = "https://api.stlouisfed.org/fred/series/observations"

SERIES = {
    "DGS10": "UST_10Y",
    "DGS2": "UST_2Y",
    "DGS3MO": "UST_3M",
    "DFII10": "UST_10Y_TIPS",
    "BAMLH0A0HYM2": "HY_OAS",
    "BAMLC0A0CM": "IG_OAS",
    "BAMLC0A4CBBB": "BBB_OAS",
}

END = datetime.utcnow().date()
START = END - timedelta(days=5*365)

def fred_df(series_id):
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
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"])
    return df.dropna(subset=["value"]).set_index("date")[["value"]]

def main():
    os.makedirs("data", exist_ok=True)
    frames = {}
    for sid, name in SERIES.items():
        df = fred_df(sid).rename(columns={"value": name})
        frames[name] = df
        df.rename(columns={"value": "value"}).to_json(
            f"data/{name}.json", orient="table", date_format="iso"
        )
        time.sleep(0.2)

    all_df = pd.concat(frames.values(), axis=1).dropna()
    all_df["YC_10s2s"] = all_df["UST_10Y"] - all_df["UST_2Y"]
    all_df["YC_10s3m"] = all_df["UST_10Y"] - all_df["UST_3M"]

    last = all_df.iloc[-1]
    # ----- Traffic-light thresholds (economist/market standards) -----
def light_10s2s(x):
    # 10y - 2y: Green > +0.25, Yellow 0..+0.25, Red < 0
    return "green" if x > 0.25 else ("yellow" if x >= 0 else "red")

def light_10s3m(x):
    # 10y - 3m: Green > +0.50, Yellow 0..+0.50, Red < 0
    return "green" if x > 0.50 else ("yellow" if x >= 0 else "red")

def light_hy_oas(x):
    # HY OAS: Green < 4.0, Yellow 4.0..6.0, Red > 6.0
    return "green" if x < 4.0 else ("yellow" if x <= 6.0 else "red")

def light_ig_oas(x):
    # IG OAS: Green < 1.25, Yellow 1.25..2.0, Red > 2.0
    return "green" if x < 1.25 else ("yellow" if x <= 2.0 else "red")

def light_bbb_oas(x):
    # BBB OAS: Green < 1.5, Yellow 1.5..2.5, Red > 2.5
    return "green" if x < 1.5 else ("yellow" if x <= 2.5 else "red")

def light_tips10y(x):
    # 10Y TIPS (real yield): Green 0..1.5, Yellow 1.5..2.0, Red >2.0 or <0
    if x < 0 or x > 2.0:
        return "red"
    return "green" if x <= 1.5 else "yellow"

# ----- Build snapshot for the front-end -----
snap = {
    "10s2s":  {"value": round(float(ten2s), 2),  "light": light_10s2s(float(ten2s))},
    "10s3m":  {"value": round(float(ten3m), 2),  "light": light_10s3m(float(ten3m))},
    "HY_OAS": {"value": round(float(hy_oas), 2), "light": light_hy_oas(float(hy_oas))},
    "IG_OAS": {"value": round(float(ig_oas), 2), "light": light_ig_oas(float(ig_oas))},
    "BBB_OAS":{"value": round(float(bbb_oas),2), "light": light_bbb_oas(float(bbb_oas))},
    "TIPS10Y":{"value": round(float(tips10y),2), "light": light_tips10y(float(tips10y))}
}

summary = {
    "as_of": pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
    "snapshot": snap
}

# write summary.json
os.makedirs("data", exist_ok=True)
with open("data/summary.json", "w") as f:
    json.dump(summary, f, indent=2)
