/*  Find My Neighborhood – client‑side logic
    Requires Turf.js to be loaded globally BEFORE this script:
    <script src="https://unpkg.com/@turf/turf@6.5.0/turf.min.js"></script>
*/

(() => {
  console.log('[find.js] script initialised');

  // --- Utility: simple debounce -------------------------------------------
  function debounce(fn, wait = 250) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), wait);
    };
  }

  // Register NYC State‑Plane projection (EPSG:2263 – NAD83/Long Island ftUS)
  // Only once, if proj4 is available
  if (typeof proj4 !== 'undefined' && !proj4.defs['EPSG:2263']) {
    proj4.defs(
      'EPSG:2263',
      '+proj=lcc +lat_1=40.66666666666666 +lat_2=41.03333333333333 ' +
        '+lat_0=40.16666666666666 +lon_0=-74 ' +
        '+x_0=300000 +y_0=0 +ellps=GRS80 +datum=NAD83 +units=ft +no_defs'
    );
    console.log('[find.js] EPSG:2263 projection registered');
  }
  // Ordered list for nicer output
  const DISPLAY_ORDER = [
    'borough',
    'council',
    'community',
    'precinct',
    'nta',
    'assembly',
    'senate'
  ];


  // --- JSON‑P fallback (legacy browsers) ------------------------
  function jsonp(url) {
    return new Promise((resolve, reject) => {
      const cb = `jsonp_cb_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const sep = url.includes('?') ? '&' : '?';
      const script = document.createElement('script');
      script.src = `${url}${sep}callback=${cb}`;
      script.onerror = () => reject(new Error('JSON-P load error'));
      window[cb] = data => {
        resolve(data);
        delete window[cb];
        script.remove();
      };
      document.head.appendChild(script);
    });
  }

  // --- simple fetch wrapper (GeoSearch v2 sends proper CORS headers) ------
  async function fetchGeo(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GeoSearch fetch ${res.status}`);
    return res.json();
  }

  // --- NYC GeoSearch helpers -------------------------------------------------
  // 1) high‑precision search when user hits <Enter> or chooses a suggestion
  async function geocodeSearch(query) {
    const url =
      `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(
        query
      )}&size=1`;
    const { features } = await fetchGeo(url);
    if (!features || !features.length) throw new Error('Address not found');
    const [lon, lat] = features[0].geometry.coordinates;
    return { lat, lon };
  }

  // 2) lightweight autocomplete for type‑ahead (returns <Feature[]>)
  async function geocodeSuggest(query) {
    const url =
      `https://geosearch.planninglabs.nyc/v2/autocomplete?text=${encodeURIComponent(
        query
      )}&size=5`;
    const { features } = await fetchGeo(url);
    return features || [];
  }

  let cachedPolygons = null;

  // State for async suggestion race‑condition avoidance
  let lastSuggestToken = 0;

  async function loadPolygons() {
    if (cachedPolygons) return cachedPolygons;           // reuse after first load
    try {
      const res = await fetch('/data/composite_regions.geojson');
      if (!res.ok) throw new Error(`Failed to fetch geojson: ${res.status}`);
      cachedPolygons = await res.json();
      const featureCount = cachedPolygons && cachedPolygons.features ? cachedPolygons.features.length : 0;
      console.log(
        `[find.js] loaded composite_regions.geojson – ${featureCount} features`
      );
      return cachedPolygons;
    } catch (err) {
      console.error('[find.js] error fetching polygons', err);
      throw err;
    }
  }

  function intersectPoint(pt, geojson) {
    const hits = {};
    let slug = null;
    geojson.features.forEach(f => {
      if (turf.booleanPointInPolygon(pt, f)) {
        if (!slug) slug = f.properties && f.properties.slug; // first match
        const g = f.properties.geo_tags;
        const n = f.properties.name_tags;
        Object.keys(g).forEach(type => {
          if (!hits[type]) hits[type] = { id: g[type], name: n[type] };
        });
      }
    });
    console.log('[find.js] intersect hits', hits, 'slug:', slug);
    return { hits, slug };
  }

  function renderResults(hits) {
    const out = document.getElementById('results');
    if (!out) return;
    if (!Object.keys(hits).length) {
      out.textContent = 'No matching geographies.';
      return;
    }
    out.innerHTML = DISPLAY_ORDER.filter(t => hits[t]).map(t => {
      const h = hits[t];
      // assumes your Hugo URLs follow /<type>/<id>/
      const url = `/${t}/${h.id.toLowerCase()}/`;
      return `<div class="geo-card">
        <h3>${h.name}</h3>
        <p><a href="${url}">View details →</a></p>
      </div>`;
    }).join('');
  }

  async function lookup(e) {
    if (e) e.preventDefault();
    const desktopInput = document.getElementById('searchQuery');
    const mobileInput = document.getElementById('searchQueryMobile');
    // Choose the field the user actually typed into (the one with a non‑empty value)
    const value = (mobileInput && mobileInput.value.trim()) || (desktopInput && desktopInput.value.trim());
    if (!value) return;

    const resultsEl = document.getElementById('results');
    if (resultsEl) resultsEl.textContent = 'Looking up…';

    try {
      const { lat, lon } = await geocodeSearch(value);
      // GeoJSON polygons are still in EPSG:2263 (NY State‑Plane feet)
      const [x, y] =
        typeof proj4 !== 'undefined'
          ? proj4('EPSG:4326', 'EPSG:2263', [lon, lat])
          : [lon, lat];       // fallback if proj4 missing
      const pt = turf.point([x, y]);
      console.log('[find.js] projected point', { x, y });
      const polygons = await loadPolygons();
      const { hits, slug } = intersectPoint(pt, polygons);
      if (slug) {
        const label = encodeURIComponent(value.trim());
        window.location.href = `/find/${slug.toLowerCase()}/?label=${label}`;
        return;                                      // stop here; browser will navigate
      }
      renderResults(hits);
    } catch (err) {
      console.error(err);
      if (resultsEl) resultsEl.textContent = err.message || 'Something went wrong.';
    }
  }

  let _findInited = false;
  function initFind() {
    if (_findInited) return;      // guard against double‑runs
    _findInited = true;
    /*  ✂— begin existing content that was inside DOMContentLoaded —✂ */
    const form = document.getElementById('find-form');
    if (form) form.addEventListener('submit', lookup);
    // Allow pressing Enter in the input
    const input = document.getElementById('searchQuery');
    if (input) input.addEventListener('keydown', e => {
      const isDown = e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40;
      const isEnter = e.key === 'Enter' || e.keyCode === 13;
      if (isEnter) lookup(e);
      if (isDown) {
        const first = suggEl.querySelector('.suggest-item');
        if (first) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Live type‑ahead -------------------------------------------------------
    const suggEl = document.getElementById('suggestions');
    if (suggEl) suggEl.setAttribute('role', 'listbox');
    const showSuggestions = debounce(async q => {
      if (q.length < 2) {
        suggEl.innerHTML = '';
        return;
      }
      const token = ++lastSuggestToken;           // track call order
      try {
        const feats = await geocodeSuggest(q);
        if (token !== lastSuggestToken) return;   // out‑of‑date response
        suggEl.innerHTML = feats
          .map(
            f =>
              `<li data-label="${encodeURIComponent(
                f.properties.label
              )}" class="suggest-item" tabindex="0" role="option">${f.properties.label}</li>`
          )
          .join('');
      } catch {
        suggEl.innerHTML = '';
      }
    }, 120);    // 120 ms debounce

    function selectSuggestion(li, inputEl, listEl, mirrorEl) {
      const value = decodeURIComponent(li.dataset.label);
      inputEl.value = value;
      if (mirrorEl) mirrorEl.value = value; // keep both inputs in sync
      listEl.innerHTML = '';
      lookup();
    }

    if (input) {
      input.addEventListener('input', e => showSuggestions(e.target.value));
      const handleClick = e => {
        const li = e.target.closest('.suggest-item');
        if (!li) return;
        selectSuggestion(li, input, suggEl, mInput); // run full lookup with chosen text
      };
      suggEl.addEventListener('click', handleClick);
      // touchend catches Safari mobile taps
      suggEl.addEventListener('touchend', handleClick);
      // keyboard nav inside suggestions
      suggEl.addEventListener('keydown', e => {
        const item = e.target.closest('.suggest-item');
        if (!item) return;
        const isDown = e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40;
        const isUp   = e.key === 'ArrowUp'   || e.key === 'Up'   || e.keyCode === 38;
        if (isDown) {
          e.preventDefault();
          const nxt = item.nextElementSibling;
          if (nxt) nxt.focus();
        } else if (isUp) {
          e.preventDefault();
          const prv = item.previousElementSibling;
          if (prv) prv.focus();
          else input.focus();          // jump back to the input
        } else if (e.key === 'Enter') {
          e.preventDefault();
          item.click();                // re‑use click handler
        }
      });
    }

    // ── Mobile search wiring ───────────────────────────────────────────────
    const mForm = document.getElementById('find-form-mobile');
    const mInput = document.getElementById('searchQueryMobile');
    const mSugg  = document.getElementById('suggestions-mobile');
    if (mSugg) mSugg.setAttribute('role', 'listbox');

    const showSuggestionsMobile = debounce(async q => {
      if (q.length < 2) { mSugg.innerHTML = ''; return; }
      const token = ++lastSuggestToken;
      try {
        const feats = await geocodeSuggest(q);
        if (token !== lastSuggestToken) return;
        mSugg.innerHTML = feats.map(f =>
          `<li data-label="${encodeURIComponent(f.properties.label)}"
               class="suggest-item" tabindex="0" role="option">${f.properties.label}</li>`).join('');
      } catch { mSugg.innerHTML = ''; }
    }, 120);

    if (mForm) mForm.addEventListener('submit', lookup);
    if (mInput){
      mInput.addEventListener('keydown', e => {
        const isDown = e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40;
        const isEnter = e.key === 'Enter' || e.keyCode === 13;
        if (isEnter) lookup(e);
        if (isDown) {
          const first = mSugg.querySelector('.suggest-item');
          if (first) {
            e.preventDefault();
            first.focus();
          }
        }
      });
      mInput.addEventListener('input',  e => showSuggestionsMobile(e.target.value));
    }
    if (mSugg){
      const handleClickMobile = e => {
        const li = e.target.closest('.suggest-item');
        if (!li) return;
        selectSuggestion(li, mInput, mSugg, input);
      };
      mSugg.addEventListener('click', handleClickMobile);
      // touchend for reliable taps on iOS
      mSugg.addEventListener('touchend', handleClickMobile);
      // keyboard nav for mobile suggestions
      mSugg.addEventListener('keydown', e => {
        const item = e.target.closest('.suggest-item');
        if (!item) return;
        const isDown = e.key === 'ArrowDown' || e.key === 'Down' || e.keyCode === 40;
        const isUp   = e.key === 'ArrowUp'   || e.key === 'Up'   || e.keyCode === 38;
        if (isDown) {
          e.preventDefault();
          const nxt = item.nextElementSibling;
          if (nxt) nxt.focus();
        } else if (isUp) {
          e.preventDefault();
          const prv = item.previousElementSibling;
          if (prv) prv.focus();
          else mInput.focus();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          item.click();
        }
      });
    }
    /*  ✂— end copied content —✂ */
  }

  // Run once when the DOM is ready (covers normal navigations)
  if (document.readyState !== 'loading') initFind();
  document.addEventListener('DOMContentLoaded', initFind);

  // Also run after BFCache restores (Safari/WebKit quirk)
  window.addEventListener('pageshow', initFind, { once: true });
})();