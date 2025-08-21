// Business rules: signature compliance, GPS zero, line-haul exclusion (placeholder)
(function(NS){
  const isLinehaul = (driverNo)=> false; // TODO: connect to registry as needed

  // Signature compliance: 1 if looks like First LastInitial OR FirstInitial Last
  const sigOK = (raw) => {
    const s = (raw||"").toString().trim();
    if (!s) return false;
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return false;
    const [a,b] = parts;
    const aIsInit = /^[A-Za-z]\.?$/.test(a);
    const bIsInit = /^[A-Za-z]\.?$/.test(b);
    if (aIsInit && b.length > 1) return true;   // F. Smith
    if (!aIsInit && bIsInit) return true;       // Frank S.
    return false;
  };

  NS.applyRules = function(orders){
    const filtered = orders.filter(o => !isLinehaul(o.driver_no));
    let gpsZeros = 0, sigYes = 0;
    const exceptions = [];

    for (const o of filtered){
      const gpsZero = (o.gps_status==="0" || o.gps_status===0 || o.gps_status==="");
      if (gpsZero) gpsZeros++;
      const ok = sigOK(o.signature_raw);
      if (ok) sigYes++; else exceptions.push({ order_id: o.order_id, driver: o.driver_no, issue: 'Signature', details: o.signature_raw||'(blank)' });
      if (gpsZero) exceptions.push({ order_id: o.order_id, driver: o.driver_no, issue: 'GPS==0', details: '' });
    }

    const kpis = {
      total: filtered.length,
      sigPct: filtered.length ? Math.round((sigYes/filtered.length)*100) : 0,
      gpsZeros,
      duplicatesRemoved: window.NEXT.state.duplicatesRemoved
    };

    // Aggregate by driver
    const byDriver = {};
    for (const o of filtered){
      const key = o.driver_no || '(n/a)';
      if (!byDriver[key]) byDriver[key] = { driver: key, orders: 0, sigOK: 0, gps0: 0 };
      byDriver[key].orders++;
      if (sigOK(o.signature_raw)) byDriver[key].sigOK++;
      if (o.gps_status==="0" || o.gps_status===0 || o.gps_status==="") byDriver[key].gps0++;
    }

    const leaderboard = Object.values(byDriver).map(d => ({
      driver: d.driver, orders: d.orders, sigPct: d.orders ? Math.round(d.sigOK*100/d.orders) : 0, gps0: d.gps0
    })).sort((a,b)=> b.orders - a.orders);

    return { kpis, leaderboard, exceptions };
  };

})(window.NEXT);
