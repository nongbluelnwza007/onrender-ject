const tempEl = document.getElementById("tempVal");
const humEl  = document.getElementById("humVal");
const timeEl = document.getElementById("timeVal");

const ctx = document.getElementById("lineChart").getContext("2d");
const chart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      { label: "Temperature (°C)", data: [], tension: .35 },
      { label: "Humidity (%)",     data: [], tension: .35 }
    ]
  },
  options: {
    responsive: true,
    interaction: { intersect: false, mode: "index" },
    plugins: { legend: { labels: { color: "#d1d5db" } } },
    scales: {
      x: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,.05)" } },
      y: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(255,255,255,.05)" } }
    }
  }
});

function toTime(ts){ return new Date(ts).toLocaleString(); }

async function refresh(){
  try{
    const res = await fetch("/api/history");
    const data = await res.json();
    chart.data.labels = data.map(d => new Date(d.ts).toLocaleTimeString());
    chart.data.datasets[0].data = data.map(d => d.t);
    chart.data.datasets[1].data = data.map(d => d.h);
    chart.update("none");
    const last = data[data.length - 1];
    if(last){
      tempEl.textContent = `${Number(last.t).toFixed(1)}°`;
      humEl.textContent  = `${Number(last.h).toFixed(1)}%`;
      timeEl.textContent = toTime(last.ts);
    }
  }catch(e){ console.error(e); }
}
refresh();
setInterval(refresh, 3000);
