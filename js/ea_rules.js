(function(NS){
  const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#","3P Tracking #","OrderNumber"];
  const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver","Driver No","Driver Number","DrvNo"];

  const pickField = (row, names)=>{
    for (const n of names){
      if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
      const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
      if (k && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  };

  // Accept "F. Smith", "Frank Smith", "Frank S."
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

  const isLinehaul = (driverNo)=>{
    const set = NS.state.linehaulSet || new Set();
    return set.has((driverNo||'').toString().trim());
  };

  NS.applyRules = function(orders){
    const filtered = (orders||[]).filter(o => !isLinehaul(o.driver_no));

    // ---------- aggregate EV rows per driver ----------
    const evByDriver = new Map();
    for (const e of (NS.state.events || [])){
      const drv = pickField(e, DRIVER_KEYS);
      if (!drv) continue;
      evByDriver.set(drv, (evByDriver.get(drv) || 0) + 1);
    }

    // optional driver targets (from a “Driver List”)
    // structure: NS.state.driverTargets = { [driverNo]: { sig: number, gps: number } }
    const targets = NS.state.driverTargets || {};

    // ---------- per-driver tallies ----------
    const byDriver = new Map();
    for (const o of filtered){
      const d = (o.driver_no || '').toString().trim();
      if (!d) continue;
      let t = byDriver.get(d);
      if (!t) { t = { driver:d, orders:0, sigOKCnt:0, gps0Cnt:0 }; byDriver.set(d, t); }
      t.orders++;
      if (sigOK(o.signature_raw)) t.sigOKCnt++;
      // gps_status zeros still counted if you mapped it; EV drives activity below
      const gpsVal = o.gps_status;
      if (gpsVal !== undefined && gpsVal !== null) {
        const s = String(gpsVal).trim().toLowerCase();
        if (s === '' || s === '0' || s === '0.0' || s === 'false' || s === 'no' || s.includes('no fix') || s.includes('no gps') || s.includes('nf')) {
          t.gps0Cnt++;
        }
      }
    }

    // ---------- apply Excel-like MIN/COUNTIFS/VLOOKUP logic ----------
    let sumOrdersWithSigs = 0;
    let sumSigTarget      = 0;
    let sumNextDelUsed    = 0;
    let sumGpsTarget      = 0;

    const leaderboard = [];

    for (const [driver, t] of byDriver.entries()){
      const total = t.orders;

      // Orders w/ Signatures = MIN(total, actual sig OK)
      const ordersWithSigs = Math.min(total, t.sigOKCnt);

      // Targets from Driver List (or default to total)
      const driverTarget = targets[driver] || {};
      const sigTarget = Math.min(total, Number(driverTarget.sig ?? total));
      const gpsTarget = Math.min(total, Number(driverTarget.gps ?? total));

      // NEXT Delivery Used = MIN(total, EV rows for driver)
      const evCount = evByDriver.get(driver) || 0;
      const nextDelUsed = Math.min(total, evCount);

      sumOrdersWithSigs += ordersWithSigs;
      sumSigTarget      += sigTarget;
      sumNextDelUsed    += nextDelUsed;
      sumGpsTarget      += gpsTarget;

      // Leaderboard row:
      //   Sig OK % = ordersWithSigs / sigTarget
      //   GPS 0    = gpsTarget - nextDelUsed   (missing GPS activity)
      const sigPct = sigTarget ? Math.round(100 * ordersWithSigs / sigTarget) : 0;
      const gps0   = Math.max(0, gpsTarget - nextDelUsed);

      leaderboard.push({ driver, orders: total, sigPct, gps0 });
    }

    // Sort by orders desc (keep your existing behavior)
    leaderboard.sort((a,b)=> b.orders - a.orders);

    // ---------- KPIs ----------
    const totalOrders = filtered.length;
    const kpis = {
      total: totalOrders,
      sigPct: sumSigTarget ? Math.round(100 * sumOrdersWithSigs / sumSigTarget) : 0,
      gpsZeros: Math.max(0, sumGpsTarget - sumNextDelUsed),
      duplicatesRemoved: NS.state.duplicatesRemoved || 0
    };

    return { kpis, leaderboard, exceptions: [] };
  };
})(window.NEXT);
