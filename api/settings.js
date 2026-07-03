const { getSetting, readBody, requireAdmin, send, setSetting } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    if (req.method === "GET") {
      return send(res, 200, {
        product: await getSetting("product"),
        gateway: await getSetting("gateway"),
        offers: await getSetting("offers"),
      });
    }
    if (req.method === "POST") {
      const body = await readBody(req);
      for (const key of ["product", "gateway", "offers"]) {
        if (body[key] !== undefined) await setSetting(key, body[key]);
      }
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
