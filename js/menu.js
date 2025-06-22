// desktop-menu.js  – adds a small delay before hiding top‑nav sub‑menus
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.relative').forEach(parent => {
    const menu = parent.querySelector('.child-menu');
    if (!menu) return;

    let hideTimer;

    function show() {
      clearTimeout(hideTimer);
      menu.style.display = 'block';
    }
    function hide() {
      hideTimer = setTimeout(() => (menu.style.display = 'none'), 200);
    }

    parent.addEventListener('mouseenter', show);
    parent.addEventListener('mouseleave', hide);
    menu.addEventListener('mouseenter', show);
    menu.addEventListener('mouseleave', hide);
  });

  /* ---------- Mobile hamburger toggle ---------- */
  const menuToggle   = document.getElementById('menuToggle');
  const mobileMenu   = document.getElementById('mobileMenu');
  const hamburgerIcon= document.getElementById('hamburgerIcon');
  const closeIcon    = document.getElementById('closeIcon');

  if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', ()=> {
      const isOpen = mobileMenu.classList.toggle('dn');  // toggles display:none
      // switch icons
      hamburgerIcon.classList.toggle('dn', !isOpen);
      closeIcon.classList.toggle('dn', isOpen);
    });

    /* close menu after any mobile‑menu link click */
    mobileMenu.querySelectorAll('a').forEach(a=>{
      a.addEventListener('click', ()=> {
        mobileMenu.classList.add('dn');
        hamburgerIcon.classList.remove('dn');
        closeIcon.classList.add('dn');
      });
    });
  }
});