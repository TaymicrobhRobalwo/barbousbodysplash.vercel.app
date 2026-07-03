const { requireAdmin, send, supabase } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
    const rows = await supabase("checkout_orders?select=*&order=created_at.desc&limit=200");
    send(res, 200, rows);
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
