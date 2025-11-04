async function loadSummary() {
  const res = await fetch('data/summary.json?_=' + Date.now());
  const js = await res.json();
  const snap = js.snapshot;

  // Optional: define display order & labels
  const order = ["10s2s","10s3m","HY_OAS","IG_OAS","BBB_OAS","TIPS10Y","VIX"];
  const labels = {
    "10s2s": "10s–2s",
    "10s3m": "10s–3m",
    "HY_OAS": "HY OAS",
    "IG_OAS": "IG OAS",
    "BBB_OAS": "BBB OAS",
    "TIPS10Y": "10Y TIPS",
    "VIX": "VIX"
  };

  const wrap = document.getElementById('traffic-lights');
  wrap.innerHTML = ''; // clear

  // Render any key that exists in snapshot (in the chosen order)
  for (const k of order) {
    if (!snap[k]) continue;
    const { value, light } = snap[k];
    const pill = document.createElement('span');
    pill.className = `pill ${light}`;  // expects CSS for .pill.green/.yellow/.red
    pill.textContent = `${labels[k] || k}: ${Number(value).toFixed(2)}`;
    wrap.appendChild(pill);
  }
}
