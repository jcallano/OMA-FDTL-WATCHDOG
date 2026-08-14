/**
 * Client-Side eCrew Logbook & Schedule Report Parser
 * Supports:
 * 1. eCrew Flight Logbook CSV (Historical Flight Logs in UTC)
 * 2. eCrew Personal Crew Schedule Report (Roster CSV with Local Station time conversion, OFF, SBY, COFF)
 * 3. Intelligent Deduplication & Robust Date Merging (OM-A 7.1.5, OM-A 7.1.7)
 * Regulations valid as of August 2026
 */

const eCrewParser = (() => {

  const AIRPORT_TIMEZONES = {
    'MCT': 4.0, 'SLL': 4.0, 'DXB': 4.0, 'SHJ': 4.0, 'AUH': 4.0,
    'DOH': 3.0, 'BAH': 3.0, 'KWI': 3.0, 'RUH': 3.0, 'JED': 3.0, 'MED': 3.0, 'DMM': 3.0, 'TIF': 3.0,
    'TZX': 3.0, 'IST': 3.0, 'CAI': 3.0, 'AMM': 3.0, 'ZNZ': 3.0, 'DAR': 3.0, 'SVO': 3.0,
    'ZRH': 2.0, 'MUC': 2.0, 'FRA': 2.0, 'MXP': 2.0, 'CDG': 2.0, 'FCO': 2.0, 'LHR': 1.0,
    'DEL': 5.5, 'BOM': 5.5, 'BLR': 5.5, 'MAA': 5.5, 'COK': 5.5, 'CCJ': 5.5, 'HYD': 5.5, 'LKO': 5.5, 'GOI': 5.5,
    'KHI': 5.0, 'LHE': 5.0, 'ISB': 5.0, 'TAS': 5.0,
    'DAC': 6.0, 'BKK': 7.0, 'HKT': 7.0, 'KUL': 8.0, 'MNL': 8.0, 'CGK': 7.0, 'CMB': 5.5
  };

  function getAirportOffsetHours(apt) {
    return AIRPORT_TIMEZONES[apt] || 4.0;
  }

  function parseDate(dStr) {
    if (!dStr) return null;
    const clean = dStr.trim().split(' ')[0];
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
    let clean = tStr.trim().replace(/^A/i, '');
    let nextDay = 0;
    if (clean.includes('?1') || clean.includes('+1') || clean.includes('?')) {
      nextDay = 1;
      clean = clean.replace('?1', '').replace('+1', '').replace('?', '');
    }
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

  function localTimeToUtc(year, month, day, h, m, dayOffset, aptCode) {
    const offsetHours = getAirportOffsetHours(aptCode);
    const localMs = Date.UTC(year, month, day + dayOffset, h, m);
    return new Date(localMs - offsetHours * 3600 * 1000);
  }

  function parseCsvContent(csvText) {
    if (csvText.includes('Personal Crew Schedule Report') || csvText.includes('Schedule Details') || csvText.includes('Day Off') || csvText.includes('Debrief times') || csvText.includes('Standby')) {
      return parseRosterSchedule(csvText);
    } else {
      return parseFlightLogbook(csvText);
    }
  }

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
        flightMinutes = (typeof FTLRules !== 'undefined') ? FTLRules.parseDurationMinutes(synthTimeStr) : 0;
      } else {
        flightMinutes = (typeof FTLRules !== 'undefined') ? FTLRules.parseDurationMinutes(fltTimeStr) : 0;
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
        isStandby: false,
        dutyCode: ''
      });
    }

    return sectors;
  }

  function parseRosterSchedule(csvText) {
    const isLocalStation = csvText.includes('Local Station');
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
      const timesStr = (row[4] || '').trim();

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
        let sbyStart = isLocalStation ? localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, 0, 0, 0, 'MCT') : new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, 0, 0));
        let sbyEnd = isLocalStation ? localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, 8, 0, 0, 'MCT') : new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, 8, 0));

        if (timesStr && timesStr.includes('-')) {
          const parts = timesStr.split('-');
          const st = parseTime(parts[0]);
          const et = parseTime(parts[1]);
          
          let endDayOffset = et.nextDay;
          if (endDayOffset === 0 && (et.h < st.h || (et.h === st.h && et.m < st.m))) {
            endDayOffset = 1;
          }

          sbyStart = isLocalStation ? localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, st.h, st.m, 0, 'MCT') : new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day, st.h, st.m));
          sbyEnd = isLocalStation ? localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, et.h, et.m, endDayOffset, 'MCT') : new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + endDayOffset, et.h, et.m));
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

      // Case C: Commercial Flight Sectors
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

        let depDt, arrDt;
        if (isLocalStation) {
          depDt = localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, depT.h, depT.m, depT.nextDay, depApt);
          let arrDayOffset = arrT.nextDay;
          arrDt = localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, arrT.h, arrT.m, arrDayOffset, arrApt);
          if (arrDt <= depDt) {
            arrDt = localTimeToUtc(dateObj.year, dateObj.month, dateObj.day, arrT.h, arrT.m, arrDayOffset + 1, arrApt);
          }
        } else {
          depDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + depT.nextDay, depT.h, depT.m));
          let arrDayOffset = arrT.nextDay;
          if (arrDayOffset === 0 && (arrT.h < depT.h || (arrT.h === depT.h && arrT.m < depT.m))) {
            arrDayOffset = depT.nextDay + 1;
          } else {
            arrDayOffset = Math.max(arrDayOffset, depT.nextDay);
          }
          arrDt = new Date(Date.UTC(dateObj.year, dateObj.month, dateObj.day + arrDayOffset, arrT.h, arrT.m));
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
          i++;
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

  function getSectorKey(s) {
    const dUtc = (s.depTimeUtc instanceof Date) ? s.depTimeUtc : new Date(s.depTimeUtc);
    const dateKey = dUtc.toISOString().slice(0, 10);
    if (s.isDayOff) {
      return `${dateKey}_DAYOFF`;
    }
    if (s.isStandby) {
      return `${dateKey}_STANDBY`;
    }
    const cleanDuty = (s.dutyCode || '').replace(/\s+/g, '');
    return `${dateKey}_${s.depAirport}_${s.arrAirport}_${cleanDuty || 'FLT'}`;
  }

  /**
   * Smart Merge: Combines newly parsed sectors with existing sectors without duplicate flights.
   */
  function mergeSectors(existingDuties, newSectors) {
    const sectorMap = new Map();
    let updatedCount = 0;
    let addedCount = 0;

    // 1. Hydrate existing sectors
    (existingDuties || []).forEach(d => {
      (d.sectors || []).forEach(s => {
        const hydrated = {
          ...s,
          depTimeUtc: (s.depTimeUtc instanceof Date) ? s.depTimeUtc : new Date(s.depTimeUtc),
          arrTimeUtc: (s.arrTimeUtc instanceof Date) ? s.arrTimeUtc : new Date(s.arrTimeUtc)
        };
        sectorMap.set(getSectorKey(hydrated), hydrated);
      });
    });

    // 2. Upsert new sectors
    (newSectors || []).forEach(s => {
      const hydrated = {
        ...s,
        depTimeUtc: (s.depTimeUtc instanceof Date) ? s.depTimeUtc : new Date(s.depTimeUtc),
        arrTimeUtc: (s.arrTimeUtc instanceof Date) ? s.arrTimeUtc : new Date(s.arrTimeUtc)
      };
      const key = getSectorKey(hydrated);
      if (sectorMap.has(key)) {
        sectorMap.set(key, hydrated);
        updatedCount++;
      } else {
        sectorMap.set(key, hydrated);
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

    // Ensure all sectors have valid Date objects
    const cleaned = sectors.map(s => ({
      ...s,
      depTimeUtc: (s.depTimeUtc instanceof Date) ? s.depTimeUtc : new Date(s.depTimeUtc),
      arrTimeUtc: (s.arrTimeUtc instanceof Date) ? s.arrTimeUtc : new Date(s.arrTimeUtc)
    }));

    const sorted = cleaned.sort((a, b) => a.depTimeUtc.getTime() - b.depTimeUtc.getTime());
    const duties = [];
    let currentSectors = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
      const nextSec = sorted[i];
      const prevSec = currentSectors[currentSectors.length - 1];

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
      const rawMin = Math.max(0, Math.round((last.arrTimeUtc.getTime() - first.depTimeUtc.getTime()) / (60 * 1000)));
      const creditedDutyMin = (typeof FTLRules !== 'undefined') ? FTLRules.getStandbyDutyCreditMinutes(rawMin, false) : Math.round(rawMin * 0.25);
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
        summaryRoute: `HOME STANDBY (${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(rawMin) : rawMin + 'm'} • 25% Credit: ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(creditedDutyMin) : creditedDutyMin + 'm'})`,
        violations: [],
        warnings: [],
        status: 'OK'
      };
    }

    const repOffset = (typeof FTLRules !== 'undefined') ? FTLRules.getReportingOffsetMinutes(first.depAirport, isSim) : (first.depAirport === 'MCT' ? 75 : 60);
    const chkOffset = (typeof FTLRules !== 'undefined') ? FTLRules.getCheckoutOffsetMinutes(isSim) : 30;

    const reportUtc = new Date(first.depTimeUtc.getTime() - repOffset * 60 * 1000);
    // Checkout marks the release time when rest begins (Chocks On + 30 min)
    const checkoutUtc = new Date(last.arrTimeUtc.getTime() + chkOffset * 60 * 1000);

    const fdpMin = Math.max(0, Math.round((last.arrTimeUtc.getTime() - reportUtc.getTime()) / (60 * 1000)));
    // Duty Period terminates at Chocks-On for flight operations (does not include the 30 min debrief buffer)
    const dutyMin = isSim ? Math.max(0, Math.round((checkoutUtc.getTime() - reportUtc.getTime()) / (60 * 1000))) : fdpMin;
    const fltMin = sectors.reduce((acc, s) => acc + (s.flightTimeMinutes || 0), 0);
    const factored = (typeof FTLRules !== 'undefined') ? FTLRules.calculateFactoredSectors(sectors, true) : sectors.length;

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

        if (prev.isDayOff) {
          consecutiveDutyCounter = 1;
          dp.precedingRestMinutes = 24 * 60;
          dp.requiredRestMinutes = 12 * 60;
          dp.restMarginMinutes = 12 * 60;
        } else {
          const restMin = Math.round((dp.reportTimeUtc.getTime() - prev.checkoutTimeUtc.getTime()) / (60 * 1000));
          const reqMin = (typeof FTLRules !== 'undefined') ? FTLRules.getRequiredRestMinutes(prev.dutyDurationMinutes) : Math.max(prev.dutyDurationMinutes, 12 * 60);
          const marginMin = restMin - reqMin;

          dp.precedingRestMinutes = restMin;
          dp.requiredRestMinutes = reqMin;
          dp.restMarginMinutes = marginMin;

          const dayOff = (typeof FTLRules !== 'undefined') ? FTLRules.evaluateDayOff(prev.checkoutTimeUtc, dp.reportTimeUtc) : { isValid: restMin >= 34 * 60 };
          if (dayOff.isValid) {
            consecutiveDutyCounter = 1;
          } else {
            consecutiveDutyCounter++;
          }

          if (restMin < reqMin) {
            dp.violations.push({
              category: 'REST_PERIOD',
              title: 'Insufficient Preceding Rest',
              detail: `Rest of ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(restMin) : restMin + 'm'} is below minimum required ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(reqMin) : reqMin + 'm'}.`,
              ref: 'OM-A 7.1.6.4',
              margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(marginMin) : marginMin + 'm'
            });
          } else if (marginMin <= ((typeof FTLRules !== 'undefined') ? FTLRules.WARNING_THRESHOLDS.REST_MARGIN_MIN : 60)) {
            dp.warnings.push({
              category: 'REST_PERIOD',
              title: 'Tight Rest Margin',
              detail: `Rest margin of ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(marginMin) : marginMin + 'm'} is close to the minimum legal limit.`,
              ref: 'OM-A 7.1.6.4',
              margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(marginMin) : marginMin + 'm'
            });
          }
        }

        dp.consecutiveDutyDays = consecutiveDutyCounter;

        if (dp.consecutiveDutyDays > ((typeof FTLRules !== 'undefined') ? FTLRules.LIMITS.MAX_CONSECUTIVE_DAYS : 7)) {
          dp.violations.push({
            category: 'CONSECUTIVE_DUTY',
            title: 'Exceeded Consecutive Duty Days',
            detail: `Working on consecutive duty day ${dp.consecutiveDutyDays} without a statutory day off (OM-A max 7 days).`,
            ref: 'OM-A 7.1.5(1)',
            margin: `+${dp.consecutiveDutyDays - 7}d`
          });
        } else if (dp.consecutiveDutyDays === ((typeof FTLRules !== 'undefined') ? FTLRules.LIMITS.MAX_CONSECUTIVE_DAYS : 7)) {
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
        const maxFdp = (typeof FTLRules !== 'undefined') ? FTLRules.getMaxFdpMinutes(dp.reportTimeUtc, dp.factoredSectors, true) : (13 * 60);
        dp.maxFdpMinutes = maxFdp;
        dp.fdpMarginMinutes = maxFdp - dp.fdpDurationMinutes;

        if (dp.fdpDurationMinutes > maxFdp) {
          dp.violations.push({
            category: 'FDP_LIMIT',
            title: 'Maximum Daily FDP Exceeded',
            detail: `Actual FDP of ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(dp.fdpDurationMinutes) : dp.fdpDurationMinutes + 'm'} exceeded Table A limit of ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(maxFdp) : maxFdp + 'm'}.`,
            ref: 'OM-A 7.1.6.9 (Table A)',
            margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(dp.fdpMarginMinutes) : dp.fdpMarginMinutes + 'm'
          });
        } else if (dp.fdpMarginMinutes <= ((typeof FTLRules !== 'undefined') ? FTLRules.WARNING_THRESHOLDS.FDP_MARGIN_MIN : 45)) {
          dp.warnings.push({
            category: 'FDP_LIMIT',
            title: 'Tight FDP Margin',
            detail: `Used ${Math.round(dp.fdpDurationMinutes / maxFdp * 100)}% of allowable FDP. Remaining margin: ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(dp.fdpMarginMinutes) : dp.fdpMarginMinutes + 'm'}.`,
            ref: 'OM-A 7.1.6.9 (Table A)',
            margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(dp.fdpMarginMinutes) : dp.fdpMarginMinutes + 'm'
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
      const maxFlt28 = (typeof FTLRules !== 'undefined') ? FTLRules.LIMITS.MAX_FLIGHT_28D : 100 * 60;
      if (flt28d > maxFlt28) {
        dp.violations.push({
          category: 'FLIGHT_28D',
          title: 'Exceeded 28-Day Flight Time Limit',
          detail: `Accumulated ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(flt28d) : flt28d + 'm'} in 28 days (limit 100h).`,
          ref: 'OM-A 7.1.4(1)',
          margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(maxFlt28 - flt28d) : (maxFlt28 - flt28d) + 'm'
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
      const maxDuty7 = (typeof FTLRules !== 'undefined') ? FTLRules.LIMITS.MAX_DUTY_7D : 55 * 60;
      if (duty7d > maxDuty7) {
        dp.violations.push({
          category: 'DUTY_7D',
          title: 'Exceeded 7-Day Duty Time Limit',
          detail: `Accumulated ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(duty7d) : duty7d + 'm'} duty in 7 days (limit 55h).`,
          ref: 'OM-A 7.1.4(3)',
          margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(maxDuty7 - duty7d) : (maxDuty7 - duty7d) + 'm'
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
      const maxDuty14 = (typeof FTLRules !== 'undefined') ? FTLRules.LIMITS.MAX_DUTY_14D : 95 * 60;
      if (duty14d > maxDuty14) {
        dp.violations.push({
          category: 'DUTY_14D',
          title: 'Exceeded 14-Day Duty Time Limit',
          detail: `Accumulated ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(duty14d) : duty14d + 'm'} duty in 14 days (limit 95h).`,
          ref: 'OM-A 7.1.4(4)',
          margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(maxDuty14 - duty14d) : (maxDuty14 - duty14d) + 'm'
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
      const maxDuty28 = (typeof FTLRules !== 'undefined') ? FTLRules.LIMITS.MAX_DUTY_28D : 190 * 60;
      if (duty28d > maxDuty28) {
        dp.violations.push({
          category: 'DUTY_28D',
          title: 'Exceeded 28-Day Duty Time Limit',
          detail: `Accumulated ${(typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(duty28d) : duty28d + 'm'} duty in 28 days (limit 190h).`,
          ref: 'OM-A 7.1.4(5)',
          margin: (typeof FTLRules !== 'undefined') ? FTLRules.formatMinutesToHM(maxDuty28 - duty28d) : (maxDuty28 - duty28d) + 'm'
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = eCrewParser;
}
