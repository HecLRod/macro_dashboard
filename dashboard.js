// dashboard.js — Macro Dashboard front-end
// Requires Plotly (already included in your index.html)

// ---------- small helpers ----------
async function fetchJSON(path) {
  // cache-buster avoids stale GitHub Pages caching
  const res = await fetch(`${path}?_=${Date.now()}`);
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return res.json();
}
function toNum(x) { return (x == null || x === "") ? null : Number(x); }

// ---------- TRAFFIC LIGHTS ----------
async function loadSummary() {
  // summary.json written by backend (fetch_fred.py)
  const { snapshot } = await fetchJSON('data/summary.json');

  // order + pretty labels
  const order = ["10s2s", "10s3m", "TIPS10Y", "HY_OAS", "IG_OAS", "BBB_OAS", "VIX"];
  const label = {
    "10s2s":   "10s–2s",
    "10s3m":   "10s–3m",
    "TIPS10Y": "10Y TIPS",
    "HY_OAS":  "HY OAS",
    "IG_OAS":  "IG OAS",
    "BBB_OAS": "BBB OAS",
    "VIX":     "VIX"
  };

  const wrap = document.getElementById('lights');
  if (!wrap) return;
  wrap.innerHTML = '';

  // pills from summary.json
  for (const k of order) {
    if (!snapshot[k]) continue;
    const { value, light } = snapshot[k];
    const pill = document.createElement('span');
    // Your CSS styles .lights span and the color classes .green/.yellow/.red
    pill.className = light || '';
    pill.textContent = `${label[k] || k}: ${Number(value).toFixed(2)}`;
    wrap.appendChild(pill);
  }

  // If VIX pill wasn't present, try the standalone vix_snapshot
  if (!snapshot["VIX"]) {
    try {
      const v = await fetchJSON('data/vix_snapshot.json');
      if (typeof v.value !== 'undefined' && v.light) {
        const pill = document.createElement('span');
        pill.className = v.light;
        pill.textContent = `VIX: ${Number(v.value).toFixed(2)}`;
        wrap.appendChild(pill);
      }
    } catch (_) { /* optional */ }
  }
}

// ---------- YIELD CURVE SPREADS ----------
async function loadYieldCurve() {
  // yield_curve.json is a pandas "table" orientation by default
  const container = document.getElementById('yc');
  if (!container) return;

  const js = await fetchJSON('data/yield_curve.json');
  const rows = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);

  // Normalize: each row should have {index, YC_10s2s, YC_10s3m}
  const x = [];
  const y10s2s = [];
  const y10s3m = [];

  for (const r of rows) {
    const t = r.index ?? r.date ?? r.t;
    const s2 = toNum(r.YC_10s2s ?? r['10s2s'] ?? r.s10s2s);
    const s3 = toNum(r.YC_10s3m ?? r['10s3m'] ?? r.s10s3m);
    if (t != null) {
      const dt = new Date(t);
      x.push(dt);
      y10s2s.push(s2);
      y10s3m.push(s3);
    }
  }

  const traces = [
    { x, y: y10s2s, mode: 'lines', name: '10s–2s' },
    { x, y: y10s3m, mode: 'lines', name: '10s–3m' }
  ];

  const layout = {
    margin: { l: 40, r: 10, t: 10, b: 30 },
    yaxis: { title: 'pct pts', zeroline: true },
    xaxis: { showgrid: false }
  };

  Plotly.newPlot(container, traces, layout, { displayModeBar: false, responsive: true });
}

// ---------- VIX CHART ----------
async function loadVIXChart() {
  const el = document.getElementById('vix');
  if (!el) return;

  // Be tolerant to filename casing and JSON shapes
  let js;
  try {
    js = await fetchJSON('data/VIX.json');
  } catch {
    js = await fetchJSON('data/vix.json'); // fallback if lowercase file exists
  }

  // Normalize to array of {t, v}
  let rows = [];
  if (Array.isArray(js)) {
    rows = js;
  } else if (Array.isArray(js?.data)) {
    rows = js.data;                       // pandas orient="table"
  } else if (Array.isArray(js?.records)) {
    rows = js.records;                    // orient="records"
  } else {
    // object-of-arrays fallback
    const dates = js?.date ?? js?.Date ?? js?.index ?? [];
    const values = js?.value ?? js?.Close ?? js?.close ?? js?.VIX ?? [];
    const N = Math.min(dates.length, values.length);
    rows = Array.from({ length: N }, (_, i) => ({ date: dates[i], value: values[i] }));
  }

  const pts = rows.map(r => {
    const t = r.t ?? r.date ?? r.index;
    const v = r.v ?? r.value ?? r.Close ?? r.close ?? r.VIX;
    return (t != null && v != null) ? { t: new Date(t), v: Number(v) } : null;
  }).filter(Boolean);

  if (!pts.length) {
    el.innerHTML = '<em>VIX data unavailable</em>';
    return;
  }

  Plotly.newPlot(el, [{
    x: pts.map(p => p.t),
    y: pts.map(p => p.v),
    mode: 'lines',
    name: 'VIX'
  }], {
    margin: { l: 40, r: 10, t: 10, b: 30 },
    xaxis: { showgrid: false },
    yaxis: { title: 'Index' }
  }, { displayModeBar: false, responsive: true });
}

// ---------- boot ----------
document.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  loadYieldCurve();
  loadVIXChart();

  // keep charts responsive on viewport changes
  window.addEventListener('resize', () => {
    const ids = ['yc', 'vix'];
    ids.forEach(id => {
      const node = document.getElementById(id);
      if (node && node._fullLayout) {
        Plotly.Plots.resize(node);
      }
    });
  });
});
