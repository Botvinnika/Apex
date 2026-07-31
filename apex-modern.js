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

    var N = 7;                       // 0-6 goals per side
    var TOP = 8;                     // scorelines worth showing
    var listEl  = $('[data-sl-list]', root);
    var splitEl = $('[data-sl-split]', root);
    var keyEl   = $('[data-sl-splitkey]', root);
    var tableWrap = $('[data-matrix-table]', root);
    var toggle = $('[data-matrix-toggle]', root);
    if (!listEl) return;

    function pois(l, k) {
      var p = Math.exp(-l);
      for (var i = 1; i <= k; i++) p *= l / i;
      return p;
    }

    var last = [];

    /* Outcome is a categorical property of a scoreline, not a rank, so
       it gets the colour. Probability is magnitude and gets the bar
       length. Encoding both on one mark is what the old 7x7 heat grid
       could not do: it showed magnitude but hid whether a cell was a
       home win, a draw or an away win.

       Home/away use the validated blue-orange pair rather than
       red/green. It carries the same opposition reading, but red and
       green are the one pairing ~8% of men cannot separate, and here
       the colour IS the information. */
    function outcomeOf(hg, ag) {
      return hg > ag ? 'home' : (hg === ag ? 'draw' : 'away');
    }

    function paint(lh, la) {
      var vals = [], cells = [];
      var agg = { home: 0, draw: 0, away: 0 };
      for (var hg = 0; hg < N; hg++) {
        for (var ag = 0; ag < N; ag++) {
          var p = pois(lh, hg) * pois(la, ag);
          vals.push(p);
          var o = outcomeOf(hg, ag);
          agg[o] += p;
          cells.push({ h: hg, a: ag, p: p, o: o });
        }
      }
      last = vals;

      // --- three-way split bar ---
      var tot = agg.home + agg.draw + agg.away || 1;
      var parts = [
        { k: 'home', label: 'Home win', v: agg.home / tot },
        { k: 'draw', label: 'Draw',     v: agg.draw / tot },
        { k: 'away', label: 'Away win', v: agg.away / tot }
      ];
      splitEl.innerHTML = parts.map(function (s) {
        return '<span class="sl__seg sl__seg--' + s.k + '" style="width:' +
               (s.v * 100).toFixed(2) + '%"><b>' + (s.v * 100).toFixed(1) + '%</b></span>';
      }).join('');
      splitEl.setAttribute('aria-label', parts.map(function (s) {
        return s.label + ' ' + (s.v * 100).toFixed(1) + ' percent';
      }).join(', '));
      keyEl.innerHTML = parts.map(function (s) {
        return '<span class="sl__k"><i class="sl__dot sl__dot--' + s.k + '"></i>' +
               s.label + '</span>';
      }).join('');

      // --- ranked scorelines ---
      cells.sort(function (x, y) { return y.p - x.p; });
      var top = cells.slice(0, TOP);
      var peak = top[0] ? top[0].p : 1;

      listEl.innerHTML = top.map(function (c, i) {
        var pct = (c.p * 100);
        var w = peak > 0 ? (c.p / peak) * 100 : 0;
        var oddsTxt = c.p > 0 ? (1 / c.p).toFixed(1) : '—';
        return '<li class="sl__row sl__row--' + c.o + '">' +
          '<span class="sl__rank">' + (i + 1) + '</span>' +
          '<span class="sl__score">' + c.h + '<i>&ndash;</i>' + c.a + '</span>' +
          '<span class="sl__track"><span class="sl__bar" style="width:' + w.toFixed(2) + '%"></span></span>' +
          '<span class="sl__pct">' + pct.toFixed(1) + '%</span>' +
          '<span class="sl__odds">' + oddsTxt + '</span>' +
        '</li>';
      }).join('');

      if (tableWrap && tableWrap.__render && !tableWrap.hasAttribute('hidden')) {
        tableWrap.__render(vals);
      }
    }

    // ---- full table: identity never depends on colour alone ----
    if (tableWrap) {
      tableWrap.__render = function (vals) {
        var rows = '';
        for (var hg = 0; hg < N; hg++) {
          rows += '<tr><th scope="row">' + hg + '</th>';
          for (var ag = 0; ag < N; ag++) {
            rows += '<td>' + (vals[hg * N + ag] * 100).toFixed(1) + '</td>';
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
          toggle.textContent = 'Hide table';
        } else {
          tableWrap.setAttribute('hidden', '');
          toggle.textContent = 'Show all 49';
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

    /* Speeds start from real ranges at 60fps — sprint ~8 m/s, jog ~4.5,
       keeper ~3, pass ~16-22, shot ~26-32 — then everything is lifted by
       one shared RATE. True real-time reads as sluggish in a background
       strip; scaling the whole set keeps the ratios honest (a pass still
       outruns a sprint, a shot outruns a pass) while playing at a pace
       closer to how football looks in highlights. */
    var RATE = 2.05;
    var SPRINT = 0.135 * RATE, JOG = 0.075 * RATE, GK_V = 0.052 * RATE;
    var PASS_MIN = 0.27 * RATE, PASS_VAR = 0.10 * RATE;
    var SHOT_MIN = 0.38 * RATE, SHOT_VAR = 0.08 * RATE;

    /* Tempo, 0 = patient circulation, 1 = full-tilt break. It spikes on a
       turnover — the moment a real game accelerates — decays back toward a
       slowly wandering baseline, and scales player speed, pass weight and
       how long anyone dwells on the ball. */
    var tempo = 0.45, tempoBase = 0.45, tempoPhase = Math.random() * 6.28;
    var w = 0, h = 0, sc = 1, ox = 0, oy = 0;    // viewport + slice transform
    var raf = null, running = false;
    var mx = -9999, my = -9999;                  // pointer, in pitch units

    /* ---- 4-3-3, home attacks +x ---- */
    var SHAPE = [
      { x: 5,  y: 34, role: 'GK' },
      { x: 20, y: 56, role: 'FB' },
      { x: 17, y: 41, role: 'CB' },
      { x: 17, y: 27, role: 'CB' },
      { x: 20, y: 12, role: 'FB' },
      { x: 33, y: 34, role: 'DM' },
      { x: 42, y: 46, role: 'CM' },
      { x: 42, y: 22, role: 'CM' },
      { x: 64, y: 59, role: 'WG' },
      { x: 70, y: 34, role: 'ST' },
      { x: 64, y: 9,  role: 'WG' }
    ];

    /* Per-role behaviour.
         adv  : metres pushed up when the team has the ball
         drop : metres dropped when it does not
         pull : how far the player slides across toward the ball's side.
                Low for wingers (they hold the touchline), high for
                centre-backs and the DM (they stay compact and shuffle).
         roam : how far the player will leave shape to press.
         run  : full-backs and wingers surge up their own flank when the
                ball is on their side. */
    var ROLE = {
      GK: { adv: 2,  drop: -1,  pull: 0.18, roam: 6,  run: 0 },
      CB: { adv: 8,  drop: -5,  pull: 0.42, roam: 14, run: 0 },
      FB: { adv: 20, drop: -2,  pull: 0.12, roam: 18, run: 14 },
      DM: { adv: 7,  drop: -8,  pull: 0.46, roam: 20, run: 0 },
      CM: { adv: 15, drop: -9,  pull: 0.34, roam: 24, run: 0 },
      WG: { adv: 14, drop: -22, pull: 0.10, roam: 20, run: 10 },
      ST: { adv: 12, drop: -18, pull: 0.24, roam: 16, run: 0 }
    };

    function mirror(p) { return { x: PW - p.x, y: PH - p.y, role: p.role }; }

    var players = [], ball = null, trail = [], passLine = null, flash = 0;

    function reset(kickoffTeam) {
      players = [];
      for (var t = 0; t < 2; t++) {
        for (var i = 0; i < SHAPE.length; i++) {
          var base = t === 0 ? SHAPE[i] : mirror(SHAPE[i]);
          players.push({
            team: t, gk: base.role === 'GK', role: base.role,
            hx: base.x, hy: base.y,              // formation anchor
            x: base.x, y: base.y,
            vx: 0, vy: 0,
            ph: Math.random() * 6.28, ph2: Math.random() * 6.28,
            wob: 0, wob2: 0,
            cool: 0                              // frames until it may win the ball again
          });
        }
      }
      var starter = players[kickoffTeam * 11 + 9];   // a central forward
      ball = {
        x: PW / 2, y: PH / 2, vx: 0, vy: 0,
        owner: starter, state: 'carry', t: 0
      };
      trail = []; passLine = null;
      for (var z = 0; z < players.length; z++) players[z].cool = 0;
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
        var score = progress * 1.4 + press * 2.4 - d * 0.30 + Math.random() * 11;
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
      var sp = (SHOT_MIN + Math.random() * SHOT_VAR) * (0.92 + tempo * 0.18);
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

      // Baseline wanders slowly; tempo eases toward it and decays after
      // any spike, so the game visibly settles and surges.
      tempoPhase += 0.0022;
      tempoBase = 0.45 + Math.sin(tempoPhase) * 0.22;
      tempo += (tempoBase - tempo) * 0.012;
      tempo = Math.max(0, Math.min(1, tempo));

      // ---- role-driven shape ----
      // Every player used to receive the SAME block offset, so the side
      // slid around as one rigid slab. Each role now has its own job.
      var inPoss = carrier ? carrier.team : -1;

      // Only the closest player of the side WITHOUT the ball presses.
      var presser = null, pd = Infinity;
      if (carrier) {
        for (var c = 0; c < players.length; c++) {
          var pc = players[c];
          if (pc.team === carrier.team || pc.gk) continue;
          if (pc.cool > 0) continue;             // just lost it — someone else goes
          var dc = dist(pc.x, pc.y, ball.x, ball.y);
          if (dc < pd) { pd = dc; presser = pc; }
        }
      }

      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var R = ROLE[p.role] || ROLE.CM;
        var fwd = p.team === 0 ? 1 : -1;
        var attacking = p.team === inPoss;
        var maxv = JOG, tx, ty;

        if (p.gk) {
          tx = p.hx + (ball.x - p.hx) * 0.04;
          ty = 34 + (ball.y - 34) * 0.26;
          maxv = GK_V;

        } else if (p === carrier) {
          tx = p.x + fwd * 2.2;                       // drive forward
          ty = p.y + p.wob * 1.2;
          // Carry at jog normally, but accelerate away under pressure so
          // being closed down is a genuine contest rather than a formality.
          maxv = (presser && pd < 6) ? SPRINT * 0.92 : JOG;

        } else if (p === presser && pd < R.roam) {
          tx = ball.x; ty = ball.y;                   // close the ball down
          maxv = SPRINT;

        } else {
          // Hold the slot, adjusted for the phase of play.
          tx = p.hx + fwd * (attacking ? R.adv : R.drop);

          // Lateral: slide toward the ball's side by a role-specific
          // amount. A winger barely moves (holds width); a centre-back
          // shuffles across to stay compact.
          ty = p.hy + (ball.y - PH / 2) * R.pull;

          // Flank runs: a full-back or winger surges up their own touchline
          // when their team has it and the ball is on their side.
          if (R.run && attacking) {
            var onMySide = (p.hy > PH / 2) === (ball.y > PH / 2);
            if (onMySide) {
              tx += fwd * R.run;
              maxv = SPRINT * 0.85;
            }
          }

          tx += p.wob * 2.2;
          ty += p.wob2 * 1.8;
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

        p.vx += (tx - p.x) * 0.040;
        p.vy += (ty - p.y) * 0.040;
        p.vx *= 0.88; p.vy *= 0.88;

        // Hard cap in metres per frame — nothing bounded this before.
        // Everyone moves quicker as the game opens up.
        var lift = 0.90 + tempo * 0.55;
        var cap = maxv * lift;
        var sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (sp > cap) { p.vx = (p.vx / sp) * cap; p.vy = (p.vy / sp) * cap; }

        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(1, Math.min(PW - 1, p.x));
        p.y = Math.max(1, Math.min(PH - 1, p.y));

        p.ph += 0.006; p.ph2 += 0.0043;
        p.wob = Math.sin(p.ph); p.wob2 = Math.sin(p.ph2);
        if (p.cool > 0) p.cool--;
      }

      /* ---- ball ---- */
      if (ball.state === 'carry' && carrier) {
        ball.x = carrier.x + (carrier.team === 0 ? 0.9 : -0.9);
        ball.y = carrier.y;
        ball.t++;

        // Duel. A challenge is a chance per frame, not a capture the
        // instant someone crosses a fixed radius — and the receiver gets
        // a moment on the ball before anyone can nick it.
        if (ball.t > 12) {
          for (var s = 0; s < players.length; s++) {
            var op = players[s];
            if (op.team === carrier.team || op.cool > 0) continue;
            var od = dist(op.x, op.y, ball.x, ball.y);
            if (od > 1.9) continue;
            // ~5% per frame ≈ a duel lasting a few tenths of a second.
            if (Math.random() < 0.05) {
              carrier.cool = 80;                 // ~1.3s before he can win it back
              tempo = Math.min(1, tempo + 0.55);  // a turnover breaks the game open
              ball.owner = op; ball.t = 0;
              break;
            }
          }
        }

        // Under real pressure, move it on early rather than get caught.
        // Tuned against a 60s simulation: pd 3.2/t20 produced 45 panic
        // releases out of 91 events and a 0.65s average touch.
        var hounded = presser && pd < 2.6 && ball.t > 40;
        // High tempo means the ball is moved on quicker.
        var dwell = (54 + Math.random() * 62) * (1.30 - tempo * 0.72);
        if (hounded || ball.t > dwell) {
          var inFinalThird = carrier.team === 0 ? carrier.x > 74 : carrier.x < 31;
          if (inFinalThird && Math.random() < 0.55) {
            shoot(carrier);
          } else {
            var tgt = choosePass(carrier);
            if (tgt) passTo(tgt, (PASS_MIN + Math.random() * PASS_VAR) * (0.92 + tempo * 0.34));
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
      var away  = cs.getPropertyValue('--fx-away').trim()  || '#94A3B8';
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
    // initField() retired: apex-sports.js now owns the background
    // surface, and running both drew two pitches on top of each other.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
