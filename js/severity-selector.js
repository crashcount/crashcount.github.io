(() => {
  const DEFAULT = 'total';

  function selects() {
    return document.querySelectorAll('.severity-selector');
  }

  function dispatch(level) {
    document.dispatchEvent(new CustomEvent('severityChange', { detail: level }));
  }

  function setAll(level, skipStore = false) {
    selects().forEach((sel) => {
      if (sel.value !== level) sel.value = level;
    });
    if (!skipStore) localStorage.setItem('severityLevel', level);
    dispatch(level);
  }

  function init() {
    const els = selects();
    if (!els.length) return;
    const stored = localStorage.getItem('severityLevel') || DEFAULT;
    setAll(stored, true);
    els.forEach((sel) => {
      sel.addEventListener('change', () => setAll(sel.value));
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
