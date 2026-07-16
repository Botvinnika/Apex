/**
 * APEX SPORTS — Violent Storm Engine v3
 * Erratic, multi-node, full-screen branching chaos.
 */
(function () {
  'use strict';

  const canvas = document.createElement('canvas');
  canvas.id = 'lightning-bg';
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:0;pointer-events:none;';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let W, H;
  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // ── SCROLL-BASED OPACITY ─────────────────────────────────────
  // Full effect at top, quietly reduces to a subtle blur as user scrolls.
  // Strike tempo stays identical — only the canvas visual opacity changes.
  let scrollAlpha    = 1.0;   // current canvas opacity (lerped)
  let scrollTarget   = 1.0;   // target based on scroll position
  const SCROLL_FULL  = 120;   // px — full effect until here
  const SCROLL_MIN   = 900;   // px — minimum opacity reached here
  const ALPHA_MIN    = 0.12;  // minimum canvas opacity when scrolled deep

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    if (y <= SCROLL_FULL) {
      scrollTarget = 1.0;
    } else {
      const t = Math.min(1, (y - SCROLL_FULL) / (SCROLL_MIN - SCROLL_FULL));
      scrollTarget = 1.0 - t * (1.0 - ALPHA_MIN);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // ── STORM CONFIG — violent & erratic ──────────────────────────
  const S = {
    quietMin:    180,   // ms between strikes
    quietMax:    900,
    jag:         0.62,  // angle swing — erratic but directional
    branchProb:  0.40,  // high branching
    maxDepth:    6,     // deep recursive branches
    branchFade:  0.58,
    segMin:      28,    // longer segments = thinner, longer-reaching bolts
    segMax:      75,
    flashPeak:   0.32,
    boltOpacity: 1.0,
    MAX_BOLTS:   8,
  };

  let nextStrike = performance.now() + 100;
  let skyFlash = 0, skyFlashX = 0.5;
  let bolts = [];
  let frameId;

  // ── BOLT BUILDER — recursive, multi-node chaos ────────────────
  function buildBolt(x, y, angle, budget, depth, alpha, segs) {
    let cx = x, cy = y, rem = budget;
    while (rem > 0) {
      // Double-jag: add two random angle kicks per segment for extra erratic feel
      angle += (Math.random() - 0.5) * 2 * S.jag;
      angle += (Math.random() - 0.5) * S.jag * 0.5; // secondary micro-jag

      const len = Math.min(rem, S.segMin + Math.random() * (S.segMax - S.segMin));
      const nx = cx + Math.cos(angle) * len;
      const ny = cy + Math.sin(angle) * len;

      segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, alpha });

      // Spawn branch
      if (depth > 0 && Math.random() < S.branchProb) {
        const bAngle  = angle + (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.9);
        const bBudget = rem * (0.3 + Math.random() * 0.5);
        buildBolt(nx, ny, bAngle, bBudget, depth - 1, alpha * S.branchFade, segs);
      }
      // Occasional second branch from same node (forked bolt effect)
      if (depth > 1 && Math.random() < 0.12) {
        const bAngle2  = angle + (Math.random() > 0.5 ? 1 : -1) * (0.2 + Math.random() * 0.4);
        const bBudget2 = rem * (0.15 + Math.random() * 0.25);
        buildBolt(nx, ny, bAngle2, bBudget2, depth - 2, alpha * S.branchFade * 0.7, segs);
      }

      cx = nx; cy = ny; rem -= len;
    }
  }

  function spawnStrike(xFrac, lengthFrac, opacity) {
    const segs = [];
    const startX = W * (xFrac !== undefined ? xFrac : 0.05 + Math.random() * 0.9);
    // Vary starting Y too — some bolts start mid-sky
    const startY = H * (Math.random() < 0.75 ? 0 : Math.random() * 0.2) - 10;
    const baseAngle = (Math.PI / 2) + (Math.random() - 0.5) * 0.9;
    const length = H * (lengthFrac || (0.65 + Math.random() * 0.40));
    buildBolt(startX, startY, baseAngle, length, S.maxDepth, opacity || S.boltOpacity, segs);
    const now = performance.now();
    bolts.push({ segs, pattern: mkPattern(now), dead: false });
    skyFlash = Math.max(skyFlash, S.flashPeak);
    skyFlashX = startX / W;
  }

  // ── FLASH PATTERN — 1, 2, or 3 re-strikes ────────────────────
  function mkPattern(now) {
    const f1 = { start: now, dur: 40 + Math.random() * 55 };
    const f2 = Math.random() < 0.72 ? { start: f1.start + f1.dur + 25 + Math.random() * 60, dur: 25 + Math.random() * 40 } : null;
    const f3 = f2 && Math.random() < 0.45 ? { start: f2.start + f2.dur + 20 + Math.random() * 35, dur: 15 + Math.random() * 25 } : null;
    const f4 = f3 && Math.random() < 0.2  ? { start: f3.start + f3.dur + 15 + Math.random() * 25, dur: 10 + Math.random() * 18 } : null;
    const all = [f1, f2, f3, f4].filter(Boolean);
    const last = all[all.length - 1];
    return { flashes: all, fadeStart: last.start + last.dur, fadeDur: 120 + Math.random() * 180 };
  }

  function getAlpha(bolt, now) {
    const p = bolt.pattern;
    for (const f of p.flashes) {
      if (now >= f.start && now < f.start + f.dur) return 0.9 + 0.1 * Math.random();
    }
    for (let i = 0; i < p.flashes.length - 1; i++) {
      if (now >= p.flashes[i].start + p.flashes[i].dur && now < p.flashes[i + 1].start)
        return 0.08 + 0.08 * Math.random();
    }
    if (now >= p.fadeStart) {
      const t = (now - p.fadeStart) / p.fadeDur;
      if (t >= 1) { bolt.dead = true; return 0; }
      return (1 - t) * 0.06;
    }
    return 0;
  }

  // ── DRAW BOLT — 4 layers for maximum visual impact ────────────
  function drawBolt(bolt, now) {
    const ma = getAlpha(bolt, now);
    if (ma < 0.004) return;

    for (const seg of bolt.segs) {
      const a = ma * seg.alpha;
      if (a < 0.004) continue;

      // Layer 1 — outer glow (narrow)
      ctx.save();
      ctx.globalAlpha = a * 0.12;
      ctx.strokeStyle = '#4499ff';
      ctx.lineWidth = 10;
      ctx.shadowColor = '#0055ff';
      ctx.shadowBlur = 22;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();

      // Layer 2 — soft halo
      ctx.save();
      ctx.globalAlpha = a * 0.28;
      ctx.strokeStyle = '#88ccff';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#00aaff';
      ctx.shadowBlur = 12;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();

      // Layer 3 — thin blue-white channel
      ctx.save();
      ctx.globalAlpha = a * 0.65;
      ctx.strokeStyle = '#cce8ff';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#55aaff';
      ctx.shadowBlur = 6;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();

      // Layer 4 — razor white core
      ctx.save();
      ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.7;
      ctx.shadowColor = '#eeffff';
      ctx.shadowBlur = 3;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); ctx.stroke();
      ctx.restore();
    }
  }

  // ── SKY FLASH — asymmetric, follows bolt origin ───────────────
  function drawSkyFlash() {
    if (skyFlash < 0.003) return;
    const gx = W * skyFlashX;
    const grad = ctx.createRadialGradient(gx, 0, 0, gx, H * 0.1, H * 1.1);
    grad.addColorStop(0,   `rgba(180, 225, 255, ${skyFlash})`);
    grad.addColorStop(0.2, `rgba(90,  160, 230, ${skyFlash * 0.5})`);
    grad.addColorStop(0.55,`rgba(30,   80, 160, ${skyFlash * 0.15})`);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    skyFlash *= 0.76; // faster decay = sharper flash
  }

  // ── RENDER LOOP ───────────────────────────────────────────────
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    drawSkyFlash();

    if (now >= nextStrike) {
      spawnStrike();

      // Cluster: 50% chance of 1 companion, 25% chance of 2, 10% of 3
      const extras = Math.random() < 0.1 ? 3 : Math.random() < 0.25 ? 2 : Math.random() < 0.5 ? 1 : 0;
      for (let e = 0; e < extras; e++) {
        const delay = 60 + e * 100 + Math.random() * 100;
        setTimeout(() => {
          if (bolts.length < S.MAX_BOLTS) {
            spawnStrike(undefined, 0.35 + Math.random() * 0.45, S.boltOpacity * 0.8);
          }
        }, delay);
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

  frameId = requestAnimationFrame(render);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(frameId);
    else frameId = requestAnimationFrame(render);
  });
})();
