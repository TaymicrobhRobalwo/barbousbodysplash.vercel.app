const { readBody, requireAdmin, send, supabase } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    if (req.method === "GET") {
      return send(res, 200, await supabase("checkout_pixels?select=*&order=created_at.desc"));
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      const payload = { ...body, updated_at: new Date().toISOString() };
      const rows = await supabase("checkout_pixels", { method: "POST", body: JSON.stringify(payload) });
      return send(res, 200, rows[0]);
    }
    if (req.method === "PUT") {
      const body = await readBody(req);
      const { id, ...rest } = body;
      const rows = await supabase(`checkout_pixels?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ ...rest, updated_at: new Date().toISOString() }),
      });
      return send(res, 200, rows[0]);
    }
    if (req.method === "DELETE") {
      const id = new URL(req.url, "http://localhost").searchParams.get("id");
      await supabase(`checkout_pixels?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
