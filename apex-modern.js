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
        startMatch(fx, host, FINE);
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

  /* ============================================================
     LIVE MATCH FIELD
     An 11v11 game played out on the pitch markings behind the content.

     Everything is computed in real pitch units (105 x 68 metres) and
     mapped through the same xMidYMid-slice transform the pitch SVG
     uses, so players line up with the painted lines at any aspect ratio.

     Behaviour, roughly in order of how much it matters visually:
       - players hold a formation and shift toward the ball, so the
         whole shape slides around like a real team block
       - the carrier picks a pass by scoring teammates on space and
         forward progress, not at random
       - the nearest opponent presses the carrier and can intercept
       - shots are taken from the final third and either score, miss,
         or are saved; play restarts from a kickoff or goal kick
     ============================================================ */
  function startMatch(fx, host, FINE) {
    var cv = $('.site-fx__net', fx);
    if (!cv) return;
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var PW = 105, PH = 68;                       // pitch metres

    /* Speeds are metres per frame at 60fps, taken from real ranges:
       sprint ~8 m/s, jog ~4.5, keeper ~3, pass ~16-22, shot ~26-32.
       The first version ran 3-9x these and looked like air hockey. */
    var SPRINT = 0.135, JOG = 0.075, GK_V = 0.052;
    var PASS_MIN = 0.27, PASS_VAR = 0.10;
    var SHOT_MIN = 0.44, SHOT_VAR = 0.09;
    var w = 0, h = 0, sc = 1, ox = 0, oy = 0;    // viewport + slice transform
    var raf = null, running = false;
    var mx = -9999, my = -9999;                  // pointer, in pitch units

    /* ---- formations: 4-3-3, home attacks +x ---- */
    var SHAPE = [
      [5, 34],
      [20, 13], [20, 27], [20, 41], [20, 55],
      [38, 19], [38, 34], [38, 49],
      [58, 15], [58, 34], [58, 53]
    ];
    function mirror(p) { return [PW - p[0], PH - p[1]]; }

    var players = [], ball = null, trail = [], passLine = null, flash = 0;

    function reset(kickoffTeam) {
      players = [];
      for (var t = 0; t < 2; t++) {
        for (var i = 0; i < SHAPE.length; i++) {
          var base = t === 0 ? SHAPE[i] : mirror(SHAPE[i]);
          players.push({
            team: t, gk: i === 0,
            hx: base[0], hy: base[1],            // formation anchor
            x: base[0], y: base[1],
            vx: 0, vy: 0,
            ph: Math.random() * 6.28, ph2: Math.random() * 6.28,
            wob: 0, wob2: 0
          });
        }
      }
      var starter = players[kickoffTeam * 11 + 9];   // a central forward
      ball = {
        x: PW / 2, y: PH / 2, vx: 0, vy: 0,
        owner: starter, state: 'carry', t: 0
      };
      trail = []; passLine = null;
    }

    function dist(ax, ay, bx, by) {
      var dx = ax - bx, dy = ay - by;
      return Math.sqrt(dx * dx + dy * dy);
    }

    /* ---- pick a pass: prefer open teammates who are further forward ---- */
    function choosePass(carrier) {
      var mates = players.filter(function (p) {
        return p.team === carrier.team && p !== carrier && !p.gk;
      });
      var best = null, bestScore = -Infinity;
      var fwd = carrier.team === 0 ? 1 : -1;

      for (var i = 0; i < mates.length; i++) {
        var m = mates[i];
        var d = dist(carrier.x, carrier.y, m.x, m.y);
        if (d < 6 || d > 42) continue;           // too short / not on

        // Nearest opponent to the receiver — crowded targets score badly.
        var press = Infinity;
        for (var k = 0; k < players.length; k++) {
          var o = players[k];
          if (o.team === carrier.team) continue;
          press = Math.min(press, dist(m.x, m.y, o.x, o.y));
        }

        var progress = (m.x - carrier.x) * fwd;  // metres gained
        var score = progress * 1.6 + press * 2.2 - d * 0.35 + Math.random() * 9;
        if (score > bestScore) { bestScore = score; best = m; }
      }
      return best;
    }

    function passTo(target, speed) {
      var d = dist(ball.x, ball.y, target.x, target.y) || 1;
      ball.vx = ((target.x - ball.x) / d) * speed;
      ball.vy = ((target.y - ball.y) / d) * speed;
      ball.state = 'travel';
      ball.target = target;
      ball.owner = null;
      passLine = { x1: ball.x, y1: ball.y, x2: target.x, y2: target.y, life: 1 };
    }

    function shoot(carrier) {
      var gx = carrier.team === 0 ? PW : 0;
      var gy = 34 + (Math.random() - 0.5) * 12;      // sometimes wide
      var d = dist(ball.x, ball.y, gx, gy) || 1;
      var sp = SHOT_MIN + Math.random() * SHOT_VAR;
      ball.vx = ((gx - ball.x) / d) * sp;
      ball.vy = ((gy - ball.y) / d) * sp;
      ball.state = 'shot';
      ball.owner = null;
      ball.target = null;
      passLine = { x1: ball.x, y1: ball.y, x2: gx, y2: gy, life: 1 };
    }

    /* ---- per-frame simulation ---- */
    function step() {
      var carrier = ball.owner;

      // ---- team block ----
      // A real side shifts as a unit: the whole block slides toward the
      // ball's side and moves its line up or down, while each player
      // holds their slot inside that shape. Previously every outfielder
      // homed on the ball independently, which collapsed all 11 into a
      // blob around it.
      var blockX = (ball.x - PW / 2) * 0.30;      // line height
      var blockY = (ball.y - PH / 2) * 0.34;      // lateral shift

      // Only the closest player of each side actually goes to the ball.
      var chaser = [null, null], chaseD = [Infinity, Infinity];
      for (var c = 0; c < players.length; c++) {
        var pc = players[c];
        if (pc.gk) continue;
        var dc = dist(pc.x, pc.y, ball.x, ball.y);
        if (dc < chaseD[pc.team]) { chaseD[pc.team] = dc; chaser[pc.team] = pc; }
      }

      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var maxv = JOG;
        var tx, ty;

        if (p.gk) {
          // Keeper holds his line and shuffles across with the ball.
          tx = p.hx + (ball.x - p.hx) * 0.04;
          ty = 34 + (ball.y - 34) * 0.26;
          maxv = GK_V;
        } else if (p === carrier) {
          tx = p.x + (p.team === 0 ? 2.2 : -2.2);   // drive forward
          ty = p.y + p.wob * 1.2;
          maxv = JOG;
        } else if (p === chaser[p.team] && chaseD[p.team] < 26) {
          tx = ball.x; ty = ball.y;                 // close it down
          maxv = SPRINT;
        } else {
          // Hold shape. wob is a slow per-player wander so the block
          // breathes instead of sitting on exact coordinates.
          tx = p.hx + blockX + p.wob * 2.4;
          ty = p.hy + blockY + p.wob2 * 2.0;
        }

        // Pointer nudge: players give way slightly as the cursor passes.
        if (FINE) {
          var dxm = p.x - mx, dym = p.y - my;
          var dm = Math.sqrt(dxm * dxm + dym * dym);
          if (dm < 9 && dm > 0.01) {
            tx += (dxm / dm) * (9 - dm) * 0.8;
            ty += (dym / dm) * (9 - dm) * 0.8;
          }
        }

        p.vx += (tx - p.x) * 0.020;
        p.vy += (ty - p.y) * 0.020;
        p.vx *= 0.86; p.vy *= 0.86;

        // Hard speed cap in metres per frame — without this a player
        // crossing a 10m gap accelerated to roughly 72 m/s.
        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp > maxv) { p.vx = (p.vx / sp) * maxv; p.vy = (p.vy / sp) * maxv; }

        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(1, Math.min(PW - 1, p.x));
        p.y = Math.max(1, Math.min(PH - 1, p.y));

        // Advance the wander phases.
        p.ph += 0.006; p.ph2 += 0.0043;
        p.wob = Math.sin(p.ph); p.wob2 = Math.sin(p.ph2);
      }

      // Reassign the presser each frame — nearest opponent to the carrier.
      for (var q = 0; q < players.length; q++) players[q].presser = false;
      if (carrier) {
        var near = null, nd = Infinity;
        for (var r = 0; r < players.length; r++) {
          var o = players[r];
          if (o.team === carrier.team || o.gk) continue;
          var d2 = dist(o.x, o.y, carrier.x, carrier.y);
          if (d2 < nd) { nd = d2; near = o; }
        }
        if (near) near.presser = true;
      }

      /* ---- ball ---- */
      if (ball.state === 'carry' && carrier) {
        ball.x = carrier.x + (carrier.team === 0 ? 0.9 : -0.9);
        ball.y = carrier.y;
        ball.t++;

        // Interception: pressing player close enough steals it.
        for (var s = 0; s < players.length; s++) {
          var op = players[s];
          if (op.team === carrier.team) continue;
          if (dist(op.x, op.y, ball.x, ball.y) < 1.6) {
            ball.owner = op; ball.t = 0; break;
          }
        }

        if (ball.t > 48 + Math.random() * 66) {
          var inFinalThird = carrier.team === 0 ? carrier.x > 74 : carrier.x < 31;
          if (inFinalThird && Math.random() < 0.55) {
            shoot(carrier);
          } else {
            var tgt = choosePass(carrier);
            if (tgt) passTo(tgt, PASS_MIN + Math.random() * PASS_VAR);
            else ball.t = 0;
          }
        }
      } else if (ball.state === 'travel' || ball.state === 'shot') {
        ball.x += ball.vx; ball.y += ball.vy;
        ball.vx *= 0.991; ball.vy *= 0.991;

        if (ball.state === 'travel' && ball.target) {
          if (dist(ball.x, ball.y, ball.target.x, ball.target.y) < 1.5) {
            // Loose ball: whoever is closest actually collects it.
            var win = ball.target, wd = 1.6;
            for (var u = 0; u < players.length; u++) {
              var pl = players[u];
              var dd = dist(pl.x, pl.y, ball.x, ball.y);
              if (dd < wd) { wd = dd; win = pl; }
            }
            ball.owner = win; ball.state = 'carry'; ball.t = 0;
          }
        }

        if (ball.state === 'shot') {
          var scored = (ball.x > PW - 0.5 && Math.abs(ball.y - 34) < 3.7) ||
                       (ball.x < 0.5 && Math.abs(ball.y - 34) < 3.7);
          if (scored) { flash = 1; reset(Math.random() < 0.5 ? 0 : 1); return; }
          if (ball.x < -2 || ball.x > PW + 2 || ball.y < -2 || ball.y > PH + 2) {
            reset(ball.vx > 0 ? 1 : 0); return;      // goal kick to the other side
          }
          // A keeper close to the shot saves it.
          for (var g = 0; g < players.length; g++) {
            var k = players[g];
            if (k.gk && dist(k.x, k.y, ball.x, ball.y) < 2.4) {
              ball.owner = k; ball.state = 'carry'; ball.t = 0; break;
            }
          }
        }

        if (Math.abs(ball.vx) + Math.abs(ball.vy) < 0.06) {
          var cl = players[0], cd = Infinity;
          for (var v = 0; v < players.length; v++) {
            var e = dist(players[v].x, players[v].y, ball.x, ball.y);
            if (e < cd) { cd = e; cl = players[v]; }
          }
          ball.owner = cl; ball.state = 'carry'; ball.t = 0;
        }
      }

      trail.push([ball.x, ball.y]);
      if (trail.length > 16) trail.shift();
      if (passLine) { passLine.life -= 0.045; if (passLine.life <= 0) passLine = null; }
      if (flash > 0) flash -= 0.02;
    }

    /* ---- drawing ---- */
    function X(px) { return ox + px * sc; }
    function Y(py) { return oy + py * sc; }

    function draw() {
      if (!running) return;
      step();
      ctx.clearRect(0, 0, w, h);

      var cs = getComputedStyle(fx);
      var home  = cs.getPropertyValue('--fx-home').trim()  || '#38BDF8';
      var away  = cs.getPropertyValue('--fx-away').trim()  || '#F0349B';
      var ballC = cs.getPropertyValue('--fx-ball').trim()  || '#fff';
      var trailC = cs.getPropertyValue('--fx-trail').trim() || 'rgba(255,255,255,.5)';

      if (passLine) {                       // the intended pass, fading out
        ctx.globalAlpha = passLine.life * 0.5;
        ctx.strokeStyle = trailC;
        ctx.lineWidth = Math.max(1, sc * 0.11);
        ctx.setLineDash([sc * 0.5, sc * 0.5]);
        ctx.beginPath();
        ctx.moveTo(X(passLine.x1), Y(passLine.y1));
        ctx.lineTo(X(passLine.x2), Y(passLine.y2));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 1;                  // ball trail
      ctx.strokeStyle = trailC;
      ctx.lineWidth = Math.max(1.2, sc * 0.16);
      ctx.beginPath();
      for (var i = 0; i < trail.length; i++) {
        var pt = trail[i];
        if (i === 0) ctx.moveTo(X(pt[0]), Y(pt[1]));
        else ctx.lineTo(X(pt[0]), Y(pt[1]));
      }
      ctx.globalAlpha = 0.32;
      ctx.stroke();

      for (var p = 0; p < players.length; p++) {          // players
        var pl = players[p];
        ctx.globalAlpha = pl.gk ? 0.55 : 0.85;
        ctx.fillStyle = pl.team === 0 ? home : away;
        ctx.beginPath();
        // Radii are metres * sc, not raw pixels — a player reads about a
        // metre across at any viewport size.
        ctx.arc(X(pl.x), Y(pl.y), sc * (pl.gk ? 0.48 : 0.55), 0, Math.PI * 2);
        ctx.fill();
        if (pl === ball.owner) {                          // carrier ring
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = pl.team === 0 ? home : away;
          ctx.lineWidth = Math.max(1, sc * 0.09);
          ctx.beginPath();
          ctx.arc(X(pl.x), Y(pl.y), sc * 1.15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;                                // ball
      ctx.fillStyle = ballC;
      ctx.beginPath();
      ctx.arc(X(ball.x), Y(ball.y), Math.max(1.6, sc * 0.26), 0, Math.PI * 2);
      ctx.fill();

      if (flash > 0) {                                    // goal
        ctx.globalAlpha = flash * 0.22;
        ctx.fillStyle = ballC;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    function resize() {
      var r = host.getBoundingClientRect();
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width * 1.12); h = Math.max(1, r.height * 1.12);
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Same transform as the SVG's xMidYMid slice, so dots sit on lines.
      sc = Math.max(w / PW, h / PH);
      ox = (w - PW * sc) / 2;
      oy = (h - PH * sc) / 2;
    }

    if (FINE) {
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect();
        mx = ((e.clientX - r.left) * 1.12 - ox) / sc;
        my = ((e.clientY - r.top) * 1.12 - oy) / sc;
      }, { passive: true });
      host.addEventListener('pointerleave', function () { mx = my = -9999; }, { passive: true });
    }

    function start() { if (!running) { running = true; raf = requestAnimationFrame(draw); } }
    function stop()  { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    resize();
    reset(Math.random() < 0.5 ? 0 : 1);
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
