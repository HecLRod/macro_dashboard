// dashboard.js

async function loadSummary() {
  // Fetch the latest snapshot (cache-busted)
  const res = await fetch('data/summary.json?_=' + Date.now());
  const { snapshot } = await res.json();

  // Display order + pretty labels
  const order = ["10s2s","10s3m","TIPS10Y","HY_OAS","IG_OAS","BBB_OAS","VIX"];
  const label = {
    "10s2s":  "10s–2s",
    "10s3m":  "10s–3m",
    "TIPS10Y":"10Y TIPS",
    "HY_OAS": "HY OAS",
    "IG_OAS": "IG OAS",
    "BBB_OAS":"BBB OAS",
    "VIX":    "VIX"
  };

  const wrap = document.getElementById('lights'); // <-- matches your HTML
  wrap.innerHTML = '';

  // Render pills that exist in snapshot
  for (const k of order) {
    if (!snapshot[k]) continue;
    const { value, light } = snapshot[k];
    const pill = document.createElement('span');
    // Your CSS already styles ".lights span" and ".green/.yellow/.red"
    pill.className = light;
    pill.textContent = `${label[k] || k}: ${Number(value).toFixed(2)}`;
    wrap.appendChild(pill);
  }

  // If VIX isn't in summary.json, try vix_snapshot.json
  if (!snapshot["VIX"]) {
    try {
      const v = await (await fetch('data/vix_snapshot.json?_=' + Date.now())).json();
      if (v && typeof v.value !== 'undefined' && v.light) {
        const pill = document.createElement('span');
        pill.className = v.light;
        pill.textContent = `VIX: ${Number(v.value).toFixed(2)}`;
        wrap.appendChild(pill);
      }
    } catch {}
  }
}

async function loadYieldCurve() {
  // Reads "table" orient JSON written by fetch_fred.py
  const res = await fetch('data/yield_curve.json?_=' + Date.now());
  const js = await res.json();               // {schema:..., data:[{index, YC_10s2s, YC_10s3m}, ...]}
  const rows = js.data || [];

  const x = rows.map(r => new Date(r.index));
  const y10s2s = rows.map(r => Number(r.YC_10s2s));
  const y10s3m = rows.map(r => Number(r.YC_10s3m));

  const traces = [
    { x, y: y10s2s, mode: 'lines', name: '10s–2s' },
    { x, y: y10s3m, mode: 'lines', name: '10s–3m' }
  ];
  const layout = {
    margin: {l: 40, r: 10, t: 10, b: 30},
    yaxis: {title: 'pct pts', zeroline: true},
    xaxis: {showgrid: false}
  };
  Plotly.newPlot('yc', traces, layout, {displayModeBar: false, responsive: true});
}

document.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  loadYieldCurve();
  async function loadVIXChart() {
  try {
    // Fetch VIX time-series (cache-busted)
    const res = await fetch('data/VIX.json?_=' + Date.now());
    const js = await res.json();

    // --- Normalize to a common array of {t, v} ---
    let rows = [];
    if (Array.isArray(js)) {
      // e.g., [{date:"2025-11-01", value: 16.5}, ...] or similar
      rows = js;
    } else if (js && Array.isArray(js.data)) {
      // pandas orient="table" => {schema:..., data:[{index, value or Close/...}]}
      rows = js.data;
    } else {
      console.warn('Unexpected VIX.json format', js);
    }

    // Try common field names
    const points = rows.map(r => {
      const t =
        r.date ? new Date(r.date) :
        r.index ? new Date(r.index) :
        r.t ? new Date(r.t) : null;

      const v =
        r.value ?? r.close ?? r.Close ?? r.VIX ?? r.v;

      return (t && v != null) ? { t, v: Number(v) } : null;
    }).filter(Boolean);

    if (!points.length) {
      throw new Error('No VIX points parsed');
    }

    // Plot with Plotly
    Plotly.newPlot('vix', [{
      x: points.map(p => p.t),
      y: points.map(p => p.v),
      mode: 'lines',
      name: 'VIX'
    }], {
      margin: { l: 40, r: 10, t: 10, b: 30 },
      xaxis: { showgrid: false },
      yaxis: { title: 'Index' }
    }, { displayModeBar: false, responsive: true });

  } catch (err) {
    console.error('VIX chart error:', err);
    const el = document.getElementById('vix');
    if (el) el.innerHTML = '<em>VIX data unavailable</em>';
  }
}});
