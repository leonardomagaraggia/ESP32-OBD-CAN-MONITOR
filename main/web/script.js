// ============================================
// OBD-II DASHBOARD SCRIPT - Index.html compatible
// Safe DOM mapping + JSON key fallback (no label mismatch)
// ============================================

(() => {
  "use strict";

  const POLL_MS = 200;

  // UI ranges (tuning)
  const RPM_MAX = 8000;
  const SPEED_MAX = 240;
  const COOLANT_MIN = 50;
  const COOLANT_MAX = 130;
  const BATT_MIN = 11.0;
  const BATT_MAX = 17.0;
  const MAP_MIN = 20;   // kPa
  const MAP_MAX = 250;  // kPa

  const $ = (id) => document.getElementById(id);
  const first = (...ids) => ids.map($).find(Boolean) || null;

  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

  const pick = (obj, keys, defVal = null) => {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
    }
    return defVal;
  };

  const fmtInt = (v, defTxt = "--") => (Number.isFinite(v) ? String(Math.round(v)) : defTxt);
  const fmt1 = (v, defTxt = "--") => (Number.isFinite(v) ? v.toFixed(1) : defTxt);
  const fmt2 = (v, defTxt = "--") => (Number.isFinite(v) ? v.toFixed(2) : defTxt);

  const setText = (el, txt) => { if (el) el.textContent = txt; };
  const setHTML = (el, html) => { if (el) el.innerHTML = html; };

  const setWidthPct = (el, pct) => { if (el) el.style.width = `${clamp(pct, 0, 100)}%`; };
  const setLeftPct  = (el, pct) => { if (el) el.style.left  = `${clamp(pct, 0, 100)}%`; };
  const setHeightPct = (el, pct) => { if (el) el.style.height = `${clamp(pct, 0, 100)}%`; };

  // --- BRIDGE VARIABLE ---
  // Memorizza l'ultimo set di dati normalizzati per i grafici
  let latestBridgeData = null;

  const ui = {
    // Header
    connDot: $("connection-status"),
    connText: $("connection-text"),
    dataCount: $("data-count"),
    updateRate: $("update-rate"),
    signalStrength: $("signal-strength"),
    bufferUsage: $("buffer-usage"),

    // KPI RPM
    kpiRpm: $("kpi-rpm"),
    rpmOverlay: $("rpm-overlay"),
    rpmIllum: $("rpm-illumination"),
    rpmCursor: $("rpm-cursor"),
    rpmTrend: $("rpm-trend"),

    // KPI Speed
    kpiSpeed: $("kpi-speed"),
    speedOverlay: $("speed-overlay"),
    speedIllum: $("speed-illumination"),
    speedCursor: $("speed-cursor"),
    speedTrend: $("speed-trend"),

    // KPI Temps
    kpiCoolant: $("kpi-temp-coolant"),
    tempIndicator: $("temp-indicator"),
    kpiIntake: $("kpi-temp-intake"),

    // KPI Battery
    kpiBatt: $("kpi-batt"),
    battFill: $("battery-fill"),
    battIndicator: $("battery-indicator"),

    // Engine panel
    paramLoad: $("param-load"),
    loadBar: $("load-bar"),
    paramThrottle: $("param-throttle"),
    throttleBar: $("throttle-bar"),
    paramTiming: $("param-timing"),
    paramMaf: $("param-maf"),

    // Fuel
    paramFuelLvl: $("param-fuel-lvl"),
    fuelLvlFill: $("fuel-level-fill"),
    fuelLvlValue: $("fuel-level-value"),
    fuelRange: $("fuel-range"),
    paramFuelPress: $("param-fuel-press"),
    paramFuelTrimS: $("param-fuel-trim-s"),
    paramFuelTrimL: $("param-fuel-trim-l"),

    // Environment
    ambientTemp: $("ambient-temp"),
    paramTempIntake: $("param-temp-intake"),
    tempDiff: $("temp-diff"),
    paramPressIntake: $("param-press-intake"),
    pressIntakeBar: $("press-intake-bar"),
    paramPressBaro: $("param-press-baro"),
    paramDistMil: $("param-dist-mil"),

    // System status
    latencyValue: $("latency-value"),
    pingTime: $("ping-time"),
    pingTimeDisplay: $("ping-time-display"),
    dtcCount: $("dtc-count"),
    pendingDtc: $("pending-dtc"),
    uptime: $("uptime"),
    uptimeDisplay: $("uptime-display"),
    updateInterval: $("update-interval"),
    updateIntervalDisplay: $("update-interval-display"),
    dataPoints: $("data-points"),
    totalData: $("total-data"),
    dataRate: $("data-rate"),
    dataRateDisplay: $("data-rate-display"),
    bufferUsageDisplay: $("buffer-usage-display"),
    signalStrengthDisplay: $("signal-strength-display"),
    signalQuality: $("signal-quality"),
  };

  let last = null;
  let samples = 0;
  const t0 = Date.now();

  function setConnected(ok) {
    if (ui.connDot) {
      ui.connDot.classList.toggle("connected", ok);
      ui.connDot.classList.toggle("disconnected", !ok);
    }
    if (ui.connText) {
      ui.connText.textContent = ok ? "Connected to vehicle" : "Disconnected / no data";
    }
  }

  function setTrend(el, now, prev, unit = "%") {
    if (!el || !Number.isFinite(now) || !Number.isFinite(prev)) return;

    const delta = now - prev;
    let icon = "fa-equals";
    let text = "Stable";

    if (Math.abs(delta) < 1e-6) {
      icon = "fa-equals";
      text = "Stable";
    } else if (delta > 0) {
      icon = "fa-arrow-up";
      text = unit === "%" ? `+${Math.abs(delta).toFixed(1)}${unit}` : `↑ +${delta.toFixed(1)}${unit}`;
    } else {
      icon = "fa-arrow-down";
      text = unit === "%" ? `-${Math.abs(delta).toFixed(1)}${unit}` : `↓ ${delta.toFixed(1)}${unit}`;
    }

    el.innerHTML = `<i class="fas ${icon}"></i> ${text}`;
  }

  function formatHMS(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }


  function onData(d, rttMs) {
    samples++;

    // --- Parse with fallback keys ---
    const rpm = Number(pick(d, ["rpm"], NaN));
    const speed = Number(pick(d, ["speed"], NaN));
    const load = Number(pick(d, ["load"], NaN));
    const throttle = Number(pick(d, ["throttle"], NaN));
    const timing = Number(pick(d, ["timing"], NaN));
    const maf = Number(pick(d, ["maf"], NaN));

    const coolant = Number(pick(d, ["temp_coolant", "coolant"], NaN));
    const intake = Number(pick(d, ["temp_intake", "intake_temp"], NaN));
    const ambient = Number(pick(d, ["temp_ambient", "ambient_temp", "ambient"], NaN));

    const batt = Number(pick(d, ["batt", "battery", "voltage"], NaN));

    const fuelLvl = Number(pick(d, ["fuel_lvl", "fuel_level"], NaN));
    const fuelPress = Number(pick(d, ["fuel_press", "fuel_pressure"], NaN));
    const stft = Number(pick(d, ["fuel_trim_s", "stft"], NaN));
    const ltft = Number(pick(d, ["fuel_trim_l", "ltft"], NaN));

    const map = Number(pick(d, ["press_intake", "map"], NaN));
    const baro = Number(pick(d, ["press_baro", "baro"], NaN));
    const distMil = Number(pick(d, ["dist_mil"], NaN));

    const dtcCount = Number(pick(d, ["dtc_count", "dtc"], 0));
    const pendingDtc = Number(pick(d, ["pending_dtc", "dtc_pending"], 0));

    const uptimeS = Number(pick(d, ["uptime_s", "uptime"], NaN)) || (Date.now() - t0) / 1000;

    // --- BRIDGE DATA UPDATE ---
    // Questo prepara un oggetto pulito e normalizzato per chart-script.js
    latestBridgeData = {
      timestamp: Date.now(),
      rpm: rpm,
      speed: speed,
      temp_coolant: coolant,
      temp_intake: intake,
      temp_ambient: ambient,
      batt: batt,
      load: load,
      throttle: throttle,
      maf: maf,
      fuel_lvl: fuelLvl,
      fuel_press: fuelPress,
      fuel_trim_s: stft,
      fuel_trim_l: ltft,
      press_intake: map,
      press_baro: baro
    };

    // --- Header/system ---
    setText(ui.dataCount, String(samples));
    setText(ui.dataPoints, String(samples));
    setText(ui.totalData, String(samples));

    if (Number.isFinite(rttMs)) {
      setText(ui.latencyValue, `${Math.round(rttMs)}ms`);
      setText(ui.pingTime, `${Math.round(rttMs)}ms`);
      setText(ui.pingTimeDisplay, `${Math.round(rttMs)}ms`);
    }

    setText(ui.dtcCount, fmtInt(dtcCount, "0"));
    setText(ui.pendingDtc, fmtInt(pendingDtc, "0"));

    const upTxt = formatHMS(uptimeS);
    setText(ui.uptime, upTxt);
    setText(ui.uptimeDisplay, upTxt);

    // --- KPI RPM ---
    setText(ui.kpiRpm, fmtInt(rpm));
    if (Number.isFinite(rpm)) {
      const pct = (clamp(rpm, 0, RPM_MAX) / RPM_MAX) * 100;
      setWidthPct(ui.rpmOverlay, pct);
      setWidthPct(ui.rpmIllum, pct);
      setLeftPct(ui.rpmCursor, pct);
      if (last && Number.isFinite(last.rpm)) {
        const dpct = ((rpm - last.rpm) / Math.max(last.rpm, 1)) * 100;
        setTrend(ui.rpmTrend, dpct, 0, "%");
      }
    }

    // --- KPI Speed ---
    setText(ui.kpiSpeed, fmtInt(speed));
    if (Number.isFinite(speed)) {
      const pct = (clamp(speed, 0, SPEED_MAX) / SPEED_MAX) * 100;
      setWidthPct(ui.speedOverlay, pct);
      setWidthPct(ui.speedIllum, pct);
      setLeftPct(ui.speedCursor, pct);
      if (last && Number.isFinite(last.speed)) {
        const dpct = ((speed - last.speed) / Math.max(last.speed, 1)) * 100;
        setTrend(ui.speedTrend, dpct, 0, "%");
      }
    }

    // --- Temps ---
    setText(ui.kpiCoolant, fmtInt(coolant));
    if (Number.isFinite(coolant)) {
      const pct = ((clamp(coolant, COOLANT_MIN, COOLANT_MAX) - COOLANT_MIN) / (COOLANT_MAX - COOLANT_MIN)) * 100;
      setLeftPct(ui.tempIndicator, pct);
    }

    setText(ui.kpiIntake, fmtInt(intake));
    setText(ui.paramTempIntake, Number.isFinite(intake) ? `${Math.round(intake)}°C` : "--");

    if (Number.isFinite(ambient)) {
      setText(ui.ambientTemp, `${Math.round(ambient)}°C`);
      if (Number.isFinite(intake)) {
        setText(ui.tempDiff, fmtInt(intake - ambient, "--"));
      }
    }

    // --- Battery ---
    setText(ui.kpiBatt, fmt2(batt));
    if (Number.isFinite(batt)) {
      const pct = ((clamp(batt, BATT_MIN, BATT_MAX) - BATT_MIN) / (BATT_MAX - BATT_MIN)) * 100;
      setWidthPct(ui.battFill, pct);
      setLeftPct(ui.battIndicator, pct);
      //updateBatteryHealth(batt);
    } else {
      //updateBatteryHealth(NaN);
    }

    // --- Engine panel ---
    if (Number.isFinite(load)) {
      setText(ui.paramLoad, `${load.toFixed(1)}%`);
      setWidthPct(ui.loadBar, load);
    } else {
      setText(ui.paramLoad, "--");
    }

    if (Number.isFinite(throttle)) {
      setText(ui.paramThrottle, `${throttle.toFixed(1)}%`);
      setWidthPct(ui.throttleBar, throttle);
    } else {
      setText(ui.paramThrottle, "--");
    }

    setText(ui.paramTiming, Number.isFinite(timing) ? `${timing.toFixed(1)}°` : "--");
    setText(ui.paramMaf, Number.isFinite(maf) ? `${maf.toFixed(2)} g/s` : "--");

    // --- Fuel panel ---
    if (Number.isFinite(fuelLvl)) {
      setText(ui.paramFuelLvl, `${fuelLvl.toFixed(1)}%`);
      setText(ui.fuelLvlValue, `${Math.round(fuelLvl)}%`);
      setHeightPct(ui.fuelLvlFill, fuelLvl);
    } else {
      setText(ui.paramFuelLvl, "--");
    }

    setText(ui.paramFuelPress, Number.isFinite(fuelPress) ? `${fuelPress.toFixed(1)} kPa` : "--");
    setText(ui.paramFuelTrimS, Number.isFinite(stft) ? `${stft >= 0 ? "+" : ""}${stft.toFixed(1)}%` : "--");
    setText(ui.paramFuelTrimL, Number.isFinite(ltft) ? `${ltft >= 0 ? "+" : ""}${ltft.toFixed(1)}%` : "--");

    const rangeKm = Number(pick(d, ["fuel_range_km", "fuel_range"], NaN));
    if (Number.isFinite(rangeKm)) setText(ui.fuelRange, fmtInt(rangeKm));

    // --- Environment pressure ---
    setText(ui.paramPressIntake, Number.isFinite(map) ? `${Math.round(map)} kPa` : "--");
    if (Number.isFinite(map)) {
      const pct = ((clamp(map, MAP_MIN, MAP_MAX) - MAP_MIN) / (MAP_MAX - MAP_MIN)) * 100;
      setWidthPct(ui.pressIntakeBar, pct);
    }

    setText(ui.paramPressBaro, Number.isFinite(baro) ? `${baro.toFixed(1)} kPa` : "--");
    setText(ui.paramDistMil, Number.isFinite(distMil) ? `${Math.round(distMil)} km` : "--");

    // --- Rate stats ---
    const elapsedS = (Date.now() - t0) / 1000;
    if (elapsedS > 0) {
      const rate = samples / elapsedS;
      setText(ui.dataRate, rate.toFixed(0));
      setText(ui.dataRateDisplay, `${rate.toFixed(0)}/s`);
    }

    last = { rpm, speed };
  }

  async function pollOnce() {
    const start = performance.now();
    try {
      const res = await fetch("/data", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rtt = performance.now() - start;
      onData(data, rtt);
      setConnected(true);
    } catch (err) {
      console.error("Errore fetch OBD:", err);
      setConnected(false);
    }
  }

  // --- EXPOSE BRIDGE FUNCTION ---
  // Rende disponibili i dati a chart-script.js
  window.getOBDChartData = () => {
    return latestBridgeData;
  };


window.getOBDDataBridge = () => {
  if (typeof latestBridgeData !== 'undefined') return latestBridgeData;
  // Se latestBridgeData non è definita globalmente nell'IIFE, 
  // assicurati che la variabile sia accessibile o usa questa logica
  return window.latestOBDData || null; 
};

  document.addEventListener("DOMContentLoaded", () => {
    pollOnce();
    setInterval(pollOnce, POLL_MS);
  });
})();