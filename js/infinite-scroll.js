document.addEventListener("DOMContentLoaded", function() {
    // Select all containers marked for infinite scroll
    const scrollContainers = document.querySelectorAll('[data-infinite-scroll="true"]');
  
    scrollContainers.forEach(container => {
      let currentPage = 1;
      const totalPages = parseInt(container.getAttribute('data-total'));
      if (totalPages <= 1) return;
  
      const trigger = document.getElementById('infiniteScrollTrigger');
      if (!trigger) return; // or dynamically create one if you prefer
  
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && currentPage < totalPages) {
            obs.unobserve(trigger);
            loadNextPage();
          }
        });
      }, { rootMargin: '200px' });
  
      observer.observe(trigger);
  
      function loadNextPage() {
        currentPage++;
        let baseURL = container.getAttribute('data-baseurl');
        if (!baseURL.endsWith('/')) baseURL += '/';
        let nextURL = baseURL + 'page/' + currentPage + '/';
  
        fetch(nextURL)
          .then(res => {
            if (!res.ok) {
              observer.disconnect();
              return null;
            }
            return res.text();
          })
          .then(html => {
            if (!html) return;
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            // If you always output items as <article> elements:
            const newItems = doc.querySelectorAll('[data-infinite-scroll="true"] > article');
            if (newItems.length === 0) {
              observer.disconnect();
              return;
            }
            newItems.forEach(item => container.appendChild(item));
            if (currentPage < totalPages) {
              observer.observe(trigger);
            } else {
              observer.disconnect();
            }
          })
          .catch(err => console.error('Error loading next page:', err));
      }
    });
  });
  