// Runs before DOM paint to prevent flash of wrong theme
(function () {
  var stored = localStorage.getItem('champions-theme');
  var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', stored || system);
})();

function initThemeToggle() {
  var btn = document.getElementById('themeToggle');
  if (!btn) return;

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('champions-theme', theme);
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('aria-label', theme === 'dark' ? 'Modo claro' : 'Modo escuro');
  }

  btn.addEventListener('click', function () {
    var current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // Set initial icon
  var current = document.documentElement.getAttribute('data-theme');
  btn.textContent = current === 'dark' ? '☀️' : '🌙';
  btn.setAttribute('aria-label', current === 'dark' ? 'Modo claro' : 'Modo escuro');
}

document.addEventListener('DOMContentLoaded', initThemeToggle);
