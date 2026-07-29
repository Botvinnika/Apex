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


  /* ============================================================
     4 · SITE BACKGROUND FIELD
     Mounts the drifting-aurora field into the hero and any section
     opting in with data-fx. Injected rather than written into every
     page's markup so it stays a one-file change across both sites.
     ============================================================ */
  function initField() {
    var targets = $$('.hero, [data-fx]');
    if (!targets.length) return;

    var FINE = window.matchMedia &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    targets.forEach(function (host) {
      if ($('.site-fx', host)) return;                 // never double-mount
      if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

      var fx = document.createElement('div');
      fx.className = 'site-fx';
      fx.setAttribute('aria-hidden', 'true');

      // Each blob gets its own depth layer: parallax rides the wrapper and
      // the keyframe drift rides the child, so neither overwrites the
      // other's transform.
      var depths = [26, 16, 34, 20];
      var layers = '';
      for (var i = 1; i <= 4; i++) {
        layers += '<div class="site-fx__layer" style="--depth:' + depths[i - 1] + '">' +
                    '<div class="site-fx__blob site-fx__blob--' + i + '"></div>' +
                  '</div>';
      }

      // Drifting debris on staggered depths so it separates under parallax.
      var bits = '';
      var kinds = ['', ' site-fx__bit--dot', ' site-fx__bit--ring'];
      for (var b = 0; b < 14; b++) {
        var left = (b * 7.3 + 4) % 96;
        var sz   = 5 + (b % 4) * 4;
        var dur  = 20 + (b % 5) * 6;
        var del  = -(b * 2.4);
        var dx   = ((b % 5) - 2) * 4;
        var rot  = 140 + (b % 3) * 120;
        var dep  = 8 + (b % 4) * 11;
        bits += '<div class="site-fx__layer" style="--depth:' + dep + '">' +
                  '<span class="site-fx__bit' + kinds[b % 3] + '" style="' +
                    'left:' + left.toFixed(1) + '%;bottom:-10%;' +
                    '--sz:' + sz + 'px;--dur:' + dur + 's;--del:' + del + 's;' +
                    '--dx:' + dx + 'vw;--rot:' + rot + 'deg"></span>' +
                '</div>';
      }

      fx.innerHTML =
        layers +
        '<div class="site-fx__mow"></div>' +
        '<div class="site-fx__pitch"><svg viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width=".3" vector-effect="non-scaling-stroke"><rect x=".5" y=".5" width="104" height="67"/><line x1="52.5" y1=".5" x2="52.5" y2="67.5"/><circle cx="52.5" cy="34" r="9.15"/><rect x=".5" y="13.84" width="16.5" height="40.32"/><rect x=".5" y="24.84" width="5.5" height="18.32"/><path d="M17 27.1A9.15 9.15 0 0 1 17 40.9"/><rect x="88" y="13.84" width="16.5" height="40.32"/><rect x="99" y="24.84" width="5.5" height="18.32"/><path d="M88 27.1A9.15 9.15 0 0 0 88 40.9"/><path d="M.5 3.5A3 3 0 0 0 3.5 .5"/><path d="M104.5 3.5A3 3 0 0 1 101.5 .5"/><path d="M.5 64.5A3 3 0 0 1 3.5 67.5"/><path d="M104.5 64.5A3 3 0 0 0 101.5 67.5"/></g><g fill="currentColor" stroke="none"><circle cx="52.5" cy="34" r=".45"/><circle cx="11" cy="34" r=".45"/><circle cx="94" cy="34" r=".45"/></g></svg></div>' +
        '<canvas class="site-fx__net"></canvas>' +
        '<div class="site-fx__bits">' + bits + '</div>' +
        '<div class="site-fx__veil"></div>';
      host.insertBefore(fx, host.firstChild);

      if (!REDUCED) {
        startFieldNet(fx, host, FINE);
        if (FINE) trackPointer(fx, host);
      }
    });
  }

  /* Pointer parallax. Raw pointer samples are eased toward rather than
     applied directly, so the field glides instead of snapping. */
  function trackPointer(fx, host) {
    var tx = 0, ty = 0, cx = 0, cy = 0, raf = null, primed = false;

    function write() {
      fx.style.setProperty('--px', cx.toFixed(4));
      fx.style.setProperty('--py', cy.toFixed(4));
    }

    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;   // -1 .. 1
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      // The very first move has nothing to ease from, so easing from 0
      // reads as lag before the field responds at all. Seed part of the
      // way there and write synchronously, then let rAF take over.
      if (!primed) {
        primed = true;
        cx = tx * 0.55; cy = ty * 0.55;
        write();
      }
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });

    host.addEventListener('pointerleave', function () {
      tx = 0; ty = 0;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });

    function step() {
      cx += (tx - cx) * 0.09;
      cy += (ty - cy) * 0.09;
      write();
      // Keep easing until settled, then release the loop entirely.
      if (Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001) {
        raf = requestAnimationFrame(step);
      } else {
        raf = null;
      }
    }
  }

  /* Particle field with a pointer repulsion well. Stops completely when
     the host scrolls out of view, so it costs nothing off-screen. */
  function startFieldNet(fx, host, FINE) {
    var cv = $('.site-fx__net', fx);
    if (!cv) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var w = 0, h = 0, nodes = [], raf = null, running = false;
    var mx = -9999, my = -9999;
    var REPEL = 130, LINK = 132;

    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var count = Math.max(24, Math.min(90, Math.round((w * h) / 20000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: Math.random() * 1.7 + 0.8
        });
      }
    }

    if (FINE) {
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        mx = e.clientX - r.left; my = e.clientY - r.top;
      }, { passive: true });
      host.addEventListener('pointerleave', function () { mx = my = -9999; }, { passive: true });
    }

    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < nodes.length; i++) {
        var p = nodes[i];
        // Pointer well. Force is capped so a fast cursor sweep cannot give
        // a node runaway velocity.
        var dx = p.x - mx, dy = p.y - my;
        var d2 = dx * dx + dy * dy;
        if (d2 < REPEL * REPEL && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var f = Math.min((1 - d / REPEL) * 1.4, 1.4);
          p.vx += (dx / d) * f * 0.55;
          p.vy += (dy / d) * f * 0.55;
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.965; p.vy *= 0.965;          // friction, or it never settles
        // Drift floor so the field never goes completely still.
        if (Math.abs(p.vx) < 0.06) p.vx += (Math.random() - 0.5) * 0.05;
        if (Math.abs(p.vy) < 0.06) p.vy += (Math.random() - 0.5) * 0.05;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.x = Math.max(0, Math.min(w, p.x));
        p.y = Math.max(0, Math.min(h, p.y));
      }

      var stroke = getComputedStyle(fx).getPropertyValue('--fx-bit').trim() ||
                   'rgba(160,215,255,.3)';
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var na = nodes[a], nb = nodes[b];
          var ex = na.x - nb.x, ey = na.y - nb.y;
          var e2 = ex * ex + ey * ey;
          if (e2 > LINK * LINK) continue;
          ctx.globalAlpha = (1 - Math.sqrt(e2) / LINK) * 0.5;
          ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = stroke;
      for (var k = 0; k < nodes.length; k++) {
        ctx.beginPath();
        ctx.arc(nodes[k].x, nodes[k].y, nodes[k].r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    function start() { if (!running) { running = true; raf = requestAnimationFrame(draw); } }
    function stop()  { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    resize();
    window.addEventListener('resize', resize, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { start(); } else { stop(); }
      }, { threshold: 0 }).observe(host);
    } else {
      start();
    }
  }

  function boot() {
    try { initMatrix(); }  catch (e) {}
    try { initExplain(); } catch (e) {}
    try { initRail(); }    catch (e) {}
    try { initField(); }   catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
