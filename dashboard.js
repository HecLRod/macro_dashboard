// dashboard.js

async function loadSummary() {
  const res = await fetch(`data/summary.json?_=${Date.now()}`);
  const snapshot = await res.json();

  const order = ["10s2s","10s3m","TIPS10Y","HY_OAS","IG_OAS","BBB_OAS","VIX"];
  const label = {
    "10s2s":"10s–2s",
    "10s3m":"10s–3m",
    "TIPS10Y":"10Y TIPS",
    "HY_OAS":"HY OAS",
    "IG_OAS":"IG OAS",
    "BBB_OAS":"BBB OAS",
    "VIX":"VIX"
  };

  const wrap = document.getElementById('lights');
  wrap.innerHTML = '';

  for (const k of order) {
    if (!snapshot[k]) continue;
    const { value, light } = snapshot[k];
    const pill = document.createElement('span');
    pill.className = light;           // green | yellow | red
    pill.textContent = `${label[k]}: ${value}`;
    wrap.appendChild(pill);
  }
}

function parseYieldCurve(json) {
  // Accept either of these shapes:
  // A) { dates:[...], ten2s:[...], ten3m:[...] }
  // B) [{date:"YYYY-MM-DD", ten2s:..., ten3m:...}, ...]
  if (Array.isArray(json)) {
    const dates = json.map(r => r.date);
    const ten2s = json.map(r => r.ten2s);
    const ten3m = json.map(r => r.ten3m);
    return { dates, ten2s, ten3m };
  }
  if (json && Array.isArray(json.dates)) {
    return { dates: json.dates, ten2s: json.ten2s, ten3m: json.ten3m };
  }
  console.warn("Unexpected_yield_curve_json_format");
  return { dates: [], ten2s: [], ten3m: [] };
}

async function drawYieldCurve() {
  const res = await fetch(`data/yield_curve.json?_=${Date.now()}`);
  const raw = await res.json();
  const { dates, ten2s, ten3m } = parseYieldCurve(raw);

  const layout = {
    margin: {l:40,r:10,t:10,b:30},
    yaxis: {title: "pct pts", zeroline: true, zerolinecolor: "#888"},
    xaxis: {type: "date"},
    showlegend: true
  };

  const traces = [
    { x: dates, y: ten2s, name: "10s–2s", mode: "lines" },
    { x: dates, y: ten3m, name: "10s–3m", mode: "lines" }
  ];

  Plotly.newPlot('yc', traces, layout, {displayModeBar: false});
}

async function drawVIX() {
  const msg = document.getElementById('vix_msg'); // might be null if HTML missing

  try {
    const res = await fetch(`data/VIX.json?_=${Date.now()}`);
    if (!res.ok) {
      if (msg) msg.textContent = "VIX data unavailable (HTTP " + res.status + ")";
      return;
    }
    const rows = await res.json();
    // Accept either [{date, value}, ...] or { dates:[], values:[] }
    let dates, values;
    if (Array.isArray(rows)) {
      dates = rows.map(r => r.date);
      values = rows.map(r => r.value);
    } else if (rows && Array.isArray(rows.dates)) {
      dates = rows.dates;
      values = rows.values;
    } else {
      if (msg) msg.textContent = "VIX data unavailable (unexpected format)";
      return;
    }

    if (msg) msg.textContent = ""; // clear any prior note

    Plotly.newPlot(
      'vix',
      [{ x: dates, y: values, mode: 'lines', name: 'VIX' }],
      { margin: {l:40,r:10,t:10,b:30}, yaxis: { rangemode: 'tozero' }, xaxis: { type: 'date' } },
      { displayModeBar: false }
    );
  } catch (e) {
    if (msg) msg.textContent = "VIX data unavailable";
    // still fail gracefully
  }
}

(async function main() {
  await loadSummary();
  await drawYieldCurve();
  await drawVIX();
})(); 
