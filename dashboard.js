// dashboard.js (explicit base path for GitHub Pages repo)

(async function () {
  const BASE = '/macro_dashboard'; // <-- important for GitHub Pages path
  const cacheBust = () => `?_=${Date.now()}`;

  // ---- Load the traffic-light snapshot ----
  async function loadSummary() {
    const res = await fetch(`${BASE}/data/summary.json${cacheBust()}`);
    if (!res.ok) throw new Error('summary.json fetch failed');
    return res.json();
  }

  // ---- Render traffic-light pills ----
  function renderPills(snapshot) {
    const order = ["10s-2s","10s-3m","TIPS10Y","HY_OAS","IG_OAS","BBB_OAS","VIX"];
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
    if (!wrap) return;
    wrap.innerHTML = '';

    for (const k of order) {
      if (!(k in snapshot)) continue;
      const { value, light } = snapshot[k];
      const pill = document.createElement('span');
      pill.className = light; // expects .green/.yellow/.red in CSS
      pill.textContent = `${label[k]}: ${value}`;
      wrap.appendChild(pill);
    }
  }

  // ---- Load and plot yield-curve spreads ----
  async function loadYield() {
    const res = await fetch(`${BASE}/data/yield_curve.json${cacheBust()}`);
    if (!res.ok) throw new Error('yield_curve.json fetch failed');
    return res.json(); // { dates: [...], ten2s: [...], ten3m: [...] }
  }

  async function plotYield(data) {
    const el = document.getElementById('yc');
    if (!el) return;

    const trace2s = {
      x: data.dates,
      y: data.ten2s,
      mode: 'lines',
      name: '10s–2s'
    };
    const trace3m = {
      x: data.dates,
      y: data.ten3m,
      mode: 'lines',
      name: '10s–3m'
    };
    const layout = {
      margin: {l:40, r:20, t:20, b:40},
      yaxis: { title: 'pct pts', zeroline: true, zerolinecolor: '#aaa' },
      xaxis: { type: 'date' }
    };
    Plotly.newPlot(el, [trace2s, trace3m], layout, {responsive: true});
  }

  // ---- Load and plot VIX ----
  async function loadVix() {
    const res = await fetch(`${BASE}/data/VIX.json${cacheBust()}`);
    if (!res.ok) throw new Error('VIX.json fetch failed');
    return res.json(); // { dates: [...], vix: [...] }
  }

  async function plotVix(data) {
    const el = document.getElementById('vix');
    const msg = document.getElementById('vixMsg');
    if (!el) return;
    if (!data || !data.dates || !data.vix || data.vix.length === 0) {
      if (msg) msg.textContent = 'VIX data unavailable';
      return;
    }
    if (msg) msg.textContent = '';

    const trace = {
      x: data.dates,
      y: data.vix,
      mode: 'lines',
      name: 'VIX'
    };
    const layout = {
      margin: {l:40, r:20, t:10, b:40},
      yaxis: { title: '', rangemode: 'tozero' },
      xaxis: { type: 'date' }
    };
    Plotly.newPlot(el, [trace], layout, {responsive: true});
  }

  // ---- Run all ----
  try {
    const summary = await loadSummary();
    renderPills(summary.snapshot || summary);

    const yc = await loadYield();
    await plotYield(yc);

    const v = await loadVix();
    await plotVix(v);
  } catch (e) {
    console.error(e);
  }
})();
