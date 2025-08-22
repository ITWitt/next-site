(function(NS){
  const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#","3P Tracking #","OrderNumber"];
  const pickField = (row, names)=>{
    for (const n of names){
      if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
      const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
      if (k && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  };

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

  const isLinehaul = (driverNo)=>{
    const set = NS.state.linehaulSet || new Set();
    return set.has((driverNo||'').toString().trim());
  };

  NS.applyRules = function(orders){
    const rows = (orders||[]).filter(o => !isLinehaul(o.driver_no));

    // Unique EV orders (so multiple EV rows for one order count once)
    const evOrderIds = new Set();
    for (const e of (NS.state.events || [])){
      const oid = pickField(e, ORDER_KEYS);
      if (oid) evOrderIds.add(oid.toString().trim());
    }

    // Per driver tallies
    const byDriver = new Map();
    for (const o of rows){
      const drv = (o.driver_no || '').toString().trim();
      const oid = (o.order_id  || '').toString().trim();
      if (!drv || !oid) continue;

      let d = byDriver.get(drv);
      if (!d) { d = { driver:drv, total:0, sigOK:0, evOrders:0, orderIds:[] }; byDriver.set(drv, d); }

      d.total++;
      d.orderIds.push(oid);
      if (sigOK(o.signature_raw)) d.sigOK++;
    }

    // Count EV-used orders per driver (intersection with evOrderIds)
    let sumTotals = 0, sumSigOK = 0, sumEvUsedUnique = 0;
    const leaderboard = [];

    for (const d of byDriver.values()){
      // dedupe order ids for driver, then count how many appear in EV set
      const uniq = Array.from(new Set(d.orderIds));
      const evUsed = uniq.reduce((acc, oid) => acc + (evOrderIds.has(oid) ? 1 : 0), 0);

      const sigPct = d.total ? Math.round(100 * d.sigOK / d.total) : 0;
      const gps0   = Math.max(0, d.total - evUsed);

      leaderboard.push({ driver:d.driver, orders:d.total, sigPct, gps0 });

      sumTotals += d.total;
      sumSigOK  += d.sigOK;
      sumEvUsedUnique += evUsed;
    }

    // Sort by orders desc
    leaderboard.sort((a,b)=> b.orders - a.orders);

    const kpis = {
      total: sumTotals,
      sigPct: sumTotals ? Math.round(100 * sumSigOK / sumTotals) : 0,
      gpsZeros: Math.max(0, sumTotals - sumEvUsedUnique),
      duplicatesRemoved: NS.state.duplicatesRemoved || 0
    };

    return { kpis, leaderboard, exceptions: [] };
  };
})(window.NEXT);
