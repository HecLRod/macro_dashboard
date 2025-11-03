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
    snap = {
        "YC_10s2s": {"value": float(last["YC_10s2s"]), "light": "red" if last["YC_10s2s"] < 0 else "green"},
        "YC_10s3m": {"value": float(last["YC_10s3m"]), "light": "red" if last["YC_10s3m"] < 0 else "green"},
    }
    hy = float(last["HY_OAS"])
    snap["HY_OAS"] = {"value": hy, "light": "red" if hy >= 6 else ("yellow" if hy >= 4 else "green")}
    for k in ("IG_OAS", "BBB_OAS"):
        v = float(last[k])
        snap[k] = {"value": v, "light": "red" if v >= 2.5 else ("yellow" if v >= 1.5 else "green")}
    tips = float(last["UST_10Y_TIPS"])
    snap["UST_10Y_TIPS"] = {"value": tips, "light": "red" if tips >= 2.0 else ("yellow" if tips >= 1.5 else "green")}

    with open("data/summary.json", "w") as f:
        json.dump({"as_of": END.isoformat(), "snapshot": snap}, f, indent=2)

    all_df[["YC_10s2s", "YC_10s3m"]].to_json(
        "data/yield_curve.json", orient="table", date_format="iso"
    )

if __name__ == "__main__":
    main()
