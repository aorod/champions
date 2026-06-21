const PageLoader = (() => {
  const MIN_MS = 500;
  const start  = Date.now();

  function done() {
    const el = document.getElementById('page-loader');
    if (!el) return;
    const delay = Math.max(0, MIN_MS - (Date.now() - start));
    setTimeout(() => {
      el.classList.add('loader--out');
      el.addEventListener('transitionend', () => el.remove(), { once: true });
    }, delay);
  }

  return { done };
})();
