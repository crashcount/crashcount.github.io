document.addEventListener("DOMContentLoaded", function() {
  const container = document.querySelector('[data-infinite-scroll="true"]');
  let currentPage = 1;
  const totalPages = parseInt(container.getAttribute('data-total'));
  const trigger = document.getElementById('infiniteScrollTrigger');
  let loading = false;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && currentPage < totalPages && !loading) {
        loading = true;
        loadNextPage().then(() => {
          loading = false;
          if (currentPage >= totalPages) obs.disconnect();
        });
      }
    });
  }, { rootMargin: '70px' });

  observer.observe(trigger);

  function loadNextPage() {
    currentPage++;
    let baseURL = container.getAttribute('data-baseurl');
    if (!baseURL.endsWith('/')) baseURL += '/';
    const nextURL = `${baseURL}page/${currentPage}/`;

    return fetch(nextURL)
      .then(res => res.ok ? res.text() : Promise.reject('No more pages'))
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newItems = doc.querySelectorAll('[data-infinite-scroll="true"] > article');
        
        if (newItems.length === 0) {
          observer.disconnect();
          return;
        }

        newItems.forEach(item => container.appendChild(item));

        // Move the trigger to always stay at the bottom
        container.insertAdjacentElement('afterend', trigger);
      })
      .catch(err => {
        console.log('All pages loaded or error:', err);
        observer.disconnect();
      });
  }
});
