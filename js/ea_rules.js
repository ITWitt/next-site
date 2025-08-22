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
  const isLinehaul = (driverNo)=>{
    const set = NS.state.linehaulSet || new Set();
    return set.has((driverNo||'').toString().trim());
  };
  const sigOK = (raw) => {
    const s = (raw ?? '').toString().trim();
    if (!s) return false;
  
    const parts = s.split(/\s+/).filter(Boolean);
    const isInit = t => /^[A-Za-z]\.?$/.test(t);
    const isWord = t => /^[A-Za-z.'-]+$/.test(t);
  
    // Accept full names like "Andres Duran"
    if (parts.length >= 2 && isWord(parts[0]) && isWord(parts[1])) return true;
  
    // Accept "F. Smith" or "Frank S."
    if (isInit(parts[0]) && (parts[1] || '').length > 1) return true;
    if (!isInit(parts[0]) && isInit(parts[1])) return true;
  
    return false;
  };

  NS.applyRules = function(orders){
    const filtered = (orders||[]).filter(o => !isLinehaul(o.driver_no));

    // orders that have at least one event row
    const orderIdsWithEvent = new Set();
    for (const e of (NS.state.events || [])) {
      const oid = pickField(e, ORDER_KEYS);
      if (oid) orderIdsWithEvent.add(oid);
    }

    let gpsZeros = 0, sigYes = 0;
    const exceptions = [];

    for (const o of filtered){
      const gpsZero = (o.gps_status==="0" || o.gps_status===0 || o.gps_status==="");
      if (gpsZero) gpsZeros++;

      const ok = sigOK(o.signature_raw);
      if (ok) sigYes++;
      else exceptions.push({ order_id:o.order_id, driver:o.driver_no, issue:'Signature', details:o.signature_raw||'(blank)' });

      if (gpsZero) exceptions.push({ order_id:o.order_id, driver:o.driver_no, issue:'GPS==0', details:'' });

      const hasEvent = orderIdsWithEvent.has((o.order_id||'').toString().trim());
      if (!hasEvent) exceptions.push({ order_id:o.order_id, driver:o.driver_no, issue:'No Event (date window)', details:'' });
    }

    const total = filtered.length;
    const kpis = {
      total,
      sigPct: total ? Math.round(sigYes*100/total) : 0,
      gpsZeros,
      duplicatesRemoved: NS.state.duplicatesRemoved || 0
    };

    const byDriver = {};
    for (const o of filtered){
      const key = (o.driver_no||'(n/a)').toString();
      if (!byDriver[key]) byDriver[key] = { driver:key, orders:0, sigOK:0, gps0:0 };
      byDriver[key].orders++;
      if (sigOK(o.signature_raw)) byDriver[key].sigOK++;
      if (o.gps_status==="0" || o.gps_status===0 || o.gps_status==="") byDriver[key].gps0++;
    }
    const leaderboard = Object.values(byDriver).map(d=>({
      driver:d.driver,
      orders:d.orders,
      sigPct: d.orders ? Math.round(d.sigOK*100/d.orders) : 0,
      gps0:d.gps0
    })).sort((a,b)=> b.orders - a.orders);

    return { kpis, leaderboard, exceptions };
  };
})(window.NEXT);
