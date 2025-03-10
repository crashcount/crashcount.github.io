document.addEventListener('DOMContentLoaded', function() {
    const toggleBtn = document.getElementById('menuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    const hamburgerIcon = document.getElementById('hamburgerIcon');
    const closeIcon = document.getElementById('closeIcon');
  
    if (toggleBtn && mobileMenu) {
      // Toggle mobile overlay and icon swap on click
      toggleBtn.addEventListener('click', function() {
        mobileMenu.classList.toggle('dn');
        hamburgerIcon.classList.toggle('dn');
        closeIcon.classList.toggle('dn');
      });
      
      // Hide mobile overlay when a menu link is clicked
      mobileMenu.querySelectorAll('a').forEach(function(link) {
        link.addEventListener('click', function() {
          mobileMenu.classList.add('dn');
          hamburgerIcon.classList.remove('dn');
          closeIcon.classList.add('dn');
        });
      });
    }
  });
  