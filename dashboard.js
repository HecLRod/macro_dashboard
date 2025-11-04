// dashboard.js  — robust loaders + two charts (YC spreads, VIX)

async function loadJSON(url) {
  const res = await fetch(url + '?_=' + Date.now()); // cache-bust
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json();
}

/* ---------------- Traffic Lights ---------------- */

function pillHTML(text, light) {
  return `<span class="${light}">${text}</span>`;
}

async function renderLights() {
  const s = await loadJSON('data/summary.json');

  // Order & labels match your pills
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
  wrap.innerHTML = '';
  for (const k of order) {
    if (!(k in s.snapshot)) continue;
    const {value, light} = s.snapshot[k];
    const pill = document.createElement('span');
    pill.innerHTML = pillHTML(`${label[k]}: ${Number(value).toFixed(2)}`, light);
    wrap.appendChild(pill);
  }
}

/* ---------------- Yield Curve Spreads ---------------- */

function toTrace(name, xs, ys) {
  return {
    x: xs,
    y: ys,
    mode: 'lines',
    name,
    hovertemplate: '%{x|%Y-%m-%d}: %{y:.2f} pp<extra></extra>'
  };
}

async function renderYieldCurve() {
  const yc = await loadJSON('data/yield_curve.json'); // { "10s2s": [...], "10s3m": [...] }

  // each array element can be {date: "YYYY-MM-DD", value: number}
  function extract(series) {
    const x = [];
    const y = [];
    for (const p of series || []) {
      const d = p.date || p.Date;
      const v = p.value ?? p.Value ?? p.val ?? p.y;
      if (d != null && v != null && !Number.isNaN(Number(v))) {
        x.push(d);
        y.push(Number(v));
      }
    }
    return [x, y];
  }

  const [x1, y1] = extract(yc['10s2s']);
  const [x2, y2] = extract(yc['10s3m']);

  const data = [
    toTrace('10s–2s', x1, y1),
    toTrace('10s–3m', x2, y2),
  ];

  Plotly.newPlot('yc', data, {
    margin: {l: 50, r: 20, t: 10, b: 40},
    xaxis: {type: 'date'},
    yaxis: {title: 'pct pts'},
  }, {displayModeBar: false});
}

/* ---------------- VIX Chart (robust parser) ---------------- */

function parseVixArray(arr) {
  // Accept a variety of shapes:
  // - {date, value}
  // - {Date, Close}
  // - {date, close}
  // - {t, v}
  const xs = [];
  const ys = [];
  for (const row of arr || []) {
    const d = row.date || row.Date || row.t;
    const raw =
      row.value ??
      row.Value ??
      row.v ??
      row.close ??
      row.Close ??
      row.adjClose ??
      row.AdjClose;

    if (d != null && raw != null) {
      const num = Number(raw);
      if (!Number.isNaN(num)) {
        xs.push(d);
        ys.push(num);
      }
    }
  }
  return [xs, ys];
}

async function renderVIX() {
  const panel = document.getElementById('vix');
  panel.innerHTML = ''; // clear

  try {
    const vix = await loadJSON('data/vix.json');

    // vix.json can be:
    //   - an array: [ {...}, {...} ]
    //   - an object with a field that is an array: { data: [...] } or { series: [...] }
    let arr = [];
    if (Array.isArray(vix)) {
      arr = vix;
    } else if (vix && Array.isArray(vix.data)) {
      arr = vix.data;
    } else if (vix && Array.isArray(vix.series)) {
      arr = vix.series;
    } else {
      // fall back: try any array-like value in object
      for (const k of Object.keys(vix || {})) {
        if (Array.isArray(vix[k])) { arr = vix[k]; break; }
      }
    }

    const [xs, ys] = parseVixArray(arr);

    if (xs.length === 0) {
      panel.textContent = 'VIX data unavailable';
      return;
    }

    Plotly.newPlot('vix', [{
      x: xs,
      y: ys,
      mode: 'lines',
      name: 'VIX',
      hovertemplate: '%{x|%Y-%m-%d}: %{y:.2f}<extra></extra>'
    }], {
      margin: {l: 50, r: 20, t: 10, b: 40},
      xaxis: {type: 'date'},
      yaxis: {title: 'level'}
    }, {displayModeBar: false});
  } catch (e) {
    panel.textContent = 'VIX data unavailable';
    console.error(e);
  }
}

/* ---------------- Boot ---------------- */

async function main() {
  await renderLights();
  await renderYieldCurve();
  await renderVIX();
}

document.addEventListener('DOMContentLoaded', main);
