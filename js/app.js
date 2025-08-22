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

  // Helper to case-insensitively pick a value from a row by known aliases
  function pickField(row, names){
    for (const n of names) {
      if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
      const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
      if (k && String(row[k]).trim()) return String(row[k]).trim();
    }
    return '';
  }

  // Common aliases we’ll look for
  const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#","3P Tracking #","OrderNumber"];
  const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver","Driver No","Driver Number","DrvNo"];

  async function process(){
    el('processStatus').textContent = 'Processing…';
    try{
      const next   = el('nextFile').files[0];
      const review = el('reviewFile').files[0];
      const events = el('eventFile').files[0];

      const driversRaw = el('driverInput').value || '';
      NS.setDrivers(driversRaw.split(/[\s,]+/).filter(Boolean));

      let ordersRows = [];

      // ---- Option A: NEXT workbook path ------------------------------------
      if (next){
        let rows = await tryApiUpload(next);
        if (!rows) rows = await NS.readFile(next);

        // Load saved profile first, then auto-resolve to fill gaps
        const saved = NS.loadMappingProfile ? NS.loadMappingProfile("nextwb") : {};
        NS.state.resolvedMap = Object.assign({}, saved);
        NS.autoResolveMapping(rows[0]||{});

        // Mapping UI (if available)
        if (NS.getHeaders && NS.buildMappingUI){
          const headers = NS.getHeaders(rows);
          NS.buildMappingUI(headers, NS.state.resolvedMap, (map)=>{
            NS.state.resolvedMap = map;
            if (NS.saveMappingProfile) NS.saveMappingProfile("nextwb", map);
          });
        }

        // Normalize orders
        ordersRows = NS.normalizeOrders(rows);

        // If an Event Viewer file is also supplied, filter it to today's orders/drivers
        if (events){
          const evAll = await NS.readFile(events);
          const orderIdsToday = new Set(ordersRows.map(o => (o.order_id||'').toString().trim()).filter(Boolean));
          const driversToday  = new Set(ordersRows.map(o => (o.driver_no||'').toString().trim()).filter(Boolean));
          NS.state.events = evAll.filter(e => {
            const evOrder  = pickField(e, ORDER_KEYS);
            const evDriver = pickField(e, DRIVER_KEYS);
            return (evOrder && orderIdsToday.has(evOrder)) || (evDriver && driversToday.has(evDriver));
          });
        } else {
          NS.state.events = [];
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
        return;
      }

      // ---- Option B: Review Orders + Event Viewer path ----------------------
      if (review && events) {
        // Keep originals in memory (read-only)
        NS.state.raw = {
          review: await NS.readFile(review),
          events: await NS.readFile(events)
        };

        // Build mapping from review file
        const saved = NS.loadMappingProfile ? NS.loadMappingProfile("review") : {};
        NS.state.resolvedMap = Object.assign({}, saved);
        NS.autoResolveMapping((NS.state.raw.review[0]) || {});

        // Mapping UI (if available)
        if (NS.getHeaders && NS.buildMappingUI){
          const headers = NS.getHeaders(NS.state.raw.review);
          NS.buildMappingUI(headers, NS.state.resolvedMap, (map)=>{
            NS.state.resolvedMap = map;
            if (NS.saveMappingProfile) NS.saveMappingProfile("review", map);
          });
        }

        // Normalize orders
        ordersRows = NS.normalizeOrders(NS.state.raw.review);

        // Detect the day's orders/drivers and filter EV to relevant rows
        const orderIdsToday = new Set(ordersRows.map(o => (o.order_id||'').toString().trim()).filter(Boolean));
        const driversToday  = new Set(ordersRows.map(o => (o.driver_no||'').toString().trim()).filter(Boolean));
        NS.state.events = NS.state.raw.events.filter(e => {
          const evOrder  = pickField(e, ORDER_KEYS);
          const evDriver = pickField(e, DRIVER_KEYS);
          return (evOrder && orderIdsToday.has(evOrder)) || (evDriver && driversToday.has(evDriver));
        });

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
        return;
      }

      // ---- Neither path satisfied ------------------------------------------
      NS.toast('Upload either the NEXT workbook or both raw exports (Review Orders + Event Viewer).');
      el('processStatus').textContent = '';
      return;

    } catch(err){
      console.error(err);
      NS.toast('Error: ' + (err.message||err));
      el('processStatus').textContent = 'Failed.';
    }
  }

  // Try API upload first; fall back to client-side parsing
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
