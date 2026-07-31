/* ============================================================
   APEX SPORTS ANALYTICS — Core Dashboard JavaScript
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // 0. CHART PALETTE
  // Series and chrome colours live in CSS (see the --viz-* block in
  // dashboard.css) so a theme switch changes them in one place. Canvas
  // can't read custom properties itself, so resolve them once here.
  // ============================================================
  const VIZ = (() => {
    const cs = getComputedStyle(document.documentElement);
    const read = (name, fallback) =>
      (cs.getPropertyValue(name) || '').trim() || fallback;
    return {
      s1:   read('--viz-1', '#0284C7'),
      s2:   read('--viz-2', '#D95926'),
      grid: read('--viz-grid', 'rgba(255,255,255,.06)'),
      tick: read('--viz-tick', '#9AA4B5')
    };
  })();

  // Chart.js takes no alpha channel on a hex string, so derive fills.
  const vizFill = (hex, a) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  };

  // ============================================================
  // 1. DATE-TIME DISPLAY & INITIAL STATE
  // ============================================================
  const dateTimeEl = document.getElementById('dateTime');
  if (dateTimeEl) {
    const options = { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' };
    dateTimeEl.textContent = new Date().toLocaleDateString('en-US', options);
  }


  // ============================================================
  // 1b. THEME TOGGLE (light / dark)
  // ============================================================
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle && window.ApexTheme) {
    themeToggle.addEventListener('click', () => window.ApexTheme.toggle());
  }


  // ============================================================
  // 2. DASHBOARD TAB NAVIGATION
  // ============================================================
  const navItems = document.querySelectorAll('.sidebar__nav-item');
  const tabContents = document.querySelectorAll('.tab-content');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.getAttribute('data-tab');
      
      // Update active nav button
      navItems.forEach(btn => btn.classList.remove('active'));
      item.classList.add('active');

      // Update visible tab content
      tabContents.forEach(tab => {
        tab.classList.remove('active');
        if (tab.id === `tab-${tabId}`) {
          tab.classList.add('active');
        }
      });

      // Special resize triggers if charts are loaded
      if (tabId === 'football') {
        setTimeout(() => {
          radarChart.resize();
          xgLineChart.resize();
        }, 100);
      }
    });
  });


  // ============================================================
  // 3. CHART.JS INTEGRATION (FOOTBALL TAB)
  // ============================================================
  
  /* 3a. Player DB — data only.
     Colour is NOT stored per player. This is a two-slot comparator: the
     left selector is always slot 1 and the right is always slot 2, and
     the legend names who is in each. Storing a hue per player looks
     tempting but cannot work — four entity colours would have to stay
     distinguishable in every 2-of-4 pairing, and past three slots no
     ordering clears the all-pairs CVD floor. Assigning by slot keeps
     every possible matchup on the one validated pair. */
  const playerData = {
    haaland: { label: 'Erling Haaland',    data: [95, 45, 68, 25, 92, 88] }, // Shooting, Passing, Dribbling, Defending, Physical, Pace
    mbappe:  { label: 'Kylian Mbappé',     data: [90, 78, 92, 32, 75, 97] },
    messi:   { label: 'Lionel Messi',      data: [92, 95, 96, 20, 58, 72] },
    ronaldo: { label: 'Cristiano Ronaldo', data: [88, 70, 78, 22, 82, 76] }
  };

  // Slot styling, applied by position rather than by entity.
  const vizSlot = (i) => {
    const c = i === 0 ? VIZ.s1 : VIZ.s2;
    return { borderColor: c, backgroundColor: vizFill(c, 0.15), pointBackgroundColor: c };
  };

  // 3b. Setup Radar Chart
  const radarCtx = document.getElementById('radarChart').getContext('2d');
  
  // Initial Datasets
  let dataset1 = playerData.mbappe;
  let dataset2 = playerData.haaland;

  const radarChart = new Chart(radarCtx, {
    type: 'radar',
    data: {
      labels: ['Shooting', 'Passing', 'Dribbling', 'Defending', 'Physical', 'Pace'],
      datasets: [
        Object.assign({ label: dataset1.label, data: dataset1.data,
                        borderWidth: 2, pointRadius: 4 }, vizSlot(0)),
        Object.assign({ label: dataset2.label, data: dataset2.data,
                        borderWidth: 2, pointRadius: 4 }, vizSlot(1))
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          grid: {
            color: VIZ.grid
          },
          angleLines: {
            color: VIZ.grid
          },
          ticks: {
            display: false,
            maxTicksLimit: 5
          },
          pointLabels: {
            color: VIZ.tick,
            font: {
              family: 'Space Grotesk',
              size: 11,
              weight: 'bold'
            }
          },
          suggestedMin: 0,
          suggestedMax: 100
        }
      },
      plugins: {
        legend: {
          labels: {
            color: VIZ.tick,
            font: {
              family: 'Plus Jakarta Sans',
              size: 12,
              weight: 'bold'
            }
          }
        }
      }
    }
  });

  // Handle player selects
  const p1Select = document.getElementById('player1Select');
  const p2Select = document.getElementById('player2Select');

  function updateRadar() {
    const p1 = playerData[p1Select.value];
    const p2 = playerData[p2Select.value];

    // Only label and data change — the slot keeps its colour, so picking
    // a different player never repaints the other series.
    radarChart.data.datasets[0].label = p1.label;
    radarChart.data.datasets[0].data = p1.data;
    radarChart.data.datasets[1].label = p2.label;
    radarChart.data.datasets[1].data = p2.data;

    radarChart.update();
  }

  p1Select.addEventListener('change', updateRadar);
  p2Select.addEventListener('change', updateRadar);

  // 3c. Setup xG Line Chart
  const lineCtx = document.getElementById('xgLineChart').getContext('2d');
  
  const gradientFill = lineCtx.createLinearGradient(0, 0, 0, 200);
  gradientFill.addColorStop(0, vizFill(VIZ.s1, 0.20));
  gradientFill.addColorStop(1, vizFill(VIZ.s1, 0));

  const xgLineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'],
      datasets: [
        {
          label: 'Expected Goals (xG)',
          data: [1.2, 1.8, 1.4, 2.4, 1.9, 2.2, 2.8, 1.5, 2.6, 2.15],
          borderColor: VIZ.s1,
          backgroundColor: gradientFill,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: VIZ.s1
        },
        {
          label: 'Actual Goals scored',
          data: [1, 2, 1, 3, 2, 2, 4, 1, 3, 2],
          borderColor: VIZ.s2,
          borderDash: [4, 4],
          fill: false,
          tension: 0.1,
          borderWidth: 1.5,
          pointRadius: 3,
          pointBackgroundColor: VIZ.s2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: VIZ.tick }
        },
        y: {
          grid: { color: VIZ.grid },
          ticks: { color: VIZ.tick }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: VIZ.tick,
            font: { family: 'Plus Jakarta Sans', size: 10 }
          }
        }
      }
    }
  });


  // ============================================================
  // 4. BASKETBALL INTERACTIVE HEATMAP
  // ============================================================
  const courtZones = document.querySelectorAll('.court-zone');
  
  // Elements for stats display
  const activeZoneLabel = document.getElementById('activeZoneLabel');
  const fgPercent = document.getElementById('fgPercent');
  const attempts = document.getElementById('attempts');
  const ppp = document.getElementById('ppp');
  const leagueAvg = document.getElementById('leagueAvg');
  const efficiencyFill = document.getElementById('efficiencyFill');

  // Interactive Database for zones
  const zoneDatabase = {
    paint: {
      label: 'Paint / Restricted Area',
      fg: '68.4%',
      att: 412,
      pointsPerPoss: '1.37',
      avg: '58.2%',
      rating: 85 // Efficiency rating out of 100 for visual bar
    },
    'mid-left': {
      label: 'Mid-Range Left',
      fg: '42.1%',
      att: 156,
      pointsPerPoss: '0.84',
      avg: '40.5%',
      rating: 58
    },
    'mid-right': {
      label: 'Mid-Range Right',
      fg: '44.3%',
      att: 188,
      pointsPerPoss: '0.89',
      avg: '40.5%',
      rating: 66
    },
    'three-left': {
      label: 'Three-Point Left Corner',
      fg: '38.5%',
      att: 220,
      pointsPerPoss: '1.16',
      avg: '35.8%',
      rating: 74
    },
    'three-right': {
      label: 'Three-Point Right Corner',
      fg: '40.2%',
      att: 204,
      pointsPerPoss: '1.21',
      avg: '35.8%',
      rating: 78
    },
    'three-deep': {
      label: 'Deep Three / Top of Key',
      fg: '35.1%',
      att: 112,
      pointsPerPoss: '1.05',
      avg: '32.4%',
      rating: 62
    }
  };

  courtZones.forEach(zone => {
    zone.addEventListener('click', () => {
      // Manage active highlights
      courtZones.forEach(z => z.classList.remove('active'));
      zone.classList.add('active');

      // Fetch zone data
      const zoneKey = zone.getAttribute('data-zone');
      const data = zoneDatabase[zoneKey];

      if (data) {
        // Populate layout
        activeZoneLabel.textContent = data.label;
        fgPercent.textContent = data.fg;
        attempts.textContent = data.att.toLocaleString();
        ppp.textContent = data.pointsPerPoss;
        leagueAvg.textContent = data.avg;
        
        // Update visual rating bar width
        efficiencyFill.style.width = `${data.rating}%`;
      }
    });
  });

  // Select Paint by default
  const defaultZone = document.querySelector('.zone-paint');
  if (defaultZone) {
    defaultZone.click();
  }


  // ============================================================
  // 5. MATCH SIMULATOR
  // ============================================================
  const startSimBtn = document.getElementById('startSimBtn');
  const homeSelect = document.getElementById('homeTeam');
  const awaySelect = document.getElementById('awayTeam');
  const homeAttack = document.getElementById('homeAttack');
  const awayAttack = document.getElementById('awayAttack');
  const weatherSelect = document.getElementById('weather');
  const simStatus = document.getElementById('simStatus');
  const consoleOutput = document.getElementById('consoleOutput');
  const liveBlink = document.getElementById('liveBlink');

  // Probabilities
  const homeProbBar = document.getElementById('homeProbBar');
  const drawProbBar = document.getElementById('drawProbBar');
  const awayProbBar = document.getElementById('awayProbBar');

  // Sliders value feedback
  const homeAttackVal = document.getElementById('homeAttackVal');
  const awayAttackVal = document.getElementById('awayAttackVal');

  homeAttack.addEventListener('input', () => homeAttackVal.textContent = homeAttack.value);
  awayAttack.addEventListener('input', () => awayAttackVal.textContent = awayAttack.value);

  // Simulation parameters
  let isSimulating = false;
  let simInterval = null;

  // Commentary database
  const regularEvents = [
    "Possession battle intensifying in the midfield.",
    "Midfielder intercepts a dangerous through ball.",
    "Tactical formation adjustments spotted from both managers.",
    "Spectacular save from the keeper! Keeps the sheet clean.",
    "Shot goes wide! A close opportunity missed.",
    "Corner kick awarded. Defense rises to clear it safely.",
    "Substitution warming up on the sideline.",
    "Yellow card issued for a sliding challenge in the center circle.",
    "Foul committed in the attacking third. Free kick coming up."
  ];

  startSimBtn.addEventListener('click', () => {
    if (isSimulating) {
      clearInterval(simInterval);
      endSimulation(true);
      return;
    }

    const home = homeSelect.value;
    const away = awaySelect.value;

    if (home === away) {
      alert("Please select two different teams to simulate!");
      return;
    }

    startSimulation(home, away);
  });

  function startSimulation(home, away) {
    isSimulating = true;
    startSimBtn.innerHTML = '<svg class="icon"><use href="#i-x"/></svg> Cancel Simulation';
    startSimBtn.style.background = 'var(--text-accent-cyan)';
    simStatus.textContent = "Simulating...";
    liveBlink.style.display = 'inline';
    consoleOutput.innerHTML = ''; // clear

    // Initial state variables
    let minute = 0;
    let homeScore = 0;
    let awayScore = 0;
    
    let homeStrength = parseInt(homeAttack.value);
    let awayStrength = parseInt(awayAttack.value);
    let weather = weatherSelect.value;

    // Tweak strengths based on weather
    if (weather === 'rain') {
      homeStrength -= 5;
      awayStrength -= 5;
    }

    // Set starting win percentages
    let homeProb = Math.floor((homeStrength / (homeStrength + awayStrength)) * 75);
    let awayProb = Math.floor((awayStrength / (homeStrength + awayStrength)) * 75);
    let drawProb = 100 - (homeProb + awayProb);

    updateProbBars(homeProb, drawProb, awayProb);
    logEvent(0, "SYSTEM", `Evaluating parameters... Weather: ${weather.toUpperCase()}. Home: ${home} (${homeStrength}). Away: ${away} (${awayStrength}).`);
    logEvent(0, "SYSTEM", "Outcome probabilities calculated. Kick-off match simulation...");

    simInterval = setInterval(() => {
      minute += Math.floor(Math.random() * 6) + 2; // Advance minutes randomly

      if (minute >= 90) {
        minute = 90;
        clearInterval(simInterval);
        logEvent(90, "FULL TIME", `Match ended. Final score: ${home} ${homeScore} - ${awayScore} ${away}.`);
        endSimulation();
        return;
      }

      // Simulate events
      const roll = Math.random();

      if (roll < 0.12) {
        // Goal opportunity
        const goalRoll = Math.random();
        // Weighted towards stronger attack
        const homeChance = homeStrength / (homeStrength + awayStrength);

        if (goalRoll < homeChance) {
          homeScore++;
          logEvent(minute, "GOAL!", `<span class="goal">GOAL for ${home}!</span> ${home} ${homeScore} - ${awayScore} ${away}. (Scored by Haaland)`);
          // Home win prob jumps
          homeProb = Math.min(95, homeProb + 12);
          awayProb = Math.max(2, awayProb - 9);
          drawProb = 100 - (homeProb + awayProb);
        } else {
          awayScore++;
          logEvent(minute, "GOAL!", `<span class="goal">GOAL for ${away}!</span> ${home} ${homeScore} - ${awayScore} ${away}. (Scored by Mbappé)`);
          // Away win prob jumps
          awayProb = Math.min(95, awayProb + 12);
          homeProb = Math.max(2, homeProb - 9);
          drawProb = 100 - (homeProb + awayProb);
        }
        updateProbBars(homeProb, drawProb, awayProb);
      } else if (roll < 0.35) {
        // Regular game commentary event
        const randComment = regularEvents[Math.floor(Math.random() * regularEvents.length)];
        logEvent(minute, "PLAY", randComment);
        
        // Small fluctuation of probabilities based on time decay (draw increases as time runs out if score is close)
        if (homeScore === awayScore) {
          drawProb = Math.min(70, drawProb + 1.5);
          const rem = 100 - drawProb;
          homeProb = Math.floor(rem * 0.5);
          awayProb = 100 - (homeProb + drawProb);
        } else {
          // leading team win probability slowly ticks up as time expires
          if (homeScore > awayScore) {
            homeProb = Math.min(99, homeProb + 1);
          } else {
            awayProb = Math.min(99, awayProb + 1);
          }
          drawProb = Math.max(1, drawProb - 0.5);
          const rem = 100 - drawProb;
          if (homeScore > awayScore) {
            awayProb = rem - homeProb;
          } else {
            homeProb = rem - awayProb;
          }
        }
        updateProbBars(homeProb, drawProb, awayProb);
      }

    }, 1200); // simulation interval time
  }

  function logEvent(minute, type, desc) {
    const eventEl = document.createElement('div');
    eventEl.className = 'event-log';
    eventEl.innerHTML = `<span class="time">${minute}'</span> [${type}] ${desc}`;
    consoleOutput.appendChild(eventEl);
    consoleOutput.scrollTop = consoleOutput.scrollHeight; // scroll bottom
  }

  function updateProbBars(home, draw, away) {
    home = Math.max(1, Math.floor(home));
    draw = Math.max(1, Math.floor(draw));
    away = 100 - (home + draw);

    homeProbBar.style.width = `${home}%`;
    homeProbBar.textContent = `Home: ${home}%`;

    drawProbBar.style.width = `${draw}%`;
    drawProbBar.textContent = `Draw: ${draw}%`;

    awayProbBar.style.width = `${away}%`;
    awayProbBar.textContent = `Away: ${away}%`;
  }

  function endSimulation(cancelled = false) {
    isSimulating = false;
    clearInterval(simInterval);
    startSimBtn.innerHTML = '<svg class="icon"><use href="#i-zap"/></svg> Run Simulation';
    startSimBtn.style.background = 'var(--gradient-accent)';
    simStatus.textContent = cancelled ? "Cancelled" : "Complete";
    liveBlink.style.display = 'none';

    if (cancelled) {
      logEvent(0, "SYSTEM", "Simulation terminated by user.");
    }
  }

  // ============================================================
  // 6. TENNIS RADAR CHART
  // ============================================================
  // Data only — colour comes from the slot, as on the football radar.
  const tennisPlayerData = {
    djokovic: { label: 'Novak Djokovic',  data: [98, 95, 88, 90, 96, 82] },
    alcaraz:  { label: 'Carlos Alcaraz',  data: [92, 90, 96, 85, 88, 98] },
    sinner:   { label: 'Jannik Sinner',   data: [90, 88, 85, 92, 84, 90] },
    medvedev: { label: 'Daniil Medvedev', data: [86, 94, 80, 88, 82, 78] }
  };

  const tennisRadarCtx = document.getElementById('tennisRadarChart');
  if (tennisRadarCtx) {
    const tRadarChart = new Chart(tennisRadarCtx.getContext('2d'), {
      type: 'radar',
      data: {
        labels: ['Serve', 'Return', 'Baseline', 'Net Play', 'Mental', 'Speed'],
        datasets: [
          Object.assign({ ...tennisPlayerData.djokovic, borderWidth: 2, pointRadius: 4 }, vizSlot(0)),
          Object.assign({ ...tennisPlayerData.alcaraz,  borderWidth: 2, pointRadius: 4 }, vizSlot(1))
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { r: { grid: { color: VIZ.grid }, angleLines: { color: VIZ.grid }, ticks: { display: false }, pointLabels: { color: VIZ.tick, font: { family: 'Space Grotesk', size: 11, weight: 'bold' } }, suggestedMin: 0, suggestedMax: 100 } },
        plugins: { legend: { labels: { color: VIZ.tick, font: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' } } } }
      }
    });

    document.getElementById('tennisPlayer1').addEventListener('change', function() {
      const p = tennisPlayerData[this.value];
      tRadarChart.data.datasets[0] = Object.assign(
        { ...p, borderWidth: 2, pointRadius: 4 }, vizSlot(0));
      tRadarChart.update();
    });
    document.getElementById('tennisPlayer2').addEventListener('change', function() {
      const p = tennisPlayerData[this.value];
      tRadarChart.data.datasets[1] = Object.assign(
        { ...p, borderWidth: 2, pointRadius: 4 }, vizSlot(1));
      tRadarChart.update();
    });
  }

  // Serve Speed Chart
  const serveSpeedCtx = document.getElementById('serveSpeedChart');
  if (serveSpeedCtx) {
    new Chart(serveSpeedCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['100-110', '111-120', '121-130', '131-140', '141-150', '150+'],
        datasets: [
          { label: 'Djokovic', data: [5, 12, 28, 34, 18, 8], backgroundColor: vizFill(VIZ.s1, 0.6), borderColor: VIZ.s1, borderWidth: 1, borderRadius: 4 },
          { label: 'Alcaraz', data: [3, 8, 22, 38, 22, 12], backgroundColor: vizFill(VIZ.s2, 0.6), borderColor: VIZ.s2, borderWidth: 1, borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { x: { grid: { display: false }, ticks: { color: VIZ.tick, font: { size: 10 } } }, y: { grid: { color: VIZ.grid }, ticks: { color: VIZ.tick } } },
        plugins: { legend: { labels: { color: VIZ.tick, font: { size: 11 } } } }
      }
    });
  }

  // Serve zone click interactions
  const serveZones = document.querySelectorAll('.serve-zone');
  const serveZoneStats = document.getElementById('serveZoneStats');
  const serveZoneData = {
    'wide-left':  { pct: '38%', ace: '14%', fault: '22%', label: 'Wide (Ad Court)' },
    'wide-right': { pct: '41%', ace: '18%', fault: '19%', label: 'Wide (Deuce Court)' },
    't-left':     { pct: '52%', ace: '28%', fault: '12%', label: 'T-Zone (Ad Court)' },
    't-right':    { pct: '49%', ace: '24%', fault: '14%', label: 'T-Zone (Deuce Court)' }
  };
  serveZones.forEach(z => {
    z.addEventListener('click', () => {
      serveZones.forEach(s => s.classList.remove('active'));
      z.classList.add('active');
      const d = serveZoneData[z.getAttribute('data-zone')];
      if (d && serveZoneStats) {
        serveZoneStats.innerHTML = `
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;margin-bottom:8px;">
            <strong style="color:var(--text-primary);">${d.label}</strong>
          </div>
          <div class="tennis-stat-row"><span>Serve In %</span><span style="color:var(--accent);">${d.pct}</span></div>
          <div class="tennis-stat-row"><span>Ace Rate</span><span style="color:var(--accent);">${d.ace}</span></div>
          <div class="tennis-stat-row"><span>Double Fault %</span><span style="color:var(--text-muted);">${d.fault}</span></div>
        `;
      }
    });
  });

  // ============================================================
  // 7. BASEBALL STRIKE ZONE
  // ============================================================
  const szZones = document.querySelectorAll('.sz-zone');
  const szZoneData = {
    'sz-hl': { name: 'High-Left',     ba: '.241', ops: '.724',  pitches: '198', swing: '54%', contact: 62 },
    'sz-hm': { name: 'High-Middle',   ba: '.312', ops: '.918',  pitches: '234', swing: '68%', contact: 74 },
    'sz-hr': { name: 'High-Right',    ba: '.258', ops: '.751',  pitches: '212', swing: '58%', contact: 66 },
    'sz-ml': { name: 'Middle-Left',   ba: '.289', ops: '.864',  pitches: '276', swing: '72%', contact: 80 },
    'sz-mm': { name: 'Middle-Middle', ba: '.398', ops: '1.142', pitches: '312', swing: '78%', contact: 88 },
    'sz-mr': { name: 'Middle-Right',  ba: '.301', ops: '.882',  pitches: '258', swing: '74%', contact: 82 },
    'sz-ll': { name: 'Low-Left',      ba: '.198', ops: '.612',  pitches: '154', swing: '44%', contact: 52 },
    'sz-lm': { name: 'Low-Middle',    ba: '.267', ops: '.778',  pitches: '188', swing: '61%', contact: 70 },
    'sz-lr': { name: 'Low-Right',     ba: '.211', ops: '.638',  pitches: '142', swing: '46%', contact: 55 }
  };

  szZones.forEach(z => {
    z.addEventListener('click', () => {
      szZones.forEach(s => s.classList.remove('active'));
      z.classList.add('active');
      const d = szZoneData[z.getAttribute('data-zone')];
      if (d) {
        document.getElementById('szZoneName').textContent = d.name;
        document.getElementById('szBA').textContent = d.ba;
        document.getElementById('szOPS').textContent = d.ops;
        document.getElementById('szPitches').textContent = d.pitches;
        document.getElementById('szSwing').textContent = d.swing;
        document.getElementById('szContactFill').style.width = d.contact + '%';
      }
    });
  });

  // Trigger default zone (middle-middle)
  const defaultSz = document.querySelector('[data-zone="sz-mm"]');
  if (defaultSz) defaultSz.click();

  /* Baseball pitch arsenal — ranked horizontal bar, not a donut.
     Two reasons it changed. A donut is only defensible for part-to-whole
     "at a glance", and these values (24 / 18 / 14) are close enough that
     arc length can't separate them — reading them off a shared baseline
     can. And a five-slice donut needs five categorical hues that stay
     distinct in every pairing, which no five-hue set achieves; the old
     one was cyan/purple/pink/green/amber and failed badly. Putting the
     pitch name on the axis moves identity to the label, so the whole
     chart needs exactly one hue and no legend. */
  const pitchCtx = document.getElementById('pitchArsenalChart');
  if (pitchCtx) {
    const pitches = [
      ['4-Seam FB', 34], ['Slider', 24], ['Curveball', 18],
      ['Changeup', 14], ['Cutter', 10]
    ];
    new Chart(pitchCtx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: pitches.map(p => p[0]),
        datasets: [{
          label: 'Usage',
          data: pitches.map(p => p[1]),
          backgroundColor: VIZ.s1,
          borderRadius: 4,
          borderSkipped: false,
          barThickness: 18
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        // One series — the card title names it, so a legend box would
        // only repeat itself.
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => c.parsed.x + '% of pitches thrown' } }
        },
        scales: {
          x: {
            grid: { color: VIZ.grid, drawBorder: false },
            ticks: { color: VIZ.tick, font: { size: 10 }, callback: (v) => v + '%' },
            beginAtZero: true
          },
          y: {
            grid: { display: false, drawBorder: false },
            ticks: { color: VIZ.tick, font: { size: 11 } }
          }
        }
      }
    });
  }

});
