(function () {

  const MAPBOX_TOKEN = window.MAPBOX_TOKEN || '';
  if (!MAPBOX_TOKEN) {
    console.error('Missing Mapbox token');
    return;
  }
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

  whenDomReady(() => whenMapboxReady(init));

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

  function init(){
    console.log('[crash‑map] init() starting');
    window.mapboxgl.accessToken = MAPBOX_TOKEN;

    const mapEl = document.getElementById('crash-map');
    if(!mapEl) return;
    const geoType = mapEl.dataset.geoType || null;
    const geoId   = mapEl.dataset.geoId || null;

    // Disable anonymous usage telemetry to avoid blocked POST requests to events.mapbox.com
    if (typeof window.mapboxgl.setTelemetryEnabled === 'function') {
      window.mapboxgl.setTelemetryEnabled(false);
    }

    const map = new window.mapboxgl.Map({
      container: 'crash-map',
      style: 'mapbox://styles/crashcount/cmc834ov801cr01rxfmrg0rhv?fresh=true',
      center: [-73.94,40.70],
      zoom: 9
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
          ],
          'circle-opacity': 0.85
        },
        layout: { visibility: 'visible' }
      });



      // ---- DEBUG ------------------------------------------------------------
      console.log("[crash‑map] geoType, geoId:", geoType, geoId);

      const severityFilters = {
        total: true,
        serious_injuries: ['>=', ['get', 'severity'], 4],
        deaths: ['==', ['get', 'severity'], 5],
      };
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
      const visibleGeoType = geoType && GEO_CFG[geoType] ? geoType : null;

      function applySeverity(level) {
        const sev = severityFilters[level] || true;
        map.setFilter('incidents', sev === true ? null : sev);
      }

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
      function zoomToFeature(e){
        if(!e.features || !e.features.length) return;
        const clickedLayer = e.features[0].layer.id;

        // Thin all boundary layers, then thicken the clicked one
        Object.keys(GEO_CFG).forEach(l =>
          map.setPaintProperty(l, 'line-width', l === clickedLayer ? 4 : 3)
        );

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


      const initial = localStorage.getItem('severityLevel') || 'total';

      if (geoType && GEO_CFG[geoType]) {
        const prop = GEO_CFG[geoType].prop;
        const val  = isNaN(+geoId) ? geoId : +geoId;
        const filter = ['==', ['get', prop], val];
        map.setFilter(geoType, filter);

        map.once('idle', () => {
          const feats = map.queryRenderedFeatures({
            layers: [geoType],
            filter
          });
          if (feats.length) {
            applySeverity(initial);   // show all incidents, just filtered by severity

            // fit map to district bounds
            if (typeof turf !== 'undefined') {
              const b = turf.bbox(feats[0]);
              map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 20 });
            }
          }
        });
      } else {
        // no specific geography → just severity filter globally
        applySeverity(initial);
      }

      // Make sure incidents layer stays on top of boundaries
      map.moveLayer('incidents');
      document.addEventListener('severityChange', e => applySeverity(e.detail));
      console.log('[crash‑map] load handler complete');
    });
    map.on('error', e => console.error('[crash‑map] mapbox error:', e.error || e));
  }

})();
