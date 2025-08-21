// web/js/ea_rules.js
(function(NS){
  // (optional) make line-haul configurable from state.linehaulSet
  const isLinehaul = (driverNo) => {
    const set = window.NEXT.state.linehaulSet || new Set();
    return set.has((driverNo||'').toString().trim());
  };

  // Signature rule (same as before)
  const sigOK = (raw) => {
    const s = (raw||"").toString().trim();
    if (!s) return false;
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    const [a,b] = parts;
    const aInit = /^[A-Za-z]\.?$/.test(a);
    const bInit = /^[A-Za-z]\.?$/.test(b);
    if (aInit && b.length > 1) return true;   // F. Smith
    if (!aInit && bInit) return true;         // Frank S.
    return false;
  };

  // Simple “is in business date” check for event timestamps
  function inBusinessDate(ts, bizISO) {
    if (!bizISO) return true;
    return (ts||"").toString().includes(bizISO);
  }

  NS.applyRules = function(orders){
    const filtered = orders.filter(o => !isLinehaul(o.driver_no));

    // Build an index of Event Viewer rows by Order ID (common field aliases)
    const evIndex = {};
    const evRows = window.NEXT.state.events || [];
    for (const e of evRows) {
      const oid = e['Order ID'] || e['OrderTrackingID'] || e['Order No'] || e['Tracking #'] || e['3P Tracking#'];
      if (!oid) continue;
      (evIndex[oid] = evIndex[oid] || []).push(e);
    }

    let gpsZeros = 0, sigYes = 0;
    const exceptions = [];

    // ←← THIS is the loop you asked about — add checks INSIDE it
    for (const o of filtered){
      const gpsZero = (o.gps_status==="0" || o.gps_status===0 || o.gps_status==="");
      if (gpsZero) gpsZeros++;

      const ok = sigOK(o.signature_raw);
      if (ok) sigYes++;
      else exceptions.push({ order_id: o.order_id, driver: o.driver_no, issue: 'Signature', details: o.signature_raw||'(blank)' });

      if (gpsZero) exceptions.push({ order_id: o.order_id, driver: o.driver_no, issue: 'GPS==0', details: '' });

      // 🔵 Event Viewer cross-check (the new part)
      const evs = evIndex[o.order_id] || [];
      const hasEvent = evs.some(e => {
        const t = e['Event Time'] || e['Timestamp'] || e['DateTime'] || e['Created'] || "";
        return inBusinessDate(t, window.NEXT.state.bizDate);
      });
      if (!hasEvent) {
        exceptions.push({ order_id: o.order_id, driver: o.driver_no, issue: 'No Event (date window)', details: '' });
      }
    }

    // KPIs
    const kpis = {
      total: filtered.length,
      sigPct: filtered.length ? Math.round((sigYes/filtered.length)*100) : 0,
      gpsZeros,
      duplicatesRemoved: window.NEXT.state.duplicatesRemoved
    };

    // Leaderboard
    const byDriver = {};
    for (const o of filtered){
      const key = o.driver_no || '(n/a)';
      if (!byDriver[key]) byDriver[key] = { driver: key, orders: 0, sigOK: 0, gps0: 0 };
      byDriver[key].orders++;
      if (sigOK(o.signature_raw)) byDriver[key].sigOK++;
      if (o.gps_status==="0" || o.gps_status===0 || o.gps_status==="") byDriver[key].gps0++;
    }
    const leaderboard = Object.values(byDriver).map(d => ({
      driver: d.driver,
      orders: d.orders,
      sigPct: d.orders ? Math.round(d.sigOK*100/d.orders) : 0,
      gps0: d.gps0
    })).sort((a,b)=> b.orders - a.orders);

    return { kpis, leaderboard, exceptions };
  };

})(window.NEXT);
