/* ============================================================
   APEX MODERN — data-native components

   1 · Scoreline matrix  — the joint Poisson distribution rendered as
                           a heatmap, bound live to the simulator.
   2 · Scroll explainer  — sticky visual driven by the active step.
   3 · Rail keyboard nav — arrow-key paging for the league rail.

   Every module is independent and guarded; a page without the
   markup simply skips it.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ============================================================
     1 · SCORELINE MATRIX
     ============================================================ */
  function initMatrix() {
    var root = $('[data-matrix]');
    if (!root) return;

    var N = 7;                       // 0–6 goals per side
    var grid = $('[data-matrix-grid]', root);
    var tableWrap = $('[data-matrix-table]', root);
    var toggle = $('[data-matrix-toggle]', root);
    var maxOut = $('[data-matrix-max]', root);
    if (!grid) return;

    var tip = document.createElement('div');
    tip.className = 'm-tip';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);

    // ---- build the grid once; only fills change afterwards ----
    var cells = [];
    var html = '<span class="m-grid__hd" aria-hidden="true"></span>';
    for (var a = 0; a < N; a++) html += '<span class="m-grid__hd">' + a + '</span>';
    for (var h = 0; h < N; h++) {
      html += '<span class="m-grid__hd">' + h + '</span>';
      for (var aw = 0; aw < N; aw++) {
        html += '<span class="m-cellbox" tabindex="0" role="img" ' +
                'data-h="' + h + '" data-a="' + aw + '"' +
                (h === aw ? ' data-draw' : '') + '></span>';
      }
    }
    grid.innerHTML = html;
    cells = $$('.m-cellbox', grid);

    function pois(l, k) {
      var p = Math.exp(-l);
      for (var i = 1; i <= k; i++) p *= l / i;
      return p;
    }

    var last = [];

    function paint(lh, la) {
      var vals = [], max = 0;
      for (var h = 0; h < N; h++) {
        for (var a = 0; a < N; a++) {
          var p = pois(lh, h) * pois(la, a);
          vals.push(p);
          if (p > max) max = p;
        }
      }
      last = vals;

      cells.forEach(function (el, i) {
        var p = vals[i];
        // Poisson mass is heavily skewed, so a linear map would leave
        // almost every cell in the first step. sqrt spreads the low end
        // without inverting any ordering.
        var t = max > 0 ? Math.sqrt(p / max) : 0;
        var step = Math.min(7, Math.max(1, Math.ceil(t * 7)));
        el.style.background = 'var(--seq-' + step + ')';
        var lbl = el.dataset.h + '–' + el.dataset.a + ': ' + (p * 100).toFixed(1) + '%';
        el.setAttribute('aria-label', lbl);
        el.__p = p;
      });

      if (maxOut) {
        var mi = vals.indexOf(max);
        maxOut.textContent = Math.floor(mi / N) + '–' + (mi % N) +
                             ' (' + (max * 100).toFixed(1) + '%)';
      }
      if (tableWrap && tableWrap.__render) tableWrap.__render(vals);
    }

    // ---- hover / focus tooltip ----
    function showTip(el) {
      var r = el.getBoundingClientRect();
      tip.innerHTML = el.dataset.h + '–' + el.dataset.a +
                      ' &middot; <b>' + (el.__p * 100).toFixed(1) + '%</b>';
      tip.style.left = (r.left + r.width / 2) + 'px';
      tip.style.top = r.top + 'px';
      tip.classList.add('is-on');
    }
    function hideTip() { tip.classList.remove('is-on'); }

    grid.addEventListener('pointerover', function (e) {
      var c = e.target.closest('.m-cellbox');
      if (c) showTip(c);
    });
    grid.addEventListener('pointerout', hideTip);
    grid.addEventListener('focusin', function (e) {
      var c = e.target.closest('.m-cellbox');
      if (c) showTip(c);
    });
    grid.addEventListener('focusout', hideTip);
    window.addEventListener('scroll', hideTip, { passive: true });

    // ---- table view: identity never depends on colour alone ----
    if (tableWrap) {
      tableWrap.__render = function (vals) {
        var rows = '';
        for (var h = 0; h < N; h++) {
          rows += '<tr><td>' + h + '</td>';
          for (var a = 0; a < N; a++) {
            rows += '<td>' + (vals[h * N + a] * 100).toFixed(1) + '</td>';
          }
          rows += '</tr>';
        }
        var head = '<tr><th scope="col">H \\ A</th>';
        for (var a2 = 0; a2 < N; a2++) head += '<th scope="col">' + a2 + '</th>';
        head += '</tr>';
        tableWrap.innerHTML =
          '<table class="m-table"><caption class="sr-only">Scoreline probabilities, ' +
          'home goals by away goals, in percent</caption>' +
          '<thead>' + head + '</thead><tbody>' + rows + '</tbody></table>';
      };
    }
    if (toggle && tableWrap) {
      toggle.addEventListener('click', function () {
        var showing = tableWrap.hasAttribute('hidden');
        if (showing) {
          tableWrap.removeAttribute('hidden');
          tableWrap.__render(last);
          toggle.textContent = 'Show matrix';
        } else {
          tableWrap.setAttribute('hidden', '');
          toggle.textContent = 'Show table';
        }
        toggle.setAttribute('aria-expanded', String(showing));
      });
    }

    // ---- bind to the simulator sliders if they exist ----
    var lh = $('[data-sim-home]'), la = $('[data-sim-away]');
    function sync() {
      paint(
        lh ? parseFloat(lh.value) : 1.62,
        la ? parseFloat(la.value) : 1.18
      );
    }
    if (lh) lh.addEventListener('input', sync);
    if (la) la.addEventListener('input', sync);
    sync();
  }

  /* ============================================================
     2 · SCROLL EXPLAINER
     Marks the step nearest the middle of the viewport as active and
     swaps the sticky panel to match.
     ============================================================ */
  function initExplain() {
    var root = $('[data-explain]');
    if (!root) return;
    var steps = $$('[data-step]', root);
    var panels = $$('[data-panel]', root);
    if (!steps.length) return;

    function setActive(i) {
      steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
      panels.forEach(function (p, k) { p.classList.toggle('is-on', k === i); });
    }

    if (REDUCED || !('IntersectionObserver' in window)) {
      steps.forEach(function (s) { s.classList.add('is-active'); });
      setActive(0);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      // Pick the most-visible step rather than the last one to fire,
      // so fast scrolling cannot leave an off-screen step active.
      var best = null;
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        if (!best || en.intersectionRatio > best.intersectionRatio) best = en;
      });
      if (best) setActive(steps.indexOf(best.target));
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, .5, 1] });

    steps.forEach(function (s) { io.observe(s); });
    setActive(0);
  }

  /* ============================================================
     3 · RAIL — arrow-key paging
     ============================================================ */
  function initRail() {
    $$('[data-rail]').forEach(function (rail) {
      rail.setAttribute('tabindex', '0');
      rail.setAttribute('role', 'region');
      if (!rail.getAttribute('aria-label')) rail.setAttribute('aria-label', 'Scrollable list');
      rail.addEventListener('keydown', function (e) {
        var card = rail.querySelector('*');
        if (!card) return;
        var step = card.getBoundingClientRect().width + 14;
        if (e.key === 'ArrowRight') { e.preventDefault(); rail.scrollBy({ left: step, behavior: REDUCED ? 'auto' : 'smooth' }); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); rail.scrollBy({ left: -step, behavior: REDUCED ? 'auto' : 'smooth' }); }
        else if (e.key === 'Home') { e.preventDefault(); rail.scrollTo({ left: 0, behavior: REDUCED ? 'auto' : 'smooth' }); }
        else if (e.key === 'End') { e.preventDefault(); rail.scrollTo({ left: rail.scrollWidth, behavior: REDUCED ? 'auto' : 'smooth' }); }
      });
    });
  }

  function boot() {
    try { initMatrix(); }  catch (e) {}
    try { initExplain(); } catch (e) {}
    try { initRail(); }    catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
