// dashboard.js — robust data handling for GitHub Pages
(async function () {
  const BASE = window.location.pathname.includes('/macro_dashboard/')
    ? '/macro_dashboard'
    : '';
  const cacheBust = () => `?_=${Date.now()}`;

  async function fetchJSON(path) {
    const res = await fetch(`${BASE}/data/${path}${cacheBust()}`);
    if (!res.ok) throw new Error(`Failed to fetch ${path}`);
    return res.json();
  }

  // ---- Traffic Lights ----
  async function loadSummary() {
    const summary = await fetchJSON('summary.json');
    return summary.snapshot || summary;
  }

  function renderTrafficLights(snapshot) {
    const order = ["10s-2s","10s-3m","TIPS10Y","HY_OAS","IG_OAS","BBB_OAS","VIX"];
    const labels = {
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
    for (const key of order) {
      if (!(key in snapshot)) continue;
      const { value, light } = snapshot[key];
      const pill = document.createElement('span');
      pill.className = light;
      pill.textContent = `${labels[key]}: ${value}`;
      wrap.appendChild(pill);
    }
  }

  // ---- Yield Curve ----
  async function plotYield() {
    const data = await fetchJSON('yield_curve.json');
    const el = document.getElementById('yc');
    if (!el) return;

    const keys = Object.keys(data);
    const dateKey = keys.find(k => k.toLowerCase().includes('date'));
    const spreadKeys = keys.filter(k => k !== dateKey);

    if (!dateKey || spreadKeys.length === 0) {
      console.warn('Unexpected yield_curve.json format');
      return;
    }

    const traces = spreadKeys.map(k => ({
      x: data[dateKey],
      y: data[k],
      mode: 'lines',
      name: k.replace(/_/g, ' ')
    }));

    Plotly.newPlot(el, traces, {
      margin: { l: 40, r: 20, t: 20, b: 40 },
      yaxis: { title: 'pct pts', zeroline: true },
      xaxis: { type: 'date' }
    }, { responsive: true });
  }

  // ---- VIX ----
  async function plotVix() {
    const data = await fetchJSON('VIX.json');
    const el = document.getElementById('vix');
    const msg = document.getElementById('vixMsg');
    if (!el) return;

    const keys = Object.keys(data);
    const dateKey = keys.find(k => k.toLowerCase().includes('date'));
    const vixKey = keys.find(k => k.toLowerCase().includes('vix'));
    if (!dateKey || !vixKey) {
      msg.textContent = 'VIX data unavailable';
      return;
    }

    Plotly.newPlot(el, [{
      x: data[dateKey],
      y: data[vixKey],
      mode: 'lines',
      name: 'VIX'
    }], {
      margin: { l: 40, r: 20, t: 20, b: 40 },
      yaxis: { rangemode: 'tozero' },
      xaxis: { type: 'date' }
    }, { responsive: true });
  }

  // ---- Main ----
  try {
    const summary = await loadSummary();
    renderTrafficLights(summary);
    await plotYield();
    await plotVix();
  } catch (err) {
    console.error(err);
  }
})();
