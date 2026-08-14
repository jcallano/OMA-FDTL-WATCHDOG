/**
 * "What-If" Legality Simulator & Duty Change Validator
 */

const FTLSimulator = (() => {

  function evaluateDraftDuty(draftSectors, existingDuties = []) {
    if (!draftSectors || draftSectors.length === 0) {
      return null;
    }

    const sortedSectors = [...draftSectors].sort((a, b) => a.depTimeUtc.getTime() - b.depTimeUtc.getTime());
    const firstSec = sortedSectors[0];
    const lastSec = sortedSectors[sortedSectors.length - 1];
    const isSim = firstSec.isSimulator || false;

    const repOffset = FTLRules.getReportingOffsetMinutes(firstSec.depAirport, isSim);
    const chkOffset = FTLRules.getCheckoutOffsetMinutes(isSim);

    const reportUtc = new Date(firstSec.depTimeUtc.getTime() - repOffset * 60 * 1000);
    const checkoutUtc = new Date(lastSec.arrTimeUtc.getTime() + chkOffset * 60 * 1000);

    const fdpMin = Math.round((lastSec.arrTimeUtc.getTime() - reportUtc.getTime()) / (60 * 1000));
    const dutyMin = Math.round((checkoutUtc.getTime() - reportUtc.getTime()) / (60 * 1000));
    const fltMin = sortedSectors.reduce((sum, s) => sum + (s.flightTimeMinutes || 0), 0);
    const factoredSectors = FTLRules.calculateFactoredSectors(sortedSectors, true);

    const reportLocal = new Date(reportUtc.getTime() + FTLRules.BASE_UTC_OFFSET_HOURS * 3600 * 1000);
    const maxFdp = isSim ? dutyMin : FTLRules.getMaxFdpMinutes(reportLocal, factoredSectors, true);
    const fdpMargin = maxFdp - fdpMin;

    const violations = [];
    const warnings = [];
    const checks = [];

    // Check 1: FDP Max Table A
    if (isSim) {
      checks.push({
        status: 'OK',
        label: 'Simulator Duty',
        detail: `Simulator session duration: ${FTLRules.formatMinutesToHM(dutyMin)} (counts as duty, debriefing 1h included).`,
        ref: 'OM-A 7.1.6.5'
      });
    } else {
      if (fdpMin > maxFdp) {
        const item = {
          status: 'VIOLATION',
          label: 'Table A Max FDP Exceeded',
          detail: `Proposed FDP of ${FTLRules.formatMinutesToHM(fdpMin)} exceeds legal limit of ${FTLRules.formatMinutesToHM(maxFdp)} (Report ${FTLRules.formatMinutesToClock(reportLocal.getHours()*60+reportLocal.getMinutes())} LT, ${factoredSectors} factored sectors).`,
          ref: 'OM-A 7.1.6.9 (Table A)',
          margin: FTLRules.formatMinutesToHM(fdpMargin)
        };
        violations.push(item);
        checks.push(item);
      } else if (fdpMargin <= FTLRules.WARNING_THRESHOLDS.FDP_MARGIN_MIN || fdpMin >= FTLRules.WARNING_THRESHOLDS.FDP_RATIO * maxFdp) {
        const item = {
          status: 'WARNING',
          label: 'FDP Tight Margin',
          detail: `Planned FDP uses ${Math.round(fdpMin/maxFdp*100)}% of allowable limit. Margin remaining: ${FTLRules.formatMinutesToHM(fdpMargin)}.`,
          ref: 'OM-A 7.1.6.9 (Table A)',
          margin: FTLRules.formatMinutesToHM(fdpMargin)
        };
        warnings.push(item);
        checks.push(item);
      } else {
        checks.push({
          status: 'OK',
          label: 'Table A FDP Limit',
          detail: `Planned FDP of ${FTLRules.formatMinutesToHM(fdpMin)} is within legal limit (${FTLRules.formatMinutesToHM(maxFdp)}). Safe margin: ${FTLRules.formatMinutesToHM(fdpMargin)}.`,
          ref: 'OM-A 7.1.6.9'
        });
      }
    }

    // Check 2: Preceding Rest
    let precedingRestMin = null;
    let requiredPrecedingRestMin = null;
    let restMargin = null;

    const pastDuties = existingDuties.filter(d => d.checkoutTimeUtc.getTime() <= reportUtc.getTime())
                                    .sort((a, b) => b.checkoutTimeUtc.getTime() - a.checkoutTimeUtc.getTime());

    if (pastDuties.length > 0) {
      const lastDuty = pastDuties[0];
      precedingRestMin = Math.round((reportUtc.getTime() - lastDuty.checkoutTimeUtc.getTime()) / (60 * 1000));
      requiredPrecedingRestMin = FTLRules.getRequiredRestMinutes(lastDuty.dutyDurationMinutes);
      restMargin = precedingRestMin - requiredPrecedingRestMin;

      if (precedingRestMin < requiredPrecedingRestMin) {
        const item = {
          status: 'VIOLATION',
          label: 'Insufficient Preceding Rest',
          detail: `Rest before this duty is ${FTLRules.formatMinutesToHM(precedingRestMin)}, which is less than required minimum of ${FTLRules.formatMinutesToHM(requiredPrecedingRestMin)} (Duty duration of previous flight: ${FTLRules.formatMinutesToHM(lastDuty.dutyDurationMinutes)}).`,
          ref: 'OM-A 7.1.6.4',
          margin: FTLRules.formatMinutesToHM(restMargin)
        };
        violations.push(item);
        checks.push(item);
      } else if (restMargin <= FTLRules.WARNING_THRESHOLDS.REST_MARGIN_MIN) {
        const item = {
          status: 'WARNING',
          label: 'Preceding Rest Tight Margin',
          detail: `Preceding rest of ${FTLRules.formatMinutesToHM(precedingRestMin)} leaves only ${FTLRules.formatMinutesToHM(restMargin)} above minimum required (${FTLRules.formatMinutesToHM(requiredPrecedingRestMin)}).`,
          ref: 'OM-A 7.1.6.4',
          margin: FTLRules.formatMinutesToHM(restMargin)
        };
        warnings.push(item);
        checks.push(item);
      } else {
        checks.push({
          status: 'OK',
          label: 'Preceding Rest Compliance',
          detail: `Sufficient preceding rest: ${FTLRules.formatMinutesToHM(precedingRestMin)} (Minimum required: ${FTLRules.formatMinutesToHM(requiredPrecedingRestMin)}).`,
          ref: 'OM-A 7.1.6.4'
        });
      }
    } else {
      checks.push({
        status: 'OK',
        label: 'Preceding Rest',
        detail: 'No preceding duty recorded immediately before this date (assumed fully rested).',
        ref: 'OM-A 7.1.6.4'
      });
    }

    // Check 3: Subsequent Minimum Rest Required
    const requiredSubsequentRestMin = FTLRules.getRequiredRestMinutes(dutyMin);
    checks.push({
      status: 'INFO',
      label: 'Subsequent Rest Required',
      detail: `After completing this duty, minimum uninterrupted rest required before next duty: ${FTLRules.formatMinutesToHM(requiredSubsequentRestMin)}.`,
      ref: 'OM-A 7.1.6.4'
    });

    // Check 4: Cumulative Projected Windows
    const endTime = checkoutUtc.getTime();
    const window28dStart = endTime - 28 * 24 * 3600 * 1000;
    let projFlt28d = fltMin;
    existingDuties.forEach(d => {
      if (d.lastArrUtc.getTime() <= endTime && d.lastArrUtc.getTime() >= window28dStart) {
        projFlt28d += (d.flightTimeMinutes || 0);
      }
    });

    if (projFlt28d > FTLRules.LIMITS.MAX_FLIGHT_28D) {
      const item = {
        status: 'VIOLATION',
        label: '28-Day Flight Limit Exceeded',
        detail: `Projected 28-day flying time would reach ${FTLRules.formatMinutesToHM(projFlt28d)}, exceeding 100h legal limit.`,
        ref: 'OM-A 7.1.4(1)',
        margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_FLIGHT_28D - projFlt28d)
      };
      violations.push(item);
      checks.push(item);
    } else if (projFlt28d >= FTLRules.WARNING_THRESHOLDS.FLIGHT_28D_MIN) {
      const item = {
        status: 'WARNING',
        label: 'High 28-Day Flight Time Projection',
        detail: `Projected 28-day flying time will reach ${FTLRules.formatMinutesToHM(projFlt28d)} (>=90h of 100h max limit).`,
        ref: 'OM-A 7.1.4(1)',
        margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_FLIGHT_28D - projFlt28d)
      };
      warnings.push(item);
      checks.push(item);
    } else {
      checks.push({
        status: 'OK',
        label: '28-Day Flight Time Projection',
        detail: `Projected 28-day flying time: ${FTLRules.formatMinutesToHM(projFlt28d)} / 100h 00m limit (Safe).`,
        ref: 'OM-A 7.1.4(1)'
      });
    }

    const window7dStart = endTime - 7 * 24 * 3600 * 1000;
    let projDuty7d = dutyMin;
    existingDuties.forEach(d => {
      if (d.checkoutTimeUtc.getTime() <= endTime && d.checkoutTimeUtc.getTime() >= window7dStart) {
        projDuty7d += (d.dutyDurationMinutes || 0);
      }
    });

    if (projDuty7d > FTLRules.LIMITS.MAX_DUTY_7D) {
      const item = {
        status: 'VIOLATION',
        label: '7-Day Duty Limit Exceeded',
        detail: `Projected 7-day duty time would reach ${FTLRules.formatMinutesToHM(projDuty7d)}, exceeding 55h limit.`,
        ref: 'OM-A 7.1.4(3)',
        margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_DUTY_7D - projDuty7d)
      };
      violations.push(item);
      checks.push(item);
    } else if (projDuty7d >= FTLRules.WARNING_THRESHOLDS.DUTY_7D_MIN) {
      const item = {
        status: 'WARNING',
        label: 'High 7-Day Duty Time Projection',
        detail: `Projected 7-day duty time will reach ${FTLRules.formatMinutesToHM(projDuty7d)} (>=50h of 55h limit).`,
        ref: 'OM-A 7.1.4(3)',
        margin: FTLRules.formatMinutesToHM(FTLRules.LIMITS.MAX_DUTY_7D - projDuty7d)
      };
      warnings.push(item);
      checks.push(item);
    } else {
      checks.push({
        status: 'OK',
        label: '7-Day Duty Time Projection',
        detail: `Projected 7-day duty time: ${FTLRules.formatMinutesToHM(projDuty7d)} / 55h 00m limit (Safe).`,
        ref: 'OM-A 7.1.4(3)'
      });
    }

    let verdict = 'LEGAL';
    let verdictTitle = 'LEGAL ASSIGNMENT (Safe Margin)';
    let verdictClass = 'legal';

    if (violations.length > 0) {
      verdict = 'ILLEGAL';
      verdictTitle = 'ILLEGAL - FTL VIOLATION (Risk of Fine)';
      verdictClass = 'illegal';
    } else if (warnings.length > 0) {
      verdict = 'WARNING';
      verdictTitle = 'LEGAL WITH WARNINGS (Tight Margin)';
      verdictClass = 'warning';
    }

    let summaryRoute = "N/A";
    if (isSim) {
      summaryRoute = "SIMULATOR";
    } else {
      const apts = [firstSec.depAirport];
      sortedSectors.forEach(s => apts.push(s.arrAirport));
      summaryRoute = apts.join('-');
    }

    const draftDutyObj = {
      dutyId: existingDuties.length + 1,
      sectors: sortedSectors,
      isSimulator: isSim,
      reportTimeUtc: reportUtc,
      firstDepUtc: firstSec.depTimeUtc,
      lastArrUtc: lastSec.arrTimeUtc,
      checkoutTimeUtc: checkoutUtc,
      fdpDurationMinutes: fdpMin,
      dutyDurationMinutes: dutyMin,
      flightTimeMinutes: fltMin,
      sectorCount: sortedSectors.length,
      factoredSectors: factoredSectors,
      maxFdpMinutes: maxFdp,
      fdpMarginMinutes: fdpMargin,
      precedingRestMinutes: precedingRestMin,
      requiredRestMinutes: requiredPrecedingRestMin,
      summaryRoute: summaryRoute,
      violations: violations,
      warnings: warnings,
      status: verdict === 'ILLEGAL' ? 'VIOLATION' : (verdict === 'WARNING' ? 'WARNING' : 'OK')
    };

    return {
      verdict,
      verdictTitle,
      verdictClass,
      checks,
      violations,
      warnings,
      metrics: {
        fdpDurationFormatted: FTLRules.formatMinutesToHM(fdpMin),
        maxFdpFormatted: isSim ? 'N/A' : FTLRules.formatMinutesToHM(maxFdp),
        fdpMarginFormatted: isSim ? 'N/A' : FTLRules.formatMinutesToHM(fdpMargin),
        precedingRestFormatted: precedingRestMin ? FTLRules.formatMinutesToHM(precedingRestMin) : 'N/A',
        requiredRestFormatted: requiredPrecedingRestMin ? FTLRules.formatMinutesToHM(requiredPrecedingRestMin) : 'N/A',
        subsequentRestRequiredFormatted: FTLRules.formatMinutesToHM(requiredSubsequentRestMin),
        projFlt28dFormatted: FTLRules.formatMinutesToHM(projFlt28d),
        projDuty7dFormatted: FTLRules.formatMinutesToHM(projDuty7d),
        dutyDurationFormatted: FTLRules.formatMinutesToHM(dutyMin),
        reportLocalFormatted: FTLRules.formatMinutesToClock(reportLocal.getHours()*60+reportLocal.getMinutes()) + ' LT',
        reportUtcFormatted: reportUtc.toISOString().slice(11, 16) + ' UTC',
        checkoutUtcFormatted: checkoutUtc.toISOString().slice(11, 16) + ' UTC'
      },
      draftDutyObj
    };
  }

  return {
    evaluateDraftDuty
  };
})();
