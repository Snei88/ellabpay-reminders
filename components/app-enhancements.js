// components/app-enhancements.js
(function(){
  const btn = document.querySelector('#darkModeToggle');
  const KEY = 'ellabpay_theme';

  function applyThemeFromStorage() {
    const mode = localStorage.getItem(KEY);
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(KEY, 'light');
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem(KEY, 'dark');
    }
  }

  function syncIcon() {
    const isDark = document.documentElement.classList.contains('dark');
    const span = btn?.querySelector('.material-symbols-outlined');
    if (span) span.textContent = isDark ? 'light_mode' : 'dark_mode';
  }

  // Inicial
  applyThemeFromStorage();
  syncIcon();

  // Click
  if (btn) {
    btn.addEventListener('click', () => {
      toggleTheme();
      syncIcon();
    });
  }

  // Si cambia en otra pestaña/ventana (o lo forzamos con el dispatch anterior), aplicar aquí
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      applyThemeFromStorage();
      syncIcon();
    }
  });
})();
