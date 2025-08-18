document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, running crash-counter code.');

  (function(){
    const jsonURL = '/data/crash_count.json';
    const updateInterval = 60000; // 1 minute

    function fetchCrashData() {
      fetch(jsonURL)
        .then(response => response.json())
        .then(data => updateCounter(data))
        .catch(err => console.error('Error fetching crash data:', err));
    }

    function updateCounter(data) {
      const container = document.getElementById('crash-counter-content');
      if (container) {
        container.innerHTML = `
          <div class="counter-header">
            <div class="counter-title">Crash Counter</div>
          </div>
          <div class="counter-data">
            <div class="counter-row"><span class="label">Crashes:</span><span class="value">${data.total_crashes.toLocaleString()}</span></div>
            <div class="counter-row"><span class="label">Injuries:</span><span class="value">${data.total_injuries.toLocaleString()}</span></div>
            <div class="counter-row"><span class="label">Serious:</span><span class="value">${data.serious_injuries.toLocaleString()}</span></div>
            <div class="counter-row"><span class="label">Deaths:</span><span class="value">${data.total_deaths.toLocaleString()}</span></div>
            <div class="mt1 f7 gray data-date">
              Data as of: ${
                data.data_as_of && !isNaN(new Date(data.data_as_of))
                  ? new Date(data.data_as_of).toLocaleDateString()
                  : "Unknown"
              }
            </div>
          </div>
        `;
      }
    }

    // Initial fetch + periodic polling
    fetchCrashData();
    setInterval(fetchCrashData, updateInterval);
  })();

  // Mobile tap-to-toggle tooltip functionality.
  if (window.matchMedia('(hover: none)').matches) {
    console.log('Device likely has no hover (touchscreen). Attaching tap-to-toggle logic.');
    document.querySelectorAll('.relative').forEach(function(container) {
      container.addEventListener('click', function(e) {
        const tooltip = container.querySelector('.tooltip');
        if (tooltip) {
          console.log('Toggling single tooltip on tap.');
          tooltip.classList.toggle('active');
          e.stopPropagation();
        }
      });
    });

    // Clicking anywhere outside closes any open tooltips.
    document.addEventListener('click', function() {
      const activeTooltips = document.querySelectorAll('.tooltip.active');
      if (activeTooltips.length > 0) {
        console.log('Closing active tooltips due to outside click.');
      }
      activeTooltips.forEach(function(tooltip) {
        tooltip.classList.remove('active');
      });
    });
  }

  
});
