# ✈️ Oman Air FTL Monitor & "What-If" Legality Simulator
### OM-A Part A Chapter 7 (Regulations valid as of August 2026)

A client-side, 100% offline-first **Progressive Web App (PWA)** built for flight crews to track Flight Time Limitations (FTL), audit eCrew logbooks, and test flight assignment changes in real time before accepting them to prevent regulatory violations and fines.

> [!NOTE]
> **Regulatory Baseline:** Calculations, Table A allowable limits, and rest rules in this application are strictly based on **Oman Air OM-A Chapter 7 (Regulations valid as of August 2026)**.

---

## 🔒 Data Persistence & Storage Architecture

### How is flight history saved on your device?
- **Permanent Local Storage:** Once you import your eCrew CSV or text, all flight sectors, duty periods, and cumulative counters are saved **permanently in your browser's private local storage (`IndexedDB` & `localStorage`) on that specific device**.
- **No Repeated Imports:** You **DO NOT** need to re-import your data every time you open the app. When you close the app, turn off your phone, or open it in flight (100% offline), your entire flight history and current rolling counters are loaded instantly.
- **Absolute Privacy:** No data is ever uploaded to any cloud server or third party. Everything resides securely in your device's browser sandbox.
- **Backups & Transfers:** You can export your data at any time to **CSV** or **JSON** from the Logbook tab to create backups or move your data to another device.

---

## ⚠️ Important Legal & Aviation Disclaimer

> [!CAUTION]
> **USE AT YOUR OWN RISK:**
> 1. This software is an independent decision-support tool provided **strictly for informational and planning purposes only**.
> 2. While the algorithmic rules have been built in accordance with **Oman Air Operations Manual Part A Chapter 7 (valid as of August 2026)**, software bugs, manual data entry errors, or unexpected operational roster changes may occur.
> 3. The **Pilot-in-Command (PIC)** and individual crew members remain solely responsible for ensuring absolute regulatory compliance before operating any flight sector.
> 4. Always verify your flight and rest legality against official company crew tracking systems (**eCrew**) and current published company manuals.
> 5. The authors, maintainers, and developers assume **no liability or responsibility** for operational delays, flight cancellations, regulatory non-compliances, license sanctions, or administrative fines resulting from the use of this application.

---

## 🌟 Key Features

1. **⚡ "What-If" Duty Legality Simulator (Change Tester):**
   - Test proposed flight additions, swaps, or roster changes before accepting them from Crew Tracking / eCrew.
   - Automatically computes reporting time (`UTC+4` MCT base), Table A Maximum allowable FDP, preceding rest, required subsequent rest, and projected cumulative 7-day, 14-day, and 28-day hours.
   - Immediate visual verdicts:
     - 🟢 **LEGAL (Safe Margin)**
     - 🟡 **LEGAL WITH WARNINGS (Tight Margin)**
     - 🔴 **ILLEGAL (OM-A Violation - Risk of Fine)**
   - Commit approved drafts directly to your local logbook.

2. **📊 Cockpit Dashboard & FTL Limits Gauges:**
   - **28-Day Flight Time Gauge:** Track block hours used vs the 100-hour legal limit (OM-A 7.1.4).
   - **7-Day Duty Gauge:** Track cumulative duty hours used vs the 55-hour limit.
   - **14-Day Duty Gauge:** Track cumulative duty hours vs the 95-hour limit.
   - **28-Day Duty Gauge:** Track cumulative duty hours vs the 190-hour limit.
   - **Consecutive Duty Days Counter:** Live countdown to required statutory days off (max 7 days).
   - **Rolling Trend Chart:** Interactive chart comparing flight and duty hours against legal caps.

3. **📥 eCrew Importer & Sync:**
   - Drag & drop CSV logbook exports or paste raw text copied directly from eCrew.
   - Automated FDP grouping using the `< 8-hour gap` rule.

4. **📖 Digital Flight Logbook & Audit:**
   - Complete chronological duty history with sector-by-sector breakdown.
   - Search by route, date, or status.
   - Export your data to **CSV** or **JSON**.

5. **📲 100% Offline & Mobile-Optimized PWA:**
   - Designed for smartphones (with a bottom navigation bar, ergonomic touch targets, and Dynamic Island/Notch support) as well as Desktop/Tablet.
   - **Absolute Privacy:** 100% of data is stored and processed locally on your device via `IndexedDB` / `LocalStorage`. No flight data is ever uploaded to any external server.

---

## 📋 Regulatory Rules Implemented (OM-A Chapter 7 - Aug 2026)

- **Home Base:** Muscat International Airport (`MCT`), UTC+4.
- **Reporting Times:** 75 min at MCT base, 60 min at outstations, 120 min for Simulator.
- **Check-out Times:** 30 min post-flight, 60 min post-simulator debriefing.
- **Daily FDP Limits:** OM-A 7.1.6.9 (Table A for Acclimatised Crew).
- **Two-Pilot Crew Factoring:** Sectors $>7$h factored according to OM-A 7.1.6.10.
- **Minimum Rest:** $\max(\text{Preceding Duty Duration}, 12\text{ hours})$ (OM-A 7.1.6.4).
- **Cumulative Limits:** 100h / 28 days, 900h / 12 months, 55h / 7 days, 95h / 14 days, 190h / 28 days (OM-A 7.1.4).
- **Days Off:** $\ge 34$ consecutive hours containing 2 local nights (22:00–08:00 LT) (OM-A 7.1.5).

---

## 🚀 How to Publish for Free on GitHub Pages

1. **Create a GitHub Repository:**
   - Go to [github.com](https://github.com/) and create a new repository.
2. **Push the contents of this folder:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Oman Air FTL PWA"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```
3. **Enable GitHub Pages:**
   - Go to your repository **Settings** $\rightarrow$ **Pages**.
   - Under **Build and deployment** $\rightarrow$ **Branch**, select `main` (root `/`) and click **Save**.
   - Your PWA will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

---

## 📱 How to Install on Devices

- **Android (Chrome / Edge):** Open the live URL, tap the **"Install App"** prompt or browser menu $\rightarrow$ **"Add to Home screen"**.
- **iPhone / iPad (Safari):** Open the live URL, tap the **Share button** $\rightarrow$ **"Add to Home Screen"**.
- **Windows / Mac / Linux (Chrome / Edge):** Open the URL and click the **Install icon** in the browser address bar.
