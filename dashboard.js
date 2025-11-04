async function loadSummary() {
  // Always fetch fresh JSON (cache buster)
  const res = await fetch('data/summary.json?_=' + Date.now());
  const { snapshot } = await res.json();

  // Order & pretty labels for pills
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

  const wrap = document.getElementById('traffic-lights');
  wrap.innerHTML = '';

  // Render pills that exist in snapshot
  for (const k of order) {
    if (!snapshot[k]) continue;
    const { value, light } = snapshot[k];
    const pill = document.createElement('span');
    pill.className = `pill ${light}`;   // needs CSS .pill.green/.yellow/.red
    pill.textContent = `${label[k] || k}: ${Number(value).toFixed(2)}`;
    wrap.appendChild(pill);
  }

  // Add VIX from its own file if not provided in summary.json
  if (!snapshot["VIX"]) {
    try {
      const v = await (await fetch('data/vix_snapshot.json?_=' + Date.now())).json();
      if (v && typeof v.value !== 'undefined' && v.light) {
        const pill = document.createElement('span');
        pill.className = `pill ${v.light}`;
        pill.textContent = `VIX: ${Number(v.value).toFixed(2)}`;
        wrap.appendChild(pill);
      }
    } catch {}
  }
}

// run on page load
document.addEventListener('DOMContentLoaded', () => {
  loadSummary();
  // keep your other initializers here (e.g., loadYieldCurve(), loadVIXChart(), etc.)
});  
