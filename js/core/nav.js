const NavMobile = (() => {
  function init() {
    const btn = document.getElementById('navHamburger');
    const nav = document.querySelector('.nav');
    if (!btn || !nav) return;

    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('nav--open');
      btn.setAttribute('aria-expanded', String(open));
    });

    document.querySelectorAll('.nav__mobile-link').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('nav--open'));
    });

    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target)) nav.classList.remove('nav--open');
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', NavMobile.init);
