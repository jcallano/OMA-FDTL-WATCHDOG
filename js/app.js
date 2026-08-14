/**
 * Main Application UI Controller for Oman Air FTL PWA
 * Features: Roster Schedule vs Completed Tracking, Hover Cards & Bottom Sheet Inspector
 * Regulations valid as of August 2026
 */

document.addEventListener('DOMContentLoaded', () => {
  let allDuties = [];
  let currentFilter = 'ALL';
  let searchQuery = '';
  let trendChartInstance = null;
  let deferredInstallPrompt = null;
  let hoverCard = null;

  initApp();

  function initApp() {
    createQuickHoverCard();
    setupTabNavigation();
    setupPwaInstall();
    setupSimulator();
    setupImporter();
    setupLogbookEvents();
    setupSettings();

    allDuties = FTLStorage.getDuties();
    refreshAllViews();
  }

  function createQuickHoverCard() {
    hoverCard = document.createElement('div');
    hoverCard.id = 'quickHoverCard';
    hoverCard.className = 'quick-hover-card';
    document.body.appendChild(hoverCard);
  }

  function setupTabNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetId = tab.getAttribute('data-tab');
        switchTab(targetId);
      });
    });

    const mobileBtns = document.querySelectorAll('.mobile-nav-btn');
    mobileBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-tab');
        switchTab(targetId);
      });
    });
  }

  function switchTab(targetId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
      if (t.getAttribute('data-tab') === targetId) t.classList.add('active');
      else t.classList.remove('active');
    });

    document.querySelectorAll('.mobile-nav-btn').forEach(b => {
      if (b.getAttribute('data-tab') === targetId) b.classList.add('active');
      else b.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const targetContent = document.getElementById(targetId);
    if (targetContent) targetContent.classList.add('active');

    if (targetId === 'tab-dashboard') {
      renderDashboard();
    } else if (targetId === 'tab-logbook') {
      renderLogbook();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function setupPwaInstall() {
    const btnInstall = document.getElementById('btnInstallApp');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (btnInstall) btnInstall.style.display = 'inline-flex';
    });

    if (btnInstall) {
      btnInstall.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        const choiceResult = await deferredInstallPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          btnInstall.style.display = 'none';
        }
        deferredInstallPrompt = null;
      });
    }
  }

  function refreshAllViews() {
    renderDashboard();
    renderLogbook();
    runSimulatorEvaluation();
  }

  function renderDashboard() {
    if (allDuties.length === 0) {
      document.getElementById('dashFlt28Value').innerText = '00h 00m';
      document.getElementById('dashFlt28Rem').innerText = '100h 00m left';
      document.getElementById('dashFlt28Sub').innerText = '0h of 100h max';
      document.getElementById('dashDuty7Value').innerText = '00h 00m';
      document.getElementById('dashDuty7Rem').innerText = '55h 00m left';
      document.getElementById('dashDuty14Value').innerText = '00h 00m';
      document.getElementById('dashDuty28Value').innerText = '00h 00m';
      document.getElementById('dashConsecValue').innerText = '0 Days';
      document.getElementById('dashViolationsBadge').innerText = '0 Violations / 0 Warnings';
      document.getElementById('dashTotalDutiesBadge').innerText = '0 Recorded Duties';
      return;
    }

    const now = new Date();
    const completedDuties = allDuties.filter(d => d.checkoutTimeUtc.getTime() <= now.getTime());
    const upcomingDuties = allDuties.filter(d => d.checkoutTimeUtc.getTime() > now.getTime());
    const latestDuty = completedDuties.length > 0 ? completedDuties[completedDuties.length - 1] : allDuties[allDuties.length - 1];

    const flt28 = latestDuty.flightTime28dMinutes || 0;
    const flt28Hours = (flt28 / 60).toFixed(1);
    const flt28Percent = Math.min(Math.round((flt28 / FTLRules.LIMITS.MAX_FLIGHT_28D) * 100), 100);
    const flt28Rem = Math.max(0, FTLRules.LIMITS.MAX_FLIGHT_28D - flt28);

    document.getElementById('dashFlt28Value').innerText = FTLRules.formatMinutesToHM(flt28);
    document.getElementById('dashFlt28Rem').innerText = `${FTLRules.formatMinutesToHM(flt28Rem)} left`;
    document.getElementById('dashFlt28Sub').innerText = `${flt28Hours}h of 100h max (${flt28Percent}%)`;
    const barFlt28 = document.getElementById('dashFlt28Bar');
    barFlt28.style.width = `${flt28Percent}%`;
    barFlt28.className = `kpi-bar ${flt28 > FTLRules.LIMITS.MAX_FLIGHT_28D ? 'bg-danger' : (flt28 >= FTLRules.WARNING_THRESHOLDS.FLIGHT_28D_MIN ? 'bg-warning' : 'bg-ok')}`;

    const duty7 = latestDuty.dutyTime7dMinutes || 0;
    const duty7Hours = (duty7 / 60).toFixed(1);
    const duty7Percent = Math.min(Math.round((duty7 / FTLRules.LIMITS.MAX_DUTY_7D) * 100), 100);
    const duty7Rem = Math.max(0, FTLRules.LIMITS.MAX_DUTY_7D - duty7);

    document.getElementById('dashDuty7Value').innerText = FTLRules.formatMinutesToHM(duty7);
    document.getElementById('dashDuty7Rem').innerText = `${FTLRules.formatMinutesToHM(duty7Rem)} left`;
    document.getElementById('dashDuty7Sub').innerText = `${duty7Hours}h of 55h max (${duty7Percent}%)`;
    const barDuty7 = document.getElementById('dashDuty7Bar');
    barDuty7.style.width = `${duty7Percent}%`;
    barDuty7.className = `kpi-bar ${duty7 > FTLRules.LIMITS.MAX_DUTY_7D ? 'bg-danger' : (duty7 >= FTLRules.WARNING_THRESHOLDS.DUTY_7D_MIN ? 'bg-warning' : 'bg-ok')}`;

    const duty14 = latestDuty.dutyTime14dMinutes || 0;
    const duty14Percent = Math.min(Math.round((duty14 / FTLRules.LIMITS.MAX_DUTY_14D) * 100), 100);
    document.getElementById('dashDuty14Value').innerText = FTLRules.formatMinutesToHM(duty14);
    document.getElementById('dashDuty14Sub').innerText = `${(duty14/60).toFixed(1)}h of 95h max (${duty14Percent}%)`;
    const barDuty14 = document.getElementById('dashDuty14Bar');
    barDuty14.style.width = `${duty14Percent}%`;
    barDuty14.className = `kpi-bar ${duty14 > FTLRules.LIMITS.MAX_DUTY_14D ? 'bg-danger' : (duty14 >= FTLRules.WARNING_THRESHOLDS.DUTY_14D_MIN ? 'bg-warning' : 'bg-ok')}`;

    const duty28 = latestDuty.dutyTime28dMinutes || 0;
    const duty28Percent = Math.min(Math.round((duty28 / FTLRules.LIMITS.MAX_DUTY_28D) * 100), 100);
    document.getElementById('dashDuty28Value').innerText = FTLRules.formatMinutesToHM(duty28);
    document.getElementById('dashDuty28Sub').innerText = `${(duty28/60).toFixed(1)}h of 190h max (${duty28Percent}%)`;
    const barDuty28 = document.getElementById('dashDuty28Bar');
    barDuty28.style.width = `${duty28Percent}%`;
    barDuty28.className = `kpi-bar ${duty28 > FTLRules.LIMITS.MAX_DUTY_28D ? 'bg-danger' : (duty28 >= FTLRules.WARNING_THRESHOLDS.DUTY_28D_MIN ? 'bg-warning' : 'bg-ok')}`;

    const consec = latestDuty.consecutiveDutyDays || 1;
    document.getElementById('dashConsecValue').innerText = `${consec} Days`;
    document.getElementById('dashConsecSub').innerText = `${Math.max(0, 7 - consec)} days until required day off`;

    const upcomingHazards = upcomingDuties.filter(d => d.status === 'VIOLATION' || d.status === 'WARNING').length;
    const violCount = allDuties.filter(d => d.status === 'VIOLATION').length;
    const warnCount = allDuties.filter(d => d.status === 'WARNING').length;

    let badgeText = `${violCount} Violations / ${warnCount} Warnings`;
    if (upcomingHazards > 0) {
      badgeText += ` (${upcomingHazards} Upcoming in Roster)`;
    }
    document.getElementById('dashViolationsBadge').innerText = badgeText;
    document.getElementById('dashTotalDutiesBadge').innerText = `${completedDuties.length} Completed | ${upcomingDuties.length} Rostered`;

    renderTrendChart();
  }

  function renderTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    const sampleStep = Math.max(1, Math.floor(allDuties.length / 50));
    const sampled = allDuties.filter((_, idx) => idx % sampleStep === 0);

    trendChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: sampled.map(d => d.firstDepUtc ? d.firstDepUtc.toISOString().slice(5,10) : ''),
        datasets: [
          {
            label: '28-Day Flight Hours',
            data: sampled.map(d => ((d.flightTime28dMinutes || 0) / 60).toFixed(1)),
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            fill: true,
            tension: 0.3
          },
          {
            label: '28-Day Limit (100h)',
            data: sampled.map(() => 100),
            borderColor: '#ef4444',
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: '7-Day Duty Hours',
            data: sampled.map(d => ((d.dutyTime7dMinutes || 0) / 60).toFixed(1)),
            borderColor: '#10b981',
            tension: 0.3,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { family: 'Outfit' } } }
        },
        scales: {
          x: { ticks: { color: '#64748b', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { ticks: { color: '#64748b' }, grid: { color: 'rgba(255,255,255,0.04)' } }
        }
      }
    });
  }

  function setupSimulator() {
    const btnAddSector = document.getElementById('btnAddSimSector');
    const container = document.getElementById('simSectorsContainer');
    const btnCommit = document.getElementById('btnCommitSimDuty');
    const btnReset = document.getElementById('btnResetSim');

    addSectorRow('MCT', 'DXB', '04:00', '05:15');
    addSectorRow('DXB', 'MCT', '06:15', '07:30');

    if (btnAddSector) {
      btnAddSector.addEventListener('click', () => {
        const lastArr = container.querySelector('.sector-box:last-child .input-arr')?.value || 'MCT';
        addSectorRow(lastArr, 'MCT', '08:30', '10:00');
        runSimulatorEvaluation();
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', () => {
        container.innerHTML = '';
        addSectorRow('MCT', 'DXB', '04:00', '05:15');
        addSectorRow('DXB', 'MCT', '06:15', '07:30');
        runSimulatorEvaluation();
      });
    }

    if (btnCommit) {
      btnCommit.addEventListener('click', () => {
        const draftEvaluation = getSimulatorDraftEvaluation();
        if (draftEvaluation && draftEvaluation.draftDutyObj) {
          const mergeResult = eCrewParser.mergeSectors(allDuties, draftEvaluation.draftDutyObj.sectors);
          allDuties = mergeResult.duties;
          FTLStorage.saveDuties(allDuties);
          refreshAllViews();
          alert('Flight successfully committed to your logbook & FTL limits updated!');
          switchTab('tab-logbook');
        }
      });
    }

    document.getElementById('simDate')?.addEventListener('change', runSimulatorEvaluation);
    document.getElementById('simDutyType')?.addEventListener('change', runSimulatorEvaluation);
  }

  function addSectorRow(dep = 'MCT', arr = 'DXB', depTime = '04:00', arrTime = '05:15') {
    const container = document.getElementById('simSectorsContainer');
    const idx = container.children.length + 1;

    const div = document.createElement('div');
    div.className = 'sector-box';
    div.innerHTML = `
      <div class="sector-box-header">
        <span>Sector #${idx}</span>
        ${idx > 1 ? '<button type="button" class="btn-remove-sector">&times; Remove</button>' : ''}
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Departure Airport</label>
          <input type="text" class="form-control input-dep" value="${dep}" maxlength="4" style="text-transform:uppercase;">
        </div>
        <div class="form-group">
          <label class="form-label">Arrival Airport</label>
          <input type="text" class="form-control input-arr" value="${arr}" maxlength="4" style="text-transform:uppercase;">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Chocks-Off (UTC)</label>
          <input type="time" class="form-control input-dep-time" value="${depTime}">
        </div>
        <div class="form-group">
          <label class="form-label">Chocks-On (UTC)</label>
          <input type="time" class="form-control input-arr-time" value="${arrTime}">
        </div>
      </div>
    `;

    const removeBtn = div.querySelector('.btn-remove-sector');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        div.remove();
        runSimulatorEvaluation();
      });
    }

    div.querySelectorAll('input').forEach(input => {
      input.addEventListener('input', runSimulatorEvaluation);
    });

    container.appendChild(div);
  }

  function getSimulatorDraftEvaluation() {
    const simDateInput = document.getElementById('simDate');
    const dateVal = simDateInput ? simDateInput.value : new Date().toISOString().slice(0,10);
    const dateObj = new Date(dateVal);
    const isSim = document.getElementById('simDutyType')?.value === 'SIMULATOR';

    const sectorBoxes = document.querySelectorAll('#simSectorsContainer .sector-box');
    const sectors = [];

    sectorBoxes.forEach(box => {
      const depApt = (box.querySelector('.input-dep').value || 'MCT').trim().toUpperCase();
      const arrApt = (box.querySelector('.input-arr').value || 'MCT').trim().toUpperCase();
      const depTimeStr = box.querySelector('.input-dep-time').value || '04:00';
      const arrTimeStr = box.querySelector('.input-arr-time').value || '05:00';

      const [depH, depM] = depTimeStr.split(':').map(Number);
      const [arrH, arrM] = arrTimeStr.split(':').map(Number);

      const depDt = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), depH, depM));
      let arrDt = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), arrH, arrM));

      if (arrDt < depDt) {
        arrDt = new Date(arrDt.getTime() + 24 * 3600 * 1000);
      }

      const fltMin = Math.round((arrDt.getTime() - depDt.getTime()) / (60 * 1000));

      sectors.push({
        dateStr: `${dateObj.getDate()}/${dateObj.getMonth()+1}/${dateObj.getFullYear()}`,
        depAirport: depApt,
        arrAirport: arrApt,
        depTimeUtc: depDt,
        arrTimeUtc: arrDt,
        flightTimeMinutes: fltMin,
        acType: '737',
        reg: '',
        picName: 'Self',
        isSimulator: isSim
      });
    });

    return FTLSimulator.evaluateDraftDuty(sectors, allDuties);
  }

  function runSimulatorEvaluation() {
    const res = getSimulatorDraftEvaluation();
    if (!res) return;

    const verdictBox = document.getElementById('simVerdictBox');
    const verdictBadge = document.getElementById('simVerdictBadge');
    const verdictTitle = document.getElementById('simVerdictTitle');
    const verdictList = document.getElementById('simVerdictList');

    verdictBox.className = `verdict-box ${res.verdictClass}`;
    verdictBadge.className = `verdict-badge ${res.verdictClass}`;
    verdictBadge.innerText = res.verdict;
    verdictTitle.innerText = res.verdictTitle;

    document.getElementById('simFdpVal').innerText = `${res.metrics.fdpDurationFormatted} (Max: ${res.metrics.maxFdpFormatted})`;
    document.getElementById('simFdpMarginVal').innerText = res.metrics.fdpMarginFormatted;
    document.getElementById('simPrecedingRestVal').innerText = res.metrics.precedingRestFormatted;
    document.getElementById('simSubsequentRestVal').innerText = res.metrics.subsequentRestRequiredFormatted;
    document.getElementById('simProjFlt28Val').innerText = `${res.metrics.projFlt28dFormatted} / 100h`;
    document.getElementById('simProjDuty7Val').innerText = `${res.metrics.projDuty7dFormatted} / 55h`;
    document.getElementById('simReportLocalVal').innerText = `${res.metrics.reportLocalFormatted} (${res.metrics.reportUtcFormatted})`;

    verdictList.innerHTML = '';
    res.checks.forEach(c => {
      const li = document.createElement('li');
      li.className = 'verdict-detail-item';
      
      let icon = '🟢';
      if (c.status === 'VIOLATION') icon = '🔴';
      else if (c.status === 'WARNING') icon = '🟡';
      else if (c.status === 'INFO') icon = 'ℹ️';

      li.innerHTML = `<span>${icon}</span> <div><strong>${c.label} (${c.ref}):</strong> ${c.detail}</div>`;
      verdictList.appendChild(li);
    });
  }

  function setupLogbookEvents() {
    document.querySelectorAll('.btn-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-status');
        renderLogbook();
      });
    });

    const searchInput = document.getElementById('logbookSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderLogbook();
      });
    }

    document.getElementById('btnExportJson')?.addEventListener('click', FTLStorage.exportToJson);
    document.getElementById('btnExportCsv')?.addEventListener('click', FTLStorage.exportToCsv);
    document.getElementById('btnClearData')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all stored flight logbook data?')) {
        FTLStorage.clearAll();
        allDuties = [];
        refreshAllViews();
      }
    });

    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modalOverlay') closeModal();
    });
    document.getElementById('btnModalClose')?.addEventListener('click', closeModal);
  }

  function renderLogbook() {
    const tbody = document.getElementById('logbookTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const now = new Date();

    const filtered = allDuties.filter(d => {
      const isPast = d.checkoutTimeUtc.getTime() <= now.getTime();
      let matchesFilter = true;

      if (currentFilter === 'UPCOMING') {
        matchesFilter = !isPast;
      } else if (currentFilter === 'COMPLETED') {
        matchesFilter = isPast;
      } else if (currentFilter === 'VIOLATION') {
        matchesFilter = (d.status === 'VIOLATION');
      } else if (currentFilter === 'WARNING') {
        matchesFilter = (d.status === 'WARNING');
      } else if (currentFilter === 'OK') {
        matchesFilter = (d.status === 'OK');
      }

      const dateStr = d.firstDepUtc ? d.firstDepUtc.toISOString().slice(0,10) : '';
      const routeStr = d.summaryRoute || '';
      const matchesSearch = !searchQuery || dateStr.includes(searchQuery) || routeStr.toLowerCase().includes(searchQuery);
      return matchesFilter && matchesSearch;
    });

    let dividerInserted = false;

    filtered.forEach((d, idx) => {
      const isPast = d.checkoutTimeUtc.getTime() <= now.getTime();

      // Insert visual TODAY line when transitioning from past to upcoming
      if (!dividerInserted && currentFilter === 'ALL' && !isPast && idx > 0) {
        const dividerTr = document.createElement('tr');
        dividerTr.className = 'tr-today-divider';
        dividerTr.innerHTML = `
          <td colspan="10" style="text-align:center;">
            📍 TODAY • ${now.toISOString().slice(0,10)} (Upcoming Rostered Duties Below &darr;)
          </td>
        `;
        tbody.appendChild(dividerTr);
        dividerInserted = true;
      }

      const tr = document.createElement('tr');
      tr.className = isPast ? 'row-past' : 'row-scheduled';
      tr.style.cursor = 'pointer';

      // Desktop Hover Events
      tr.addEventListener('mouseenter', (e) => showHoverCard(e, d));
      tr.addEventListener('mousemove', (e) => positionHoverCard(e));
      tr.addEventListener('mouseleave', hideHoverCard);

      // Tap to open full Inspector Bottom Sheet
      tr.addEventListener('click', () => openDutyModal(d.dutyId));

      let badgeHtml = '';
      if (d.isDayOff) {
        badgeHtml = `<span class="badge badge-legal" style="background:rgba(16,185,129,0.18);color:#10b981;border:1px solid rgba(16,185,129,0.4);">🏖️ ${d.summaryRoute || 'Day Off'}</span>`;
      } else if (d.isStandby) {
        badgeHtml = `<span class="badge badge-scheduled" style="background:rgba(14,165,233,0.18);color:#38bdf8;border:1px solid rgba(14,165,233,0.4);">📞 Home Standby</span>`;
      } else if (!isPast) {
        if (d.status === 'VIOLATION') badgeHtml = '<span class="badge badge-illegal">⚠️ Illegal Roster</span>';
        else if (d.status === 'WARNING') badgeHtml = '<span class="badge badge-warning">⚡ Tight Roster</span>';
        else badgeHtml = '<span class="badge badge-scheduled">Rostered</span>';
      } else {
        if (d.status === 'VIOLATION') badgeHtml = '<span class="badge badge-illegal">Violation</span>';
        else if (d.status === 'WARNING') badgeHtml = '<span class="badge badge-warning">Tight</span>';
        else badgeHtml = '<span class="badge badge-legal">Legal</span>';
      }

      if (d.isSimulator) badgeHtml += ' <span class="badge badge-sim">SIM</span>';

      const dateStr = d.firstDepUtc ? d.firstDepUtc.toISOString().slice(0,10) : 'N/A';
      const repStr = (d.isDayOff) ? '--:--' : (d.reportTimeUtc ? d.reportTimeUtc.toISOString().slice(11,16) : '--:--');
      const chkStr = (d.isDayOff) ? '--:--' : (d.checkoutTimeUtc ? d.checkoutTimeUtc.toISOString().slice(11,16) : '--:--');
      const fdpDisplay = (d.isDayOff || d.isStandby) ? '-' : `${FTLRules.formatMinutesToHM(d.fdpDurationMinutes)} <span style="color:var(--text-muted);font-size:11px;">/ ${d.isSimulator ? 'N/A' : FTLRules.formatMinutesToHM(d.maxFdpMinutes)}</span>`;
      const restDisplay = (d.isDayOff) ? '-' : (d.precedingRestMinutes !== null ? FTLRules.formatMinutesToHM(d.precedingRestMinutes) : 'Start');
      const dutyDayDisplay = (d.isDayOff) ? '<span style="color:#10b981;font-weight:700;">OFF (Reset)</span>' : `<span style="font-weight:700;color:${d.consecutiveDutyDays >= 7 ? 'var(--danger)' : (d.consecutiveDutyDays >= 6 ? 'var(--warning)' : 'var(--text-primary)')};">Day ${d.consecutiveDutyDays || 1}/7</span>`;

      tr.innerHTML = `
        <td class="mono">#${d.dutyId}</td>
        <td><strong>${dateStr}</strong></td>
        <td><strong>${d.summaryRoute}</strong> <span style="color:var(--text-muted);font-size:11px;">${d.isDayOff ? '' : `(${d.sectorCount}s)`}</span></td>
        <td class="mono">${repStr} ${d.isDayOff ? '' : 'UTC'}</td>
        <td class="mono">${chkStr} ${d.isDayOff ? '' : 'UTC'}</td>
        <td class="mono">${fdpDisplay}</td>
        <td class="mono">${restDisplay}</td>
        <td class="mono">${dutyDayDisplay}</td>
        <td class="mono">${d.isDayOff ? '-' : FTLRules.formatMinutesToHM(d.flightTime28dMinutes)}</td>
        <td class="mono">${d.isDayOff ? '-' : FTLRules.formatMinutesToHM(d.dutyTime7dMinutes)}</td>
        <td>${badgeHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function showHoverCard(e, d) {
    if (!hoverCard) return;
    const isPast = d.checkoutTimeUtc.getTime() <= new Date().getTime();
    const consecDays = d.consecutiveDutyDays || 1;
    const daysOffNeeded = Math.max(0, 7 - consecDays);
    
    let content = `
      <div style="font-weight:700;margin-bottom:6px;color:#fff;border-bottom:1px solid rgba(255,255,255,0.15);padding-bottom:4px;display:flex;justify-content:space-between;align-items:center;">
        <span>Duty #${d.dutyId} • ${d.summaryRoute}</span>
        <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${isPast ? 'rgba(16,185,129,0.2)' : 'rgba(168,85,247,0.2)'};color:${isPast ? '#10b981' : '#c084fc'};">${isPast ? 'COMPLETED' : 'ROSTERED'}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px;">
        <div><strong>FDP:</strong> ${FTLRules.formatMinutesToHM(d.fdpDurationMinutes)}</div>
        <div><strong>Max FDP:</strong> ${d.isSimulator ? 'N/A' : FTLRules.formatMinutesToHM(d.maxFdpMinutes)}</div>
        <div><strong>Margin:</strong> <span style="color:${d.fdpMarginMinutes < 0 ? '#ef4444' : '#10b981'};font-weight:700;">${d.isSimulator ? 'N/A' : FTLRules.formatMinutesToHM(d.fdpMarginMinutes)}</span></div>
        <div><strong>Preceding Rest:</strong> ${d.precedingRestMinutes !== null ? FTLRules.formatMinutesToHM(d.precedingRestMinutes) : 'N/A'}</div>
      </div>
      <div style="background:rgba(255,255,255,0.05);padding:6px 8px;border-radius:6px;margin-bottom:6px;">
        <div style="color:${consecDays >= 7 ? '#ef4444' : (consecDays >= 6 ? '#f59e0b' : '#38bdf8')};font-weight:700;">
          🗓️ Consecutive Duty: Day ${consecDays} of 7 Max (OM-A 7.1.5)
        </div>
        <div style="font-size:11px;color:#94a3b8;">${consecDays >= 7 ? '🛑 Statutory Days Off REQUIRED after this duty' : `${daysOffNeeded} day(s) remaining until required days off`}</div>
      </div>
      <div style="padding-top:4px;border-top:1px dashed rgba(255,255,255,0.1);font-size:11.5px;color:#cbd5e1;">
        <div>• 28-Day Flight: <strong>${FTLRules.formatMinutesToHM(d.flightTime28dMinutes)}</strong> / 100h</div>
        <div>• 7-Day Duty: <strong>${FTLRules.formatMinutesToHM(d.dutyTime7dMinutes)}</strong> / 55h</div>
      </div>
    `;

    if (d.violations && d.violations.length > 0) {
      content += `<div style="color:#f87171;margin-top:6px;font-size:11px;background:rgba(239,68,68,0.15);padding:4px 6px;border-radius:4px;">⚠️ ${d.violations[0].title}</div>`;
    }

    hoverCard.innerHTML = content;
    hoverCard.style.display = 'block';
    positionHoverCard(e);
  }

  function positionHoverCard(e) {
    if (!hoverCard || hoverCard.style.display !== 'block') return;
    const x = e.clientX + 15;
    const y = e.clientY + 15;
    const cardWidth = 320;
    const cardHeight = hoverCard.offsetHeight || 220;

    // Boundary protection for screen edges
    const posX = (x + cardWidth > window.innerWidth) ? (e.clientX - cardWidth - 10) : x;
    const posY = (y + cardHeight > window.innerHeight) ? (e.clientY - cardHeight - 10) : y;

    hoverCard.style.left = `${Math.max(10, posX)}px`;
    hoverCard.style.top = `${Math.max(10, posY)}px`;
    hoverCard.style.position = 'fixed';
  }

  function hideHoverCard() {
    if (hoverCard) hoverCard.style.display = 'none';
  }

  function openDutyModal(dutyId) {
    hideHoverCard();
    const d = allDuties.find(item => item.dutyId === dutyId);
    if (!d) return;

    const isPast = d.checkoutTimeUtc.getTime() <= new Date().getTime();
    document.getElementById('modalTitle').innerText = `Duty #${d.dutyId} - ${d.summaryRoute} (${isPast ? 'Completed' : 'Upcoming Roster'})`;
    document.getElementById('modalSubtitle').innerText = `${d.firstDepUtc ? d.firstDepUtc.toISOString().slice(0,10) : ''} | Report: ${d.reportTimeUtc ? d.reportTimeUtc.toISOString().slice(11,16) : ''} UTC -> Checkout: ${d.checkoutTimeUtc ? d.checkoutTimeUtc.toISOString().slice(11,16) : ''} UTC`;

    const alertsDiv = document.getElementById('modalAlerts');
    alertsDiv.innerHTML = '';
    d.violations?.forEach(v => {
      alertsDiv.innerHTML += `<div style="background:var(--danger-bg);border-left:4px solid var(--danger);padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13px;"><strong>[VIOLATION] ${v.title} (${v.ref}):</strong> ${v.detail} (Margin: ${v.margin})</div>`;
    });
    d.warnings?.forEach(w => {
      alertsDiv.innerHTML += `<div style="background:var(--warning-bg);border-left:4px solid var(--warning);padding:10px 14px;border-radius:8px;margin-bottom:8px;font-size:13px;"><strong>[WARNING] ${w.title} (${w.ref}):</strong> ${w.detail} (Margin: ${w.margin})</div>`;
    });

    document.getElementById('modalFdpInfo').innerText = `${FTLRules.formatMinutesToHM(d.fdpDurationMinutes)} (Max Limit: ${d.isSimulator ? 'N/A' : FTLRules.formatMinutesToHM(d.maxFdpMinutes)} | Margin: ${d.isSimulator ? 'N/A' : FTLRules.formatMinutesToHM(d.fdpMarginMinutes)})`;
    document.getElementById('modalRestInfo').innerText = `${d.precedingRestMinutes !== null ? FTLRules.formatMinutesToHM(d.precedingRestMinutes) : 'Initial Rest'} (Required: ${d.requiredRestMinutes ? FTLRules.formatMinutesToHM(d.requiredRestMinutes) : 'N/A'})`;
    document.getElementById('modalFlt28Info').innerText = `${FTLRules.formatMinutesToHM(d.flightTime28dMinutes)} / 100h 00m`;
    document.getElementById('modalDuty7Info').innerText = `7d: ${FTLRules.formatMinutesToHM(d.dutyTime7dMinutes)}/55h | 14d: ${FTLRules.formatMinutesToHM(d.dutyTime14dMinutes)}/95h`;

    const sectorsBody = document.getElementById('modalSectorsBody');
    sectorsBody.innerHTML = '';
    d.sectors?.forEach(s => {
      const depT = s.depTimeUtc ? s.depTimeUtc.toISOString().slice(11,16) : '--:--';
      const arrT = s.arrTimeUtc ? s.arrTimeUtc.toISOString().slice(11,16) : '--:--';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${s.depAirport} &rarr; ${s.arrAirport}</strong></td>
        <td class="mono">${depT}</td>
        <td class="mono">${arrT}</td>
        <td class="mono">${FTLRules.formatMinutesToHM(s.flightTimeMinutes)}</td>
        <td>${s.acType || '-'}</td>
        <td>${s.reg || '-'}</td>
        <td>${s.picName || s.simType || '-'}</td>
      `;
      sectorsBody.appendChild(tr);
    });

    // Add Action to test in simulator
    let simBtn = document.getElementById('btnTestInSim');
    if (!simBtn) {
      simBtn = document.createElement('button');
      simBtn.id = 'btnTestInSim';
      simBtn.className = 'btn-primary';
      simBtn.style.width = '100%';
      simBtn.style.marginTop = '16px';
      simBtn.innerHTML = '<span>⚡</span> Test / Modify this Duty in Simulator';
      document.querySelector('.modal-card').appendChild(simBtn);
    }

    simBtn.onclick = () => {
      closeModal();
      loadDutyIntoSimulator(d);
      switchTab('tab-simulator');
    };

    document.getElementById('modalOverlay').style.display = 'flex';
  }

  function loadDutyIntoSimulator(duty) {
    const simDateInput = document.getElementById('simDate');
    if (simDateInput && duty.firstDepUtc) {
      simDateInput.value = duty.firstDepUtc.toISOString().slice(0,10);
    }
    const container = document.getElementById('simSectorsContainer');
    container.innerHTML = '';

    duty.sectors.forEach((s, idx) => {
      const depTime = s.depTimeUtc ? s.depTimeUtc.toISOString().slice(11,16) : '04:00';
      const arrTime = s.arrTimeUtc ? s.arrTimeUtc.toISOString().slice(11,16) : '05:00';
      addSectorRow(s.depAirport, s.arrAirport, depTime, arrTime);
    });

    runSimulatorEvaluation();
  }

  function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  function setupImporter() {
    const dropzone = document.getElementById('csvDropzone');
    const fileInput = document.getElementById('csvFileInput');
    const btnParseText = document.getElementById('btnParseClipboard');
    const clipboardText = document.getElementById('clipboardText');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
      dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          handleFileImport(e.dataTransfer.files[0]);
        }
      });

      fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          handleFileImport(e.target.files[0]);
        }
      });
    }

    if (btnParseText && clipboardText) {
      btnParseText.addEventListener('click', () => {
        const text = clipboardText.value.trim();
        if (!text) {
          alert('Please paste CSV text into the textarea first.');
          return;
        }
        processCsvText(text);
      });
    }
  }

  function handleFileImport(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      processCsvText(e.target.result);
    };
    reader.readAsText(file);
  }

  function processCsvText(text) {
    const newSectors = eCrewParser.parseCsvContent(text);
    if (newSectors.length === 0) {
      alert('No valid flight sectors found. Please check file format.');
      return;
    }

    const mergeResult = eCrewParser.mergeSectors(allDuties, newSectors);
    allDuties = mergeResult.duties;
    FTLStorage.saveDuties(allDuties);
    refreshAllViews();

    const { addedCount, updatedCount, totalDuties } = mergeResult.stats;
    alert(`Logbook Synchronized Successfully!\n\n• ${addedCount} new flights added\n• ${updatedCount} overlapping flights updated with latest data\n• Total: ${totalDuties} duty periods in local history.`);
    switchTab('tab-dashboard');
  }

  function setupSettings() {
    const settings = FTLStorage.getSettings();
    const pilotName = document.getElementById('settingsPilotName');
    const baseAirport = document.getElementById('settingsBase');
    const fleet = document.getElementById('settingsFleet');

    if (pilotName) pilotName.value = settings.pilotName || '';
    if (baseAirport) baseAirport.value = settings.baseAirport || 'MCT';
    if (fleet) fleet.value = settings.fleet || 'B737';

    document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
      const updated = {
        pilotName: pilotName.value,
        baseAirport: baseAirport.value,
        fleet: fleet.value,
        utcOffset: 4,
        tightMarginAlerts: true
      };
      FTLStorage.saveSettings(updated);
      alert('Settings saved successfully!');
    });
  }

  async function clearDataAndForceUpdate() {
    const ok = confirm('⚠️ Reset All Data & Force Update?\n\nThis will:\n1. Clear all local stored flight & duty data\n2. Purge Service Worker & Browser Cache\n3. Force fresh live download of latest code from GitHub Pages\n\nDo you want to proceed?');
    if (!ok) return;

    try {
      localStorage.clear();

      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
          await registration.unregister();
        }
      }

      if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (let name of cacheNames) {
          await caches.delete(name);
        }
      }
    } catch (err) {
      console.error('Error while clearing data and cache:', err);
    }

    // Force hard reload bypassing cache
    window.location.href = window.location.origin + window.location.pathname + '?v=' + Date.now();
  }

  document.getElementById('btnClearDataAndUpdate')?.addEventListener('click', clearDataAndForceUpdate);
  document.getElementById('btnBannerReset')?.addEventListener('click', clearDataAndForceUpdate);
});
