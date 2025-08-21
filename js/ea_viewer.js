(function(NS){
  const host = () => document.getElementById('mappingPanel');

  NS.buildMappingUI = function(headers, currentMap, onSave) {
    const CANON = [
      ["order_id","Order ID"],
      ["driver_no","Driver #"],
      ["signature_raw","Signature"],
      ["gps_status","GPS"],
      ["center","Center"],
      ["pod_datetime","POD Date/Time"],
      ["company_name","Company/Account"]
    ];

    const opts = h => ['<option value="">(unmapped)</option>']
      .concat(h.map(x => `<option value="${x}">${x}</option>`)).join('');

    const rows = CANON.map(([key,label]) => `
      <div class="grid cols-3" style="align-items:center;">
        <div class="small">${label}</div>
        <div><select id="map_${key}">${opts(headers)}</select></div>
        <div class="small">${currentMap[key]||""}</div>
      </div>`).join('');

    host().innerHTML = `
      <div class="card">
        <h3>Field Mapping</h3>
        ${rows}
        <div style="margin-top:10px;">
          <button id="mapSave">Save Mapping</button>
          <span class="small" id="mapStatus"></span>
        </div>
      </div>`;

    // preselect
    for (const [k,v] of Object.entries(currentMap||{})) {
      const sel = document.getElementById(`map_${k}`);
      if (sel && v) sel.value = v;
    }

    document.getElementById('mapSave').onclick = () => {
      const result = {};
      CANON.forEach(([k]) => {
        const v = document.getElementById(`map_${k}`).value;
        if (v) result[k] = v;
      });
      onSave(result);
      document.getElementById('mapStatus').textContent = 'Saved.';
      setTimeout(()=>document.getElementById('mapStatus').textContent='',1500);
    };
  };
})(window.NEXT);
