(function () {
  var STORAGE_KEY = 'gb-theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setStoredTheme(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
    }
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-bs-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-bs-theme', 'light');
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-bs-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggleTheme() {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    setStoredTheme(next);
    return next;
  }

  window.GBTheme = {
    apply: applyTheme,
    toggle: toggleTheme,
    current: currentTheme
  };

  document.addEventListener('DOMContentLoaded', function () {
    var logo = document.getElementById('theme-toggle-logo');
    if (logo) {
      logo.style.cursor = 'pointer';
      logo.title = 'Bấm để chuyển chế độ sáng / tối';
      logo.addEventListener('click', function (e) {
        e.preventDefault();
        toggleTheme();
      });
    }
  });
})();
