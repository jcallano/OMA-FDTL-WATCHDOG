/**
 * Local Storage & Persistence Layer for Oman Air FTL PWA
 */

const FTLStorage = (() => {
  const STORAGE_KEY_DUTIES = 'oman_air_ftl_duties_v1';
  const STORAGE_KEY_SETTINGS = 'oman_air_ftl_settings_v1';

  const defaultSettings = {
    pilotName: 'Captain B737',
    fleet: 'B737',
    baseAirport: 'MCT',
    utcOffset: 4,
    tightMarginAlerts: true
  };

  function getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return data ? Object.assign({}, defaultSettings, JSON.parse(data)) : defaultSettings;
    } catch (e) {
      return defaultSettings;
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }

  function getDuties() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_DUTIES);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return parsed.map(dp => {
        if (dp.reportTimeUtc) dp.reportTimeUtc = new Date(dp.reportTimeUtc);
        if (dp.checkoutTimeUtc) dp.checkoutTimeUtc = new Date(dp.checkoutTimeUtc);
        if (dp.firstDepUtc) dp.firstDepUtc = new Date(dp.firstDepUtc);
        if (dp.lastArrUtc) dp.lastArrUtc = new Date(dp.lastArrUtc);
        if (dp.sectors) {
          dp.sectors.forEach(s => {
            if (s.depTimeUtc) s.depTimeUtc = new Date(s.depTimeUtc);
            if (s.arrTimeUtc) s.arrTimeUtc = new Date(s.arrTimeUtc);
          });
        }
        return dp;
      });
    } catch (e) {
      console.error("Error reading stored duties:", e);
      return [];
    }
  }

  function saveDuties(duties) {
    try {
      localStorage.setItem(STORAGE_KEY_DUTIES, JSON.stringify(duties));
      return true;
    } catch (e) {
      console.error("Error saving duties to storage:", e);
      return false;
    }
  }

  function exportToJson() {
    const duties = getDuties();
    const settings = getSettings();
    const payload = {
      exportDate: new Date().toISOString(),
      version: "1.0",
      settings: settings,
      duties: duties
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmanAir_FTL_Logbook_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportToCsv() {
    const duties = getDuties();
    if (!duties || duties.length === 0) return;

    let csvContent = "Duty ID,Date,Route,Report UTC,Checkout UTC,Sectors,Flight Time,Duty Time,FDP Duration,Max FDP,FDP Margin,Preceding Rest,Required Rest,Status\n";
    
    duties.forEach(d => {
      const dateStr = d.firstDepUtc ? d.firstDepUtc.toISOString().slice(0,10) : '';
      const repStr = d.reportTimeUtc ? d.reportTimeUtc.toISOString().slice(11,16) : '';
      const chkStr = d.checkoutTimeUtc ? d.checkoutTimeUtc.toISOString().slice(11,16) : '';
      const route = `"${d.summaryRoute || ''}"`;
      
      csvContent += `${d.dutyId},${dateStr},${route},${repStr},${chkStr},${d.sectorCount},${d.flightTimeMinutes},${d.dutyDurationMinutes},${d.fdpDurationMinutes},${d.maxFdpMinutes},${d.fdpMarginMinutes},${d.precedingRestMinutes || ''},${d.requiredRestMinutes || ''},${d.status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OmanAir_FTL_Duties_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    localStorage.removeItem(STORAGE_KEY_DUTIES);
  }

  return {
    getSettings,
    saveSettings,
    getDuties,
    saveDuties,
    exportToJson,
    exportToCsv,
    clearAll
  };
})();
