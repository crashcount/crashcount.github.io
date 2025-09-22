(() => {
  const STORAGE_KEY = 'crashYearFilter';

  function getSelects() {
    return Array.from(document.querySelectorAll('.year-selector'));
  }

  function parseOptions(selectEl) {
    if (!selectEl || !selectEl.dataset) return [];
    const raw = selectEl.dataset.options;
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (err) {
      console.error('[year-selector] failed to parse options', err);
      return [];
    }
  }

  function init() {
    const selects = getSelects();
    if (!selects.length) return;

    const primary = selects[0];
    const options = parseOptions(primary);
    const optionMap = {};
    options.forEach(opt => {
      if (opt && opt.value) optionMap[opt.value] = opt;
    });

    function detailFor(value) {
      const opt = optionMap[value] || optionMap['__all'] || null;
      if (!opt) return { value };
      return {
        value,
        label: opt.label,
        start: opt.start,
        end: opt.end,
        isYTD: opt.isYTD || false,
      };
    }

    function dispatch(value) {
      document.dispatchEvent(new CustomEvent('yearChange', { detail: detailFor(value) }));
    }

    function setAll(value, skipStore = false) {
      selects.forEach(sel => {
        if (sel.value !== value) sel.value = value;
      });
      if (!skipStore) {
        try {
          if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, value);
        } catch (err) {
          console.warn('[year-selector] unable to store selection', err);
        }
      }
      dispatch(value);
    }

    let stored = null;
    try {
      stored = window.localStorage ? window.localStorage.getItem(STORAGE_KEY) : null;
    } catch (err) {
      stored = null;
    }
    const defaultValue = primary.dataset.defaultValue || '__all';
    const initial = (stored && (stored in optionMap || stored === '__all')) ? stored : defaultValue;
    setAll(initial, true);

    selects.forEach(sel => {
      sel.addEventListener('change', () => setAll(sel.value));
    });
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
