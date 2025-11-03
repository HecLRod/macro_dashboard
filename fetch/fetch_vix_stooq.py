import os, io, json
import pandas as pd
import requests

os.makedirs("data", exist_ok=True)

r = requests.get("https://stooq.com/q/d/l/?s=^vix&i=d", timeout=20)
r.raise_for_status()
df = pd.read_csv(io.StringIO(r.text))
df["Date"] = pd.to_datetime(df["Date"])
df = df.set_index("Date")[["Close"]].rename(columns={"Close": "VIX"})
df.to_json("data/VIX.json", orient="table", date_format="iso")

v = float(df["VIX"].iloc[-1])
with open("data/vix_snapshot.json", "w") as f:
    json.dump({"value": v, "light": "red" if v >= 30 else ("yellow" if v >= 20 else "green")}, f, indent=2)
