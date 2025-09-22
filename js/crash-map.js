(function () {

  const MAPBOX_TOKEN = window.MAPBOX_TOKEN || '';
  if (!MAPBOX_TOKEN) {
    console.error('Missing Mapbox token');
    return;
  }
  const HEAT_DATA = (() => {
    const el = document.getElementById('heatmap-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  })();
  const POPUP_DATA = (() => {
    const el = document.getElementById('heatmap-popup-data');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch { return null; }
  })();
  console.log('[crash‑map] script loaded; MAPBOX_TOKEN present:', !!MAPBOX_TOKEN);

  // ----------------------------------------------------------------------------
  // Wait until the Mapbox GL JS library has attached `window.mapboxgl`
  // (network hiccups or CSP blocks can delay the script execution).
  // ----------------------------------------------------------------------------
  function whenMapboxReady(cb, tries = 0) {
    if (window.mapboxgl && typeof window.mapboxgl.Map === 'function') {
      console.log('[crash‑map] mapboxgl detected after', tries, 'checks');
      cb(window.mapboxgl);
    } else if (tries < 40) {          // wait up to ~2 s (40 × 50 ms)
      setTimeout(() => whenMapboxReady(cb, tries + 1), 50);
    } else {
      console.error('Mapbox GL JS failed to load');
    }
  }

  // ----------------------------------------------------------------------------
  // Wait for both DOM and Mapbox GL JS to be ready, then run init()
  // ----------------------------------------------------------------------------
  function whenDomReady(cb) {
    if (document.readyState !== 'loading') cb();
    else document.addEventListener('DOMContentLoaded', cb, { once: true });
  }

  // From here down, the code stays the same, but
  // we delete the earlier `if (!mapboxgl)` guard

  const GEO_CFG = {
    borough:  {prop: 'BoroName'},
    council:  {prop: 'CounDist'},
    community:{prop: 'BoroCD'},
    precinct: {prop: 'Precinct'},
    nta:      {prop: 'NTA2020'},
    assembly: {prop: 'District'},
    senate:   {prop: 'DISTRICT'},
  };

  // Wait for DOM and Mapbox GL JS only after the constants above are in scope
  whenDomReady(() => whenMapboxReady(init));

  function init(){
    console.log('[crash‑map] init() starting');
    window.mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapEl = document.getElementById('crash-map');
    if(!mapEl) return;
    const geoType = mapEl.dataset.geoType || null;
    const geoId   = mapEl.dataset.geoId || null;
    const heatRegion = (geoType && GEO_CFG[geoType]) ? geoType : 'council';
    const initCenter = mapEl.dataset.mapCenter
        ? mapEl.dataset.mapCenter.split(',').map(Number)
        : [-73.94, 40.70];
    const initZoom = mapEl.dataset.mapZoom
        ? parseFloat(mapEl.dataset.mapZoom)
        : 9;
    const initBbox = mapEl.dataset.mapBbox
        ? mapEl.dataset.mapBbox.split(',').map(Number)
        : null;

    // Disable anonymous usage telemetry to avoid blocked POST requests to events.mapbox.com
    if (typeof window.mapboxgl.setTelemetryEnabled === 'function') {
      window.mapboxgl.setTelemetryEnabled(false);
    }

    const selectorEl = document.querySelector('.year-selector');
    let yearOptions = [];
    if (selectorEl && selectorEl.dataset && selectorEl.dataset.options) {
      try { yearOptions = JSON.parse(selectorEl.dataset.options); }
      catch (err) { console.warn('[crash-map] failed to parse year selector options', err); }
    }
    const yearOptionMap = {};
    yearOptions.forEach(opt => { if (opt && opt.value) yearOptionMap[opt.value] = opt; });
    const storageKey = 'crashYearFilter';
    const mapAsOf = mapEl.dataset.asOf || null;
    const aggregateOption = yearOptionMap['__all'] || yearOptions[0] || { start: '2022-01-01', end: mapAsOf };

    function rangeFor(key) {
      const opt = yearOptionMap[key];
      if (opt) {
        return {
          start: opt.start || aggregateOption.start || '2022-01-01',
          end: opt.end || aggregateOption.end || mapAsOf || null,
        };
      }
      return {
        start: aggregateOption.start || '2022-01-01',
        end: aggregateOption.end || mapAsOf || null,
      };
    }

    let storedYearKey = null;
    try {
      storedYearKey = window.localStorage ? window.localStorage.getItem(storageKey) : null;
    } catch (err) {
      storedYearKey = null;
    }
    let currentYearKey = (storedYearKey && (storedYearKey in yearOptionMap || storedYearKey === '__all')) ? storedYearKey : '__all';
    if (!yearOptionMap[currentYearKey] && currentYearKey !== '__all') currentYearKey = '__all';
    let currentRange = rangeFor(currentYearKey);

    let storedSeverity = null;
    try {
      storedSeverity = window.localStorage ? window.localStorage.getItem('severityLevel') : null;
    } catch (err) {
      storedSeverity = null;
    }
    let currentSeverity = storedSeverity || 'total';

    let popup = null;

    const map = new window.mapboxgl.Map({
      container: 'crash-map',
      style: 'mapbox://styles/crashcount/cmc834ov801cr01rxfmrg0rhv?fresh=true',
      center: initCenter,
      zoom: initZoom,
      cooperativeGestures: true
    });
    console.log('[crash‑map] map object created', map);

    map.on('load', () => {
      console.log('[crash‑map] map load event fired');
      map.addSource('incidents', {
        type: 'vector',
        url: 'mapbox://crashcount.incidents'
      });
      console.log('[crash‑map] incidents source added');
      map.addLayer({
        id: 'incidents',
        type: 'circle',
        source: 'incidents',
        'source-layer': 'incidents',
        minzoom: 11,
        paint: {
          // radius grows with severity
          'circle-radius': [
            'step',
            ['get', 'severity'],
            3,   // severity 1‑3
            4, 4, // ≥4
            5, 6  // =5
          ],
          // color by severity
          'circle-color': [
            'step',
            ['get', 'severity'],
            '#666', // 1‑3  → grey
            4, '#ff9800', // 4  → orange
            5, '#ff1744'  // 5  → red
          ]
        },
        layout: {
          visibility: 'visible',
          'circle-sort-key': ['get', 'severity']   // draw higher‑severity crashes last
        }
      });

      map.addLayer({
        id: 'incidents-hi',
        type: 'circle',
        source: 'incidents',
        'source-layer': 'incidents',
        minzoom: 10,
        maxzoom: 11,
        filter: ['>=', ['to-number', ['get', 'severity']], 4],
        layout: {
          'circle-sort-key': ['get', 'severity']
        },
        paint: {
          'circle-radius': [
            'step',
            ['get', 'severity'],
            4,   // sev 4
            5, 6 // sev 5
          ],
          'circle-color': [
            'step',
            ['get', 'severity'],
            '#ff9800', // 4
            5, '#ff1744'
          ],
          'circle-opacity': 0.85
        }
      });

      // -----------------------------------------------------------------------
      // Popup on incident hover
      // -----------------------------------------------------------------------
      const incPopup = new window.mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '280px'
      });

      ['incidents', 'incidents-hi'].forEach(layer => {
        map.on('mouseenter', layer, e => {
          map.getCanvas().style.cursor = 'pointer';
          if (!e.features.length) return;
          const props = e.features[0].properties || {};

          const title   = props.title   || 'Traffic Collision';
          const summary = props.summary || '';
          const dateStr = props.crash_date
            ? new Date(props.crash_date).toLocaleDateString(undefined,
                {year:'numeric', month:'short', day:'numeric'})
            : '';

          const html = `
            <div style="font-size:12px;line-height:1.4;max-width:260px">
              <strong>${dateStr} — ${title}</strong><br>${summary}
            </div>`;
          incPopup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = '';
          incPopup.remove();
        });
      });

      // -----------------------------------------------------------------------
      // Severity filter (hooked to severity-selector.js)
      // -----------------------------------------------------------------------
      const severityFilters = {
        total:  true,                                    // no filter
        serious_injuries: ['>=', ['to-number', ['get', 'severity']], 4],
        deaths: ['==', ['to-number', ['get', 'severity']], 5]
      };

      function buildDateConditions(range) {
        const conditions = [];
        const start = (range && range.start) ? range.start : (aggregateOption.start || '2022-01-01');
        const end = range && range.end ? range.end : null;
        const safeStart = start || '2022-01-01';
        conditions.push(['>=', ['get', 'crash_date'], safeStart]);
        if (end) conditions.push(['<=', ['get', 'crash_date'], end]);
        return conditions;
      }

      function applySeverity(level){
        currentSeverity = level || 'total';
        const sev = severityFilters[currentSeverity] || true;
        const dateConditions = buildDateConditions(currentRange);
        let filter;
        if (sev === true) {
          filter = dateConditions.length === 1
            ? dateConditions[0]
            : ['all'].concat(dateConditions);
        } else {
          filter = ['all'].concat(dateConditions, [sev]);
        }
        ['incidents', 'incidents-hi'].forEach(layerId => {
          if (map.getLayer(layerId)) map.setFilter(layerId, filter);
        });
      }

      // ---- DEBUG ------------------------------------------------------------
      console.log("[crash‑map] geoType, geoId:", geoType, geoId);

      let clipGeom = null;    // geometry of the selected district for clipping

      map.once('idle', () => {
        const src = map.getSource('incidents');
        if (src && src.vectorLayers) {
          console.log("[crash‑map] incidents vector layers:", src.vectorLayers);
        }
        const featCount = map.querySourceFeatures('incidents', { sourceLayer: 'incidents' }).length;
        console.log(`[crash‑map] incidents features in view: ${featCount}`);
      });
      // -----------------------------------------------------------------------

      // If this page is scoped to a single geoType (e.g. "council"),
      // show only that boundary layer; others start hidden.
      // Default to showing City Council districts when no specific geo type is requested
      const visibleGeoType = (geoType && GEO_CFG[geoType]) ? geoType : 'council';

      Object.keys(GEO_CFG).forEach(layer => {
        map.addSource(layer, { type: 'vector', url: `mapbox://crashcount.${layer}` });
        map.addLayer({
          id: layer,
          type: 'line',
          source: layer,
          'source-layer': layer,
          paint: { 'line-color': '#000', 'line-width': 3 },
          layout: { visibility: (visibleGeoType && layer !== visibleGeoType) ? 'none' : 'visible' }
        });
      });
      if (HEAT_DATA) {
        map.addLayer({
          id: heatRegion + '-fill',
          type: 'fill',
          source: heatRegion,
          'source-layer': heatRegion,
          maxzoom: 10,
          paint: { 'fill-opacity': 0.7, 'fill-color': '#cccccc' }
        });
        map.addLayer({
          id: heatRegion + '-line',
          type: 'line',
          source: heatRegion,
          'source-layer': heatRegion,
          maxzoom: 10,
          paint: { 'line-color': '#777', 'line-width': 1 }
        });
        function applyHeatColors(){
          const keys = Object.keys(HEAT_DATA || {});
          if (!keys.length) return;
          const vals = keys.map(k => {
            const yearly = HEAT_DATA[k] || {};
            if (currentYearKey && currentYearKey !== '__all') {
              const slice = yearly[currentYearKey] || {};
              return (slice.moderate_injuries || 0) + (slice.serious_injuries || 0) + (slice.total_deaths || 0);
            }
            return Object.values(yearly).reduce((sum, v) => sum +
              (v.moderate_injuries || 0) + (v.serious_injuries || 0) + (v.total_deaths || 0), 0);
          });
          if (vals.every(v => v === 0)) return;
          const sorted = vals.slice().sort((a, b) => a - b);
          const q = p => sorted[Math.floor(p * sorted.length)];
          const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
          const expr = ['match', ['downcase', ['to-string', ['get', GEO_CFG[heatRegion].prop]]]];
          keys.forEach((k, i) => {
            const v = vals[i];
            let col = '#cccccc';
            if (v > 0) {
              if (v >= q3) col = '#cc0000';
              else if (v >= q2) col = '#ff1a1a';
              else if (v >= q1) col = '#ff6666';
              else col = '#ffb3b3';
            }
            expr.push(k.toLowerCase(), col);
          });
          expr.push('#cccccc');
          map.setPaintProperty(heatRegion + '-fill', 'fill-color', expr);
        }
        applyHeatColors();

        function statsForEntry(entry) {
          if (!entry) return { crashes: 0, injuries: 0, moderate: 0, serious: 0, deaths: 0 };
          if (currentYearKey && currentYearKey !== '__all') {
            const yearlyMap = entry.yearly || {};
            const slice = yearlyMap[currentYearKey] || {};
            return {
              crashes: slice.total_crashes || 0,
              injuries: slice.total_injuries || 0,
              moderate: slice.moderate_injuries || 0,
              serious: slice.serious_injuries || 0,
              deaths: slice.total_deaths || 0,
            };
          }
          const aggregate = entry.aggregate || {};
          if (aggregate && Object.keys(aggregate).length) {
            return {
              crashes: aggregate.total_crashes || 0,
              injuries: aggregate.total_injuries || 0,
              moderate: aggregate.moderate_injuries || 0,
              serious: aggregate.serious_injuries || 0,
              deaths: aggregate.total_deaths || 0,
            };
          }
          const yearlyMap = entry.yearly || {};
          return Object.keys(yearlyMap).reduce((acc, key) => {
            const slice = yearlyMap[key] || {};
            acc.crashes += slice.total_crashes || 0;
            acc.injuries += slice.total_injuries || 0;
            acc.moderate += slice.moderate_injuries || 0;
            acc.serious += slice.serious_injuries || 0;
            acc.deaths += slice.total_deaths || 0;
            return acc;
          }, { crashes: 0, injuries: 0, moderate: 0, serious: 0, deaths: 0 });
        }
        map.on('click', heatRegion+'-fill', e => {
          if(e.features && e.features[0]){
            const raw = String(e.features[0].properties[GEO_CFG[heatRegion].prop]);
            const slug = raw
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            const root = {
              borough: 'borough',
              council: 'council-district',
              community: 'community-board',
              precinct: 'police-precinct',
              nta: 'neighborhood',
              assembly: 'assembly-district',
              senate: 'senate-district',
            }[heatRegion] || heatRegion;
            window.location.href = `/${root}/${slug}/`;
          }
        });
        if(POPUP_DATA){
          popup = new window.mapboxgl.Popup({closeButton:false,closeOnClick:false});
          map.on('mousemove', heatRegion+'-fill', e => {
            map.getCanvas().style.cursor = 'pointer';
            if (!e.features.length) return;
            const id = String(
              e.features[0].properties[GEO_CFG[heatRegion].prop]
            ).toLowerCase();
            const entry = POPUP_DATA[id] || {};
            const stats = statsForEntry(entry);

            // Strip any leading/trailing quotes that have crept into titles
            const cleanName = (entry.name || id).replace(/^"+|"+$/g, '');
            const cleanRep  = entry.rep ? entry.rep.replace(/^"+|"+$/g, '') : '';

            const repLine = cleanRep
              ? `<span style="font-size:11px;color:#333;">${cleanRep}</span><br>`
              : '';

            popup.setHTML(`
              <div style="font-size:12px;line-height:1.35">
                <strong>${cleanName}</strong><br>${repLine}
                Crashes:&nbsp;${stats.crashes.toLocaleString()}<br>
                Injuries:&nbsp;${stats.injuries.toLocaleString()}<br>
                Moderate:&nbsp;${stats.moderate.toLocaleString()}<br>
                Serious:&nbsp;${stats.serious.toLocaleString()}<br>
                Deaths:&nbsp;${stats.deaths.toLocaleString()}
              </div>`).setLngLat(e.lngLat).addTo(map);
          });
          map.on('mouseleave', heatRegion+'-fill', () => { map.getCanvas().style.cursor=''; popup.remove(); });
        }
      }
      function zoomToFeature(e){
        if(!e.features || !e.features.length) return;

        // Zoom to bounds of the clicked geometry
        const geom = e.features[0].geometry;
        if(typeof turf !== "undefined"){
          const b = turf.bbox(geom);
          map.fitBounds([[b[0],b[1]],[b[2],b[3]]], {padding:20});
        }

        // Ensure incidents remain visible
        map.setLayoutProperty("incidents","visibility","visible");
      }
      Object.keys(GEO_CFG).forEach(id => map.on("click", id, zoomToFeature));

      const initial = currentSeverity;

      if (geoType && GEO_CFG[geoType]) {
        const prop = GEO_CFG[geoType].prop;
        const val  = isNaN(+geoId) ? geoId : +geoId;
        const filter = ['==', ['get', prop], val];
        map.setFilter(geoType, filter);

        map.once('idle', () => {
          // Retrieve *all* matching features from the vector source so we
          // capture geometry that may start outside the initial viewport.
          const feats = map.querySourceFeatures(geoType, {
            sourceLayer: geoType,
            filter
          });

          if (feats.length) {
            applySeverity(initial);

            // Build a FeatureCollection and take a bbox around every part
            // of the geometry, not just the first feature.
            if (typeof turf !== 'undefined') {
              const collection = { type: 'FeatureCollection', features: feats };
              const b = turf.bbox(collection);
              map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 20 });
            }
          } else if (initBbox) {
            map.fitBounds(
              [[initBbox[0], initBbox[1]], [initBbox[2], initBbox[3]]],
              { padding: 20 }
            );
            applySeverity(initial);
          }
        });
      } else {
        // no specific geography → just severity filter globally
        applySeverity(initial);
      }

      // Make sure incidents layer stays on top of boundaries
      map.moveLayer('incidents');
      map.moveLayer('incidents-hi');
      document.addEventListener('severityChange', e => {
        const level = e.detail || 'total';
        currentSeverity = level;
        applySeverity(level);
      });
      document.addEventListener('yearChange', e => {
        const detail = e.detail || {};
        const key = detail.value || '__all';
        const range = {
          start: detail.start || rangeFor(key).start,
          end: detail.end || rangeFor(key).end,
        };
        currentYearKey = key;
        currentRange = range;
        try {
          if (window.localStorage) window.localStorage.setItem(storageKey, key);
        } catch (err) {}
        applySeverity(currentSeverity);
        applyHeatColors();
        if (popup && typeof popup.remove === 'function') popup.remove();
      });
      console.log('[crash‑map] load handler complete');
    });
    map.on('error', e => console.error('[crash‑map] mapbox error:', e.error || e));
  }

})();
