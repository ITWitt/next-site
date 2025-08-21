import XLSX from "xlsx";

function getPrincipal(req) {
  const b64 = req.headers["x-ms-client-principal"];
  if (!b64) return null;
  try { return JSON.parse(Buffer.from(b64, "base64").toString("utf8")); }
  catch { return null; }
}

export default async function (context, req) {
  if (req.method === "OPTIONS") {
    context.res = { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } };
    return;
  }

  try {
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buf.length) throw new Error("No file body. POST the file as the request body.");

    const wb = XLSX.read(buf, { type: "buffer" });
    const sheet = wb.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "" });

    const principal = getPrincipal(req);
    context.res = {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        ok: true,
        actor: principal?.userDetails || null,
        sheet,
        preview: rows.slice(0, 100),
        totalRows: rows.length
      })
    };
  } catch (e) {
    context.res = { status: 400, headers: { "Access-Control-Allow-Origin": "*" }, body: JSON.stringify({ ok: false, error: String(e.message || e) }) };
  }
}
