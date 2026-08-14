# User Manual & Regulatory Reference Guide
### Oman Air OM-A Chapter 7 (Flight Time Limitations & Duty Scheme - Valid as of August 2026)

---

## 1. Regulatory Framework & Scope

This Progressive Web Application (PWA) is engineered for Oman Air flight and cabin crews to audit, track, and simulate the regulatory legality of monthly rosters, historical flight logs, and last-minute operational schedule modifications (via the **What-If Simulator**).

All calculation rules, rest parameters, and Table A limits strictly implement the requirements of the **Oman Air Operations Manual Part A (OM-A), Chapter 7** based on Muscat Main Base (**MCT, UTC+4**), valid as of **August 2026**.

---

## 2. Cumulative Flight & Duty Limitations (OM-A 7.1.4 & 7.1.5)

| Operational Limit | Maximum Allowable Cap | Warning Threshold | OM-A Reference |
| :--- | :--- | :--- | :--- |
| **28-Day Flight Time** | **100 Hours** | 90 Hours (90%) | OM-A 7.1.4(1) |
| **12-Month Flight Time** | **900 Hours** | 850 Hours | OM-A 7.1.4(2) |
| **7-Day Duty Period** | **55 Hours** | 50 Hours | OM-A 7.1.4(3) |
| **14-Day Duty Period** | **95 Hours** | 85 Hours | OM-A 7.1.4(4) |
| **28-Day Duty Period** | **190 Hours** | 175 Hours | OM-A 7.1.4(5) |
| **Consecutive Duty Days** | **Max 7 Days** before statutory rest | Day 7 | OM-A 7.1.5(1) |
| **Preceding Minimum Rest** | $\ge \max(\text{Previous Duty Duration}, 12\text{h})$ at Base | 60 min margin | OM-A 7.1.6.4 |
| **Statutory Day Off** | $\ge 34\text{ Consecutive Hours}$ including 2 Local Nights at Base | - | OM-A 7.1.5 |

---

## 3. Maximum Daily FDP & Chocks-On Rule (OM-A 7.1.6.9 - Table A)

A Flight Duty Period (**FDP**) commences at the designated reporting time and **terminates strictly at Chocks-On (in-block) of the final commercial sector**. 

The subsequent 30-minute post-flight debrief period does not extend the FDP, but establishes the exact release timestamp from which mandatory preceding rest commences for the subsequent duty.

| Local Reporting Time (Base MCT) | 1 Sector | 2 Sectors | 3 Sectors | 4 Sectors |
| :---: | :---: | :---: | :---: | :---: |
| **06:00 – 07:59** | 13h 00m | 12h 15m | 11h 30m | 10h 45m |
| **08:00 – 12:59** | 14h 00m | 13h 15m | 12h 30m | 11h 45m |
| **13:00 – 17:59** | 13h 00m | 12h 15m | 11h 30m | 10h 45m |
| **18:00 – 21:59** | 12h 00m | 11h 15m | 10h 30m | 09h 45m |
| **22:00 – 05:59** | 11h 00m | 10h 15m | 09h 30m | 09h 00m |

---

## 4. Standby Duties & Callout Rules (OM-A 7.1.7)

### A. Home Standby (`SBY`)
* **Cumulative Duty Credit:** Credited at **25% towards 7d, 14d, and 28d cumulative duty limits** (OM-A 7.1.7.8.c).
* **The 6-Hour Callout Rule:**
  * **Callout within first 6 hours:** The maximum allowable Table A FDP is **not reduced**, and FDP duration counts from the designated airport reporting time (OM-A 7.1.7.8.f & OM-A 7.1.7.9.c).
  * **Callout after 6 hours:** The maximum allowable Table A FDP is reduced minute-by-minute for all standby time exceeding 6 hours (OM-A 7.1.7.8.g).

### B. Airport Standby
* Credited at **100% duty time** (OM-A 7.1.7.4).
* If a flight is assigned after more than 4 hours on airport standby, the allowable FDP is reduced by the excess over 4 hours (OM-A 7.1.7.4.a).

---

## 5. eCrew Roster & Logbook Importer

* **Automatic Format Detection:** Accepts both eCrew *Personal Crew Schedule Reports* (monthly rosters) and *Flight Logbook CSV* exports.
* **Days Off Recognition:** Identifies `OFF` and `COFF` assignments (highlighted in green), accurately resetting consecutive duty counters.
* **Station Local Time to UTC Conversion:** Automatically converts local station departure and arrival times into UTC based on international IATA airport databases.
* **Smart Idempotent Deduplication:** Multiple monthly rosters or overlapping logbook files can be imported seamlessly without duplicate records.

---

## 6. Interactive Logbook, Timeline & Desktop Hover Cards

* **`📍 TODAY` Timeline Divider:** Visually demarcates executed historical flights from prospective roster assignments.
* **Desktop Hover Cards:** Hover over any duty row on PC to inspect real-time legal margins, Table A limits, preceding rest, and consecutive duty count.
* **Mobile & Desktop Modal Inspector:** Click or tap any row to view complete flight sector details, aircraft registration, block times, and crew members.
* **Reset & Update Tool:** Dedicated button in the top navigation bar to purge local data and browser cache, forcing an instant live download from GitHub Pages.

---

## 7. What-If Legality Simulator

Allows crew members to evaluate prospective roster swaps, extra sectors, or schedule changes before acceptance:
1. Add proposed flight sectors with departure and arrival stations.
2. The simulator calculates airport reporting time, allowable Table A FDP, required preceding rest, and projected cumulative 28-day flight / 7-day duty hours.

---

## 8. Client-Side Privacy & Full Offline PWA Access

* **100% Client-Side Privacy:** All flight data resides solely in your device's browser `LocalStorage`. No personal flight records or schedules are transmitted to external servers.
* **Offline Execution:** Built as an installable Progressive Web App (PWA) with full service worker caching, operating seamlessly in flight mode and during overseas layovers.

---

## 9. Aviation Operational Disclaimer

> **IMPORTANT LEGAL NOTICE:**  
> This application is an independent decision-support tool designed for informational and planning purposes only. It does not supersede official airline flight operations systems (eCrew/AIMS), Operations Control Center (OCC) instructions, or the regulatory accountability of the Pilot-in-Command under Civil Aviation Regulations (CAR-OPS) and Oman Air OM-A.
