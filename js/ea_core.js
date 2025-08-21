// Core: parsing, mapping, normalization
window.NEXT = window.NEXT || {};
(function(NS){
  NS.state = {
    bizDate: null,
    drivers: [],
    raw: { nextWb: null, review: null, events: null },
    orders: [],
    events: [],
    duplicatesRemoved: 0,
    mapping: {
      order_id: ["OrderTrackingID","Order No","Order #","3P Tracking#","Tracking #","Order ID"],
      driver_no: ["DriverNo","Drv No(s)","Driver #","Driver"],
      signature_raw: ["Signature","Recipient","SIG"],
      gps_status: ["GPS","gps","GPS Status"],
      center: ["Delivery Center","Center"],
      pod_datetime: ["POD DateTime","POD Date","POD Time"],
      company_name: ["Company Name","Account","Customer"]
    },
    resolvedMap: {}
  };

  const normalizeHeader = h => (h||"").toString().trim().toLowerCase();
  const pick = (row, names) => {
    for (const n of names) {
      if (n in row && row[n] !== undefined) return row[n];
      const k = Object.keys(row).find(k => normalizeHeader(k) === normalizeHeader(n));
      if (k) return row[k];
    }
    return undefined;
  };

  NS.setBizDate = (iso) => { NS.state.bizDate = iso; };
  NS.setDrivers = (list) => { NS.state.drivers = list; };

  // Parse CSV or XLSX into array of objects
  NS.readFile = async function(file){
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
      return new Promise((resolve, reject)=>{
        Papa.parse(file, { header: true, skipEmptyLines: true, complete: res => resolve(res.data), error: reject });
      });
    }
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, {type:'array'});
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
    return json;
  };

  // Detect mapping by synonyms seen in the first row
  NS.autoResolveMapping = function(sampleRow){
    const map = {};
    for (const [canon, synonyms] of Object.entries(NS.state.mapping)){
      const keys = Object.keys(sampleRow||{});
      const found = keys.find(k => synonyms.map(s=>normalizeHeader(s)).includes(normalizeHeader(k)));
      if (found) map[canon] = found;
    }
    NS.state.resolvedMap = map;
    return map;
  };

  // Normalize an Orders table given raw rows
  NS.normalizeOrders = function(rows){
    const out = [];
    const seen = new Set();
    let dupes = 0;
    for (const r of rows){
      const get = (canon)=> {
        const key = NS.state.resolvedMap[canon];
        if (key && r[key] !== undefined) return r[key];
        return pick(r, NS.state.mapping[canon]||[]);
      };

      const order_id = (get('order_id')||"").toString().trim();
      if (!order_id) continue;
      if (seen.has(order_id)) { dupes++; continue; }
      seen.add(order_id);

      out.push({
        order_id,
        driver_no: (get('driver_no')||"").toString().trim(),
        driver_name: (r['Driver Name']||r['DriverName']||""),
        pod_datetime: get('pod_datetime')||"",
        gps_status: get('gps_status'),
        signature_raw: get('signature_raw')||"",
        center: get('center')||"",
        company_name: get('company_name')||""
      });
    }
    NS.state.duplicatesRemoved = dupes;
    return out;
  };
  // Return unique headers from a sample of rows
  window.NEXT.getHeaders = function(rows) {
    if (!rows || !rows.length) return [];
    const keys = new Set();
    for (const r of rows.slice(0, 10)) Object.keys(r).forEach(k => keys.add(k));
    return Array.from(keys).sort();
  };
  
  // Persist & load mapping profiles (two types supported)
  const MAP_KEYS = { nextwb: "next_map_nextwb", review: "next_map_review" };
  
  window.NEXT.saveMappingProfile = function(type, map) {
    localStorage.setItem(MAP_KEYS[type], JSON.stringify(map||{}));
  };
  
  window.NEXT.loadMappingProfile = function(type) {
    try { return JSON.parse(localStorage.getItem(MAP_KEYS[type])||"{}"); }
    catch { return {}; }
  };

})(window.NEXT);
