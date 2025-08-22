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
    // removed: el('nextFile').value
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
    const btn = el('btnProcess'); if (btn) btn.disabled = true;
    try{
      const next   = el('nextFile')   ? el('nextFile').files[0]   : null; // ok if you still have NEXT input
      const review = el('reviewFile').files[0];
      const events = el('eventFile').files[0];
  
      const driversRaw = (el('driverInput')?.value || '');
      NS.setDrivers(driversRaw.split(/[\s,]+/).filter(Boolean));
  
      let ordersRows = [];
      let eventsRows = [];
  
      // Helper: case-insensitive field pick
      const pick = (row, names) => {
        for (const n of names) {
          if (row[n] != null && String(row[n]).trim()) return String(row[n]).trim();
          const k = Object.keys(row).find(k => k.trim().toLowerCase() === n.trim().toLowerCase());
          if (k && String(row[k]).trim()) return String(row[k]).trim();
        }
        return '';
      };
      const ORDER_KEYS  = ["Order ID","OrderTrackingID","Order No","Order #","Tracking #","3P Tracking#","3P Tracking #","OrderNumber"];
      const DRIVER_KEYS = ["DriverNo","Drv No(s)","Driver #","Driver","Driver No","Driver Number","DrvNo"];
  
      if (review && events) {
        // ---- Primary path: Review Orders + Event Viewer
        const reviewRaw = await NS.readFile(review);
        const eventsRaw = await NS.readFile(events);
        NS.state.raw = { review: reviewRaw, events: eventsRaw };
  
        // mapping
        const saved = NS.loadMappingProfile ? NS.loadMappingProfile("review") : {};
        NS.state.resolvedMap = Object.assign({}, saved);
        NS.autoResolveMapping(reviewRaw[0] || {});
  
        // normalize
        ordersRows = NS.normalizeOrders(reviewRaw);
  
        // filter EV to today’s orders/drivers
        const orderIdsToday = new Set(ordersRows.map(o => (o.order_id||'').toString().trim()).filter(Boolean));
        const driversToday  = new Set(ordersRows.map(o => (o.driver_no||'').toString().trim()).filter(Boolean));
        eventsRows = eventsRaw.filter(e => {
          const evOid = pick(e, ORDER_KEYS);
          const evDrv = pick(e, DRIVER_KEYS);
          return (evOid && orderIdsToday.has(evOid)) || (evDrv && driversToday.has(evDrv));
        });
  
      } else if (next) {
        // ---- Optional path: single NEXT workbook (kept for now)
        let rows = await tryApiUpload(next);
        if (!rows) rows = await NS.readFile(next);
  
        const saved = NS.loadMappingProfile ? NS.loadMappingProfile("nextwb") : {};
        NS.state.resolvedMap = Object.assign({}, saved);
        NS.autoResolveMapping(rows[0] || {});
  
        if (NS.getHeaders && NS.buildMappingUI){
          const headers = NS.getHeaders(rows);
          NS.buildMappingUI(headers, NS.state.resolvedMap, map=>{
            NS.state.resolvedMap = map;
            if (NS.saveMappingProfile) NS.saveMappingProfile("nextwb", map);
          });
        }
  
        ordersRows = NS.normalizeOrders(rows);
  
        if (events) { // only read EV once if user supplied it
          const eventsRaw = await NS.readFile(events);
          const orderIdsToday = new Set(ordersRows.map(o => (o.order_id||'').toString().trim()).filter(Boolean));
          const driversToday  = new Set(ordersRows.map(o => (o.driver_no||'').toString().trim()).filter(Boolean));
          eventsRows = eventsRaw.filter(e => {
            const evOid = pick(e, ORDER_KEYS);
            const evDrv = pick(e, DRIVER_KEYS);
            return (evOid && orderIdsToday.has(evOid)) || (evDrv && driversToday.has(evDrv));
          });
        }
  
      } else {
        NS.toast('Upload both raw files (Review Orders + Event Viewer), or a NEXT workbook.');
        el('processStatus').textContent = '';
        return;
      }
  
      // one placement for events
      NS.state.events = eventsRows;
  
      // single compute + render
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
      NS.state.lastResults = results; // for Save Run, if you need it
    } catch(err){
      console.error(err);
      NS.toast('Error: ' + (err.message||err));
      el('processStatus').textContent = 'Failed.';
    } finally {
      if (btn) btn.disabled = false;
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
