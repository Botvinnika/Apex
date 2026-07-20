/* ============================================================
   APEX SPORTS ANALYTICS — Theme Manager
   Reads the saved theme, falls back to system preference, and
   exposes toggle() for the navbar button.
   ============================================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'apex-theme';
  const VALID = ['dark', 'light'];

  function preferredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && VALID.includes(saved)) return saved;
    } catch (e) { /* storage unavailable — fall through */ }
    if (window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }

  function applyTheme(theme) {
    if (!VALID.includes(theme)) theme = 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (document.body) document.body.setAttribute('data-theme', theme);

    // Keep every frame and iframe in sync
    document.querySelectorAll('iframe').forEach(f => {
      try { f.contentDocument && f.contentDocument.documentElement
              .setAttribute('data-theme', theme); } catch (e) {}
    });

    // Notify the rest of the app
    document.dispatchEvent(new CustomEvent('themechange', {
      detail: { theme: theme }
    }));
  }

  // A short-lived `.theme-switching` class on <html> widens the
  // CSS transition for the duration of the cross-fade so every
  // element retints together instead of a pop-cut. We use a class
  // (not inline transition overrides) so the cascade still wins
  // and so reduced-motion overrides in CSS keep working.
  const FADE_MS = 500;
  let fadeTimer = null;
  function applyThemeWithFade(theme) {
    if (!VALID.includes(theme)) theme = 'dark';
    const sameTheme = document.documentElement.getAttribute('data-theme') === theme;
    if (sameTheme) { applyTheme(theme); return; }

    if (fadeTimer) clearTimeout(fadeTimer);
    const html = document.documentElement;
    html.classList.add('theme-switching');
    applyTheme(theme);
    fadeTimer = setTimeout(() => {
      html.classList.remove('theme-switching');
      fadeTimer = null;
    }, FADE_MS);
  }

  function setTheme(theme, persist) {
    applyThemeWithFade(theme);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (e) {}
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    setTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  // Apply early so the first paint is already correct (no flash).
  applyTheme(preferredTheme());

  // Once <body> is in the DOM, copy the data-theme onto it so
  // light/dark-only body selectors (`:root[data-theme="light"] body`)
  // and any theme-aware JS that reads `body.dataset.theme` work.
  if (document.body) {
    document.body.setAttribute('data-theme',
      document.documentElement.getAttribute('data-theme') || 'dark');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.setAttribute('data-theme',
        document.documentElement.getAttribute('data-theme') || 'dark');
    }, { once: true });
  }

  // React to OS changes only if the user hasn't explicitly chosen a theme.
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e) => {
      try {
        if (localStorage.getItem(STORAGE_KEY)) return;
      } catch (err) { return; }
      applyTheme(e.matches ? 'light' : 'dark');
    };
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else if (mq.addListener) mq.addListener(handler);
  }

  // Expose for the toggle button
  window.ApexTheme = {
    toggle: toggleTheme,
    set:    function (t) { setTheme(t, true); },
    get:    function ()  { return document.documentElement.getAttribute('data-theme') || 'dark'; }
  };
})();
