/**
 * Main Application UI Controller for Oman Air FTL PWA
 * Regulations valid as of August 2026
 */

document.addEventListener('DOMContentLoaded', () => {
  let allDuties = [];
  let currentFilter = 'ALL';
  let searchQuery = '';
  let trendChartInstance = null;
  let deferredInstallPrompt = null;

  initApp();

  function initApp() {
    setupTabNavigation();
    setupPwaInstall();
    setupSimulator();
    setupImporter();
    setupLogbookEvents();
    setupSettings();

    allDuties = FTLStorage.getDuties();
    refreshAllViews();
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

    const latestDuty = allDuties[allDuties.length - 1];
    
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

    const violCount = allDuties.filter(d => d.status === 'VIOLATION').length;
    const warnCount = allDuties.filter(d => d.status === 'WARNING').length;
    document.getElementById('dashViolationsBadge').innerText = `${violCount} Violations / ${warnCount} Warnings`;
    document.getElementById('dashTotalDutiesBadge').innerText = `${allDuties.length} Recorded Duties`;

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
          allDuties.push(draftEvaluation.draftDutyObj);
          allDuties = eCrewParser.recalculateDutiesAnalysis(allDuties);
          FTLStorage.saveDuties(allDuties);
          refreshAllViews();
          alert('Assignment successfully committed to your Flight Logbook!');
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

    const filtered = allDuties.filter(d => {
      const matchesFilter = (currentFilter === 'ALL') || (d.status === currentFilter);
      const dateStr = d.firstDepUtc ? d.firstDepUtc.toISOString().slice(0,10) : '';
      const routeStr = d.summaryRoute || '';
      const matchesSearch = !searchQuery || dateStr.includes(searchQuery) || routeStr.toLowerCase().includes(searchQuery);
      return matchesFilter && matchesSearch;
    });

    filtered.forEach(d => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => openDutyModal(d.dutyId));

      let badgeHtml = '<span class="badge badge-legal">Legal</span>';
      if (d.status === 'VIOLATION') badgeHtml = '<span class="badge badge-illegal">Violation</span>';
      else if (d.status === 'WARNING') badgeHtml = '<span class="badge badge-warning">Tight</span>';

      if (d.isSimulator) badgeHtml += ' <span class="badge badge-sim">SIM</span>';

      const dateStr = d.firstDepUtc ? d.firstDepUtc.toISOString().slice(0,10) : 'N/A';
      const repStr = d.reportTimeUtc ? d.reportTimeUtc.toISOString().slice(11,16) : '--:--';
      const chkStr = d.checkoutTimeUtc ? d.checkoutTimeUtc.toISOString().slice(11,16) : '--:--';

      tr.innerHTML = `
        <td class="mono">#${d.dutyId}</td>
        <td><strong>${dateStr}</strong></td>
        <td><strong>${d.summaryRoute}</strong> <span style="color:var(--text-muted);font-size:11px;">(${d.sectorCount}s)</span></td>
        <td class="mono">${repStr} UTC</td>
        <td class="mono">${chkStr} UTC</td>
        <td class="mono">${FTLRules.formatMinutesToHM(d.fdpDurationMinutes)} <span style="color:var(--text-muted);font-size:11px;">/ ${d.isSimulator ? 'N/A' : FTLRules.formatMinutesToHM(d.maxFdpMinutes)}</span></td>
        <td class="mono">${d.precedingRestMinutes !== null ? FTLRules.formatMinutesToHM(d.precedingRestMinutes) : 'Start'}</td>
        <td class="mono">${FTLRules.formatMinutesToHM(d.flightTime28dMinutes)}</td>
        <td class="mono">${FTLRules.formatMinutesToHM(d.dutyTime7dMinutes)}</td>
        <td>${badgeHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function openDutyModal(dutyId) {
    const d = allDuties.find(item => item.dutyId === dutyId);
    if (!d) return;

    document.getElementById('modalTitle').innerText = `Duty #${d.dutyId} - ${d.summaryRoute}`;
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

    document.getElementById('modalOverlay').style.display = 'flex';
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

    // Smart Merge: updates existing overlapping sectors & appends new ones
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
});
