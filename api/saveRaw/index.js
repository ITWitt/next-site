import { BlobServiceClient } from "@azure/storage-blob";

function ok(res, body, headers = {}) {
  res.status = 200; res.headers = { "Content-Type":"application/json", ...headers };
  res.body = JSON.stringify(body);
}
function cors(res, code=204){ res.status = code; res.headers = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"*" }; }

export default async function (context, req) {
  if (req.method === "OPTIONS") { cors(context.res); return; }

  try {
    const conn = process.env.BLOB_CONN;
    if (!conn) throw new Error("Missing BLOB_CONN");
    const bsc = BlobServiceClient.fromConnectionString(conn);

    // Expect ?date=YYYY-MM-DD&kind=review|events&filename=YourFile.xlsx
    const q = req.query || {};
    const bizDate = (q.date || "").trim();
    const kind = (q.kind || "").trim();         // e.g., "review" or "events"
    const filename = (q.filename || "upload.bin").replace(/[^A-Za-z0-9._-]/g, "_");

    if (!bizDate || !kind) throw new Error("Query params required: date, kind");
    const container = bsc.getContainerClient("next");
    await container.createIfNotExists();

    const blobPath = `raw/${bizDate}/${kind}/${Date.now()}_${filename}`;
    const block = container.getBlockBlobClient(blobPath);

    // Body as bytes
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    if (!buf.length) throw new Error("No file body");

    await block.uploadData(buf, { blobHTTPHeaders: { blobContentType: req.headers["content-type"] || "application/octet-stream" }});

    ok(context.res, { ok:true, blobPath });
  } catch (e) {
    context.res = { status: 400, headers: { "Content-Type":"application/json" }, body: JSON.stringify({ ok:false, error: String(e.message||e) }) };
  }
}
