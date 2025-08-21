// UI rendering helpers
(function(NS){
  const el = (id)=> document.getElementById(id);

  NS.renderValidation = function(items){
    const host = document.getElementById('validationPanel');
    host.innerHTML = items.map(({label,ok})=>`<div class="card"><h3>${label}</h3><div>${ ok? '✅ OK' : '⚠️ Check'}</div></div>`).join('');
  };

  NS.renderKPIs = function(k){
    el('kpiTotal').textContent = k.total;
    el('kpiSig').textContent = (k.sigPct||0) + '%';
    el('kpiGPS').textContent = k.gpsZeros;
    el('kpiDupes').textContent = k.duplicatesRemoved;
  };

  NS.renderDrivers = function(rows){
    const tbody = document.querySelector('#driversTable tbody');
    tbody.innerHTML = rows.map(r=>`<tr><td>${r.driver}</td><td>${r.orders}</td><td>${r.sigPct}%</td><td>${r.gps0}</td></tr>`).join('');
  };

  NS.renderExceptions = function(rows){
    const tbody = document.querySelector('#exceptionsTable tbody');
    tbody.innerHTML = rows.map(r=>`<tr><td>${r.order_id}</td><td>${r.driver}</td><td>${r.issue}</td><td>${r.details||''}</td></tr>`).join('');
  };

  NS.toast = function(msg){
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display='block';
    setTimeout(()=> t.style.display='none', 3000);
  };
})(window.NEXT);
