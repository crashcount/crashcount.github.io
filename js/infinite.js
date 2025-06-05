/**
 * static/js/infinite.js
 * Initialise Metafizzy InfiniteScroll on the #timeline element.
 * Assumes infinite-scroll.pkgd.min.js has already been loaded in footer.html
 */
function dedupeHeaders(container) {
  const items = container.querySelectorAll('.tl-item');
  let prevYear = '';
  let prevMonth = '';

  items.forEach(el => {
    const year = el.getAttribute('data-year');
    const month = el.getAttribute('data-month');

    // --- Year header logic ---
    if (year) {
      if (year === prevYear) {
        // Same year block → strip year on subsequent items
        el.removeAttribute('data-year');
      } else {
        // New year starts → keep year and reset month tracker
        prevYear = year;
        prevMonth = '';
      }
    }

    // --- Month header logic (per current year) ---
    if (month) {
      if (month === prevMonth) {
        el.removeAttribute('data-month');
      } else {
        prevMonth = month;
      }
    }
  });
}

function cleanNavs(container) {
  const navs = container.querySelectorAll('nav.tr');
  navs.forEach((nav, idx) => {
    if (idx < navs.length - 1) nav.remove();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const timeline = document.querySelector("#timeline");
  if (!timeline) return;

  console.log('∞ init: found 1 timeline container in DOM. Using →', timeline.id);

  // Need at least one “Next” link for InfiniteScroll to start
  if (!timeline.querySelector('nav.tr a.pagination__next')) return;
  dedupeHeaders(timeline);

  // Track seen permalinks to avoid duplicate items – scan the entire document,
  // not just the visible timeline, because a hidden mobile/desktop copy may
  // already contain the same events.
  const seenLinks = new Set(
    Array.from(document.querySelectorAll('.tl-item a[href]')).map(a => a.getAttribute('href'))
  );

  if (typeof InfiniteScroll !== "function") {
    console.error("InfiniteScroll library missing");
    return;
  }

  const inf = new InfiniteScroll(timeline, {
    path: 'nav.tr a.pagination__next',   // follow real next‑page link
    append: '.tl-item',
    history: false,
    scrollThreshold: 400,
    debug: true,
  });

  inf.on('request', (path) => {
    console.log('[∞] request →', path);
  });
  inf.on('load', (response, path) => {
    console.log('[∞] load done ←', path);
  });
  inf.on('last', (path) => {
    console.log('[∞] last page detected at', path);
  });
  inf.on('page', (pageIndex, path) => {
    console.log('[∞] page event index=', pageIndex, 'path=', path);
  });

  inf.on('append', (response, path, items) => {
    console.log('[∞] append', items ? items.length : 0, 'items from', path);
    if (Array.isArray(items)) {
      // Remove duplicates before they hit the DOM
      items.forEach(item => {
        const a = item.querySelector('a[href]');
        if (a) {
          const href = a.getAttribute('href');
          if (seenLinks.has(href)) {
            item.remove();              // duplicate → discard
            return;
          }
          seenLinks.add(href);
        }
      });
    }

    // Defer until paint, then hide navs and dedupe headings
    requestAnimationFrame(() => {
      dedupeHeaders(timeline);
      console.log('[∞] timeline now has', timeline.querySelectorAll('.tl-item').length,
                  'items and', timeline.querySelectorAll('nav.tr').length, 'nav(s)');
    });
  });
});
