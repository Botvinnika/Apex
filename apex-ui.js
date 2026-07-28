/* ============================================================
   APEX UI — shared interaction & data-visualisation layer

   Portable: this file is dropped into both sites unchanged. It
   discovers what it needs from the DOM rather than being
   configured, so a page that lacks a given component simply
   skips it — no errors, no half-initialised state.

   Nothing here is required for the page to work. If this file
   fails to load, every page remains readable and navigable.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Pointer-driven effects (tilt, magnet, spotlight) are meaningless on
  // touch and cost battery, so they are gated on a real hover pointer.
  var FINE = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var ICON = {
    page:   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    hash:   '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
    trophy: '<path d="M6 3h12v5a6 6 0 0 1-12 0z"/><path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M9 21h6M12 14v7"/>',
    bolt:   '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    sun:    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    up:     '<path d="M12 19V5M5 12l7-7 7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'
  };

  function svg(path, cls) {
    return '<svg class="' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
           'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" ' +
           'stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ============================================================
     1 · SCROLL PROGRESS  +  BACK TO TOP
     One scroll listener drives both, rAF-throttled and passive.
     ============================================================ */
  function initScroll() {
    var bar = document.createElement('div');
    bar.className = 'ui-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.innerHTML = '<div class="ui-progress__bar"></div>';
    document.body.appendChild(bar);

    var R = 21, C = 2 * Math.PI * R;
    var top = document.createElement('button');
    top.type = 'button';
    top.className = 'ui-top';
    top.setAttribute('aria-label', 'Back to top');
    top.style.setProperty('--circ', C.toFixed(2));
    top.innerHTML =
      '<svg class="ui-top__ring" viewBox="0 0 46 46" aria-hidden="true">' +
        '<circle class="ui-top__track" cx="23" cy="23" r="' + R + '"/>' +
        '<circle class="ui-top__bar" cx="23" cy="23" r="' + R + '"/>' +
      '</svg>' + svg(ICON.up, 'ui-top__arrow');
    document.body.appendChild(top);

    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
    });

    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
      doc.style.setProperty('--ui-progress', p.toFixed(4));
      top.classList.toggle('is-on', window.scrollY > 480);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
  }

  /* ============================================================
     2 · COMMAND PALETTE (⌘K / Ctrl+K)
     Index is built from the page's own nav plus a small set of
     actions, so it stays correct on any page without config.
     Implements the ARIA combobox pattern.
     ============================================================ */
  function initPalette() {
    var items = buildIndex();
    if (items.length < 2) return;

    var root = document.createElement('div');
    root.className = 'ui-cmdk';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Command palette');
    root.innerHTML =
      '<div class="ui-cmdk__panel">' +
        '<div class="ui-cmdk__search">' +
          svg(ICON.search) +
          '<input class="ui-cmdk__input" type="text" autocomplete="off" spellcheck="false" ' +
                 'placeholder="Search pages, leagues, actions…" ' +
                 'role="combobox" aria-expanded="true" aria-controls="ui-cmdk-list" ' +
                 'aria-autocomplete="list" aria-label="Search">' +
          '<span class="ui-cmdk__esc">ESC</span>' +
        '</div>' +
        '<ul class="ui-cmdk__list" id="ui-cmdk-list" role="listbox" aria-label="Results"></ul>' +
        '<div class="ui-cmdk__foot">' +
          '<span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>' +
          '<span><kbd>↵</kbd> open</span>' +
          '<span><kbd>esc</kbd> close</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(root);

    var input = $('.ui-cmdk__input', root);
    var list  = $('.ui-cmdk__list', root);
    var cur = 0, shown = [], lastFocus = null;

    function score(item, q) {
      // Cheap subsequence match: every query char must appear in order.
      // Contiguous prefix matches rank highest, then word starts.
      var hay = (item.label + ' ' + (item.sub || '')).toLowerCase();
      if (!q) return 1;
      if (hay.indexOf(q) === 0) return 1000;
      var wordStart = hay.indexOf(' ' + q);
      if (wordStart > -1) return 800;
      if (hay.indexOf(q) > -1) return 600;
      var i = 0;
      for (var c = 0; c < q.length; c++) {
        i = hay.indexOf(q[c], i);
        if (i === -1) return 0;
        i++;
      }
      return 200;
    }

    function mark(text, q) {
      if (!q) return esc(text);
      var i = text.toLowerCase().indexOf(q);
      if (i === -1) return esc(text);
      return esc(text.slice(0, i)) + '<b>' + esc(text.slice(i, i + q.length)) +
             '</b>' + esc(text.slice(i + q.length));
    }

    function render() {
      var q = input.value.trim().toLowerCase();
      shown = items
        .map(function (it) { return { it: it, s: score(it, q) }; })
        .filter(function (r) { return r.s > 0; })
        .sort(function (a, b) { return b.s - a.s; })
        .map(function (r) { return r.it; })
        .slice(0, 40);

      if (!shown.length) {
        list.innerHTML = '<li class="ui-cmdk__empty">No matches for “' + esc(input.value) + '”</li>';
        return;
      }
      cur = Math.min(cur, shown.length - 1);

      var html = '', group = null;
      shown.forEach(function (it, i) {
        if (it.group !== group) {
          group = it.group;
          html += '<li class="ui-cmdk__group" role="presentation">' + esc(group) + '</li>';
        }
        html += '<li class="ui-cmdk__item" role="option" id="ui-cmdk-o' + i + '" ' +
                'aria-selected="' + (i === cur) + '" data-i="' + i + '">' +
                  '<span class="ui-cmdk__icon">' + svg(ICON[it.icon] || ICON.page) + '</span>' +
                  '<span class="ui-cmdk__label">' + mark(it.label, q) +
                    (it.sub ? '<span class="ui-cmdk__sub">' + esc(it.sub) + '</span>' : '') +
                  '</span>' +
                  '<span class="ui-cmdk__go">↵</span>' +
                '</li>';
      });
      list.innerHTML = html;
      input.setAttribute('aria-activedescendant', 'ui-cmdk-o' + cur);
    }

    function move(d) {
      if (!shown.length) return;
      cur = (cur + d + shown.length) % shown.length;
      $$('.ui-cmdk__item', list).forEach(function (el) {
        var on = +el.dataset.i === cur;
        el.setAttribute('aria-selected', on);
        if (on) el.scrollIntoView({ block: 'nearest' });
      });
      input.setAttribute('aria-activedescendant', 'ui-cmdk-o' + cur);
    }

    function run(it) {
      close();
      if (!it) return;
      if (it.action) it.action();
      else if (it.href) navigate(it.href);
    }

    function open() {
      lastFocus = document.activeElement;
      root.classList.add('is-open');
      input.value = '';
      cur = 0;
      render();
      // Focus after the transition starts so the caret does not jump.
      requestAnimationFrame(function () { input.focus(); });
      document.body.style.overflow = 'hidden';
    }
    function close() {
      root.classList.remove('is-open');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function isOpen() { return root.classList.contains('is-open'); }

    input.addEventListener('input', function () { cur = 0; render(); });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Home') { e.preventDefault(); cur = 0; move(0); }
      else if (e.key === 'End') { e.preventDefault(); cur = shown.length - 1; move(0); }
      else if (e.key === 'Enter') { e.preventDefault(); run(shown[cur]); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    list.addEventListener('click', function (e) {
      var li = e.target.closest('.ui-cmdk__item');
      if (li) run(shown[+li.dataset.i]);
    });
    list.addEventListener('mousemove', function (e) {
      var li = e.target.closest('.ui-cmdk__item');
      if (li && +li.dataset.i !== cur) { cur = +li.dataset.i; move(0); }
    });

    root.addEventListener('mousedown', function (e) {
      if (e.target === root) close();
    });

    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        isOpen() ? close() : open();
      } else if (e.key === 'Escape' && isOpen()) {
        close();
      }
    });

    // Keep focus inside the dialog while it is open.
    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      input.focus();
    });

    $$('[data-cmdk-open]').forEach(function (b) {
      b.addEventListener('click', open);
    });
    window.ApexPalette = { open: open, close: close, toggle: function () { isOpen() ? close() : open(); } };
  }

  function buildIndex() {
    var out = [], seen = {};

    // Pages — read straight off the site's own nav so this never
    // goes stale when the nav changes.
    $$('.nav__links a, .nav__link, .footer__links a').forEach(function (a) {
      var href = a.getAttribute('href');
      var label = (a.textContent || '').trim();
      if (!href || !label || href.charAt(0) === '#' || href.indexOf('mailto:') === 0) return;
      if (seen[href]) return;
      seen[href] = 1;
      out.push({ group: 'Pages', icon: 'page', label: label, sub: href, href: href });
    });

    // In-page sections
    $$('section[id], div[id].section').forEach(function (s) {
      var h = $('h1, h2', s);
      if (!h) return;
      var label = (h.textContent || '').trim().replace(/\s+/g, ' ');
      if (!label || label.length > 60) return;
      out.push({ group: 'On this page', icon: 'hash', label: label, sub: '#' + s.id, href: '#' + s.id });
    });

    // Leagues — harvested from whatever the page already lists.
    var leagues = {};
    $$('[data-league], .league-card__name, .league-row__name').forEach(function (el) {
      var n = (el.getAttribute('data-league') || el.textContent || '').trim();
      if (n && n.length < 44) leagues[n] = 1;
    });
    Object.keys(leagues).slice(0, 30).forEach(function (n) {
      out.push({ group: 'Leagues', icon: 'trophy', label: n, sub: 'Competition', href: 'league-hub.html' });
    });

    out.push({
      group: 'Actions', icon: 'sun', label: 'Toggle theme',
      sub: 'Switch between light and dark',
      action: function () {
        if (window.ApexTheme && window.ApexTheme.toggle) window.ApexTheme.toggle();
        else document.documentElement.setAttribute('data-theme',
          document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light');
      }
    });
    out.push({
      group: 'Actions', icon: 'up', label: 'Scroll to top', sub: 'Return to the top of the page',
      action: function () { window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }
    });
    out.push({
      group: 'Actions', icon: 'bolt', label: 'Replay loading sequence',
      sub: 'Reload and watch the boot animation',
      action: function () { location.reload(); }
    });

    return out;
  }

  /* ============================================================
     3 · POINTER EFFECTS — spotlight, tilt, magnet
     All three share one rAF-batched pointermove handler.
     ============================================================ */
  function initPointer() {
    if (!FINE || REDUCED) return;

    $$('.card, .feature, .plan, .ui-spot').forEach(function (el) {
      el.classList.add('ui-spot');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
    });

    $$('[data-tilt]').forEach(function (el) {
      el.classList.add('ui-tilt');
      var raf = null;
      el.addEventListener('pointermove', function (e) {
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = el.getBoundingClientRect();
          var px = (e.clientX - r.left) / r.width - .5;
          var py = (e.clientY - r.top) / r.height - .5;
          var max = parseFloat(el.dataset.tilt) || 6;
          el.style.setProperty('--ry', (px * max).toFixed(2) + 'deg');
          el.style.setProperty('--rx', (-py * max).toFixed(2) + 'deg');
        });
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });

    $$('[data-magnet]').forEach(function (el) {
      el.classList.add('ui-magnet');
      var pull = parseFloat(el.dataset.magnet) || 0.28;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.setProperty('--tx', (dx * pull).toFixed(1) + 'px');
        el.style.setProperty('--ty', (dy * pull).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--tx', '0px');
        el.style.setProperty('--ty', '0px');
      });
    });
  }

  /* ============================================================
     4 · PAGE TRANSITIONS
     Same-origin link clicks route through the View Transitions API
     when available. Modified clicks, new tabs, downloads, hashes
     and external links are all left to the browser.
     ============================================================ */
  function navigate(href) {
    if (href.charAt(0) === '#') {
      var t = document.getElementById(href.slice(1));
      if (t) t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    if (REDUCED || !document.startViewTransition) { location.href = href; return; }
    document.documentElement.classList.add('ui-leaving');
    setTimeout(function () { location.href = href; }, 150);
  }

  function initTransitions() {
    if (REDUCED) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      if (a.target && a.target !== '_self') return;
      if (a.hasAttribute('download')) return;

      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      if (/^(https?:)?\/\//i.test(href) && a.hostname !== location.hostname) return;
      if (/^(mailto:|tel:)/i.test(href)) return;
      if (document.startViewTransition) return;   // browser handles it

      e.preventDefault();
      document.documentElement.classList.add('ui-leaving');
      setTimeout(function () { location.href = href; }, 150);
    });

    // Clear the fade if the page is restored from bfcache.
    window.addEventListener('pageshow', function () {
      document.documentElement.classList.remove('ui-leaving');
    });
  }

  /* ============================================================
     5 · DATA VISUALISATION
     ============================================================ */

  // Shared observer: reveals any chart once it scrolls into view.
  var io = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function (es) {
        es.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add('is-in');
          if (en.target.__onIn) en.target.__onIn();
          io.unobserve(en.target);
        });
      }, { threshold: .3 })
    : null;

  function watch(el, fn) {
    if (fn) el.__onIn = fn;
    if (io && !REDUCED) io.observe(el);
    else { el.classList.add('is-in'); if (fn) fn(); }
  }

  /* Probability bars — <div data-prob="44.8" data-prob-label="Home win"> */
  function initProbs() {
    $$('[data-prob]').forEach(function (el) {
      var v = parseFloat(el.dataset.prob);
      if (!isFinite(v)) return;
      var label = el.dataset.probLabel || '';
      var muted = el.hasAttribute('data-prob-muted');
      el.classList.add('ui-prob');
      if (muted) el.classList.add('ui-prob--muted');
      el.innerHTML =
        '<div class="ui-prob__head"><span class="ui-prob__name">' + esc(label) +
        '</span><span class="ui-prob__val">' + v.toFixed(1) + '%</span></div>' +
        '<div class="ui-prob__track"><div class="ui-prob__fill"></div></div>';
      var fill = $('.ui-prob__fill', el);
      watch(el, function () { fill.style.width = Math.max(0, Math.min(100, v)) + '%'; });
    });
  }

  /* Sparkline — <svg data-spark="3,5,4,8,6,9"></svg> */
  function initSparks() {
    $$('[data-spark]').forEach(function (host) {
      var pts = host.dataset.spark.split(',').map(parseFloat).filter(isFinite);
      if (pts.length < 2) return;

      var W = 100, H = 32, P = 2;
      var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
      var span = (max - min) || 1;
      var xy = pts.map(function (v, i) {
        return [
          P + (i / (pts.length - 1)) * (W - P * 2),
          H - P - ((v - min) / span) * (H - P * 2)
        ];
      });
      var d = xy.map(function (p, i) {
        return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2);
      }).join(' ');
      var area = d + ' L' + xy[xy.length - 1][0].toFixed(2) + ' ' + H + ' L' + xy[0][0].toFixed(2) + ' ' + H + ' Z';
      var last = xy[xy.length - 1];
      var uid = 'uiSparkFade';

      var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('class', 'ui-spark');
      el.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      el.setAttribute('preserveAspectRatio', 'none');
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', host.dataset.sparkLabel ||
        ('Trend from ' + pts[0] + ' to ' + pts[pts.length - 1]));
      el.innerHTML =
        '<defs><linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0" stop-color="currentColor" stop-opacity=".28"/>' +
          '<stop offset="1" stop-color="currentColor" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<path class="ui-spark__area" d="' + area + '"/>' +
        '<path class="ui-spark__line" d="' + d + '"/>' +
        '<circle class="ui-spark__dot" cx="' + last[0].toFixed(2) + '" cy="' + last[1].toFixed(2) + '" r="2"/>';
      el.style.color = 'var(--ui-accent)';
      host.replaceWith(el);

      // Dash length must be measured after the node is in the document.
      var line = $('.ui-spark__line', el);
      var len = line.getTotalLength ? line.getTotalLength() : 200;
      el.style.setProperty('--len', len.toFixed(1));
      watch(el);
    });
  }

  /* Calibration plot — <div data-calibration="0.1:0.08,0.3:0.31,…"> */
  function initCalibration() {
    $$('[data-calibration]').forEach(function (host) {
      var pairs = host.dataset.calibration.split(',').map(function (p) {
        var a = p.split(':').map(parseFloat);
        return (isFinite(a[0]) && isFinite(a[1])) ? a : null;
      }).filter(Boolean);
      if (!pairs.length) return;

      var S = 200, P = 22;
      function X(v) { return P + v * (S - P * 2); }
      function Y(v) { return S - P - v * (S - P * 2); }

      var grid = '';
      [0, .25, .5, .75, 1].forEach(function (t) {
        grid += '<line class="ui-cal__grid" x1="' + X(t) + '" y1="' + Y(0) + '" x2="' + X(t) + '" y2="' + Y(1) + '"/>' +
                '<line class="ui-cal__grid" x1="' + X(0) + '" y1="' + Y(t) + '" x2="' + X(1) + '" y2="' + Y(t) + '"/>';
      });
      var dots = pairs.map(function (p, i) {
        return '<circle class="ui-cal__pt" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) +
               '" r="3.4" style="transition-delay:' + (i * 60) + 'ms"/>';
      }).join('');

      var el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      el.setAttribute('class', 'ui-cal');
      el.setAttribute('viewBox', '0 0 ' + S + ' ' + S);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label',
        'Calibration plot: predicted probability against observed frequency. ' +
        'Points on the diagonal indicate a well-calibrated model.');
      el.innerHTML = grid +
        '<line class="ui-cal__ideal" x1="' + X(0) + '" y1="' + Y(0) + '" x2="' + X(1) + '" y2="' + Y(1) + '"/>' +
        dots +
        '<text class="ui-cal__lbl" x="' + X(0) + '" y="' + (S - 6) + '">0</text>' +
        '<text class="ui-cal__lbl" x="' + (X(1) - 6) + '" y="' + (S - 6) + '">100%</text>' +
        '<text class="ui-cal__lbl" x="2" y="' + (Y(1) + 4) + '">100%</text>';
      host.replaceWith(el);
      watch(el);
    });
  }

  /* ------------------------------------------------------------
     Match simulator — real Poisson maths, no network.

     P(k goals) = e^-λ · λ^k / k!  for each side, then the joint
     grid gives home / draw / away and the scoreline distribution.
     ------------------------------------------------------------ */
  function initSimulator() {
    var root = $('[data-simulator]');
    if (!root) return;

    var MAX = 8;
    function pois(l, k) {
      var p = Math.exp(-l), f = 1;
      for (var i = 1; i <= k; i++) { p *= l / i; }
      return p;
    }

    function compute(lh, la) {
      var home = 0, draw = 0, away = 0, over = 0, btts = 0, grid = [];
      for (var i = 0; i <= MAX; i++) {
        for (var j = 0; j <= MAX; j++) {
          var p = pois(lh, i) * pois(la, j);
          if (i > j) home += p; else if (i === j) draw += p; else away += p;
          if (i + j > 2.5) over += p;
          if (i > 0 && j > 0) btts += p;
          grid.push({ s: i + '–' + j, p: p });
        }
      }
      grid.sort(function (a, b) { return b.p - a.p; });
      return { home: home, draw: draw, away: away, over: over, btts: btts, top: grid.slice(0, 5) };
    }

    var lhEl = $('[data-sim-home]', root);
    var laEl = $('[data-sim-away]', root);
    if (!lhEl || !laEl) return;

    var out = {
      home: $('[data-sim-out="home"]', root),
      draw: $('[data-sim-out="draw"]', root),
      away: $('[data-sim-out="away"]', root),
      over: $('[data-sim-out="over"]', root),
      btts: $('[data-sim-out="btts"]', root),
      scores: $('[data-sim-scores]', root),
      lhv: $('[data-sim-val="home"]', root),
      lav: $('[data-sim-val="away"]', root)
    };

    function setBar(el, v) {
      if (!el) return;
      var pct = (v * 100);
      var fill = $('.ui-prob__fill', el);
      var val = $('.ui-prob__val', el);
      if (fill) fill.style.width = pct.toFixed(1) + '%';
      if (val) val.textContent = pct.toFixed(1) + '%';
      // Fair decimal price, shown where the markup asks for it.
      var fair = el.querySelector('[data-sim-fair]');
      if (fair) fair.textContent = v > 0 ? (1 / v).toFixed(2) : '—';
    }

    function run() {
      var lh = parseFloat(lhEl.value), la = parseFloat(laEl.value);
      var r = compute(lh, la);
      if (out.lhv) out.lhv.textContent = lh.toFixed(2);
      if (out.lav) out.lav.textContent = la.toFixed(2);
      setBar(out.home, r.home);
      setBar(out.draw, r.draw);
      setBar(out.away, r.away);
      setBar(out.over, r.over);
      setBar(out.btts, r.btts);
      if (out.scores) {
        out.scores.innerHTML = r.top.map(function (s) {
          return '<span class="ui-sim__score">' + s.s + ' <b>' + (s.p * 100).toFixed(1) + '%</b></span>';
        }).join('');
      }
    }

    lhEl.addEventListener('input', run);
    laEl.addEventListener('input', run);
    run();
  }

  /* ============================================================
     boot
     ============================================================ */
  function boot() {
    try { initScroll(); }        catch (e) {}
    try { initPalette(); }       catch (e) {}
    try { initPointer(); }       catch (e) {}
    try { initTransitions(); }   catch (e) {}
    try { initProbs(); }         catch (e) {}
    try { initSparks(); }        catch (e) {}
    try { initCalibration(); }   catch (e) {}
    try { initSimulator(); }     catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
