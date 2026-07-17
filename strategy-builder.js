/**
 * APEX SPORTS — Strategy Builder Logic
 * Frontend only. No real transactions.
 * Odds range: 1.20 – 20.00 (responsible modeling cap)
 */
(function () {
  'use strict';

  // ── STATE ────────────────────────────────────────────────────
  let stake = 1000;
  let selections = [];

  // ── ELEMENTS ─────────────────────────────────────────────────
  const oddsSlider     = document.getElementById('oddsSlider');
  const oddsDisplay    = document.getElementById('oddsDisplay');
  const riskFill       = document.getElementById('riskFill');
  const riskLabel      = document.getElementById('riskLabel');
  const addLegBtn      = document.getElementById('addLegBtn');
  const selectionsList = document.getElementById('selectionsList');
  const emptyState     = document.getElementById('emptyState');
  const legCount       = document.getElementById('legCount');
  const slipActions    = document.getElementById('slipActions');
  const clearAllBtn    = document.getElementById('clearAllBtn');
  const stakeInput     = document.getElementById('stakeInput');
  const presets        = document.querySelectorAll('.bb-preset');
  const placeBetBtn    = document.getElementById('placeBetBtn');
  const toast          = document.getElementById('toast');

  // Summary elements
  const accaType       = document.getElementById('accaType');
  const accaBadge      = document.getElementById('accaBadge');
  const totalOddsEl    = document.getElementById('totalOdds');
  const totalLegsEl    = document.getElementById('totalLegs');
  const stakeDisplay   = document.getElementById('stakeDisplay');
  const potentialReturn= document.getElementById('potentialReturn');
  const potentialProfit= document.getElementById('potentialProfit');
  const placeBtnOdds   = document.getElementById('placeBtnOdds');
  const aiRiskFill     = document.getElementById('aiRiskFill');
  const aiRiskNeedle   = document.getElementById('aiRiskNeedle');
  const aiNote         = document.getElementById('aiNote');

  // ── ODDS SLIDER ───────────────────────────────────────────────
  oddsSlider.addEventListener('input', updateOddsUI);
  updateOddsUI();

  function updateOddsUI() {
    const val = parseFloat(oddsSlider.value);
    oddsDisplay.textContent = val.toFixed(2);

    // Risk 0-1 mapped from 1.2 to 20
    const risk = (val - 1.2) / (20 - 1.2);
    const pct = (risk * 100).toFixed(1);

    riskFill.style.width = pct + '%';

    if (risk < 0.2) {
      riskFill.style.background = '#00ff87';
      riskLabel.style.color     = '#00ff87';
      riskLabel.textContent     = 'Low Risk';
    } else if (risk < 0.45) {
      riskFill.style.background = '#ffe44d';
      riskLabel.style.color     = '#ffe44d';
      riskLabel.textContent     = 'Moderate';
    } else if (risk < 0.70) {
      riskFill.style.background = '#ff8800';
      riskLabel.style.color     = '#ff8800';
      riskLabel.textContent     = 'High Risk';
    } else {
      riskFill.style.background = '#ff2222';
      riskLabel.style.color     = '#ff2222';
      riskLabel.textContent     = 'Extreme Risk';
    }
  }

  // ── ADD LEG ───────────────────────────────────────────────────
  addLegBtn.addEventListener('click', addLeg);

  function addLeg() {
    const sport     = document.getElementById('sportSelect').value;
    const market    = document.getElementById('marketSelect').value;
    const match     = document.getElementById('matchInput').value.trim();
    const selection = document.getElementById('selectionInput').value.trim();
    const odds      = parseFloat(oddsSlider.value);

    if (!sport)     { showToast('📊 Please select a sport'); return; }
    if (!match)     { showToast('📊 Please enter a match'); return; }
    if (!selection) { showToast('📊 Please enter your selection'); return; }

    const leg = {
      id: Date.now(),
      sport,
      market: market || 'General',
      match,
      selection,
      odds,
    };

    selections.push(leg);
    renderSelections();
    updateSummary();

    // Reset form
    document.getElementById('sportSelect').value    = '';
    document.getElementById('marketSelect').value   = '';
    document.getElementById('matchInput').value     = '';
    document.getElementById('selectionInput').value = '';
    oddsSlider.value = '2.0';
    updateOddsUI();

    showToast('✅ Leg added to your strategy!');
  }

  // ── RENDER SELECTIONS ─────────────────────────────────────────
  function renderSelections() {
    selectionsList.innerHTML = '';

    if (selections.length === 0) {
      selectionsList.appendChild(emptyState);
      slipActions.style.display = 'none';
      legCount.textContent = '0 Legs';
      return;
    }

    slipActions.style.display = 'block';
    legCount.textContent = selections.length + (selections.length === 1 ? ' Leg' : ' Legs');

    selections.forEach((leg, i) => {
      const card = document.createElement('div');
      card.className = 'bb-selection-card';
      card.dataset.id = leg.id;

      const sportLabel = {
        football: '⚽ Football', basketball: '🏀 Basketball', tennis: '🎾 Tennis',
        baseball: '⚾ Baseball', mma: '🥊 MMA', rugby: '🏉 Rugby', cricket: '🏏 Cricket'
      }[leg.sport] || leg.sport;

      card.innerHTML = `
        <div class="bb-selection-card__num">${i + 1}</div>
        <div class="bb-selection-card__body">
          <div class="bb-selection-card__sport">${sportLabel} · ${formatMarket(leg.market)}</div>
          <div class="bb-selection-card__selection">${leg.selection}</div>
          <div class="bb-selection-card__match">${leg.match}</div>
        </div>
        <div class="bb-selection-card__odds">${leg.odds.toFixed(2)}</div>
        <button class="bb-selection-card__remove" title="Remove leg" data-id="${leg.id}">✕</button>
      `;

      selectionsList.appendChild(card);
    });

    // Remove leg buttons
    selectionsList.querySelectorAll('.bb-selection-card__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id);
        selections = selections.filter(s => s.id !== id);
        renderSelections();
        updateSummary();
      });
    });
  }

  function formatMarket(m) {
    return {
      match_result: 'Match Result', both_score: 'BTTS', over_under: 'O/U',
      anytime_scorer: 'Anytime Scorer', correct_score: 'Correct Score',
      handicap: 'Asian Handicap', '1st_scorer': '1st Goalscorer',
      cards: 'Bookings', General: 'General'
    }[m] || m;
  }

  // ── UPDATE SUMMARY ────────────────────────────────────────────
  function updateSummary() {
    const n = selections.length;

    if (n === 0) {
      totalOddsEl.textContent    = '—';
      totalLegsEl.textContent    = '0';
      potentialReturn.textContent= '—';
      potentialProfit.textContent= '—';
      placeBtnOdds.textContent   = '—';
      accaType.textContent       = 'Single';
      accaBadge.textContent      = '—';
      placeBetBtn.disabled       = true;
      updateAIRisk(0);
      return;
    }

    // Total odds = product of all legs
    const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);
    const ret       = stake * totalOdds;
    const profit    = ret - stake;

    totalOddsEl.textContent    = totalOdds.toFixed(2);
    totalLegsEl.textContent    = n;
    stakeDisplay.textContent   = '₦' + Number(stake).toLocaleString();
    potentialReturn.textContent= '₦' + Number(ret).toLocaleString(undefined, {maximumFractionDigits: 0});
    potentialProfit.textContent= '₦' + Number(profit).toLocaleString(undefined, {maximumFractionDigits: 0});
    placeBtnOdds.textContent   = totalOdds.toFixed(2) + 'x';

    // Strategy type label
    const types = ['', 'Single', 'Double', 'Treble', '4-Fold', '5-Fold', '6-Fold', '7-Fold', '8-Fold', '9-Fold', '10-Fold'];
    accaType.textContent = n <= 10 ? (types[n] || n + '-Fold Strategy') : n + '-Fold Strategy';
    accaBadge.textContent = totalOdds < 3 ? 'SAFE' : totalOdds < 8 ? 'VALUE' : totalOdds < 20 ? 'BOLD' : 'EXTREME';

    placeBetBtn.disabled = false;

    // AI risk
    const avgOdds = selections.reduce((a, s) => a + s.odds, 0) / n;
    const legRisk = n / 10;           // more legs = more risk
    const oddsRisk = (avgOdds - 1.2) / (20 - 1.2);
    const combined = Math.min(1, (legRisk * 0.4) + (oddsRisk * 0.6));
    updateAIRisk(combined);
  }

  function updateAIRisk(level) {
    const pct = (level * 100).toFixed(1);
    // The fill div covers from right — so we invert it
    aiRiskFill.style.width  = (100 - level * 100).toFixed(1) + '%';
    aiRiskFill.style.left   = 'unset';
    aiRiskFill.style.right  = '0';
    aiRiskNeedle.style.left = pct + '%';

    const notes = [
      [0.0, 0.25, '🟢 Low risk strategy. Conservative selections with good implied probability.'],
      [0.25, 0.5,  '🟡 Moderate risk. A solid combination with fair value — keep an eye on form.'],
      [0.5, 0.75,  '🟠 High risk. Multiple uncertain outcomes combined. Proceed with caution.'],
      [0.75, 1.1,  '⚠️ Extreme risk. Very high multiplier combination — treat as simulation only.'],
    ];

    if (level === 0) {
      aiNote.textContent = 'Add legs to see AI risk analysis.';
    } else {
      const note = notes.find(([lo, hi]) => level >= lo && level < hi);
      aiNote.textContent = note ? note[2] : '';
    }
  }

  // ── STAKE ─────────────────────────────────────────────────────
  stakeInput.addEventListener('input', () => {
    stake = Math.max(100, parseFloat(stakeInput.value) || 100);
    updateSummary();
  });

  presets.forEach(btn => {
    btn.addEventListener('click', () => {
      stake = parseFloat(btn.dataset.val);
      stakeInput.value = stake;
      presets.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSummary();
    });
  });

  // ── CLEAR ALL ─────────────────────────────────────────────────
  clearAllBtn.addEventListener('click', () => {
    selections = [];
    renderSelections();
    updateSummary();
    showToast('🗑️ Strategy cleared');
  });

  // ── PLACE BET (demo) ──────────────────────────────────────────
  placeBetBtn.addEventListener('click', () => {
    if (selections.length === 0) return;
    const totalOdds = selections.reduce((a, s) => a * s.odds, 1);
    const ret = (stake * totalOdds).toFixed(0);
    showToast(`📈 Strategy saved! Potential return: ₦${Number(ret).toLocaleString()} (Simulation only)`);
    // Animate button
    placeBetBtn.style.transform = 'scale(0.96)';
    setTimeout(() => placeBetBtn.style.transform = '', 150);
  });

  // ── TOAST ─────────────────────────────────────────────────────
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // ── INIT ──────────────────────────────────────────────────────
  renderSelections();
  updateSummary();

})();
