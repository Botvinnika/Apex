/* ============================================================
   APEX SPORTS FIELD

   One fixed background surface that morphs between sports as the
   page scrolls: football, then basketball, then tennis.

   Structure:
     - SPORTS holds each surface's real dimensions, its line
       markings, and the parameters its simulation runs on.
     - ONE generic engine drives all three. They differ only in
       squad size, formation, speeds and where a shot is aimed —
       not in code — so a fix to possession logic fixes every sport.
     - Sections declare data-sport="…"; whichever is nearest the
       middle of the viewport wins, and the surface cross-fades.

   Everything is measured in real metres and mapped through the
   same xMidYMid-slice transform the markings SVG uses, so players
   always sit on the painted lines.
   ============================================================ */
(function () {
  'use strict';

  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var REDUCED = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ============================================================
     SURFACES
     ============================================================ */
  var SPORTS = {

    /* ---------- FOOTBALL · 105 x 68 ---------- */
    football: {
      W: 105, H: 68,
      squad: 11,
      rate: 2.05,
      // metres/frame at 60fps, before the shared rate multiplier
      sprint: 0.135, jog: 0.075, keeper: 0.052,
      pass: [0.27, 0.10], shot: [0.38, 0.08],
      hold: [54, 62],
      goalHalf: 3.7,            // half-width of the scoring mouth
      finalThird: 0.70,         // fraction of pitch length before shooting
      shootChance: 0.55,
      shape: [
        { x: 5,  y: 34, role: 'GK' },
        { x: 20, y: 56, role: 'FB' }, { x: 17, y: 41, role: 'CB' },
        { x: 17, y: 27, role: 'CB' }, { x: 20, y: 12, role: 'FB' },
        { x: 33, y: 34, role: 'DM' },
        { x: 42, y: 46, role: 'CM' }, { x: 42, y: 22, role: 'CM' },
        { x: 64, y: 59, role: 'WG' }, { x: 70, y: 34, role: 'ST' },
        { x: 64, y: 9,  role: 'WG' }
      ],
      marks:
        '<g fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke">' +
        '<rect x=".5" y=".5" width="104" height="67"/>' +
        '<line x1="52.5" y1=".5" x2="52.5" y2="67.5"/>' +
        '<circle cx="52.5" cy="34" r="9.15"/>' +
        '<rect x=".5" y="13.84" width="16.5" height="40.32"/>' +
        '<rect x=".5" y="24.84" width="5.5" height="18.32"/>' +
        '<path d="M17 27.1A9.15 9.15 0 0 1 17 40.9"/>' +
        '<rect x="88" y="13.84" width="16.5" height="40.32"/>' +
        '<rect x="99" y="24.84" width="5.5" height="18.32"/>' +
        '<path d="M88 27.1A9.15 9.15 0 0 0 88 40.9"/>' +
        '</g><g fill="currentColor">' +
        '<circle cx="52.5" cy="34" r=".45"/><circle cx="11" cy="34" r=".45"/>' +
        '<circle cx="94" cy="34" r=".45"/></g>'
    },

    /* ---------- BASKETBALL · 28 x 15 ---------- */
    basketball: {
      W: 28, H: 15,
      squad: 5,
      rate: 2.3,
      sprint: 0.115, jog: 0.070, keeper: 0.070,
      pass: [0.30, 0.12], shot: [0.34, 0.08],
      hold: [34, 40],           // the shot clock makes everything quicker
      goalHalf: 0.9,            // the rim is small — most attempts miss
      finalThird: 0.60,
      shootChance: 0.72,
      shape: [
        { x: 6,  y: 7.5, role: 'PG' },
        { x: 10, y: 3,   role: 'SG' }, { x: 10, y: 12, role: 'SF' },
        { x: 14, y: 5.5, role: 'PF' }, { x: 14, y: 9.5, role: 'C'  }
      ],
      marks:
        '<g fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke">' +
        '<rect x=".4" y=".4" width="27.2" height="14.2"/>' +
        '<line x1="14" y1=".4" x2="14" y2="14.6"/>' +
        '<circle cx="14" cy="7.5" r="1.8"/>' +
        // keys
        '<rect x=".4" y="4.9" width="5.8" height="4.9"/>' +
        '<rect x="21.8" y="4.9" width="5.8" height="4.9"/>' +
        '<circle cx="6.2" cy="7.5" r="1.8"/><circle cx="21.8" cy="7.5" r="1.8"/>' +
        // three-point arcs + corner lines
        '<path d="M1.6 .9v2.1A6.75 6.75 0 0 0 1.6 12v2.1"/>' +
        '<path d="M26.4 .9v2.1A6.75 6.75 0 0 1 26.4 12v2.1"/>' +
        '</g><g fill="currentColor">' +
        '<circle cx="1.6" cy="7.5" r=".28"/><circle cx="26.4" cy="7.5" r=".28"/></g>'
    },

    /* ---------- TENNIS · 23.77 x 10.97 (doubles) ---------- */
    tennis: {
      W: 23.77, H: 10.97,
      squad: 2,
      rate: 2.2,
      sprint: 0.105, jog: 0.062, keeper: 0.062,
      pass: [0.42, 0.14], shot: [0.46, 0.10],
      hold: [26, 26],           // a stroke is struck almost on contact
      goalHalf: 5.5,
      finalThird: 0.0,
      shootChance: 0.30,
      rally: true,              // two players trading, no possession chain
      shape: [
        { x: 2.2, y: 5.5, role: 'BASE' },
        { x: 6.0, y: 5.5, role: 'NET'  }
      ],
      marks:
        '<g fill="none" stroke="currentColor" stroke-width="1.3" vector-effect="non-scaling-stroke">' +
        '<rect x=".3" y=".3" width="23.17" height="10.37"/>' +
        // singles tramlines
        '<line x1=".3" y1="1.67" x2="23.47" y2="1.67"/>' +
        '<line x1=".3" y1="9.3" x2="23.47" y2="9.3"/>' +
        // net
        '<line x1="11.885" y1="-.2" x2="11.885" y2="11.17" stroke-width="2.6"/>' +
        // service boxes
        '<line x1="5.485" y1="1.67" x2="5.485" y2="9.3"/>' +
        '<line x1="18.285" y1="1.67" x2="18.285" y2="9.3"/>' +
        '<line x1="5.485" y1="5.485" x2="18.285" y2="5.485"/>' +
        '</g>'
    }
  };

  var ORDER = ['football', 'basketball', 'tennis'];

  /* ============================================================
     GENERIC ENGINE
     One simulation, parameterised by surface. Roles only change how
     far a player pushes up, how much they slide toward the ball, and
     how far they will roam to press.
     ============================================================ */
  var ROLE = {
    GK:  { adv: 2,  drop: -1,  pull: 0.18, roam: 6,  run: 0 },
    CB:  { adv: 8,  drop: -5,  pull: 0.42, roam: 14, run: 0 },
    FB:  { adv: 20, drop: -2,  pull: 0.12, roam: 18, run: 14 },
    DM:  { adv: 7,  drop: -8,  pull: 0.46, roam: 20, run: 0 },
    CM:  { adv: 15, drop: -9,  pull: 0.34, roam: 24, run: 0 },
    WG:  { adv: 14, drop: -22, pull: 0.10, roam: 20, run: 10 },
    ST:  { adv: 12, drop: -18, pull: 0.24, roam: 16, run: 0 },
    // basketball — everyone presses, spacing matters more than lines
    PG:  { adv: 5,  drop: -3,  pull: 0.34, roam: 12, run: 3 },
    SG:  { adv: 5,  drop: -3,  pull: 0.22, roam: 12, run: 4 },
    SF:  { adv: 5,  drop: -3,  pull: 0.22, roam: 12, run: 4 },
    PF:  { adv: 4,  drop: -2,  pull: 0.30, roam: 10, run: 0 },
    C:   { adv: 3,  drop: -2,  pull: 0.30, roam: 9,  run: 0 },
    // tennis
    BASE:{ adv: 1,  drop: -1,  pull: 0.85, roam: 8,  run: 0 },
    NET: { adv: 2,  drop: -2,  pull: 0.80, roam: 8,  run: 0 }
  };

  function dist(a, b, c, d) { var x = a - c, y = b - d; return Math.sqrt(x * x + y * y); }

  function makeSim(S) {
    var R = S.rate;
    var SPRINT = S.sprint * R, JOG = S.jog * R, GKV = S.keeper * R;
    var PASS_MIN = S.pass[0] * R, PASS_VAR = S.pass[1] * R;
    var SHOT_MIN = S.shot[0] * R, SHOT_VAR = S.shot[1] * R;
    var PW = S.W, PH = S.H;

    var players = [], ball = null, trail = [], line = null, flash = 0;
    var tempo = 0.45, tempoBase = 0.45, phase = Math.random() * 6.28;

    function mirror(p) { return { x: PW - p.x, y: PH - p.y, role: p.role }; }

    function reset(kick) {
      players = [];
      for (var t = 0; t < 2; t++) {
        for (var i = 0; i < S.shape.length; i++) {
          var b = t === 0 ? S.shape[i] : mirror(S.shape[i]);
          players.push({
            team: t, role: b.role, gk: b.role === 'GK',
            hx: b.x, hy: b.y, x: b.x, y: b.y, vx: 0, vy: 0,
            ph: Math.random() * 6.28, ph2: Math.random() * 6.28,
            wob: 0, wob2: 0, cool: 0
          });
        }
      }
      var n = S.shape.length;
      var starter = players[kick * n + (n > 2 ? n - 2 : 0)];
      ball = { x: PW / 2, y: PH / 2, vx: 0, vy: 0, owner: starter, state: 'carry', t: 0 };
      trail = []; line = null;
      for (var z = 0; z < players.length; z++) players[z].cool = 0;
    }

    function choosePass(c) {
      var best = null, bs = -Infinity, fwd = c.team === 0 ? 1 : -1;
      var reach = PW * 0.42;
      for (var i = 0; i < players.length; i++) {
        var m = players[i];
        if (m.team !== c.team || m === c || m.gk) continue;
        var d = dist(c.x, c.y, m.x, m.y);
        if (d < PW * 0.05 || d > reach) continue;
        var press = Infinity;
        for (var k = 0; k < players.length; k++) {
          var o = players[k];
          if (o.team === c.team) continue;
          press = Math.min(press, dist(m.x, m.y, o.x, o.y));
        }
        var sc2 = (m.x - c.x) * fwd * 1.4 + press * 2.4 - d * 0.30 + Math.random() * 11;
        if (sc2 > bs) { bs = sc2; best = m; }
      }
      return best;
    }

    function passTo(tg, sp) {
      var d = dist(ball.x, ball.y, tg.x, tg.y) || 1;
      ball.vx = ((tg.x - ball.x) / d) * sp;
      ball.vy = ((tg.y - ball.y) / d) * sp;
      ball.state = 'travel'; ball.target = tg; ball.owner = null;
      line = { x1: ball.x, y1: ball.y, x2: tg.x, y2: tg.y, life: 1 };
    }

    function shoot(c) {
      var gx = c.team === 0 ? PW : 0;
      var gy = PH / 2 + (Math.random() - 0.5) * PH * 0.30;
      var d = dist(ball.x, ball.y, gx, gy) || 1;
      var sp = (SHOT_MIN + Math.random() * SHOT_VAR) * (0.92 + tempo * 0.18);
      ball.vx = ((gx - ball.x) / d) * sp;
      ball.vy = ((gy - ball.y) / d) * sp;
      ball.state = 'shot'; ball.owner = null; ball.target = null;
      line = { x1: ball.x, y1: ball.y, x2: gx, y2: gy, life: 1 };
    }

    function step() {
      var carrier = ball.owner;

      phase += 0.0022;
      tempoBase = 0.45 + Math.sin(phase) * 0.22;
      tempo += (tempoBase - tempo) * 0.012;
      tempo = Math.max(0, Math.min(1, tempo));

      var inPoss = carrier ? carrier.team : -1;
      var presser = null, pd = Infinity;
      if (carrier) {
        for (var c = 0; c < players.length; c++) {
          var pc = players[c];
          if (pc.team === carrier.team || pc.gk || pc.cool > 0) continue;
          var dc = dist(pc.x, pc.y, ball.x, ball.y);
          if (dc < pd) { pd = dc; presser = pc; }
        }
      }

      for (var i = 0; i < players.length; i++) {
        var p = players[i];
        var Rl = ROLE[p.role] || ROLE.CM;
        var fwd = p.team === 0 ? 1 : -1;
        var att = p.team === inPoss;
        var maxv = JOG, tx, ty;

        // Roles are written in football metres; scale to this surface.
        var k = PW / 105;

        if (p.gk) {
          tx = p.hx + (ball.x - p.hx) * 0.04;
          ty = PH / 2 + (ball.y - PH / 2) * 0.26;
          maxv = GKV;
        } else if (p === carrier) {
          tx = p.x + fwd * 2.2 * k;
          ty = p.y + p.wob * 1.2 * k;
          maxv = (presser && pd < 6 * k) ? SPRINT * 0.92 : JOG;
        } else if (p === presser && pd < Rl.roam * k) {
          tx = ball.x; ty = ball.y; maxv = SPRINT;
        } else {
          tx = p.hx + fwd * (att ? Rl.adv : Rl.drop) * k;
          ty = p.hy + (ball.y - PH / 2) * Rl.pull;
          if (Rl.run && att) {
            var mine = (p.hy > PH / 2) === (ball.y > PH / 2);
            if (mine) { tx += fwd * Rl.run * k; maxv = SPRINT * 0.85; }
          }
          tx += p.wob * 2.2 * k;
          ty += p.wob2 * 1.8 * k;
        }

        p.vx += (tx - p.x) * 0.040;
        p.vy += (ty - p.y) * 0.040;
        p.vx *= 0.88; p.vy *= 0.88;

        var lift = 0.90 + tempo * 0.55;
        var cap = maxv * lift;
        var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (spd > cap) { p.vx = (p.vx / spd) * cap; p.vy = (p.vy / spd) * cap; }

        p.x += p.vx; p.y += p.vy;
        p.x = Math.max(0.4, Math.min(PW - 0.4, p.x));
        p.y = Math.max(0.4, Math.min(PH - 0.4, p.y));

        p.ph += 0.006; p.ph2 += 0.0043;
        p.wob = Math.sin(p.ph); p.wob2 = Math.sin(p.ph2);
        if (p.cool > 0) p.cool--;
      }

      if (ball.state === 'carry' && carrier) {
        ball.x = carrier.x + (carrier.team === 0 ? 0.9 : -0.9) * (PW / 105);
        ball.y = carrier.y;
        ball.t++;

        if (ball.t > 12) {
          for (var s2 = 0; s2 < players.length; s2++) {
            var op = players[s2];
            if (op.team === carrier.team || op.cool > 0) continue;
            if (dist(op.x, op.y, ball.x, ball.y) > 1.9 * (PW / 105)) continue;
            if (Math.random() < 0.05) {
              carrier.cool = 80;
              tempo = Math.min(1, tempo + 0.55);
              ball.owner = op; ball.t = 0;
              break;
            }
          }
        }

        var hounded = presser && pd < 2.6 * (PW / 105) && ball.t > 40;
        var dwell = (S.hold[0] + Math.random() * S.hold[1]) * (1.30 - tempo * 0.72);
        if (hounded || ball.t > dwell) {
          var deep = carrier.team === 0
            ? carrier.x > PW * S.finalThird
            : carrier.x < PW * (1 - S.finalThird);
          if ((deep || S.rally) && Math.random() < S.shootChance) shoot(carrier);
          else {
            var tg = choosePass(carrier);
            if (tg) passTo(tg, (PASS_MIN + Math.random() * PASS_VAR) * (0.92 + tempo * 0.34));
            else ball.t = 0;
          }
        }

      } else if (ball.state === 'travel' || ball.state === 'shot') {
        ball.x += ball.vx; ball.y += ball.vy;
        ball.vx *= 0.991; ball.vy *= 0.991;

        if (ball.state === 'travel' && ball.target &&
            dist(ball.x, ball.y, ball.target.x, ball.target.y) < 1.5 * (PW / 105)) {
          var win = ball.target, wd = 1.6 * (PW / 105);
          for (var u = 0; u < players.length; u++) {
            var dd = dist(players[u].x, players[u].y, ball.x, ball.y);
            if (dd < wd) { wd = dd; win = players[u]; }
          }
          ball.owner = win; ball.state = 'carry'; ball.t = 0;
        }

        if (ball.state === 'shot') {
          var scored = (ball.x > PW - 0.5 && Math.abs(ball.y - PH / 2) < S.goalHalf) ||
                       (ball.x < 0.5 && Math.abs(ball.y - PH / 2) < S.goalHalf);
          if (scored) { flash = 1; reset(Math.random() < 0.5 ? 0 : 1); return; }
          if (ball.x < -1 || ball.x > PW + 1 || ball.y < -1 || ball.y > PH + 1) {
            reset(ball.vx > 0 ? 1 : 0); return;
          }
          for (var g = 0; g < players.length; g++) {
            var kp = players[g];
            if (kp.gk && dist(kp.x, kp.y, ball.x, ball.y) < 2.4 * (PW / 105)) {
              ball.owner = kp; ball.state = 'carry'; ball.t = 0; break;
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
      if (line) { line.life -= 0.045; if (line.life <= 0) line = null; }
      if (flash > 0) flash -= 0.02;
    }

    return {
      reset: reset,
      step: step,
      state: function () {
        return { players: players, ball: ball, trail: trail, line: line, flash: flash };
      }
    };
  }

  /* ============================================================
     MOUNT
     ============================================================ */
  function init() {
    if (!document.body) return;
    if ($('.sport-fx')) return;

    var fx = document.createElement('div');
    fx.className = 'sport-fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML =
      '<div class="site-fx__layer" style="--depth:26"><div class="site-fx__blob site-fx__blob--1"></div></div>' +
      '<div class="site-fx__layer" style="--depth:16"><div class="site-fx__blob site-fx__blob--2"></div></div>' +
      '<div class="site-fx__layer" style="--depth:34"><div class="site-fx__blob site-fx__blob--3"></div></div>' +
      '<div class="site-fx__layer" style="--depth:20"><div class="site-fx__blob site-fx__blob--4"></div></div>' +
      '<div class="sport-fx__mow"></div>' +
      '<div class="sport-fx__marks" data-marks></div>' +
      '<canvas class="sport-fx__net" data-play></canvas>' +
      '<div class="sport-fx__veil"></div>';
    document.body.insertBefore(fx, document.body.firstChild);

    var marksHost = $('[data-marks]', fx);
    var cv = $('[data-play]', fx);
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var current = null, sim = null, S = null;
    var w = 0, h = 0, sc = 1, ox = 0, oy = 0;
    var raf = null;

    function paintMarks(name) {
      var sp = SPORTS[name];
      marksHost.innerHTML =
        '<svg viewBox="0 0 ' + sp.W + ' ' + sp.H + '" preserveAspectRatio="xMidYMid slice">' +
        sp.marks + '</svg>';
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!S) return;
      sc = Math.max(w / S.W, h / S.H);
      ox = (w - S.W * sc) / 2;
      oy = (h - S.H * sc) / 2;
    }

    function setSport(name, instant) {
      if (name === current || !SPORTS[name]) return;
      current = name;
      var swap = function () {
        S = SPORTS[name];
        sim = makeSim(S);
        sim.reset(Math.random() < 0.5 ? 0 : 1);
        paintMarks(name);
        resize();
        fx.dataset.sport = name;
        fx.classList.remove('is-swapping');
      };
      if (instant || REDUCED) { swap(); return; }
      // Cross-fade: drop out, swap the surface, fade the new one in.
      fx.classList.add('is-swapping');
      setTimeout(swap, 420);
    }

    function X(v) { return ox + v * sc; }
    function Y(v) { return oy + v * sc; }

    function draw() {
      raf = requestAnimationFrame(draw);
      if (!sim || !S) return;
      sim.step();
      var st = sim.state();
      ctx.clearRect(0, 0, w, h);

      var cs = getComputedStyle(fx);
      var home  = cs.getPropertyValue('--fx-home').trim()  || '#38BDF8';
      var away  = cs.getPropertyValue('--fx-away').trim()  || '#F0349B';
      var ballC = cs.getPropertyValue('--fx-ball').trim()  || '#fff';
      var trailC = cs.getPropertyValue('--fx-trail').trim() || 'rgba(255,255,255,.5)';

      if (st.line) {
        ctx.globalAlpha = st.line.life * 0.5;
        ctx.strokeStyle = trailC;
        ctx.lineWidth = Math.max(1, sc * 0.11);
        ctx.setLineDash([sc * 0.5, sc * 0.5]);
        ctx.beginPath();
        ctx.moveTo(X(st.line.x1), Y(st.line.y1));
        ctx.lineTo(X(st.line.x2), Y(st.line.y2));
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = trailC;
      ctx.lineWidth = Math.max(1.2, sc * 0.16);
      ctx.beginPath();
      for (var i = 0; i < st.trail.length; i++) {
        var t = st.trail[i];
        if (i === 0) ctx.moveTo(X(t[0]), Y(t[1])); else ctx.lineTo(X(t[0]), Y(t[1]));
      }
      ctx.stroke();

      for (var p = 0; p < st.players.length; p++) {
        var pl = st.players[p];
        ctx.globalAlpha = pl.gk ? 0.55 : 0.85;
        ctx.fillStyle = pl.team === 0 ? home : away;
        ctx.beginPath();
        ctx.arc(X(pl.x), Y(pl.y), sc * (pl.gk ? 0.48 : 0.55), 0, Math.PI * 2);
        ctx.fill();
        if (pl === st.ball.owner) {
          ctx.globalAlpha = 0.9;
          ctx.strokeStyle = pl.team === 0 ? home : away;
          ctx.lineWidth = Math.max(1, sc * 0.09);
          ctx.beginPath();
          ctx.arc(X(pl.x), Y(pl.y), sc * 1.15, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.fillStyle = ballC;
      ctx.beginPath();
      ctx.arc(X(st.ball.x), Y(st.ball.y), Math.max(1.6, sc * 0.26), 0, Math.PI * 2);
      ctx.fill();

      if (st.flash > 0) {
        ctx.globalAlpha = st.flash * 0.18;
        ctx.fillStyle = ballC;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalAlpha = 1;
    }

    /* ---- which sport is on screen ----
       Driven by scroll rather than IntersectionObserver. IO only fires
       when a threshold is crossed, so a long section could sit on screen
       with no callback and the surface would never change — which is
       exactly what happened: the field stayed on football through every
       basketball and tennis zone. A rAF-throttled scroll check always
       reflects the current position. */
    var zones = $$('section[data-sport], [data-sport]:not(.sport-fx)');

    function pick() {
      if (!zones.length) return null;
      var mid = window.innerHeight / 2, best = null, bd = Infinity;
      for (var i = 0; i < zones.length; i++) {
        var r = zones[i].getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) continue;
        var d = Math.abs((r.top + r.bottom) / 2 - mid);
        if (d < bd) { bd = d; best = zones[i]; }
      }
      // Nothing straddles the middle (between sections) — keep the last
      // zone scrolled past rather than snapping back to the first.
      if (!best) {
        for (var k = 0; k < zones.length; k++) {
          if (zones[k].getBoundingClientRect().top < mid) best = zones[k];
        }
      }
      return best;
    }

    if (!zones.length) {
      setSport('football', true);
    } else {
      var first = pick() || zones[0];
      setSport(first.dataset.sport, true);

      var ticking = false;
      var onScroll = function () {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(function () {
          ticking = false;
          var z = pick();
          if (z) setSport(z.dataset.sport);
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    if (!REDUCED) raf = requestAnimationFrame(draw);
    else { sim && sim.step(); draw(); cancelAnimationFrame(raf); }

    window.ApexSportsField = {
      set: function (n) { setSport(n); },
      list: ORDER.slice()
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
