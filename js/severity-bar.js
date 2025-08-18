(() => {
  const DATA_URL = '/data/severity_summary.json';
  let cached = null;
  let chart = null;

  async function loadData() {
    if (cached) return cached;
    const res = await fetch(DATA_URL);
    cached = await res.json();
    return cached;
  }

  function draw(level, data) {
    const ctx = document.getElementById('severityBarChart').getContext('2d');
    const geo = (data[level] || {}).borough || {};
    const labels = Object.keys(geo);
    const values = labels.map(k => geo[k]);
    if (!chart) {
      chart = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ data: values, backgroundColor: '#ef4e16' }] },
        options: { responsive: true, maintainAspectRatio: false }
      });
    } else {
      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.update();
    }
  }

  async function init() {
    const start = localStorage.getItem('severityLevel') || 'total';
    const data = await loadData();
    draw(start, data);
    document.addEventListener('severityChange', async e => {
      const lvl = e.detail || 'total';
      await loadData();
      draw(lvl, cached);
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
