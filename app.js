/* ============================================================
   APEX SPORTS ANALYTICS — Interactivity & Data Logic
   Preloader | Particle Network | Parallax | Live Widgets
   ============================================================ */

// Mark JS as loaded immediately so .reveal elements can animate in.
// (If JS fails to run, content stays visible by default — no blank page.)
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // 0. PRELOADER v2 — "Ignition"
  //
  //    Choreography is driven by a single eased progress curve.
  //    Everything else (status text, boot log, counter) reads off
  //    that curve, so the sequence can never desynchronise.
  //
  //    Contract with the markup: the module needs #preloader and
  //    degrades cleanly if any individual part is absent. Anything
  //    it cannot find is simply skipped.
  //
  //    Public: window.ApexPreloader.skip()
  // ============================================================
  const pl = document.getElementById('preloader');

  let plSkip = null;
  window.ApexPreloader = { skip: () => plSkip && plSkip() };

  if (!pl) {
    setTimeout(() => {
      if (typeof startFeatureVisuals === 'function') startFeatureVisuals();
      if (typeof window.initScrollAnimations === 'function') window.initScrollAnimations();
    }, 100);
  } else {
    const plFill    = pl.querySelector('[data-pl-fill]');
    const plNum     = pl.querySelector('[data-pl-num]');
    const plStatus  = pl.querySelector('[data-pl-status]');
    const plLog     = pl.querySelector('[data-pl-log]');
    const plBar     = pl.querySelector('.pl__bar');
    const plSkipBtn = pl.querySelector('[data-pl-skip]');

    const REDUCED = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const TOTAL   = REDUCED ? 700 : 2600;   // full sequence length (ms)
    const TYPE_MS = 15;                     // per-character typing speed

    // Status lines are pinned to progress thresholds rather than to a
    // timer, so the message always matches the bar.
    const STAGES = [
      { at: 0,  text: 'Booting model runtime' },
      { at: 22, text: 'Calibrating league priors' },
      { at: 46, text: 'Warming Monte Carlo simulator' },
      { at: 70, text: 'Streaming live odds feeds' },
      { at: 92, text: 'All systems ready' }
    ];

    const LOG = [
      'core.runtime          init',
      'priors/147            loaded',
      'sim.montecarlo        warm',
      'feed.odds             connected',
      'xg.model  v4.7.2      ready',
      'cache.edge af-south-1 hot',
      'route /                200 OK'
    ];

    let finished = false;

    /* ---------- progress ---------- */
    function setPct(p) {
      if (plFill) plFill.style.width = p + '%';
      if (plNum)  plNum.textContent = String(p).padStart(2, '0');
      if (plBar)  plBar.setAttribute('aria-valuenow', String(p));
    }

    /* ---------- typed status ---------- */
    let typeTimer = null;
    function typeStatus(text) {
      if (!plStatus) return;
      clearTimeout(typeTimer);

      if (REDUCED) { plStatus.textContent = text; return; }

      // Start at 1 so the first character lands on this frame. Starting
      // at 0 would paint one empty frame per stage, which reads as a
      // flicker rather than a line being typed.
      let i = 1;
      const caret = document.createElement('span');
      caret.className = 'pl__caret';
      caret.setAttribute('aria-hidden', 'true');

      plStatus.textContent = '';
      plStatus.appendChild(caret);

      (function tick() {
        if (finished || i > text.length) return;
        caret.insertAdjacentText('beforebegin', text.charAt(i - 1) || '');
        i++;
        if (i <= text.length) typeTimer = setTimeout(tick, TYPE_MS);
      })();
    }

    let stageIndex = -1;
    function syncStage(p) {
      let next = stageIndex;
      for (let i = 0; i < STAGES.length; i++) {
        if (p >= STAGES[i].at) next = i;
      }
      if (next !== stageIndex) {
        stageIndex = next;
        typeStatus(STAGES[next].text);
      }
    }

    /* ---------- boot log ---------- */
    function pad2(n) { return String(n).padStart(2, '0'); }

    function pushLog(line) {
      if (!plLog) return;
      const now = new Date();
      const el = document.createElement('span');
      el.className = 'pl__log-line is-new';
      el.innerHTML =
        '<span class="pl__log-time">' +
        pad2(now.getHours()) + ':' + pad2(now.getMinutes()) + ':' + pad2(now.getSeconds()) +
        '</span>' + line.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

      // Demote the previous newest line so only one row is ever bright.
      const prev = plLog.querySelector('.pl__log-line.is-new');
      if (prev) prev.classList.remove('is-new');
      plLog.appendChild(el);

      // Keep the DOM bounded — the mask only shows four rows.
      while (plLog.children.length > 6) plLog.removeChild(plLog.firstChild);
    }

    function startLog() {
      if (!plLog) return;
      if (REDUCED) { LOG.forEach(pushLog); return; }
      let i = 0;
      (function step() {
        if (finished || i >= LOG.length) return;
        pushLog(LOG[i++]);
        setTimeout(step, TOTAL / (LOG.length + 1));
      })();
    }

    /* ---------- per-letter wordmark reveal ---------- */
    // Progressive enhancement: the markup ships whole words (which the
    // CSS already rises as a unit). If JS is here, split into letters
    // so each gets its own delay, blur, and fade.
    function splitWordmark() {
      if (REDUCED) return;
      let n = 0;
      pl.querySelectorAll('.pl__word').forEach(word => {
        const text = word.textContent;
        const isGrad = word.classList.contains('pl__word--grad');
        // Read the ramp off the word BEFORE we clear its background.
        const ramp = isGrad ? getComputedStyle(word).backgroundImage : null;

        word.textContent = '';
        word.style.animation = 'none';
        word.style.transform = 'none';
        word.style.opacity = '1';

        const chars = [];
        for (const ch of text) {
          const s = document.createElement('span');
          s.className = 'pl__ch';
          s.style.setProperty('--c', n++);
          s.textContent = ch;
          word.appendChild(s);
          chars.push(s);
        }

        if (!isGrad || !ramp || ramp === 'none') return;

        // Each letter animates opacity and filter, which promotes it to
        // its own compositing layer — and a promoted child stops the
        // PARENT's background-clip:text from painting through it, so the
        // gradient word rendered as nothing at all.
        //
        // Fix: drop the parent's background and give every letter its own
        // slice of the same ramp, sized to the whole word and offset by
        // the letter's position, so the gradient stays continuous.
        const wordRect = word.getBoundingClientRect();
        word.style.background = 'none';

        chars.forEach(s => {
          const dx = s.getBoundingClientRect().left - wordRect.left;
          s.style.backgroundImage      = ramp;
          s.style.backgroundSize       = wordRect.width + 'px 100%';
          s.style.backgroundPosition   = (-dx) + 'px 0';
          s.style.backgroundRepeat     = 'no-repeat';
          s.style.webkitBackgroundClip = 'text';
          s.style.backgroundClip       = 'text';
          s.style.webkitTextFillColor  = 'transparent';
          s.style.color                = 'transparent';
        });
      });
    }

    /* ---------- particle network ---------- */
    // Drifting nodes joined by proximity links — the "engine thinking"
    // layer. Device-pixel-ratio aware, capped node count, and torn down
    // the moment the preloader dismisses so it costs nothing after.
    let netRaf = null;
    function startNetwork() {
      const cv = pl.querySelector('[data-pl-net]');
      if (!cv || REDUCED) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;

      let w = 0, h = 0, dpr = 1, nodes = [];

      function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = cv.clientWidth;
        h = cv.clientHeight;
        cv.width  = Math.floor(w * dpr);
        cv.height = Math.floor(h * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Scale density to area so phones do not run the desktop count.
        const count = Math.max(38, Math.min(120, Math.round((w * h) / 14000)));
        nodes = [];
        for (let i = 0; i < count; i++) {
          nodes.push({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 1.15,
            vy: (Math.random() - 0.5) * 1.15,
            r: Math.random() * 1.6 + 0.7
          });
        }
      }

      const LINK = 148;
      let frame = 0;

      function draw() {
        if (finished) return;
        ctx.clearRect(0, 0, w, h);

        // Periodic shock: every ~1.4s every node gets a random impulse,
        // so the field keeps re-scrambling instead of drifting to a
        // visually static equilibrium.
        frame++;
        if (frame % 84 === 0) {
          for (const p of nodes) {
            p.vx += (Math.random() - 0.5) * 1.9;
            p.vy += (Math.random() - 0.5) * 1.9;
          }
        }

        for (const p of nodes) {
          p.x += p.vx; p.y += p.vy;
          // Friction keeps repeated shocks from compounding into
          // nodes that rocket off and never come back.
          p.vx *= 0.985; p.vy *= 0.985;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }

        // Links first so nodes sit on top of them.
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i], b = nodes[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > LINK * LINK) continue;
            const t = 1 - Math.sqrt(d2) / LINK;
            ctx.strokeStyle = 'rgba(56,189,248,' + (t * 0.42).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        for (const p of nodes) {
          ctx.fillStyle = 'rgba(180,225,255,.75)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }

        netRaf = requestAnimationFrame(draw);
      }

      resize();
      window.addEventListener('resize', resize, { passive: true });
      netRaf = requestAnimationFrame(draw);
    }

    /* ---------- live engine stats ---------- */
    // Each stat counts up on the same eased curve as the bar, so the
    // whole cluster resolves together on the completion beat.
    const statEls = Array.prototype.slice.call(pl.querySelectorAll('[data-pl-stat]'));
    const nf = new Intl.NumberFormat('en-NG');

    function syncStats(p) {
      const eased = p / 100;
      for (let i = 0; i < statEls.length; i++) {
        const el = statEls[i];
        const to = parseInt(el.getAttribute('data-to'), 10);
        if (!isFinite(to)) continue;
        el.textContent = nf.format(Math.round(to * eased));
      }
    }

    /* ---------- drive ---------- */
    const t0 = performance.now();
    let lastPct = -1;

    function frame(now) {
      if (finished) return;
      const t = Math.min((now - t0) / TOTAL, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const pct = Math.round(eased * 100);
      if (pct !== lastPct) { setPct(pct); syncStage(pct); syncStats(pct); lastPct = pct; }
      if (t < 1) requestAnimationFrame(frame);
    }

    splitWordmark();
    startNetwork();
    setPct(0);
    syncStage(0);
    syncStats(0);
    startLog();
    requestAnimationFrame(frame);


    /* ---------- shared-element handoff ---------- */
    // Measures the site's nav brand and flies the loading wordmark into
    // that exact position, so the splash resolves into the header rather
    // than just fading. Purely additive: if the brand cannot be measured
    // the mark falls back to a plain lift-and-fade (.is-static) and the
    // page is never touched either way.
    function flyMarkToBrand() {
      const mark = pl.querySelector('.pl__mark');
      if (!mark) return;

      const target = document.querySelector('.nav__brand, .brand');
      if (REDUCED || !target) { mark.classList.add('is-static'); return; }

      const a = mark.getBoundingClientRect();
      const b = target.getBoundingClientRect();

      // A hidden or unlaid-out target would produce a nonsense transform.
      if (!a.width || !a.height || !b.width || !b.height) {
        mark.classList.add('is-static');
        return;
      }

      const scale = b.width / a.width;
      const dx = (b.left + b.width / 2)  - (a.left + a.width / 2);
      const dy = (b.top  + b.height / 2) - (a.top  + a.height / 2);

      mark.style.transformOrigin = '50% 50%';
      mark.style.willChange = 'transform, opacity';
      mark.style.transition =
        'transform .86s cubic-bezier(.72,0,.18,1), opacity .3s ease .52s';
      mark.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ')';
      // Fades as it lands so the real header brand takes over cleanly.
      mark.style.opacity = '0';
    }

    /* ---------- exit ---------- */
    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      finished = true;
      clearTimeout(typeTimer);
      if (netRaf) cancelAnimationFrame(netRaf);

      setPct(100);
      syncStats(100);
      if (plStatus) plStatus.textContent = 'Ready';

      // Beat on 100% so completion registers, then hand off. The page
      // underneath is deliberately NOT animated — driving page content
      // from here risks leaving the site invisible if the two desync,
      // and it fights the existing .reveal system.
      setTimeout(() => {
        flyMarkToBrand();
        pl.classList.add('is-out');
        document.removeEventListener('keydown', onKey);
        if (typeof startFeatureVisuals === 'function') startFeatureVisuals();
        setTimeout(() => {
          pl.classList.add('is-done');
        }, REDUCED ? 0 : 980);
      }, REDUCED ? 0 : 240);
    }

    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') dismiss();
    }

    plSkip = dismiss;
    if (plSkipBtn) plSkipBtn.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKey);
    setTimeout(dismiss, TOTAL);

    // Reveal observers run immediately so content is ready behind the
    // curtain rather than popping in after it lifts.
    if (typeof window.initScrollAnimations === 'function') window.initScrollAnimations();
  }


  // ============================================================
  // 1b. HERO LIVE MATCH CLOCK + MOMENTUM
  // ============================================================
  const heroTime = document.getElementById('heroTime');
  const heroMomFill = document.getElementById('heroMomFill');
  if (heroTime) {
    let seconds = 64 * 60 + 22;
    let momentum = 63;
    setInterval(() => {
      seconds += 1;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      heroTime.textContent = `${m}:${String(s).padStart(2, '0')}`;
      if (m >= 90) seconds = 64 * 60 + 22; // loop for the demo
    }, 1000);
  }
  if (heroMomFill) {
    setInterval(() => {
      momentum = Math.max(40, Math.min(82, momentum + (Math.random() - 0.5) * 6));
      heroMomFill.style.width = momentum.toFixed(1) + '%';
    }, 3200);
  }


  // ============================================================
  // 2. HERO CANVAS PARTICLE NETWORK
  // ============================================================
  const canvas = document.getElementById('heroCanvas');
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 80;
  const connectionDistance = 120;
  const speedFactor = 0.5;

  class Particle {
    constructor() {
      this.x = Math.random() * width;
      this.y = Math.random() * height;
      this.vx = (Math.random() - 0.5) * speedFactor;
      this.vy = (Math.random() - 0.5) * speedFactor;
      this.radius = Math.random() * 2 + 1.5;
      this.color = Math.random() > 0.5 ? 'rgba(0, 229, 255, 0.4)' : 'rgba(139, 92, 246, 0.3)';
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0 || this.x > width) this.vx *= -1;
      if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = this.color;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }
  }

  // Initialize
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function animateParticles() {
    ctx.clearRect(0, 0, width, height);

    // Draw lines
    for (let i = 0; i < particles.length; i++) {
      const p1 = particles[i];
      p1.update();
      p1.draw();

      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < connectionDistance) {
          const alpha = (1 - dist / connectionDistance) * 0.15;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animateParticles);
  }

  animateParticles();

  // Resize Handler
  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });


  // ============================================================
  // 3. STICKY NAVBAR
  // ============================================================
  const navbar = document.getElementById('navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        navbar.classList.add('is-scrolled');
      } else {
        navbar.classList.remove('is-scrolled');
      }
    });
  }


  // ============================================================
  // 4. MOBILE MENU
  // ============================================================
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('navLinks');

  if (mobileToggle && mobileMenu) {
    mobileToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('is-open');
      mobileToggle.classList.toggle('is-open');
      document.body.classList.toggle('overflow-hidden');
    });

    window.closeMobileMenu = function() {
      mobileMenu.classList.remove('is-open');
      mobileToggle.classList.remove('is-open');
      document.body.classList.remove('overflow-hidden');
    };
  }


  // ============================================================
  // 4b. THEME TOGGLE (light / dark)
  // ============================================================
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle && window.ApexTheme) {
    themeToggle.addEventListener('click', () => {
      window.ApexTheme.toggle();
    });
  }


  // ============================================================
  // 5. SCROLL REVEAL & STATS COUNTERS
  // ============================================================
  const reveals = document.querySelectorAll('.reveal');
  const statsSection = document.querySelector('.stats-strip');
  const statNumbers = document.querySelectorAll('.stats-strip__num');
  let countersAnimated = false;

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  window.initScrollAnimations = function() {
    reveals.forEach(reveal => {
      revealObserver.observe(reveal);
    });
    if (statsSection) {
      statsObserver.observe(statsSection);
    }
  };

  // Stats Counters logic
  const statsObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !countersAnimated) {
      statNumbers.forEach(num => {
        const target = parseFloat(num.getAttribute('data-target'));
        const suffix = num.getAttribute('data-suffix') || '';
        const isDecimal = num.getAttribute('data-decimal') === 'true';
        animateCounter(num, target, suffix, isDecimal);
      });
      countersAnimated = true;
    }
  }, { threshold: 0.2 });

  // Initialization moved to window.initScrollAnimations

  function animateCounter(element, target, suffix, isDecimal) {
    let start = 0;
    const duration = 2000; // ms
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      let currentVal = easeProgress * target;

      if (isDecimal) {
        element.textContent = currentVal.toFixed(1) + suffix;
      } else {
        element.textContent = Math.floor(currentVal).toLocaleString() + suffix;
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        if (isDecimal) {
          element.textContent = target.toFixed(1) + suffix;
        } else {
          element.textContent = target.toLocaleString() + suffix;
        }
      }
    }

    requestAnimationFrame(update);
  }


  // ============================================================
  // 6. PRICING TOGGLE
  // ============================================================
  const pricingToggle = document.getElementById('pricingToggle');
  const saveBadge = document.getElementById('saveBadge');
  const monthlyLabel = document.getElementById('monthlyLabel');
  const annualLabel = document.getElementById('annualLabel');
  const priceAmounts = document.querySelectorAll('.plan__price-amt');
  const pricePeriods = document.querySelectorAll('.plan__price-per');

  if (pricingToggle) {
    pricingToggle.addEventListener('click', () => {
      const isAnnual = pricingToggle.classList.toggle('toggle--on');

      if (isAnnual) {
        saveBadge.classList.add('is-visible');
        monthlyLabel.classList.remove('toggle-label--active');
        annualLabel.classList.add('toggle-label--active');
      } else {
        saveBadge.classList.remove('is-visible');
        monthlyLabel.classList.add('toggle-label--active');
        annualLabel.classList.remove('toggle-label--active');
      }

      priceAmounts.forEach(amount => {
        const value = isAnnual ? amount.getAttribute('data-annual') : amount.getAttribute('data-monthly');
        amount.style.opacity = 0;
        setTimeout(() => {
          amount.textContent = value;
          amount.style.opacity = 1;
        }, 150);
      });

      pricePeriods.forEach(period => {
        period.textContent = isAnnual ? '/yr' : '/mo';
      });
    });
  }


  // ============================================================
  // 7. FAQ ACCORDION
  // ============================================================
  const faqQuestions = document.querySelectorAll('.faq__q');

  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const parent = question.parentElement;
      const isActive = parent.classList.contains('is-open');

      // Close all other FAQs
      document.querySelectorAll('.faq__item').forEach(item => {
        item.classList.remove('is-open');
      });

      if (!isActive) {
        parent.classList.add('is-open');
      }
    });
  });


  // ============================================================
  // 8. 3D PARALLAX SHOWCASE & CALLOUTS
  // ============================================================
  const showcase = document.getElementById('showcaseVisual');
  const showcaseImg = document.getElementById('showcaseImage');
  const callouts = document.querySelectorAll('[data-callout]');

  if (showcase) {
    showcase.addEventListener('mousemove', (e) => {
      const rect = showcase.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      // Rotate image wrapper based on mouse coords
      const rotateX = -y / 25 + 8; // maintain basic 3D tilt + add dynamic offset
      const rotateY = x / 25 - 3;
      
      showcaseImg.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });

    showcase.addEventListener('mouseleave', () => {
      showcaseImg.style.transform = `rotateX(8deg) rotateY(-3deg)`;
    });

    // Observer to show callouts when showcase comes into view
    const calloutObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        callouts.forEach(callout => {
          callout.classList.add('visible');
        });
      }
    }, { threshold: 0.3 });

    calloutObserver.observe(showcase);
  }


  // ============================================================
  // 9. CORE FEATURE MINI-VISUALIZATIONS
  // ============================================================
  function startFeatureVisuals() {
    // 9a. Mini Radar morphing animation
    const player1 = document.getElementById('radarPlayer1');
    const player2 = document.getElementById('radarPlayer2');

    if (player1 && player2) {
      setInterval(() => {
        // Generate values slightly shifting from their default
        const p1Points = [
          `50,${12 + Math.random() * 8}`,
          `${80 + Math.random() * 8},${35 + Math.random() * 8}`,
          `${75 + Math.random() * 8},${68 + Math.random() * 8}`,
          `50,${85 + Math.random() * 8}`,
          `${12 + Math.random() * 8},${64 + Math.random() * 8}`,
          `${16 + Math.random() * 8},${35 + Math.random() * 8}`
        ].join(' ');

        const p2Points = [
          `50,${18 + Math.random() * 8}`,
          `${72 + Math.random() * 8},${38 + Math.random() * 8}`,
          `${82 + Math.random() * 8},${64 + Math.random() * 8}`,
          `50,${76 + Math.random() * 8}`,
          `${15 + Math.random() * 8},${68 + Math.random() * 8}`,
          `${22 + Math.random() * 8},${32 + Math.random() * 8}`
        ].join(' ');

        player1.setAttribute('points', p1Points);
        player2.setAttribute('points', p2Points);
      }, 3000);
    }

    // 9b. Mini Prediction Gauge observer trigger
    const gaugeValue = document.getElementById('gaugeValue');
    const featureCard2 = document.getElementById('featureCard2');

    if (gaugeValue && featureCard2) {
      const gaugeObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          animateCounter(gaugeValue, 94.7, '', true);
          gaugeObserver.unobserve(featureCard2);
        }
      }, { threshold: 0.3 });
      
      gaugeObserver.observe(featureCard2);
    }

    // 9c. Mini Live Sparkline real-time updating
    const sparklinePath = document.getElementById('sparklinePath');
    const sparklineFill = document.getElementById('sparklineFill');
    const sparklinePoints = [20, 25, 18, 30, 22, 28, 32, 25, 30, 28, 35, 29, 36, 31, 38];
    const width = 160;
    const height = 40;

    function renderSparkline() {
      if (!sparklinePath || !sparklineFill) return;
      
      const segmentWidth = width / (sparklinePoints.length - 1);
      let pathData = '';
      
      const coords = sparklinePoints.map((val, i) => {
        const x = i * segmentWidth;
        const y = height - (val / 50) * height; // scale 0-50
        return { x, y };
      });

      pathData = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
      
      sparklinePath.setAttribute('points', coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' '));

      // Close the path for fill
      const fillPoints = [
        `0,${height}`,
        ...coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`),
        `${width},${height}`
      ].join(' ');
      
      sparklineFill.setAttribute('points', fillPoints);
    }

    renderSparkline();

    // Dynamically add a new point every 2.5s to simulate live data stream
    setInterval(() => {
      sparklinePoints.shift();
      // Generate a new point centered around the last point with some fluctuation
      const lastPoint = sparklinePoints[sparklinePoints.length - 1];
      const newPoint = Math.min(Math.max(10, lastPoint + (Math.random() - 0.5) * 12), 48);
      sparklinePoints.push(newPoint);
      renderSparkline();
    }, 2500);
  }


  // ============================================================
  // 10. TESTIMONIALS CAROUSEL
  // ============================================================
  const tmTrack = document.getElementById('testimonialsTrack');
  const tmPrev = document.getElementById('tmPrev');
  const tmNext = document.getElementById('tmNext');
  const tmDotsHost = document.getElementById('tmDots');

  if (tmTrack && tmDotsHost) {
    const tmSlides = Array.from(tmTrack.children);
    let tmIdx = 0;
    let tmTimer = null;
    let tmPaused = false;

    // Build dots
    tmSlides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'testimonials__dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', `Go to testimonial ${i + 1}`);
      dot.addEventListener('click', () => goTo(i, true));
      tmDotsHost.appendChild(dot);
    });

    function goTo(i, manual) {
      tmIdx = (i + tmSlides.length) % tmSlides.length;
      tmTrack.style.transform = `translateX(-${tmIdx * 100}%)`;
      Array.from(tmDotsHost.children).forEach((d, idx) => d.classList.toggle('is-active', idx === tmIdx));
      if (manual) restartAuto();
    }

    function restartAuto() {
      if (tmTimer) clearInterval(tmTimer);
      tmTimer = setInterval(() => {
        if (!tmPaused) goTo(tmIdx + 1);
      }, 6000);
    }

    if (tmPrev) tmPrev.addEventListener('click', () => goTo(tmIdx - 1, true));
    if (tmNext) tmNext.addEventListener('click', () => goTo(tmIdx + 1, true));

    // Pause on hover
    const tmViewport = document.getElementById('testimonialsViewport');
    if (tmViewport) {
      tmViewport.addEventListener('mouseenter', () => tmPaused = true);
      tmViewport.addEventListener('mouseleave', () => tmPaused = false);
    }

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      tmPaused = document.hidden;
    });

    // Swipe support
    let touchStartX = 0;
    if (tmViewport) {
      tmViewport.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
      tmViewport.addEventListener('touchend', (e) => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) > 40) goTo(tmIdx + (dx < 0 ? 1 : -1), true);
      });
    }

    restartAuto();
  }


  // ============================================================
  // 11. EV CALCULATOR
  // ============================================================
  const evOdds = document.getElementById('evOdds');
  const evProb = document.getElementById('evProb');
  const evStake = document.getElementById('evStake');
  const evTrue = document.getElementById('evTrue');
  const evValue = document.getElementById('evValue');
  const evKelly = document.getElementById('evKelly');
  const evFlag = document.getElementById('evFlag');

  if (evOdds && evProb && evStake) {
    function recomputeEV() {
      const odds = parseFloat(evOdds.value);
      const p = parseFloat(evProb.value);
      const stake = parseFloat(evStake.value);

      if (!isFinite(odds) || odds < 1.01 || !isFinite(p) || p <= 0 || p >= 1) {
        if (evTrue) evTrue.textContent = '—';
        if (evValue) evValue.textContent = '—';
        if (evKelly) evKelly.textContent = '—';
        if (evFlag) { evFlag.className = 'ev-calc__flag'; evFlag.textContent = '—'; }
        return;
      }

      const trueOdds = 1 / p;
      const ev = (p * odds - 1) * stake;
      const kelly = Math.max(0, (p * odds - 1) / (odds - 1));

      if (evTrue) evTrue.textContent = trueOdds.toFixed(2);
      if (evValue) {
        evValue.textContent = (ev >= 0 ? '+' : '−') + '₦' + Math.abs(Math.round(ev)).toLocaleString();
        evValue.style.color = ev >= 0 ? 'var(--positive)' : 'var(--negative)';
      }
      if (evKelly) evKelly.textContent = (kelly * 100).toFixed(1) + '%';

      if (evFlag) {
        const pct = (ev / Math.max(1, stake)) * 100;
        evFlag.classList.remove('ev-calc__flag--value', 'ev-calc__flag--fair', 'ev-calc__flag--trap');
        if (pct > 5) {
          evFlag.classList.add('ev-calc__flag--value');
          evFlag.textContent = '▲ Value';
        } else if (pct < -5) {
          evFlag.classList.add('ev-calc__flag--trap');
          evFlag.textContent = '▼ Trap';
        } else {
          evFlag.classList.add('ev-calc__flag--fair');
          evFlag.textContent = '≈ Fair';
        }
      }
    }

    [evOdds, evProb, evStake].forEach(el => el.addEventListener('input', recomputeEV));
    recomputeEV();
  }


  // ============================================================
  // 12. LIVE SIMS CHIP — floating bottom-left
  // ============================================================
  const liveSimsChip = document.getElementById('liveSimsChip');
  const liveSimsNum = document.getElementById('liveSimsNum');
  if (liveSimsChip && liveSimsNum) {
    setTimeout(() => liveSimsChip.classList.add('is-visible'), 1800);
    let sims = 10247;
    setInterval(() => {
      sims += Math.floor(Math.random() * 12) + 4;
      liveSimsNum.textContent = sims.toLocaleString();
    }, 1200);
  }


  // ============================================================
  // 13. LEAGUE HUB FILTER
  // ============================================================
  const filterPills = document.querySelectorAll('.tab-pill[data-filter]');
  const leagueCards = document.querySelectorAll('.league-card[data-region]');
  if (filterPills.length && leagueCards.length) {
    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const filter = pill.getAttribute('data-filter');
        filterPills.forEach(p => p.classList.toggle('is-active', p === pill));
        leagueCards.forEach(card => {
          if (filter === 'all') {
            card.style.display = '';
            return;
          }
          if (filter === 'high-roi') {
            card.style.display = card.getAttribute('data-roi') === 'high' ? '' : 'none';
            return;
          }
          card.style.display = card.getAttribute('data-region') === filter ? '' : 'none';
        });
      });
    });
  }


  // ============================================================
  // 14. NEWSLETTER FORM
  // ============================================================
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('nlEmail');
      if (!email || !email.value || !email.value.includes('@')) {
        window.ApexToast?.show('Please enter a valid email.', 'warn');
        return;
      }
      window.ApexToast?.show("You're on the Founders' list. Check your inbox.", 'pos');
      email.value = '';
    });
  }


  // ============================================================
  // 15. DASHBOARD — Today's Top Value Picks
  // ============================================================
  const pickCards = document.querySelectorAll('.pick-card');
  pickCards.forEach(card => {
    card.addEventListener('click', () => {
      const title = card.querySelector('.pick-card__meta')?.textContent || 'Pick detail';
      window.ApexToast?.show(`Opening details: ${title.trim()}`, 'pos');
    });
  });


  // ============================================================
  // 16. STRATEGY BUILDER — templates + risk meter
  // ============================================================
  const tplCards = document.querySelectorAll('.tpl-card');
  tplCards.forEach(card => {
    card.addEventListener('click', () => {
      const name = card.querySelector('.tpl-card__name')?.textContent || 'Template';
      window.ApexToast?.show(`Loaded strategy: ${name}`, 'pos');
    });
  });

  const riskMeter = document.getElementById('riskMeter');
  if (riskMeter) {
    function updateRisk(legs) {
      const fill = riskMeter.querySelector('.risk-meter__fill');
      const val = riskMeter.querySelector('.risk-meter__val');
      const pct = Math.min(100, legs * 25);
      fill.style.width = pct + '%';
      val.textContent = legs + ' leg' + (legs === 1 ? '' : 's');
      riskMeter.classList.remove('is-warn', 'is-bad');
      if (legs >= 4) riskMeter.classList.add('is-bad');
      else if (legs >= 2) riskMeter.classList.add('is-warn');
    }
    // listen for slip updates (the strategy builder page will dispatch a custom event)
    document.addEventListener('apex:slip-changed', (e) => {
      updateRisk(e.detail?.count || 0);
    });
    updateRisk(0);
  }

});
