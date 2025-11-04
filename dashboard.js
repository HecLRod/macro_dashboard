// dashboard.js – full replacement

async function loadSummary() {
  // cache-bust so GitHub Pages doesn’t serve an old JSON
  const res = await fetch('data/summary.json?_=' + Date.now());
  if (!res.ok) throw new Error('summary.json fetch failed');
  const { snapshot } = await res.json();

  // Display order + pretty labels (make sure these keys exist in summary.json)
  const order = ["10s-2s", "10s-3m", "TIPS10Y", "HY_OAS", "IG_OAS", "BBB_OAS", "VIX"];
  const label = {
    "10s-2s": "10s–2s",
    "10s-3m": "10s–3m",
    "TIPS10Y": "10Y TIPS",
    "HY_OAS": "HY OAS",
    "IG_OAS": "IG OAS",
    "BBB_OAS": "BBB OAS",
    "VIX": "VIX"
  };

  const wrap = document.getElementById('lights');
  wrap.innerHTML = '';

  for (const k of order) {
    if (!snapshot[k]) continue;
    const { value, light } = snapshot[k];

    const pill = document.createElement('span');
    pill.className = light; // your CSS has .green/.yellow/.red
    pill.textContent = `${label[k]}: ${value}`;
    wrap.appendChild(pill);
  }
}

async function loadYieldCurves() {
  // Fetch the combined yield curve data written by fetch_fred.py
  const res = await fetch('data/yield_curve.json?_=' + Date.now());
  if (!res.ok) throw new Error('yield_curve.json fetch failed');
  const data = await res.json();

  // Build Plotly series
  const s10s2s = data["10s-2s"] || [];
  const s10s3m = data["10s-3m"] || [];

  const trace1 = {
    x: s10s2s.map(p => p.t),
    y: s10s2s.map(p => p.v),
    name: '10s–2s',
    line: { width: 2 }
  };
  const trace2 = {
    x: s10s3m.map(p => p.t),
    y: s10s3m.map(p => p.v),
    name: '10s–3m',
    line: { width: 2 }
  };

  const layout = {
    margin: { l: 50, r: 20, t: 10, b: 30 },
    yaxis: { title: 'pct pts' },
    legend: { orientation: 'h' }
  };

  Plotly.newPlot('yc', [trace1, trace2], layout, { responsive: true, displayModeBar: false });
}

async function loadVix() {
  const holder = document.getElementById('vix');
  holder.innerHTML = ''; // clear “unavailable” text from HTML

  try {
    // match lowercase filename written by Python
    const res = await fetch('data/vix.json?_=' + Date.now());
    if (!res.ok) throw new Error('vix.json fetch failed');
    const rows = await res.json();

    const x = rows.map(p => p.t);
    const y = rows.map(p => p.v);

    const trace = { x, y, name: 'VIX', line: { width: 2 } };
    const layout = { margin: { l: 50, r: 20, t: 10, b: 30 } };

    Plotly.newPlot('vix', [trace], layout, { responsive: true, displayModeBar: false });
  } catch (e) {
    holder.textContent = 'VIX data unavailable';
  }
}

(async function init() {
  try {
    await loadSummary();
    await loadYieldCurves();
    await loadVix();
  } catch (e) {
    console.error(e);
  }
})();
