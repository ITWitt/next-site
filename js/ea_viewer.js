(function (NS) {
  // Fallback toast so app.js never explodes if you haven’t themed a toaster yet
  NS.toast = NS.toast || (msg => alert(msg));

  // KPI cards – uses IDs from your markup
  NS.renderKPIs = NS.renderKPIs || function (k) {
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = (v ?? '—'); };
    set('kpiTotal',  k?.total);
    set('kpiSig%',   k?.sigPct);          // keep your existing id
    set('kpiGPS',    k?.gpsZeros);
    set('kpiDupes',  k?.duplicatesRemoved);
  };

  // Drivers leaderboard table (tbody id="driversTable")
  NS.renderDrivers = NS.renderDrivers || function (rows) {
    const tbody = document.querySelector('#driversTable tbody'); if (!tbody) return;
    tbody.innerHTML = '';
    (rows || []).forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.driver ?? ''}</td>
        <td>${r.orders ?? 0}</td>
        <td>${r.sigPct ?? 0}%</td>
        <td>${r.gps0 ?? 0}</td>`;
      tbody.appendChild(tr);
    });
  };

  // Exceptions table (tbody id="exceptionsTable")
  NS.renderExceptions = NS.renderExceptions || function (rows) {
    const tbody = document.querySelector('#exceptionsTable tbody'); if (!tbody) return;
    tbody.innerHTML = '';
    (rows || []).forEach(x => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${x.order_id ?? ''}</td>
        <td>${x.driver ?? ''}</td>
        <td>${x.issue ?? ''}</td>
        <td>${x.details ?? ''}</td>`;
      tbody.appendChild(tr);
    });
  };

  // Validation panel – harmless no-op if you don’t render anything here yet
  NS.renderValidation = NS.renderValidation || function (_checks) {};
})(window.NEXT);
