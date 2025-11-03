import json, os, glob, datetime
import pandas as pd
from jinja2 import Environment, FileSystemLoader, select_autoescape
import plotly.graph_objects as go

ROOT = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(ROOT)  # repo root
DATA_DIR = os.path.join(ROOT, "data")
DOCS_DIR = os.path.join(ROOT, "docs")
TEMPLATE_DIR = os.path.join(ROOT, "templates")

os.makedirs(DOCS_DIR, exist_ok=True)

def load_json(path):
    with open(path, "r") as f:
        return json.load(f)

# ---- Load data (adjust filenames if yours differ) ----
vix_path = os.path.join(DATA_DIR, "vix_stooq.json")
vix_df = pd.DataFrame(load_json(vix_path)) if os.path.exists(vix_path) else pd.DataFrame(columns=["date","close"])
if not vix_df.empty:
    vix_df["date"] = pd.to_datetime(vix_df["date"])

fred_files = sorted(glob.glob(os.path.join(DATA_DIR, "fred_*.json")))
fred_long = []
for fp in fred_files:
    name = os.path.splitext(os.path.basename(fp))[0].replace("fred_","")
    data = load_json(fp)
    for row in data:
        fred_long.append({"series": name, "date": row.get("date"), "value": row.get("value")})
fred_df = pd.DataFrame(fred_long)
if not fred_df.empty:
    fred_df["date"] = pd.to_datetime(fred_df["date"])
    first_series = fred_df["series"].iloc[0]
    fred_plot = fred_df[fred_df["series"] == first_series].sort_values("date")
else:
    first_series, fred_plot = None, pd.DataFrame(columns=["date","value"])

def line_html(x, y, title):
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=x, y=y, mode="lines"))
    fig.update_layout(margin=dict(l=20, r=20, t=30, b=20), title=title)
    return fig.to_html(include_plotlyjs="cdn", full_html=False)

vix_html = line_html(vix_df["date"], vix_df["close"], "VIX") if not vix_df.empty else "<p>No VIX data yet.</p>"
fred_html = line_html(fred_plot["date"], fred_plot["value"], first_series.upper() if first_series else "FRED") if not fred_plot.empty else "<p>No FRED data yet.</p>"

env = Environment(loader=FileSystemLoader(TEMPLATE_DIR), autoescape=select_autoescape(["html", "xml"]))
tpl = env.get_template("index.html")

html = tpl.render(
    last_updated=datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
    vix_html=vix_html,
    fred_html=fred_html,
    data_files=[os.path.relpath(p, ROOT).replace("\\", "/") for p in [vix_path] + fred_files if os.path.exists(p)]
)

with open(os.path.join(DOCS_DIR, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print("Wrote docs/index.html")
