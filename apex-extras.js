/* ============================================================
   APEX SPORTS ANALYTICS — Professional Polish Pack
   - Scroll progress bar
   - Back-to-top button
   - Command Palette (Cmd/Ctrl + K)
   ============================================================ */
(function () {
  'use strict';

  // Belt-and-braces: also tag <html> as JS-enabled in case this file
  // loads before app.js (or standalone).
  document.documentElement.classList.add('js');


  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  };

  // ----------------------------------------------------------------
  // 1. SCROLL PROGRESS BAR + NAV SCROLLED STATE
  // ----------------------------------------------------------------
  onReady(() => {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    const nav = document.querySelector('.nav');
    const NAV_TOGGLE_AT = 24; // px scrolled before nav tightens

    let ticking = false;
    function update() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = pct + '%';
      if (nav) {
        if (h.scrollTop > NAV_TOGGLE_AT) nav.classList.add('is-scrolled');
        else nav.classList.remove('is-scrolled');
      }
      ticking = false;
    }
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });
    update();
  });

  // ----------------------------------------------------------------
  // 2. BACK TO TOP BUTTON
  // ----------------------------------------------------------------
  onReady(() => {
    const btn = document.createElement('button');
    btn.className = 'back-to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>`;
    document.body.appendChild(btn);

    const SHOW_AT = 600;
    function onScroll() {
      if (window.scrollY > SHOW_AT) btn.classList.add('visible');
      else btn.classList.remove('visible');
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  // ----------------------------------------------------------------
  // 3. COMMAND PALETTE (Cmd/Ctrl + K)
  // ----------------------------------------------------------------
  onReady(() => {
    const isMac = /Mac|iPhone|iPad/i.test(navigator.platform);
    const triggerLabel = isMac ? '⌘ K' : 'Ctrl K';

    // Build DOM
    const backdrop = document.createElement('div');
    backdrop.className = 'cmdk-backdrop';
    const modal = document.createElement('div');
    modal.className = 'cmdk';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Command palette');

    const commands = buildCommands();

    modal.innerHTML = `
      <div style="position:relative;">
        <span class="cmdk__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
        </span>
        <input type="text" class="cmdk__input" id="cmdkInput"
          placeholder="Search pages, actions, or type a command..."
          autocomplete="off" spellcheck="false" />
      </div>
      <div class="cmdk__list" id="cmdkList"></div>
      <div class="cmdk__footer">
        <span><kbd>↑</kbd> <kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> open</span>
        <span><kbd>esc</kbd> close</span>
        <span style="margin-left:auto;">ApexSports · v2.4</span>
      </div>`;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);

    const input = modal.querySelector('#cmdkInput');
    const list  = modal.querySelector('#cmdkList');

    let filtered = commands.slice();
    let activeIdx = 0;

    function render() {
      if (!filtered.length) {
        list.innerHTML = '<div class="cmdk__empty">No results. Try "pricing", "ledger", or "dashboard".</div>';
        return;
      }
      const groups = {};
      filtered.forEach((c) => {
        groups[c.group] = groups[c.group] || [];
        groups[c.group].push(c);
      });
      let html = '';
      let idx = 0;
      for (const groupName of Object.keys(groups)) {
        html += `<div class="cmdk__group-label">${groupName}</div>`;
        for (const item of groups[groupName]) {
          const isActive = idx === activeIdx ? 'active' : '';
          const iconHtml = item.icon
            ? (item.icon.startsWith('i-')
                ? `<svg class="icon"><use href="#${item.icon}"/></svg>`
                : item.icon)
            : '<svg class="icon"><use href="#i-zap"/></svg>';
          html += `
            <div class="cmdk__item ${isActive}" data-idx="${idx}" data-action="${item.action}">
              <span class="cmdk__item-ico">${iconHtml}</span>
              <div>
                <div class="cmdk__item-title">${item.title}</div>
                <div class="cmdk__item-sub">${item.subtitle || ''}</div>
              </div>
              ${item.shortcut ? `<span class="cmdk__item-kbd">${item.shortcut}</span>` : ''}
            </div>`;
          idx++;
        }
      }
      list.innerHTML = html;
    }

    function open() {
      backdrop.classList.add('open');
      modal.classList.add('open');
      filtered = commands.slice();
      activeIdx = 0;
      input.value = '';
      render();
      setTimeout(() => input.focus(), 30);
    }
    function close() {
      backdrop.classList.remove('open');
      modal.classList.remove('open');
      input.value = '';
    }

    function moveActive(delta) {
      if (!filtered.length) return;
      activeIdx = (activeIdx + delta + filtered.length) % filtered.length;
      render();
      const el = list.querySelector('.cmdk__item.active');
      if (el) el.scrollIntoView({ block: 'nearest' });
    }

    function selectActive() {
      if (!filtered.length) return;
      runAction(filtered[activeIdx]);
      close();
    }

    function runAction(item) {
      if (!item) return;
      const a = item.action;
      if (a.startsWith('navigate:')) {
        const href = a.split(':', 2)[1];
        window.location.href = href;
      } else if (a.startsWith('scroll:')) {
        const sel = a.split(':', 2)[1];
        const el = document.querySelector(sel);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        close();
      } else if (a === 'theme:toggle') {
        if (window.ApexTheme) window.ApexTheme.toggle();
        close();
      } else if (a === 'theme:light') {
        if (window.ApexTheme) window.ApexTheme.set('light');
        close();
      } else if (a === 'theme:dark') {
        if (window.ApexTheme) window.ApexTheme.set('dark');
        close();
      } else if (a === 'top') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        close();
      }
    }

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (!q) { filtered = commands.slice(); }
      else {
        filtered = commands.filter((c) => {
          return (c.title + ' ' + (c.subtitle || '') + ' ' + (c.keywords || ''))
            .toLowerCase().includes(q);
        });
      }
      activeIdx = 0;
      render();
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); moveActive(-1); }
      else if (e.key === 'Enter')     { e.preventDefault(); selectActive(); }
      else if (e.key === 'Escape')    { e.preventDefault(); close(); }
    });

    list.addEventListener('click', (e) => {
      const item = e.target.closest('.cmdk__item');
      if (!item) return;
      const idx = parseInt(item.getAttribute('data-idx'), 10);
      activeIdx = idx;
      selectActive();
    });

    backdrop.addEventListener('click', close);

    // Open with Cmd/Ctrl+K
    document.addEventListener('keydown', (e) => {
      const isK = e.key === 'k' || e.key === 'K';
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (modal.classList.contains('open')) close(); else open();
      } else if (e.key === 'Escape' && modal.classList.contains('open')) {
        close();
      } else if (e.key === '/' && !modal.classList.contains('open') &&
                 document.activeElement === document.body) {
        e.preventDefault();
        open();
      }
    });

    // Expose globally so other scripts can open it
    window.ApexCommandPalette = { open, close };

    // Add a small ⌘K hint to the navbar if a navbar__links exists
    const links = document.querySelector('.navbar__links') || document.querySelector('.nav__links');
    if (links && !document.getElementById('cmdkHint')) {
      const hint = document.createElement('button');
      hint.id = 'cmdkHint';
      hint.className = 'kbd-hint';
      hint.type = 'button';
      hint.setAttribute('aria-label', 'Open command palette');
      hint.innerHTML = triggerLabel;
      hint.addEventListener('click', open);
      const themeBtn = document.getElementById('themeToggle');
      if (themeBtn) links.insertBefore(hint, themeBtn);
      else links.appendChild(hint);
    }

    function buildCommands() {
      const path = location.pathname.split('/').pop() || 'index.html';
      const cmds = [
              // Pages
        { group: 'Pages',     title: 'Home',          subtitle: 'ApexSports landing page', icon: 'i-globe', action: 'navigate:index.html',   keywords: 'home landing' },
        { group: 'Pages',     title: 'Dashboard',     subtitle: 'Real-time analytics view', icon: 'i-radar', action: 'navigate:dashboard.html', keywords: 'analytics stats' },
        { group: 'Pages',     title: 'Strategy Builder', subtitle: 'Stack custom legs', icon: 'i-bookmark', action: 'navigate:strategy-builder.html', keywords: 'builder bet combo' },
        { group: 'Pages',     title: 'Methodology',   subtitle: 'How the model works',       icon: 'i-spark', action: 'navigate:methodology.html', keywords: 'method model math' },
        { group: 'Pages',     title: 'Athlete Analysis', subtitle: 'Six-axis player profiles', icon: 'i-radar', action: 'navigate:analysis.html', keywords: 'player athlete profile percentile radar compare' },
        { group: 'Pages',     title: 'League Hub',    subtitle: 'African leagues deep-dive', icon: 'i-trophy', action: 'navigate:league-hub.html', keywords: 'africa npfl afcon' },
        { group: 'Pages',     title: 'Team',          subtitle: 'Founders & contributors',   icon: 'i-spark', action: 'navigate:team.html',      keywords: 'team about people' },
        // In-page sections (only on index)
        ...(path === 'index.html' || path === '' ? [
          { group: 'Sections', title: 'Features',      subtitle: 'Jump to features grid', icon: 'i-spark', action: 'scroll:#features',  keywords: 'core xray engine' },
          { group: 'Sections', title: 'How It Works',  subtitle: '4-step pipeline',       icon: 'i-zap', action: 'scroll:#showcase',  keywords: 'how steps' },
          { group: 'Sections', title: 'Testimonials',  subtitle: 'What members are saying', icon: 'i-chat', action: 'scroll:#testimonials', keywords: 'reviews quotes' },
          { group: 'Sections', title: 'Public Ledger', subtitle: 'Every call, forever',    icon: 'i-bookmark', action: 'scroll:#ledger',    keywords: 'ledger record history' },
          { group: 'Sections', title: 'Pricing',       subtitle: 'Plans & Founder\'s 20',  icon: 'i-trophy', action: 'scroll:#pricing',   keywords: 'price plan' },
          { group: 'Sections', title: 'FAQ',           subtitle: 'Common questions',       icon: 'i-chat', action: 'scroll:#faq',       keywords: 'faq help' },
        ] : []),
        // Actions
        { group: 'Actions',   title: 'Toggle Theme',  subtitle: 'Switch light/dark',       icon: 'i-moon', action: 'theme:toggle',     shortcut: 'T', keywords: 'theme dark light mode sun moon' },
        { group: 'Actions',   title: 'Use Light Mode',                              icon: 'i-sun', action: 'theme:light',     keywords: 'light sun' },
        { group: 'Actions',   title: 'Use Dark Mode',                               icon: 'i-moon', action: 'theme:dark',      keywords: 'dark night' },
        { group: 'Actions',   title: 'Back to top',   subtitle: 'Smooth scroll',           icon: 'i-arrow-right', action: 'top',             keywords: 'top scroll up' },
      ];
      return cmds;
    }
  });

  // ----------------------------------------------------------------
  // 4. TOAST HELPER
  // ----------------------------------------------------------------
  onReady(() => {
    const stack = document.getElementById('toastStack');
    if (!stack) return;

    // Toast icons — pure SVG, currentColor so they inherit toast tint
    const icons = {
      pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
      neg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.86l-8.1 14a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3l-8.1-14a2 2 0 0 0-3.4 0z"/></svg>',
      warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.86l-8.1 14a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3l-8.1-14a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>'
    };

    function show(message, variant = 'info', title = '') {
      const t = document.createElement('div');
      t.className = 'toast' + (variant && variant !== 'info' ? ' toast--' + variant : '');
      const defaultTitles = { pos: 'Done', neg: 'Heads up', warn: 'Wait', info: 'Info' };
      t.innerHTML = `
        <div class="toast__ico">${icons[variant] || icons.info}</div>
        <div>
          <div class="toast__title">${title || defaultTitles[variant] || defaultTitles.info}</div>
          <div class="toast__sub">${message}</div>
        </div>
        <button type="button" class="toast__close" aria-label="Dismiss">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
        <div class="toast__bar"></div>`;
      stack.appendChild(t);
      // animate in
      requestAnimationFrame(() => t.classList.add('is-visible'));
      const dismiss = () => {
        t.classList.remove('is-visible');
        setTimeout(() => t.remove(), 240);
      };
      t.querySelector('.toast__close').addEventListener('click', dismiss);
      setTimeout(dismiss, 4000);
      return t;
    }

    window.ApexToast = { show };

    // Wire up [data-toast] elements site-wide
    document.querySelectorAll('[data-toast]').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't override anchor navigation
        if (el.tagName === 'A' && el.getAttribute('href')) return;
        e.preventDefault();
        show(el.getAttribute('data-toast'), el.getAttribute('data-toast-variant') || 'info');
      });
    });

    // Wire up all anchor buttons that look like "Join" / "Get Started" inside pricing/CTA/footer
    const ctaSelectors = '.plan .btn--primary, .plan .btn--ghost, .cta-banner a.btn, .newsletter .btn, .pick-card';
    document.querySelectorAll(ctaSelectors).forEach(el => {
      // Skip ones with data-toast (already wired), and ones that are real links to pages
      if (el.hasAttribute('data-toast')) return;
      const href = el.getAttribute('href');
      // Only intercept hash-only anchors or no-href buttons inside cards
      el.addEventListener('click', (e) => {
        if (href && href !== '#' && !href.startsWith('#')) return;
        e.preventDefault();
        show('We\'ll be in touch soon. Watch your inbox.', 'pos', 'Reserved');
      });
    });
  });

  // ----------------------------------------------------------------
  // 5. KEYBOARD SHORTCUTS — "?" opens the cheat sheet
  // ----------------------------------------------------------------
  onReady(() => {
    // Don't fight with input fields
    const isTyping = () => {
      const t = document.activeElement;
      if (!t) return false;
      const tag = t.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
    };

    const overlay = document.createElement('div');
    overlay.className = 'kbd-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Keyboard shortcuts');
    overlay.innerHTML = `
      <div class="kbd-overlay__panel">
        <div class="kbd-overlay__head">
          <h3>Keyboard shortcuts</h3>
          <button type="button" class="kbd-overlay__close" aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <ul class="kbd-overlay__list">
          <li><span>Open command palette</span><span><kbd>⌘</kbd><kbd>K</kbd> or <kbd>/</kbd></span></li>
          <li><span>Show this cheat sheet</span><span><kbd>?</kbd></span></li>
          <li><span>Back to top</span><span><kbd>G</kbd> then <kbd>T</kbd></span></li>
          <li><span>Go to pricing</span><span><kbd>G</kbd> then <kbd>P</kbd></span></li>
          <li><span>Go to dashboard</span><span><kbd>G</kbd> then <kbd>D</kbd></span></li>
          <li><span>Go to league hub</span><span><kbd>G</kbd> then <kbd>L</kbd></span></li>
          <li><span>Next testimonial</span><span><kbd>→</kbd></span></li>
          <li><span>Previous testimonial</span><span><kbd>←</kbd></span></li>
          <li><span>Close any overlay</span><span><kbd>esc</kbd></span></li>
        </ul>
        <p class="kbd-overlay__hint">Tip: press <kbd>?</kbd> any time to come back here.</p>
      </div>`;
    document.body.appendChild(overlay);

    const openShortcuts = () => overlay.classList.add('open');
    const closeShortcuts = () => overlay.classList.remove('open');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeShortcuts();
    });
    overlay.querySelector('.kbd-overlay__close').addEventListener('click', closeShortcuts);

    // "g then X" two-key sequence
    let pendingG = 0;
    const pendingGWindow = 900;
    const fire = (sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    document.addEventListener('keydown', (e) => {
      if (isTyping()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        overlay.classList.contains('open') ? closeShortcuts() : openShortcuts();
        return;
      }

      if (overlay.classList.contains('open') && e.key === 'Escape') {
        closeShortcuts();
        return;
      }

      const now = performance.now();
      if (e.key === 'g' || e.key === 'G') {
        pendingG = now;
        return;
      }
      if (now - pendingG > pendingGWindow) return;

      const k = e.key.toLowerCase();
      if (k === 't') { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); pendingG = 0; }
      else if (k === 'p') { e.preventDefault(); fire('#pricing'); pendingG = 0; }
      else if (k === 'd') { e.preventDefault(); const a = document.querySelector('a[href="dashboard.html"]'); if (a) a.click(); pendingG = 0; }
      else if (k === 'l') { e.preventDefault(); const a = document.querySelector('a[href="league-hub.html"]'); if (a) a.click(); pendingG = 0; }
    });

    window.ApexShortcuts = { open: openShortcuts, close: closeShortcuts };
  });

})();

/* ============================================================
   6. NAV GROUP — the "Platform" dropdown

   Opens on hover for pointer users and on click/Enter for everyone
   else, because a hover-only menu is unreachable by keyboard and
   unusable on touch. Below 900px .nav__links is hidden and the mobile
   drawer takes over, so this stays out of the way entirely.
   ============================================================ */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var group = document.querySelector('[data-navgroup]');
    if (!group) return;

    var trigger = group.querySelector('.nav__trigger');
    var menu = group.querySelector('.nav__menu');
    if (!trigger || !menu) return;

    var isDesktop = function () { return window.matchMedia('(min-width: 901px)').matches; };
    var hoverTimer = null;

    function open() {
      group.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }
    function close() {
      group.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      if (group.classList.contains('is-open')) close(); else open();
    }

    // Pointer: open on enter, close on leave with a small grace period
    // so crossing the gap to the menu does not dismiss it.
    group.addEventListener('mouseenter', function () {
      if (!isDesktop()) return;
      clearTimeout(hoverTimer);
      open();
    });
    group.addEventListener('mouseleave', function () {
      if (!isDesktop()) return;
      hoverTimer = setTimeout(close, 160);
    });

    // Keyboard / touch
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      toggle();
    });
    trigger.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        open();
        var first = menu.querySelector('.nav__menuitem');
        if (first) first.focus();
      }
    });
    menu.addEventListener('keydown', function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll('.nav__menuitem'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[(i + 1) % items.length].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (i <= 0) { trigger.focus(); close(); }
        else items[i - 1].focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        close();
        trigger.focus();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && group.classList.contains('is-open')) {
        close();
        trigger.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!group.contains(e.target)) close();
    });
    // Focus moving out of the group closes it, so tabbing past the menu
    // does not leave it hanging open behind the rest of the bar.
    group.addEventListener('focusout', function (e) {
      if (!group.contains(e.relatedTarget)) close();
    });

    /* Mark the trigger as "you are here" when the current page lives
       inside the group, so collapsing these links does not cost the
       reader their sense of place. */
    var here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    var match = menu.querySelector('a[href="' + here + '"]');
    if (match) {
      group.classList.add('is-current');
      match.setAttribute('aria-current', 'page');
    }
  });
})();
