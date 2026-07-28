/* ============================================================
   APEX SPORTS — Icon Sprite Loader
   Fetches assets/icons.svg and inlines its <symbol> definitions
   into the page so <use href="#i-name"/> works everywhere.

   The sprite is fetched once per page (cached by browser). If the
   fetch fails (offline, file://), icons degrade gracefully — the
   <svg><use/></svg> renders as a 0-size element.

   Add to any page with: <script src="apex-icons.js" defer></script>
   ============================================================ */
(function () {
  'use strict';

  const SPRITE_URL = 'assets/icons.svg';

  function inject(svgText) {
    // Parse out <symbol> elements and re-wrap them in a hidden <svg>
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.documentElement;
    if (!svg || svg.nodeName !== 'svg') return;
    // Hide the sprite SVG (it's a defs container)
    svg.style.display = 'none';
    svg.setAttribute('aria-hidden', 'true');
    svg.id = 'apex-icon-sprite';
    // Move into the body so use href="#i-name" resolves
    document.body.insertBefore(svg, document.body.firstChild);
  }

  function load() {
    fetch(SPRITE_URL, { cache: 'force-cache' })
      .then(r => r.ok ? r.text() : Promise.reject(r.status))
      .then(inject)
      .catch(() => { /* silent — icons fall back to existing emoji/text */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
