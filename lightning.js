/**
 * APEX SPORTS — Violent Storm Engine v3
 * Erratic, multi-node, full-screen branching chaos.
 *
 * Theme-aware: the storm only runs in dark mode. In light mode
 * a calmer "sun rays" overlay is shown via CSS (see theme.css).
 * Exposes window.ApexStorm.start() / .stop() for the theme
 * manager so toggling light/dark doesn't fork new instances.
 */
(function () {
  'use strict';

  // Singleton guard — the script may be referenced multiple times
  // by MutationObservers, app re-inits, or dev hot-reloads. Keep
  // a single live storm engine.
  if (window.ApexStorm) return;
  window.ApexStorm = { running: false };

  let canvas, ctx, W, H;
  let frameId, observer, resizeBound, scrollBound;
  let nextStrike = 0, skyFlash = 0, skyFlashX = 0.5;
  let bolts = [];
  let scrollAlpha = 1.0, scrollTarget = 1.0;

  function start() {
    if (window.ApexStorm.running) return;
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (theme !== 'dark') return; // light mode is handled by CSS

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'lightning-bg';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
      ctx = canvas.getContext('2d');
    }
    if (document.body && !canvas.isConnected) {
      document.body.insertBefore(canvas, document.body.firstChild);
    } else if (!document.body) {
      return document.addEventListener('DOMContentLoaded', start, { once: true });
    }

    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (!resizeBound) {
      resizeBound = () => { W = canvas.width  = window.innerWidth;
                            H = canvas.height = window.innerHeight; };
      window.addEventListener('resize', resizeBound);
    }
    if (!scrollBound) {
      scrollBound = () => {
        const y = window.scrollY || 0;
        scrollTarget = y <= 120 ? 1.0
                     : Math.max(0.12, 1.0 - (Math.min(1, (y - 120) / 780)) * 0.88);
      };
      window.addEventListener('scroll', scrollBound, { passive: true });
    }

    nextStrike = performance.now() + 100;
    frameId = requestAnimationFrame(render);
    window.ApexStorm.running = true;
  }

  function stop() {
    if (!window.ApexStorm.running) return;
    if (frameId) cancelAnimationFrame(frameId);
    frameId = null;
    if (ctx) ctx.clearRect(0, 0, W, H);
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    bolts = [];
    window.ApexStorm.running = false;
  }

  // Watch for theme flips and start/stop accordingly. Cheap and
  // safe — `start()`/`stop()` are idempotent.
  observer = new MutationObserver(() => {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    if (theme === 'dark') start(); else stop();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // Kick the engine off if the page loads already in dark mode.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // ── STORM CONFIG — calm & infrequent ──────────────────────────
  // The original storm was violent and constant; it competed with
  // the content. We now treat lightning as subtle ambience: rare,
  // soft, single bolts with low sky-flash. Storms feel like
  // weather, not the main attraction.
  const S = {
    quietMin:    4500,  // ms — long quiet between strikes (was 180)
    quietMax:    9000,  // ms — most gaps are several seconds
    jag:         0.38,  // smoother angles (was 0.62)
    branchProb:  0.18,  // fewer forks (was 0.40)
    maxDepth:    4,     // shallower bolts (was 6)
    branchFade:  0.50,
    segMin:      22,
    segMax:      55,    // shorter bolts (was 75)
    flashPeak:   0.10,  // very soft sky flash (was 0.32)
    boltOpacity: 0.55,  // overall dimmer (was 1.0)
    MAX_BOLTS:   3,     // cap concurrent visible bolts (was 8)
  };

  // ── BOLT BUILDER — recursive, calmer chaos ────────────────────
  function buildBolt(x, y, angle, budget, depth, alpha, segs) {
    let cx = x, cy = y, rem = budget;
    while (rem > 0) {
      angle += (Math.random() - 0.5) * 2 * S.jag;

      const len = Math.min(rem, S.segMin + Math.random() * (S.segMax - S.segMin));
      const nx = cx + Math.cos(angle) * len;
      const ny = cy + Math.sin(angle) * len;

      segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, alpha });

      if (depth > 0 && Math.random() < S.branchProb) {
        const bAngle  = angle + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.9);
        const bBudget = rem * (0.3 + Math.random() * 0.5);
        buildBolt(nx, ny, bAngle, bBudget, depth - 1, alpha * S.branchFade, segs);
      }
      // Forked second branch removed — it doubled the visual weight.

      cx = nx; cy = ny; rem -= len;
    }
  }

  function spawnStrike(xFrac, lengthFrac, opacity) {
    const segs = [];
    const startX = W * (xFrac !== undefined ? xFrac : 0.1 + Math.random() * 0.8);
    const startY = H * (Math.random() < 0.8 ? 0 : Math.random() * 0.15) - 10;
    const baseAngle = (Math.PI / 2) + (Math.random() - 0.5) * 0.6;
    const length = H * (lengthFrac || (0.45 + Math.random() * 0.30));
    buildBolt(startX, startY, baseAngle, length, S.maxDepth, opacity || S.boltOpacity, segs);
    const now = performance.now();
    bolts.push({ segs, pattern: mkPattern(now), dead: false });
    skyFlash = Math.max(skyFlash, S.flashPeak);
    skyFlashX = startX / W;
  }

  // ── FLASH PATTERN — single quick strike, no re-strikes ───────
  function mkPattern(now) {
    const f1 = { start: now, dur: 30 + Math.random() * 30 };
    return { flashes: [f1], fadeStart: f1.start + f1.dur, fadeDur: 180 + Math.random() * 220 };
  }

  function getAlpha(bolt, now) {
    const p = bolt.pattern;
    for (const f of p.flashes) {
      if (now >= f.start && now < f.start + f.dur) return 0.7 + 0.15 * Math.random();
    }
    if (now >= p.fadeStart) {
      const t = (now - p.fadeStart) / p.fadeDur;
      if (t >= 1) { bolt.dead = true; return 0; }
      return (1 - t) * 0.05;
    }
    return 0;
  }

  // ── DRAW BOLT — 3 softer layers (was 4) ───────────────────────
  function drawBolt(bolt, now) {
    const ma = getAlpha(bolt, now);
    if (ma < 0.004) return;

    for (const seg of bolt.segs) {
      const a = ma * seg.alpha;
      if (a < 0.004) continue;

      // Layer 1 — soft outer glow
      ctx.save();
      ctx.globalAlpha = a * 0.18;
      ctx.strokeStyle = '#5b8cc8';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#1a4a8a';
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();

      // Layer 2 — halo
      ctx.save();
      ctx.globalAlpha = a * 0.40;
      ctx.strokeStyle = '#9cc7ee';
      ctx.lineWidth = 2.4;
      ctx.shadowColor = '#3a78c0';
      ctx.shadowBlur = 6;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();

      // Layer 3 — thin channel
      ctx.save();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = '#dceaf7';
      ctx.lineWidth = 0.9;
      ctx.shadowColor = '#88b6e0';
      ctx.shadowBlur = 3;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();
    }
  }

  // ── SKY FLASH — very subtle ───────────────────────────────────
  function drawSkyFlash() {
    if (skyFlash < 0.003) return;
    const gx = W * skyFlashX;
    const grad = ctx.createRadialGradient(gx, 0, 0, gx, H * 0.1, H * 1.1);
    grad.addColorStop(0,   `rgba(160, 200, 235, ${skyFlash})`);
    grad.addColorStop(0.2, `rgba(80,  130, 200, ${skyFlash * 0.5})`);
    grad.addColorStop(0.55,`rgba(30,   60, 130, ${skyFlash * 0.12})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    skyFlash *= 0.78;
  }

  // ── RENDER LOOP — single bolts, no clusters ──────────────────
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    drawSkyFlash();

    if (now >= nextStrike) {
      // 20% of strikes are skipped to break up the rhythm.
      if (Math.random() < 0.8 && bolts.length < S.MAX_BOLTS) {
        spawnStrike();
      }
      nextStrike = now + S.quietMin + Math.random() * (S.quietMax - S.quietMin);
    }

    bolts = bolts.filter(b => !b.dead);
    if (bolts.length > S.MAX_BOLTS) bolts.splice(0, bolts.length - S.MAX_BOLTS);
    for (const b of bolts) drawBolt(b, now);

    // Smooth scroll-opacity lerp (exponential ease)
    scrollAlpha += (scrollTarget - scrollAlpha) * 0.07;
    canvas.style.opacity = scrollAlpha.toFixed(3);

    frameId = requestAnimationFrame(render);
  }

  document.addEventListener('visibilitychange', () => {
    if (!window.ApexStorm.running) return;
    if (document.hidden) cancelAnimationFrame(frameId);
    else frameId = requestAnimationFrame(render);
  });
})();
