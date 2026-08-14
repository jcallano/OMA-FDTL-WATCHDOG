/**
 * Oman Air OM-A Chapter 7 FTL Rules & Business Logic Engine
 * Regulations valid as of August 2026
 */

const FTLRules = (() => {
  const BASE_AIRPORT = 'MCT';
  const BASE_UTC_OFFSET_HOURS = 4; // Muscat is UTC+4 year-round

  const LIMITS = {
    MAX_FLIGHT_28D: 100 * 60, // 100 hours
    MAX_FLIGHT_12M: 900 * 60, // 900 hours
    MAX_DUTY_7D: 55 * 60,     // 55 hours
    MAX_DUTY_14D: 95 * 60,    // 95 hours
    MAX_DUTY_28D: 190 * 60,   // 190 hours
    MAX_CONSECUTIVE_DAYS: 7,
    MIN_DAYS_OFF_28D: 7,
    MIN_CONSECUTIVE_DAYS_OFF_14D: 2
  };

  const WARNING_THRESHOLDS = {
    FDP_MARGIN_MIN: 45,
    FDP_RATIO: 0.90,
    REST_MARGIN_MIN: 60,
    FLIGHT_28D_MIN: 90 * 60,
    DUTY_7D_MIN: 50 * 60,
    DUTY_14D_MIN: 85 * 60,
    DUTY_28D_MIN: 175 * 60
  };

  const TABLE_A = [
    [6, 0, 7, 59, [13*60, 12*60+15, 11*60+30, 10*60+45, 10*60, 9*60+30, 9*60, 9*60]],
    [8, 0, 12, 59, [14*60, 13*60+15, 12*60+30, 11*60+45, 11*60, 10*60+30, 10*60, 9*60+30]],
    [13, 0, 17, 59, [13*60, 12*60+15, 11*60+30, 10*60+45, 10*60, 9*60+30, 9*60, 9*60]],
    [18, 0, 21, 59, [12*60, 11*60+15, 10*60+30, 9*60+45, 9*60, 9*60, 9*60, 9*60]],
    [22, 0, 5, 59, [11*60, 10*60+15, 9*60+30, 9*60, 9*60, 9*60, 9*60, 9*60]],
  ];

  function formatMinutesToHM(minutes) {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return '--:--';
    const sign = minutes < 0 ? '-' : '';
    const abs = Math.abs(Math.round(minutes));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
  }

  function formatMinutesToClock(minutes) {
    if (minutes === null || minutes === undefined || isNaN(minutes)) return '--:--';
    const abs = Math.abs(Math.round(minutes));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function parseDurationMinutes(str) {
    if (!str) return 0;
    const parts = str.trim().split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return 0;
  }

  function getReportingOffsetMinutes(depAirport, isSimulator = false) {
    if (isSimulator) return 120;
    if ((depAirport || '').trim().toUpperCase() === BASE_AIRPORT) return 75;
    return 60;
  }

  function getCheckoutOffsetMinutes(isSimulator = false) {
    if (isSimulator) return 60;
    return 30;
  }

  function calculateFactoredSectors(sectors, isAcclimatised = true) {
    let count = 0;
    for (const s of sectors) {
      const hours = (s.flightTimeMinutes || 0) / 60.0;
      if (hours > 11.0) count += 4;
      else if (hours > 9.0) count += isAcclimatised ? 3 : 4;
      else if (hours > 7.0) count += isAcclimatised ? 2 : 4;
      else count += 1;
    }
    return Math.max(count, 1);
  }

  function getMaxFdpMinutes(reportLocalDate, sectorCount, isAcclimatised = true) {
    const h = reportLocalDate.getHours();
    const m = reportLocalDate.getMinutes();
    const totalMinutes = h * 60 + m;
    const sIdx = Math.min(Math.max(sectorCount, 1), 8) - 1;

    for (const [sh, sm, eh, em, tableVals] of TABLE_A) {
      const startBound = sh * 60 + sm;
      const endBound = eh * 60 + em;

      if (startBound <= endBound) {
        if (totalMinutes >= startBound && totalMinutes <= endBound) {
          return tableVals[sIdx];
        }
      } else {
        if (totalMinutes >= startBound || totalMinutes <= endBound) {
          return tableVals[sIdx];
        }
      }
    }
    return 11 * 60;
  }

  function getRequiredRestMinutes(precedingDutyMinutes) {
    return Math.max(precedingDutyMinutes || 0, 12 * 60);
  }

  function countLocalNightsInInterval(startLocal, endLocal) {
    if (endLocal <= startLocal) return 0;
    let nights = 0;
    const cur = new Date(startLocal);
    cur.setHours(0, 0, 0, 0);

    const endDay = new Date(endLocal);
    endDay.setDate(endDay.getDate() + 1);

    while (cur <= endDay) {
      const nightStart = new Date(cur);
      nightStart.setHours(22, 0, 0, 0);
      const nightEnd = new Date(nightStart.getTime() + 10 * 3600 * 1000);

      const overlapStart = Math.max(startLocal.getTime(), nightStart.getTime());
      const overlapEnd = Math.min(endLocal.getTime(), nightEnd.getTime());

      if (overlapEnd > overlapStart) {
        const overlapDurationHours = (overlapEnd - overlapStart) / (1000 * 3600);
        if (overlapDurationHours >= 8.0) {
          nights++;
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
    return nights;
  }

  function evaluateDayOff(startUtc, endUtc) {
    const totalHours = (endUtc.getTime() - startUtc.getTime()) / (1000 * 3600);
    const startLocal = new Date(startUtc.getTime() + BASE_UTC_OFFSET_HOURS * 3600 * 1000);
    const endLocal = new Date(endUtc.getTime() + BASE_UTC_OFFSET_HOURS * 3600 * 1000);

    const nights = countLocalNightsInInterval(startLocal, endLocal);

    if (totalHours < 34.0 || nights < 2) {
      return { isValid: false, consecutiveDays: 0 };
    }

    let daysCount = 1;
    while (totalHours >= (34.0 + daysCount * 24.0) && nights >= (daysCount + 2)) {
      daysCount++;
    }

    return { isValid: true, consecutiveDays: daysCount };
  }

  return {
    BASE_AIRPORT,
    BASE_UTC_OFFSET_HOURS,
    LIMITS,
    WARNING_THRESHOLDS,
    formatMinutesToHM,
    formatMinutesToClock,
    parseDurationMinutes,
    getReportingOffsetMinutes,
    getCheckoutOffsetMinutes,
    calculateFactoredSectors,
    getMaxFdpMinutes,
    getRequiredRestMinutes,
    evaluateDayOff
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FTLRules;
}
