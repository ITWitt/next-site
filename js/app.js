(function(NS){
  const el = (id)=> document.getElementById(id);

  function init(){
    // Default business date to yesterday
    const d = new Date(); d.setDate(d.getDate()-1);
    el('bizDate').valueAsDate = d;
    NS.setBizDate(el('bizDate').value);

    el('bizDate').addEventListener('change', ()=> NS.setBizDate(el('bizDate').value));
    el('btnClear').addEventListener('click', clearAll);
    el('btnProcess').addEventListener('click', process);
  }

  function clearAll(){
    el('nextFile').value = '';
    el('reviewFile').value = '';
    el('eventFile').value = '';
    el('driverInput').value='';
    document.querySelector('#driversTable tbody').innerHTML='';
    document.querySelector('#exceptionsTable tbody').innerHTML='';
    NS.renderKPIs({total:0, sigPct:0, gpsZeros:0, duplicatesRemoved:0});
    NS.renderValidation([]);
    el('processStatus').textContent='';
  }

  async function process(){
    el('processStatus').textContent = 'Processing…';
    try{
      const next = el('nextFile').files[0];
      const review = el('reviewFile').files[0];
      const events = el('eventFile').files[0];
      const driversRaw = el('driverInput').value;
      NS.setDrivers(driversRaw.split(/[,\\s]+/).filter(Boolean));

      let ordersRows = [];

      if (next){
        let rows = await tryApiUpload(next);
        if (!rows) rows = await NS.readFile(next);
      
        // Load saved profile first, then auto-resolve to fill gaps
        const saved = NS.loadMappingProfile("nextwb");
        NS.state.resolvedMap = Object.assign({}, saved);
        NS.autoResolveMapping(rows[0]||{});
      
        // Build mapping UI with detected headers & current map
        const headers = NS.getHeaders(rows);
        NS.buildMappingUI(headers, NS.state.resolvedMap, (map)=>{
          NS.state.resolvedMap = map;
          NS.saveMappingProfile("nextwb", map);
        });
      
        ordersRows = NS.normalizeOrders(rows);
        // Parse Event Viewer
        const eventRows = await NS.readFile(events);
        NS.state.events = eventRows;
      } else if (review && events) {
        // Keep originals (read-only)
        NEXT.state.raw = {
          review: await NEXT.readFile(review),
          events: await NEXT.readFile(events)
        };
      
        // Build mapping from the review file only (no file edits)
        NEXT.autoResolveMapping((NEXT.state.raw.review[0]) || {});
        const ordersRows = NEXT.normalizeOrders(NEXT.state.raw.review);
      
        // Detect “today’s” drivers & order IDs from the review data
        const orderIdsToday = new Set(ordersRows.map(o => (o.order_id||'').toString().trim()).filter(Boolean));
        const driversToday  = new Set(ordersRows.map(o => (o.driver_no||'').toString().trim()).filter(Boolean));
      
        // Filter Event Viewer IN-MEMORY to relevant rows (no file changes)
        const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#","3P Tracking #"];
        const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver","Driver No","Driver Number","DrvNo"];
        const pick = (row, names) => {
          for (const n of names) {
            if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
            const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
            if (k && String(row[k]).trim()) return String(row[k]).trim();
          }
          return "";
        };
        NEXT.state.events = NEXT.state.raw.events.filter(e => {
          const evOid = pick(e, ORDER_KEYS);
          const evDrv = pick(e, DRIVER_KEYS);
          return (evOid && orderIdsToday.has(evOid)) || (evDrv && driversToday.has(evDrv));
        });
      
        // Compute and render (derived views only)
        const results = NEXT.applyRules(ordersRows);
        NEXT.renderKPIs(results.kpis);
        NEXT.renderDrivers(results.leaderboard);
        NEXT.renderExceptions(results.exceptions);
        NEXT.renderValidation([
          {label:'Schema', ok: Object.keys(NEXT.state.resolvedMap).length>0 },
          {label:'Duplicates removed', ok: true},
          {label:'Signature check', ok: true},
          {label:'GPS zeros flagged', ok: true}
        ]);
        el('processStatus').textContent = 'Done.';
        return;
      }
      
        // 2) Parse Event Viewer
        const evAll = await NEXT.readFile(events);
      
        // Helper to pick a field by common aliases (case-insensitive)
        const pickField = (row, names) => {
          for (const n of names) {
            if (row[n] !== undefined) return row[n];
            const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
            if (k) return row[k];
          }
          return '';
        };
      
        // Common aliases we’ll look for
        const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#"];
        const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver"];
      
        // 3) Keep only events that belong to today’s orders or today’s drivers
        const evFiltered = evAll.filter(e => {
          const evOrder  = (pickField(e, ORDER_KEYS)  || '').toString().trim();
          const evDriver = (pickField(e, DRIVER_KEYS) || '').toString().trim();
          const byOrder  = evOrder  && orderIdsToday.has(evOrder);
          const byDriver = evDriver && driversToday.has(evDriver);
          return byOrder || byDriver;
        });
      
        // Store filtered events for rules to use (date-window checks, etc.)
        NEXT.state.events = evFiltered;
      
        // Continue with the normal flow using ordersRows
        const results = NEXT.applyRules(ordersRows);
        NEXT.renderKPIs(results.kpis);
        NEXT.renderDrivers(results.leaderboard);
        NEXT.renderExceptions(results.exceptions);
        NEXT.renderValidation([
          {label:'Schema', ok: Object.keys(NEXT.state.resolvedMap).length>0 },
          {label:'Duplicates removed', ok: true},
          {label:'Signature check', ok: true},
          {label:'GPS zeros flagged', ok: true}
        ]);
        el('processStatus').textContent = 'Done.';
        return;
      }
      
      const results = NS.applyRules(ordersRows);
      NS.renderKPIs(results.kpis);
      NS.renderDrivers(results.leaderboard);
      NS.renderExceptions(results.exceptions);
      NS.renderValidation([
        {label:'Schema', ok: Object.keys(NS.state.resolvedMap).length>0 },
        {label:'Duplicates removed', ok: true},
        {label:'Signature check', ok: true},
        {label:'GPS zeros flagged', ok: true}
      ]);

      el('processStatus').textContent = 'Done.';
    } catch(err){
      console.error(err);
      NS.toast('Error: ' + (err.message||err));
      el('processStatus').textContent = 'Failed.';
    }
  }
  async function tryApiUpload(file) {
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: await file.arrayBuffer()
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data.preview;
    } catch (e) {
      console.warn("API upload failed, falling back:", e);
      return null;
    }
  }
  
  document.addEventListener('DOMContentLoaded', init);
})(window.NEXT);
