/* ============================================================
   APEX SPORTS ANALYTICS — Interactivity & Data Logic
   Preloader | Particle Network | Parallax | Live Widgets
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // 1. PRELOADER & INITIAL ANIMATION
  // ============================================================
  const preloader = document.getElementById('preloader');
  
  // Keep preloader visible for at least 1.5s to show off the lightning animations
  setTimeout(() => {
    preloader.classList.add('hidden');
    // Start widgets animations once preloader is gone
    startFeatureVisuals();
  }, 1600);


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
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });


  // ============================================================
  // 4. MOBILE MENU
  // ============================================================
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('mobileMenu');

  mobileToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    mobileToggle.classList.toggle('active');
    document.body.classList.toggle('overflow-hidden');
  });

  window.closeMobileMenu = function() {
    mobileMenu.classList.remove('active');
    mobileToggle.classList.remove('active');
    document.body.classList.remove('overflow-hidden');
  };


  // ============================================================
  // 5. SCROLL REVEAL & STATS COUNTERS
  // ============================================================
  const reveals = document.querySelectorAll('.reveal');
  const statsSection = document.getElementById('stats');
  const statNumbers = document.querySelectorAll('.stat-item__number');
  let countersAnimated = false;

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(reveal => {
    revealObserver.observe(reveal);
  });

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

  if (statsSection) {
    statsObserver.observe(statsSection);
  }

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
  const priceAmounts = document.querySelectorAll('.pricing-card__amount');
  const pricePeriods = document.querySelectorAll('.pricing-card__period');

  pricingToggle.addEventListener('click', () => {
    const isAnnual = pricingToggle.classList.toggle('annual');
    
    if (isAnnual) {
      saveBadge.classList.add('visible');
      monthlyLabel.classList.remove('active');
      annualLabel.classList.add('active');
    } else {
      saveBadge.classList.remove('visible');
      monthlyLabel.classList.add('active');
      annualLabel.classList.remove('active');
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


  // ============================================================
  // 7. FAQ ACCORDION
  // ============================================================
  const faqQuestions = document.querySelectorAll('.faq-item__question');

  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const parent = question.parentElement;
      const isActive = parent.classList.contains('active');
      
      // Close all other FAQs
      document.querySelectorAll('.faq-item').forEach(item => {
        item.classList.remove('active');
      });

      if (!isActive) {
        parent.classList.add('active');
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

});
