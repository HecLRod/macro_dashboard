async function loadJSON(p){ const r = await fetch(p); return r.ok ? r.json() : null; }
function pill(name, v){ if(!v) return ""; const val = typeof v.value==="number" ? v.value.toFixed(2) : v.value; return `<span class="${v.light}">${name}: ${val}</span>`; }
(async ()=>{
  const summary = await loadJSON("./data/summary.json");
  const vix = await loadJSON("./data/vix_snapshot.json");
  if(summary){
    const lights = {
      "10s–2s": summary.snapshot.YC_10s2s,
      "10s–3m": summary.snapshot.YC_10s3m,
      "HY OAS": summary.snapshot.HY_OAS,
      "IG OAS": summary.snapshot.IG_OAS,
      "BBB OAS": summary.snapshot.BBB_OAS,
      "10Y TIPS": summary.snapshot.UST_10Y_TIPS,
      "VIX": vix
    };
    document.getElementById("lights").innerHTML = Object.entries(lights).map(([k,v])=>pill(k,v)).join("");
    const yc = await loadJSON("./data/yield_curve.json");
    if(yc){
      const x = yc.data.map(r=>r.index);
      const s10_2 = yc.data.map(r=>r.YC_10s2s);
      const s10_3m = yc.data.map(r=>r.YC_10s3m);
      Plotly.newPlot("yc", [
        {x, y:s10_2, mode:"lines", name:"10s–2s"},
        {x, y:s10_3m, mode:"lines", name:"10s–3m"}
      ], {margin:{t:20}, yaxis:{title:"pct pts"}});
    }
    const vixSeries = await loadJSON("./data/VIX.json");
    if(vixSeries){
      Plotly.newPlot("vix", [{
        x: vixSeries.data.map(r=>r.index),
        y: vixSeries.data.map(r=>r.VIX),
        mode:"lines", name:"VIX"
      }], {margin:{t:20}});
    }
  }
})();
