/**
 * static/js/infinite.js
 * Initialise Metafizzy InfiniteScroll on the #timeline element.
 * Assumes infinite-scroll.pkgd.min.js has already been loaded in footer.html
 */
function dedupeHeaders() {
  const items = document.querySelectorAll('#timeline .tl-item');
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

document.addEventListener("DOMContentLoaded", () => {

  const timeline = document.querySelector("#timeline");
  if (!timeline) return;

  if (typeof InfiniteScroll !== "function") {
    console.error("InfiniteScroll library missing");
    return;
  }

  const inf = new InfiniteScroll(timeline, {
    path: '.pagination__next',
    append: '.tl-item',            // append only the items, not navs
    history: false,
    scrollThreshold: 400,
    debug: true,                   // logs events for debugging
  });

  // Remove the initial "Next" navigation link
  timeline.querySelectorAll('nav.tr').forEach(nav => nav.remove());

  dedupeHeaders();

  // Remove the initial "Next" navigation link and dedupe headers on append
  inf.on('append', (body, newItems) => {
    // Remove any pagination navs
    document.querySelectorAll('#timeline nav.tr').forEach(n => n.remove());
    // Re-run dedupe on entire timeline
    dedupeHeaders();
  });
});
