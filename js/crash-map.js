(function(){
  const Maplibre = window.maplibregl || window.mapboxgl;
  if(!Maplibre){
    console.error('Mapbox GL JS or MapLibre GL required');
    return;
  }

  function init(){
    const map = new Maplibre.Map({
      container: 'crash-map',
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-73.94,40.70],
      zoom: 9
    });

    map.on('load', () => {
      map.addSource('incidents', {
        type: 'vector',
        url: 'mbtiles://shared_data/incidents.mbtiles'
      });
      map.addLayer({
        id: 'incidents',
        type: 'circle',
        source: 'incidents',
        'source-layer': 'incidents',
        paint: {
          'circle-radius': 2,
          'circle-color': '#d0021b'
        },
        layout: { visibility: 'none' }
      });

      const severityFilters = {
        total: true,
        serious_injuries: ['>=', ['get', 'injury_severity'], 4],
        deaths: ['==', ['get', 'injury_severity'], 5],
      };

      function applySeverity(level) {
        const f = severityFilters[level] || true;
        map.setFilter('incidents', f === true ? null : f);
      }

      map.addSource('regions', {
        type: 'geojson',
        data: '/data/composite_regions.geojson'
      });
      map.addLayer({
        id: 'council',
        type: 'fill',
        source: 'regions',
        paint: {
          'fill-color': '#088',
          'fill-opacity': 0.1,
          'fill-outline-color': '#044'
        }
      });
      map.addLayer({
        id: 'neighborhood',
        type: 'line',
        source: 'regions',
        paint: {
          'line-color': '#800',
          'line-width': 1
        }
      });
      map.addLayer({
        id: 'composite',
        type: 'line',
        source: 'regions',
        paint: {
          'line-color': '#333',
          'line-width': 2
        }
      });

      function zoomToFeature(e){
        if(!e.features || !e.features.length){ return; }
        const geom = e.features[0].geometry;
        if(typeof turf !== 'undefined'){
          const b = turf.bbox(geom);
          map.fitBounds([[b[0],b[1]],[b[2],b[3]]], { padding:20 });
        }
        ['council','neighborhood','composite'].forEach(l=>{
          map.setLayoutProperty(l,'visibility','none');
        });
        map.setLayoutProperty('incidents','visibility','visible');
      }

      ['council','neighborhood','composite'].forEach(id => {
        map.on('click', id, zoomToFeature);
      });

      const initial = localStorage.getItem('severityLevel') || 'total';
      applySeverity(initial);
      document.addEventListener('severityChange', e => applySeverity(e.detail));
    });
  }

  if(document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
