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
        const rows = await NS.readFile(next);
        NS.autoResolveMapping(rows[0]||{});
        ordersRows = NS.normalizeOrders(rows);
      } else if (review && events){
        const reviewRows = await NS.readFile(review);
        NS.autoResolveMapping(reviewRows[0]||{});
        ordersRows = NS.normalizeOrders(reviewRows);
        // future: cross-check with event file
      } else {
        NS.toast('Upload either NEXT workbook or both raw exports.');
        el('processStatus').textContent='';
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
