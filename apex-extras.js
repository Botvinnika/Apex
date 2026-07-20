/* ============================================================
   APEX SPORTS ANALYTICS — Professional Polish Pack
   - Scroll progress bar
   - Back-to-top button
   - Command Palette (Cmd/Ctrl + K)
   ============================================================ */
(function () {
  'use strict';

  const onReady = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else { fn(); }
  };

  // ----------------------------------------------------------------
  // 1. SCROLL PROGRESS BAR
  // ----------------------------------------------------------------
  onReady(() => {
    const bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    let ticking = false;
    function update() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      const pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
      bar.style.width = pct + '%';
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
          html += `
            <div class="cmdk__item ${isActive}" data-idx="${idx}" data-action="${item.action}">
              <span class="cmdk__item-ico">${item.icon || '⚡'}</span>
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
    const links = document.querySelector('.navbar__links');
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
        { group: 'Pages',     title: 'Home',          subtitle: 'ApexSports landing page', icon: '🏠', action: 'navigate:index.html',   keywords: 'home landing' },
        { group: 'Pages',     title: 'Dashboard',     subtitle: 'Real-time analytics view', icon: '📊', action: 'navigate:dashboard.html', keywords: 'analytics stats' },
        { group: 'Pages',     title: 'Strategy Builder', subtitle: 'Stack custom legs', icon: '🎯', action: 'navigate:strategy-builder.html', keywords: 'builder bet combo' },
        // In-page sections (only on index)
        ...(path === 'index.html' || path === '' ? [
          { group: 'Sections', title: 'Features',      subtitle: 'Jump to features grid', icon: '🧩', action: 'scroll:#features',  keywords: 'core xray engine' },
          { group: 'Sections', title: 'How It Works',  subtitle: '4-step pipeline',       icon: '⚙️', action: 'scroll:#showcase',  keywords: 'how steps' },
          { group: 'Sections', title: 'Public Ledger', subtitle: 'Every call, forever',    icon: '📒', action: 'scroll:#ledger',    keywords: 'ledger record history' },
          { group: 'Sections', title: 'Pricing',       subtitle: 'Plans & Founder\'s 20',  icon: '💎', action: 'scroll:#pricing',   keywords: 'price plan' },
          { group: 'Sections', title: 'FAQ',           subtitle: 'Common questions',       icon: '❓', action: 'scroll:#faq',       keywords: 'faq help' },
        ] : []),
        // Actions
        { group: 'Actions',   title: 'Toggle Theme',  subtitle: 'Switch light/dark',       icon: '🌓', action: 'theme:toggle',     shortcut: 'T', keywords: 'theme dark light mode sun moon' },
        { group: 'Actions',   title: 'Use Light Mode',                              icon: '☀️', action: 'theme:light',     keywords: 'light sun' },
        { group: 'Actions',   title: 'Use Dark Mode',                               icon: '🌙', action: 'theme:dark',      keywords: 'dark night' },
        { group: 'Actions',   title: 'Back to top',   subtitle: 'Smooth scroll',           icon: '⬆️', action: 'top',             keywords: 'top scroll up' },
      ];
      return cmds;
    }
  });

})();
