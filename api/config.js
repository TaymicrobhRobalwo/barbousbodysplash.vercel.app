const { getSetting, send, supabase } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
    let pixels = [];
    try {
      pixels = await supabase("checkout_pixels?enabled=eq.true&select=id,platform,name,pixel_id,events");
    } catch (_) {}
    send(res, 200, {
      product: await getSetting("product"),
      offers: await getSetting("offers"),
      pixels,
    });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
