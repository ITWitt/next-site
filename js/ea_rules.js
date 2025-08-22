(function(NS){
  const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver","Driver No","Driver Number","DrvNo"];

  // Accept: "F. Smith", "Frank Smith", "Frank S."
  const sigOK = (raw)=>{
    const s = (raw ?? '').toString().trim();
    if (!s) return false;
    const parts = s.split(/\s+/).filter(Boolean);
    const isInit = t => /^[A-Za-z]\.?$/.test(t);
    const isWord = t => /^[A-Za-z.'-]+$/.test(t);
    if (parts.length >= 2 && isWord(parts[0]) && isWord(parts[1])) return true; // First Last
    if (isInit(parts[0]) && (parts[1] || '').length > 1) return true;           // F. Smith
    if (!isInit(parts[0]) && isInit(parts[1])) return true;                     // Frank S.
    return false;
  };

  const pick = (row, names)=>{
    for (const n of names){
      if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
      const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
      if (k && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  };

  NS.applyRules = function(orders){
    const rows = orders || [];

    // --- EV rows per driver (COUNTIFS by driver) ---
    const evByDriver = new Map();
    for (const e of (NS.state.events || [])){
      const drv = pick(e, DRIVER_KEYS);
      if (!drv) continue;
      evByDriver.set(drv, (evByDriver.get(drv) || 0) + 1);
    }

    // --- per-driver tallies from Review Orders ---
    const byDriver = new Map();
    for (const o of rows){
      const drv = (o.driver_no || '').toString().trim();
      if (!drv) continue;
      let d = byDriver.get(drv);
      if (!d) { d = { driver:drv, total:0, sigOK:0 }; byDriver.set(drv, d); }
      d.total++;
      if (sigOK(o.signature_raw)) d.sigOK++;
    }

    // --- aggregate and build leaderboard ---
    let sumTotals = 0, sumSigOK = 0, sumEvUsed = 0;
    const leaderboard = [];

    for (const d of byDriver.values()){
      const total = d.total;
      const evUsed = Math.min(total, evByDriver.get(d.driver) || 0);

      const sigPct = total ? Math.round(100 * d.sigOK / total) : 0;
      const gps0   = Math.max(0, total - evUsed);

      leaderboard.push({ driver:d.driver, orders: total, sigPct, gps0 });

      sumTotals += total;
      sumSigOK  += d.sigOK;
      sumEvUsed += evUsed;
    }

    leaderboard.sort((a,b)=> b.orders - a.orders);

    const kpis = {
      total: sumTotals,
      sigPct: sumTotals ? Math.round(100 * sumSigOK / sumTotals) : 0,
      gpsZeros: Math.max(0, sumTotals - sumEvUsed),
      duplicatesRemoved: NS.state.duplicatesRemoved || 0
    };

    return { kpis, leaderboard, exceptions: [] };
  };
})(window.NEXT);
