/**
 * Client-Side eCrew Logbook Parser & Duty Grouping Engine
 * Supports Intelligent Merging, Deduplication & Updates
 */

const eCrewParser = (() => {

  function parseDate(dStr) {
    if (!dStr) return null;
    const parts = dStr.trim().split('/');
    if (parts.length === 3) {
      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10) - 1;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      return { year, month, day };
    }
    return null;
  }

  function parseTime(tStr) {
    if (!tStr) return { h: 0, m: 0 };
    const parts = tStr.trim().split(':');
    return {
      h: parseInt(parts[0] || '0', 10),
      m: parseInt(parts[1] || '0', 10)
    };
  }

  function parseCsvContent(csvText) {
    const lines = csvText.split(/\r\n|\n/);
    const sectors = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (row.length < 5) continue;

      const firstCol = row[0];
      if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(firstCol)) continue;

      const dateObj = parseDate(firstCol);
      if (!dateObj) continue;

      const depApt = (row[1] || '').toUpperCase();
      const depTimeStr = row[2] || '';
      const arrApt = (row[3] || '').toUpperCase();
      const arrTimeStr = row[4] || '';

      if (!depTimeStr || !arrTimeStr) continue;

      const depT = parseTime(depTimeStr);
      const arrT = parseTime(arrTimeStr);

      const depDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, depT.h, depT.m));
      let arrDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, arrT.h, arrT.m));

      if (arrDt < depDt) {
        arrDt = new Date(arrDt.getTime() + 24 * 3600 * 1000);
      }

      const acType = row[5] || '';
      const reg = row[6] || '';
      const fltTimeStr = row[7] || '';
      const picName = row[8] || '';

      const synthTimeStr = row[16] || '';
      const synthTypeStr = row[17] || '';

      let isSim = false;
      let simType = '';
      let flightMinutes = 0;

      if (synthTypeStr || synthTimeStr) {
        isSim = true;
        simType = synthTypeStr;
        flightMinutes = FTLRules.parseDurationMinutes(synthTimeStr);
      } else {
        flightMinutes = FTLRules.parseDurationMinutes(fltTimeStr);
      }

      if (flightMinutes === 0) {
        flightMinutes = Math.round((arrDt.getTime() - depDt.getTime()) / (60 * 1000));
      }

      sectors.push({
        dateStr: firstCol,
        depAirport: depApt,
        arrAirport: arrApt,
        depTimeUtc: depDt,
        arrTimeUtc: arrDt,
        flightTimeMinutes: flightMinutes,
        acType: acType,
        reg: reg,
        picName: picName,
        isSimulator: isSim,
        simType: simType
      });
    }

    return sectors;
  }

  /**
   * Smart Merge: Combines newly parsed sectors with existing sectors.
   * Updates overlapping flights with the newest data and adds new flights without duplicating.
   */
  function mergeSectors(existingDuties, newSectors) {
    // Extract existing sectors from all duties
    const sectorMap = new Map();
    let updatedCount = 0;
    let addedCount = 0;

    // 1. Index existing sectors
    existingDuties.forEach(d => {
      d.sectors.forEach(s => {
        const key = `${s.depAirport}_${s.arrAirport}_${s.depTimeUtc.getTime()}`;
        sectorMap.set(key, s);
      });
    });

    // 2. Merge new sectors
    newSectors.forEach(s => {
      const key = `${s.depAirport}_${s.arrAirport}_${s.depTimeUtc.getTime()}`;
      if (sectorMap.has(key)) {
        // Update existing record with newest info
        sectorMap.set(key, s);
        updatedCount++;
      } else {
        // Add new flight record
        sectorMap.set(key, s);
        addedCount++;
      }
    });

    const combinedSectors = Array.from(sectorMap.values());
    const recalculatedDuties = groupSectorsIntoDuties(combinedSectors);

    return {
      duties: recalculatedDuties,
      stats: {
        totalSectors: combinedSectors.length,
        updatedCount,
        addedCount,
        totalDuties: recalculatedDuties.length
      }
    };
  }

  function groupSectorsIntoDuties(sectors) {
    if (!sectors || sectors.length === 0) return [];

    const sorted = [...sectors].sort((a, b) => a.depTimeUtc.getTime() - b.depTimeUtc.getTime());

    const duties = [];
    let currentSectors = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const nextSec = sorted[i];
      const prevSec = currentSectors[currentSectors.length - 1];

      const gapHours = (nextSec.depTimeUtc.getTime() - prevSec.arrTimeUtc.getTime()) / (1000 * 3600);
      const sameType = prevSec.isSimulator === nextSec.isSimulator;

      if (gapHours < 8.0 && sameType) {
        currentSectors.push(nextSec);
      } else {
        duties.push(buildDutyPeriod(duties.length + 1, currentSectors));
        currentSectors = [nextSec];
      }
    }

    if (currentSectors.length > 0) {
      duties.push(buildDutyPeriod(duties.length + 1, currentSectors));
    }

    return recalculateDutiesAnalysis(duties);
  }

  function buildDutyPeriod(dutyId, sectors) {
    const first = sectors[0];
    const last = sectors[sectors.length - 1];
    const isSim = first.isSimulator;

    const repOffset = FTLRules.getReportingOffsetMinutes(first.depAirport, isSim);
    const chkOffset = FTLRules.getCheckoutOffsetMinutes(isSim);

    const reportUtc = new Date(first.depTimeUtc.getTime() - repOffset * 60 * 1000);
    const checkoutUtc = new Date(last.arrTimeUtc.getTime() + chkOffset * 60 * 1000);

    const fdpMin = Math.round((last.arrTimeUtc.getTime() - reportUtc.getTime()) / (60 * 1000));
    const dutyMin = Math.round((checkoutUtc.getTime() - reportUtc.getTime()) / (60 * 1000));
    const fltMin = sectors.reduce((acc, s) => acc + (s.flightTimeMinutes || 0), 0);

    const factored = FTLRules.calculateFactoredSectors(sectors, true);

    let summaryRoute = "N/A";
    if (isSim) {
      const types = Array.from(new Set(sectors.map(s => s.simType).filter(Boolean))).join(', ');
      summaryRoute = `SIMULATOR (${types || 'SIM'})`;
    } else {
      const apts = [first.depAirport];
      sectors.forEach(s => apts.push(s.arrAirport));
      summaryRoute = apts.join('-');
    }

    return {
      dutyId: dutyId,
      sectors: sectors,
      isSimulator: isSim,
      reportTimeUtc: reportUtc,
      firstDepUtc: first.depTimeUtc,
      lastArrUtc: last.arrTimeUtc,
      checkoutTimeUtc: checkoutUtc,
      fdpDurationMinutes: fdpMin,
      dutyDurationMinutes: dutyMin,
      flightTimeMinutes: fltMin,
      sectorCount: sectors.length,
      factoredSectors: factored,
      summaryRoute: summaryRoute,
      violations: [],
      warnings: [],
      status: 'OK'
    };
  }

  function recalculateDutiesAnalysis(duties) {
    const sorted = [...duties].sort((a, b) => a.reportTimeUtc.getTime() - b.reportTimeUtc.getTime());
    let consecutiveDutyCounter = 0;

    for (let i = 0; i < sorted.length; i++) {
      const dp = sorted[i];
      dp.dutyId = i + 1;
      dp.violations = [];
      dp.warnings = [];

      if (i === 0) {
        dp.precedingRestMinutes = null;
        dp.requiredRestMinutes = null;
        dp.restMarginMinutes = null;
        consecutiveDutyCounter = 1;
        dp.consecutiveDutyDays = 1;
      } else {
        const prev = sorted[i - 1];
        const restMin = Math.round((dp.reportTimeUtc.getTime() - prev.checkoutTimeUtc.getTime()) / (60 * 1000));
        const reqMin = FTLRules.getRequiredRestMinutes(prev.dutyDurationMinutes);
        const marginMin = restMin - reqMin;

        dp.precedingRestMinutes = restMin;
        dp.requiredRestMinutes = reqMin;
        dp.restMarginMinutes = marginMin;

        const dayOff = FTLRules.evaluateDayOff(prev.checkoutTimeUtc, dp.reportTimeUtc);
        if (dayOff.isValid) {
          consecutiveDutyCounter = 1;
        } else {
          consecutiveDutyCounter++;
        }
        dp.consecutiveDutyDays = consecutiveDutyCounter;

        if (restMin < reqMin) {
          dp.violations.push({
            category: 'REST_PERIOD',
            title: 'Insufficient Preceding Rest',
            detail: `Rest of ${FTLRules.formatMinutesToHM(restMin)} is below minimum required ${FTLRules.formatMinutesToHM(reqMin)}.`,
            ref: 'OM-A 7.1.6.4',
            margin: FTLRules.formatMinutesToHM(marginMin)
          });
        } else if (marginMin <= FTLRules.WARNING_THRESHOLDS.REST_MARGIN_MIN) {
          dp.warnings.push({
            category: 'REST_PERIOD',
            title: 'Tight Rest Margin',
            detail: `Rest margin of ${FTLRules.formatMinutesToHM(marginMin)} is close to the minimum legal limit.`,
            ref: 'OM-A 7.1.6.4',
            margin: FTLRules.formatMinutesToHM(marginMin)
          });
        }

        if (dp.consecutiveDutyDays > FTLRules.LIMITS.MAX_CONSECUTIVE_DAYS) {
          dp.violations.push({
            category: 'CONSECUTIVE_DUTY',
            title: 'Exceeded Consecutive Duty Days',
            detail: `Working on consecutive duty day ${dp.consecutiveDutyDays} without a required statutory day off (max 7 days).`,
            ref: 'OM-A 7.1.5(1)',
            margin: `+${dp.consecutiveDutyDays - 7}d`
          });
        } else if (dp.consecutiveDutyDays === FTLRules.LIMITS.MAX_CONSECUTIVE_DAYS) {
          dp.warnings.push({
            category: 'CONSECUTIVE_DUTY',
            title: 'Maximum Consecutive Duty Days Reached',
            detail: `Reached maximum limit of 7 consecutive duty days. Days off required after this duty.`,
            ref: 'OM-A 7.1.5(1)',
            margin: '0d'
          });
        }
      }

      if (dp.isSimulator) {
        dp.maxFdpMinutes = dp.dutyDurationMinutes;
        dp.fdpMarginMinutes = 0;
      } else {
        const reportLocal = new Date(dp.reportTimeUtc.getTime() + FTLRules.BASE_UTC_OFFSET_HOURS * 3600 * 1000);
        const maxFdp = FTLRules.getMaxFdpMinutes(reportLocal, dp.factoredSectors, true);
        dp.maxFdpMinutes = maxFdp;
        dp.fdpMarginMinutes = maxFdp - dp.fdpDurationMinutes;

        if (dp.fdpDurationMinutes > maxFdp) {
          dp.violations.push({
            category: 'FDP_LIMIT',
            title: 'Maximum Daily FDP Exceeded',
            detail: `Actual FDP of ${FTLRules.formatMinutesToHM(dp.fdpDurationMinutes)} exceeded Table A limit of ${FTLRules.formatMinutesToHM(maxFdp)}.`,
            ref: 'OM-A 7.1.6.9 (Table A)',
            margin: FTLRules.formatMinutesToHM(dp.fdpMarginMinutes)
          });
        } else if (dp.fdpMarginMinutes <= FTLRules.WARNING_THRESHOLDS.FDP_MARGIN_MIN || dp.fdpDurationMinutes >= FTLRules.WARNING_THRESHOLDS.FDP_RATIO * maxFdp) {
          dp.warnings.push({
            category: 'FDP_LIMIT',
            title: 'Tight FDP Margin',
            detail: `Used ${Math.round(dp.fdpDurationMinutes / maxFdp * 100)}% of allowable FDP. Remaining margin: ${FTLRules.formatMinutesToHM(dp.fdpMarginMinutes)}.`,
            ref: 'OM-A 7.1.6.9 (Table A)',
            margin: FTLRules.formatMinutesToHM(dp.fdpMarginMinutes)
          });
        }
      }

      const endTime = dp.checkoutTimeUtc.getTime();
      const window28dStart = endTime - 28 * 24 * 3600 * 1000;
      let flt28d = 0;
      for (const p of sorted) {
        const pArr = p.lastArrUtc.getTime();
        if (pArr <= endTime && pArr >= window28dStart) {
          flt28d += (p.flightTimeMinutes || 0);
        }
      }
      dp.flightTime28dMinutes = flt28d;
      if (flt28d > FTLRules.LIMITS.MAX_FLIGHT_28D) {
        dp.violations.push({
          category: 'FLIGHT_28D',
          title: 'Exceeded 28-Day Flight Time Limit',
          detail: `Accumulated ${FTLRules.formatMinutesToHM(flt28d)} in 28 days (limit 100h).`,
          ref: 'OM-A 7.1.4(1)',
          margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_FLIGHT_28D - flt28d)
        });
      } else if (flt28d >= FTLRules.WARNING_THRESHOLDS.FLIGHT_28D_MIN) {
        dp.warnings.push({
          category: 'FLIGHT_28D',
          title: 'High 28-Day Flight Time',
          detail: `Accumulated ${FTLRules.formatMinutesToHM(flt28d)} in 28 days (>=90h of 100h max limit).`,
          ref: 'OM-A 7.1.4(1)',
          margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_FLIGHT_28D - flt28d)
        });
      }

      const window7dStart = endTime - 7 * 24 * 3600 * 1000;
      let duty7d = 0;
      for (const p of sorted) {
        const pChk = p.checkoutTimeUtc.getTime();
        if (pChk <= endTime && pChk >= window7dStart) {
          duty7d += (p.dutyDurationMinutes || 0);
        }
      }
      dp.dutyTime7dMinutes = duty7d;
      if (duty7d > FTLRules.LIMITS.MAX_DUTY_7D) {
        dp.violations.push({
          category: 'DUTY_7D',
          title: 'Exceeded 7-Day Duty Time Limit',
          detail: `Accumulated ${FTLRules.formatMinutesToHM(duty7d)} duty in 7 days (limit 55h).`,
          ref: 'OM-A 7.1.4(3)',
          margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_DUTY_7D - duty7d)
        });
      } else if (duty7d >= FTLRules.WARNING_THRESHOLDS.DUTY_7D_MIN) {
        dp.warnings.push({
          category: 'DUTY_7D',
          title: 'High 7-Day Duty Time',
          detail: `Accumulated ${FTLRules.formatMinutesToHM(duty7d)} duty in 7 days (>=50h of 55h max).`,
          ref: 'OM-A 7.1.4(3)',
          margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_DUTY_7D - duty7d)
        });
      }

      const window14dStart = endTime - 14 * 24 * 3600 * 1000;
      let duty14d = 0;
      for (const p of sorted) {
        const pChk = p.checkoutTimeUtc.getTime();
        if (pChk <= endTime && pChk >= window14dStart) {
          duty14d += (p.dutyDurationMinutes || 0);
        }
      }
      dp.dutyTime14dMinutes = duty14d;
      if (duty14d > FTLRules.LIMITS.MAX_DUTY_14D) {
        dp.violations.push({
          category: 'DUTY_14D',
          title: 'Exceeded 14-Day Duty Time Limit',
          detail: `Accumulated ${FTLRules.formatMinutesToHM(duty14d)} duty in 14 days (limit 95h).`,
          ref: 'OM-A 7.1.4(4)',
          margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_DUTY_14D - duty14d)
        });
      }

      let duty28d = 0;
      for (const p of sorted) {
        const pChk = p.checkoutTimeUtc.getTime();
        if (pChk <= endTime && pChk >= window28dStart) {
          duty28d += (p.dutyDurationMinutes || 0);
        }
      }
      dp.dutyTime28dMinutes = duty28d;
      if (duty28d > FTLRules.LIMITS.MAX_DUTY_28D) {
        dp.violations.push({
          category: 'DUTY_28D',
          title: 'Exceeded 28-Day Duty Time Limit',
          detail: `Accumulated ${FTLRules.formatMinutesToHM(duty28d)} duty in 28 days (limit 190h).`,
          ref: 'OM-A 7.1.4(5)',
          margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_DUTY_28D - duty28d)
        });
      }

      if (dp.violations.length > 0) dp.status = 'VIOLATION';
      else if (dp.warnings.length > 0) dp.status = 'WARNING';
      else dp.status = 'OK';
    }

    return sorted;
  }

  return {
    parseCsvContent,
    mergeSectors,
    groupSectorsIntoDuties,
    recalculateDutiesAnalysis
  };
})();
