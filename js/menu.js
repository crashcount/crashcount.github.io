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
});