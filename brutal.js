/**
 * BRUTAL ANALYTICS — Frontend JS
 */
(function () {
  'use strict';

  // ── PRELOADER ────────────────────────────────────────────────
  window.addEventListener('load', () => {
    setTimeout(() => {
      const pre = document.getElementById('preloader');
      if (pre) pre.classList.add('hidden');
    }, 2400);
  });

  // ── NAVBAR SCROLL ────────────────────────────────────────────
  const navbar = document.getElementById('navbar') || document.querySelector('.navbar');
  if (navbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 40) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    }, { passive: true });
  }

  // ── MOBILE NAV ───────────────────────────────────────────────
  const navToggle = document.getElementById('navToggle');
  const navLinks  = document.getElementById('navLinks');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => navLinks.classList.toggle('open'));
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => navLinks.classList.remove('open'));
    });
  }

  // ── LIVE MATCH TIMER ─────────────────────────────────────────
  const liveTimer = document.getElementById('liveTimer');
  if (liveTimer) {
    let mins = 62, secs = 0;
    setInterval(() => {
      secs++;
      if (secs >= 60) { secs = 0; mins++; }
      if (mins > 90) { mins = 90; secs = 0; }
      liveTimer.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  // ── SIMULATION COUNTER ────────────────────────────────────────
  const simCountEl = document.getElementById('simCount');
  if (simCountEl) {
    let simCount = 0;
    const target = 10247;

    // Count up on first scroll into view
    const simObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        simObserver.disconnect();
        const duration = 2000;
        const start = performance.now();
        function step(now) {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          simCount = Math.round(eased * target);
          simCountEl.textContent = simCount.toLocaleString();
          if (progress < 1) requestAnimationFrame(step);
          else {
            // Keep incrementing after count-up
            setInterval(() => {
              simCount += Math.floor(Math.random() * 8) + 2;
              simCountEl.textContent = simCount.toLocaleString();
            }, 200);
          }
        }
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });

    simObserver.observe(simCountEl);
  }

  // ── EV ROWS ───────────────────────────────────────────────────
  const evRows = document.getElementById('evRows');
  if (evRows) {
    const EV_DATA = [
      { match: 'Arsenal vs Chelsea',  market: 'Arsenal Win',         true_odds: '1.85', mkt: '2.30', ev: '+₦245', pos: true  },
      { match: 'Nigeria vs Ghana',    market: 'Over 2.5 Goals',      true_odds: '2.10', mkt: '2.80', ev: '+₦333', pos: true  },
      { match: 'PSG vs Real Madrid',  market: 'PSG Win',             true_odds: '1.72', mkt: '1.40', ev: '−₦190', pos: false },
      { match: 'Sundowns vs Zamalek', market: 'Sundowns Win',        true_odds: '2.20', mkt: '3.10', ev: '+₦409', pos: true  },
      { match: 'Man City vs Liverpool', market: 'Both Teams Score',  true_odds: '1.68', mkt: '2.10', ev: '+₦253', pos: true  },
    ];

    function renderEVRows() {
      evRows.innerHTML = '';
      EV_DATA.forEach((d, i) => {
        const row = document.createElement('div');
        row.className = 'ev-row';
        row.style.animationDelay = `${i * 80}ms`;
        row.innerHTML = `
          <div>
            <div class="ev-row__match">${d.match}</div>
            <div class="ev-row__market">${d.market}</div>
          </div>
          <div class="ev-row__odds mono">${d.true_odds} → ${d.mkt}</div>
          <div class="ev-row__ev ${d.pos ? 'ev-row__ev--pos' : 'ev-row__ev--neg'}">${d.ev}</div>
        `;
        evRows.appendChild(row);
      });
    }

    renderEVRows();

    // Refresh animation every 8s to simulate live updates
    setInterval(() => {
      evRows.querySelectorAll('.ev-row').forEach((row, i) => {
        setTimeout(() => {
          row.style.transition = 'opacity 0.3s ease';
          row.style.opacity = '0.4';
          setTimeout(() => { row.style.opacity = '1'; }, 300);
        }, i * 60);
      });
    }, 8000);
  }

  // ── SCROLL REVEAL ─────────────────────────────────────────────
  const revealEls = document.querySelectorAll(
    '.problem-card, .engine-step, .feat-card, .plan-card, .ledger-stat, .value-type'
  );

  if (revealEls.length && 'IntersectionObserver' in window) {
    const revealObs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

    revealEls.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(28px)';
      el.style.transition = `opacity 0.5s ease ${(i % 4) * 80}ms, transform 0.5s ease ${(i % 4) * 80}ms`;
      revealObs.observe(el);
    });
  }

  // ── TICKER PAUSE ON HOVER ─────────────────────────────────────
  const tickerInner = document.querySelector('.ticker__inner');
  if (tickerInner) {
    tickerInner.addEventListener('mouseenter', () => {
      tickerInner.style.animationPlayState = 'paused';
    });
    tickerInner.addEventListener('mouseleave', () => {
      tickerInner.style.animationPlayState = 'running';
    });
  }

  // ── SMOOTH SECTION ANCHORS ────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

})();
