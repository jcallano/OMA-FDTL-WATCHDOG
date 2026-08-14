/**
 * Client-Side eCrew Logbook & Schedule Report Parser
 * Supports:
 * 1. eCrew Flight Logbook CSV (Historical Flight Logs)
 * 2. eCrew Personal Crew Schedule Report (Roster CSV with OFF, SBY, COFF, Multi-line Sectors, ?1 next day)
 * 3. Intelligent Merging & Day-Off Tracking (OM-A 7.1.5)
 * Regulations valid as of August 2026
 */

const eCrewParser = (() => {

  function parseDate(dStr) {
    if (!dStr) return null;
    const clean = dStr.trim().split(' ')[0]; // removes day name like "Sat", "Sun"
    const parts = clean.split('/');
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
    if (!tStr) return { h: 0, m: 0, nextDay: 0 };
    let clean = tStr.trim().replace(/^A/i, ''); // Strip actual 'A' prefix
    let nextDay = 0;
    if (clean.includes('?1') || clean.includes('+1')) {
      nextDay = 1;
      clean = clean.replace('?1', '').replace('+1', '');
    }
    // Remove delay suffix e.g. "/00:34"
    if (clean.includes('/')) {
      clean = clean.split('/')[0].trim();
    }
    const parts = clean.split(':');
    return {
      h: parseInt(parts[0] || '0', 10),
      m: parseInt(parts[1] || '0', 10),
      nextDay: nextDay
    };
  }

  /**
   * Detects which type of eCrew file was uploaded and parses accordingly.
   */
  function parseCsvContent(csvText) {
    if (csvText.includes('Personal Crew Schedule Report') || csvText.includes('Schedule Details') || csvText.includes('Day Off') || csvText.includes('Debrief times')) {
      return parseRosterSchedule(csvText);
    } else {
      return parseFlightLogbook(csvText);
    }
  }

  /**
   * Format 1: Historical Logbook
   */
  function parseFlightLogbook(csvText) {
    const lines = csvText.split(/\r\n|\n/);
    const sectors = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (row.length < 5) continue;

      const firstCol = row[0];
      if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(firstCol)) continue;

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
      let arrDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + arrT.nextDay, arrT.h, arrT.m));

      if (arrDt < depDt && arrT.nextDay === 0) {
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
        dateStr: firstCol.split(' ')[0],
        depAirport: depApt,
        arrAirport: arrApt,
        depTimeUtc: depDt,
        arrTimeUtc: arrDt,
        flightTimeMinutes: flightMinutes,
        acType: acType,
        reg: reg,
        picName: picName,
        isSimulator: isSim,
        simType: simType,
        isDayOff: false,
        isStandby: false
      });
    }

    return sectors;
  }

  /**
   * Format 2: eCrew Personal Crew Schedule Report (Roster CSV)
   * Handles multi-line cells, OFF, COFF, SBY, and flight rotations with ?1 next day
   */
  function parseRosterSchedule(csvText) {
    const rawRows = parseCsvWithQuotes(csvText);
    const sectors = [];
    let startParsing = false;

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const col0 = (row[0] || '').trim();
      if (col0.toLowerCase() === 'date' && (row[1] || '').toLowerCase().includes('duties')) {
        startParsing = true;
        continue;
      }
      if (col0.includes('Total Hours') || col0.includes('Hotel Information') || col0.includes('Descriptions')) {
        startParsing = false;
        break;
      }
      if (!startParsing) continue;

      const dateObj = parseDate(col0);
      if (!dateObj) continue;

      const dutyCode = (row[1] || '').trim().toUpperCase();
      const details = (row[2] || '').trim();
      const reportTimeStr = (row[3] || '').trim();
      const timesStr = (row[4] || '').trim();
      const debriefTimeStr = (row[5] || '').trim();
      const crewStr = (row[7] || '').trim();

      // Case A: Day Off (OFF or COFF)
      if (dutyCode === 'OFF' || dutyCode === 'COFF' || details.toLowerCase().includes('day off')) {
        const offDate = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, 0, 0));
        sectors.push({
          dateStr: col0.split(' ')[0],
          depAirport: 'MCT',
          arrAirport: 'MCT',
          depTimeUtc: offDate,
          arrTimeUtc: new Date(offDate.getTime() + 24 * 3600 * 1000),
          flightTimeMinutes: 0,
          acType: '',
          reg: '',
          picName: dutyCode === 'COFF' ? 'Compensated Day Off' : 'Day Off',
          isSimulator: false,
          isDayOff: true,
          isStandby: false,
          dutyCode: dutyCode
        });
        continue;
      }

      // Case B: Home Standby (SBY)
      if (dutyCode === 'SBY' || details.toLowerCase().includes('standby')) {
        let sbyStart = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, 0, 0));
        let sbyEnd = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, 8, 0));

        if (timesStr && timesStr.includes('-')) {
          const parts = timesStr.split('-');
          const st = parseTime(parts[0]);
          const et = parseTime(parts[1]);
          sbyStart = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, st.h, st.m));
          sbyEnd = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + et.nextDay, et.h, et.m));
        }

        sectors.push({
          dateStr: col0.split(' ')[0],
          depAirport: 'MCT',
          arrAirport: 'MCT',
          depTimeUtc: sbyStart,
          arrTimeUtc: sbyEnd,
          flightTimeMinutes: 0,
          acType: 'SBY',
          reg: '',
          picName: 'Home Standby',
          isSimulator: false,
          isDayOff: false,
          isStandby: true,
          dutyCode: 'SBY'
        });
        continue;
      }

      // Case C: Commercial Flight or Simulator Duties (may have multi-lines in cell)
      const detailLines = details.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
      const timeLines = timesStr.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);
      const fltNumberLines = dutyCode.split(/\r\n|\n/).map(l => l.trim()).filter(Boolean);

      const numSectors = Math.max(detailLines.length, timeLines.length, 1);

      for (let sIdx = 0; sIdx < numSectors; sIdx++) {
        const dLine = detailLines[sIdx] || detailLines[0] || 'MCT - MCT';
        const tLine = timeLines[sIdx] || timeLines[0] || '08:00 - 10:00';
        const fltNum = fltNumberLines[sIdx] || fltNumberLines[0] || 'WY';

        let depApt = 'MCT';
        let arrApt = 'MCT';
        if (dLine.includes('-')) {
          const apts = dLine.split('-').map(a => a.trim().toUpperCase());
          depApt = apts[0] || 'MCT';
          arrApt = apts[1] || 'MCT';
        }

        let depT = { h: 8, m: 0, nextDay: 0 };
        let arrT = { h: 10, m: 0, nextDay: 0 };

        if (tLine.includes('-')) {
          const tParts = tLine.split('-');
          depT = parseTime(tParts[0]);
          arrT = parseTime(tParts[1]);
        }

        const depDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + depT.nextDay, depT.h, depT.m));
        let arrDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + arrT.nextDay, arrT.h, arrT.m));

        if (arrDt < depDt) {
          arrDt = new Date(arrDt.getTime() + 24 * 3600 * 1000);
        }

        const fltMin = Math.max(1, Math.round((arrDt.getTime() - depDt.getTime()) / (60 * 1000)));

        sectors.push({
          dateStr: col0.split(' ')[0],
          depAirport: depApt,
          arrAirport: arrApt,
          depTimeUtc: depDt,
          arrTimeUtc: arrDt,
          flightTimeMinutes: fltMin,
          acType: '737',
          reg: '',
          picName: fltNum ? `WY ${fltNum}` : 'Scheduled Flight',
          isSimulator: false,
          isDayOff: false,
          isStandby: false,
          dutyCode: fltNum
        });
      }
    }

    return sectors;
  }

  /**
   * Helper: Standard CSV parser that respects multiline quoted fields
   */
  function parseCsvWithQuotes(text) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
    }

    return rows;
  }

  /**
   * Smart Merge: Combines newly parsed sectors/days off with existing sectors.
   */
  function mergeSectors(existingDuties, newSectors) {
    const sectorMap = new Map();
    let updatedCount = 0;
    let addedCount = 0;

    existingDuties.forEach(d => {
      d.sectors.forEach(s => {
        const key = `${s.depAirport}_${s.arrAirport}_${s.depTimeUtc.getTime()}_${s.isDayOff ? 'OFF' : 'FLT'}`;
        sectorMap.set(key, s);
      });
    });

    newSectors.forEach(s => {
      const key = `${s.depAirport}_${s.arrAirport}_${s.depTimeUtc.getTime()}_${s.isDayOff ? 'OFF' : 'FLT'}`;
      if (sectorMap.has(key)) {
        sectorMap.set(key, s);
        updatedCount++;
      } else {
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

      // If either sector is a Day Off or Standby, separate it into its own duty block
      if (prevSec.isDayOff || nextSec.isDayOff || prevSec.isStandby || nextSec.isStandby) {
        duties.push(buildDutyPeriod(duties.length + 1, currentSectors));
        currentSectors = [nextSec];
        continue;
      }

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
    const isDayOff = first.isDayOff || false;
    const isStandby = first.isStandby || false;
    const isSim = first.isSimulator || false;

    if (isDayOff) {
      return {
        dutyId: dutyId,
        sectors: sectors,
        isSimulator: false,
        isDayOff: true,
        isStandby: false,
        reportTimeUtc: first.depTimeUtc,
        firstDepUtc: first.depTimeUtc,
        lastArrUtc: last.arrTimeUtc,
        checkoutTimeUtc: last.arrTimeUtc,
        fdpDurationMinutes: 0,
        dutyDurationMinutes: 0,
        flightTimeMinutes: 0,
        sectorCount: 0,
        factoredSectors: 0,
        summaryRoute: first.picName || 'DAY OFF',
        violations: [],
        warnings: [],
        status: 'OFF'
      };
    }

    if (isStandby) {
      const rawMin = Math.round((last.arrTimeUtc.getTime() - first.depTimeUtc.getTime()) / (60 * 1000));
      const creditedDutyMin = FTLRules.getStandbyDutyCreditMinutes(rawMin, false);
      return {
        dutyId: dutyId,
        sectors: sectors,
        isSimulator: false,
        isDayOff: false,
        isStandby: true,
        reportTimeUtc: first.depTimeUtc,
        firstDepUtc: first.depTimeUtc,
        lastArrUtc: last.arrTimeUtc,
        checkoutTimeUtc: last.arrTimeUtc,
        fdpDurationMinutes: 0,
        dutyDurationMinutes: creditedDutyMin, // 25% credited for OM-A 7.1.4 (OM-A 7.1.7.8.c)
        rawStandbyMinutes: rawMin,
        flightTimeMinutes: 0,
        sectorCount: 0,
        factoredSectors: 0,
        summaryRoute: `HOME STANDBY (${FTLRules.formatMinutesToHM(rawMin)} • 25% Credit: ${FTLRules.formatMinutesToHM(creditedDutyMin)})`,
        violations: [],
        warnings: [],
        status: 'OK'
      };
    }

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
      isDayOff: false,
      isStandby: false,
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

      // Day Off Duty handling
      if (dp.isDayOff) {
        consecutiveDutyCounter = 0;
        dp.consecutiveDutyDays = 0;
        dp.precedingRestMinutes = null;
        dp.requiredRestMinutes = null;
        dp.maxFdpMinutes = 0;
        dp.fdpMarginMinutes = 0;
        dp.flightTime28dMinutes = 0;
        dp.dutyTime7dMinutes = 0;
        dp.dutyTime14dMinutes = 0;
        dp.dutyTime28dMinutes = 0;
        dp.status = 'OFF';
        continue;
      }

      if (i === 0) {
        dp.precedingRestMinutes = null;
        dp.requiredRestMinutes = null;
        dp.restMarginMinutes = null;
        consecutiveDutyCounter = 1;
        dp.consecutiveDutyDays = 1;
      } else {
        const prev = sorted[i - 1];

        // If preceding was an explicit Day Off
        if (prev.isDayOff) {
          consecutiveDutyCounter = 1;
          dp.precedingRestMinutes = 24 * 60;
          dp.requiredRestMinutes = 12 * 60;
          dp.restMarginMinutes = 12 * 60;
        } else {
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
        }

        dp.consecutiveDutyDays = consecutiveDutyCounter;

        if (dp.consecutiveDutyDays > FTLRules.LIMITS.MAX_CONSECUTIVE_DAYS) {
          dp.violations.push({
            category: 'CONSECUTIVE_DUTY',
            title: 'Exceeded Consecutive Duty Days',
            detail: `Working on consecutive duty day ${dp.consecutiveDutyDays} without a statutory day off (OM-A max 7 days).`,
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

      if (dp.isSimulator || dp.isStandby) {
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
        if (p.isDayOff) continue;
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
        if (p.isDayOff) continue;
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
        if (p.isDayOff) continue;
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
        if (p.isDayOff) continue;
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
    parseRosterSchedule,
    parseFlightLogbook,
    mergeSectors,
    groupSectorsIntoDuties,
    recalculateDutiesAnalysis
  };
})();
