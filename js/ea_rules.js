/* ea_rules.js — complete replacement */
(function (NS) {
  'use strict';

  // Common header aliases (handy if you need to pick fields from EV later)
  const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#","3P Tracking #","OrderNumber"];
  const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver","Driver No","Driver Number","DrvNo"];

  // Case-insensitive field picker
  function pick(row, names){
    if (!row) return '';
    for (const n of names){
      if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
      const k = Object.keys(row).find(k => k && k.trim && k.trim().toLowerCase() === String(n).trim().toLowerCase());
      if (k && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  }

  // Acceptable signature forms: "F. Smith", "Frank Smith", "Frank S"
  function sigOK(raw){
    const s = (raw ?? '').toString().trim();
    if (!s) return false;
    const parts = s.replace(/\s+/g, ' ').split(' ');
    const isInit = (t) => /^[A-Za-z]\.?$/.test(t);
    const isWord = (t) => /^[A-Za-z][A-Za-z.'-]*$/.test(t);
    if (parts.length >= 2 && isWord(parts[0]) && isWord(parts[1])) return true; // First Last
    if (isInit(parts[0]) && (parts[1] || '').length > 1) return true;           // F. Smith
    if (!isInit(parts[0]) && isInit(parts[1])) return true;                     // Frank S.
    return false;
  }

  // Optional linehaul filter (set NS.state.linehaulSet = new Set([...driverNos]))
  function isLinehaul(driverNo){
    const set = NS.state && NS.state.linehaulSet;
    if (!set) return false;
    return set.has(String(driverNo ?? '').trim());
  }

  // ---------- MAIN ----------
  NS.applyRules = function(orders){
    // Use normalized review orders (from NS.normalizeOrders), drop linehaul if provided
    const rows = (orders || []).filter(o => !!o && !isLinehaul(o.driver_no));

    // 1) Event Viewer: COUNTIFS by driver (matches workbook "NEXT Data" by driver)
    const evByDriver = new Map();
    const ev = (NS.state && NS.state.events) || [];
    for (const e of ev){
      const drv = pick(e, DRIVER_KEYS);
      if (!drv) continue;
      evByDriver.set(drv, (evByDriver.get(drv) || 0) + 1);
    }

    // 2) Review Orders: per-driver tallies
    const byDriver = new Map();
    for (const o of rows){
      const drv = String(o.driver_no ?? '').trim();
      if (!drv) continue;
      let agg = byDriver.get(drv);
      if (!agg){
        agg = { driver: drv, total: 0, sigOK: 0 };
        byDriver.set(drv, agg);
      }
      agg.total++;
      if (sigOK(o.signature_raw)) agg.sigOK++;
    }

    // 3) Build leaderboard & overall KPIs (targets = total orders; goal = 100%)
    let sumTotals = 0, sumSigOK = 0, sumEvUsed = 0;
    const leaderboard = [];

    for (const d of byDriver.values()){
      const total  = d.total;
      const evUsed = Math.min(total, evByDriver.get(d.driver) || 0); // MIN(total, EV rows for driver)

      const sigPct = total ? Math.round(100 * d.sigOK / total) : 0;
      const gps0   = Math.max(0, total - evUsed);                    // missing EV "activity"

      leaderboard.push({ driver: d.driver, orders: total, sigPct, gps0 });

      sumTotals += total;
      sumSigOK  += d.sigOK;
      sumEvUsed += evUsed;
    }

    // sort by orders descending for display
    leaderboard.sort((a,b) => b.orders - a.orders);

    const kpis = {
      total: sumTotals,
      sigPct: sumTotals ? Math.round(100 * sumSigOK / sumTotals) : 0,
      gpsZeros: Math.max(0, sumTotals - sumEvUsed),
      duplicatesRemoved: (NS.state && NS.state.duplicatesRemoved) || 0
    };

    // stash for debugging, non-critical
    NS.state = NS.state || {};
    NS.state.lastResults = { kpis, leaderboard };

    return { kpis, leaderboard, exceptions: [] };
  };

  // Optional: expose helpers for console debugging
  NS._rulesDebug = { pick, sigOK, ORDER_KEYS, DRIVER_KEYS };

})(window.NEXT);
