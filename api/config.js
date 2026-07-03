const { getSetting, send, supabase } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
    let pixels = [];
    let advancedOffers = [];
    try {
      pixels = await supabase("checkout_pixels?enabled=eq.true&select=id,platform,name,pixel_id,events");
    } catch (_) {}
    try {
      const rows = await supabase("checkout_offers?status=eq.active&select=*&order=created_at.asc");
      advancedOffers = rows
        .filter((offer) => ["order_bump", "checkout", "cart"].includes(offer.type) || ["checkout", "cart"].includes(offer.placement))
        .map((offer) => ({
          id: offer.id,
          name: offer.title,
          description: offer.description,
          price: offer.price,
          compareAtPrice: offer.compare_at_price,
          image: offer.image,
          enabled: offer.status === "active",
          placement: offer.placement,
          maxQuantity: offer.max_quantity,
        }));
    } catch (_) {}

    const legacyOffers = await getSetting("offers");
    const branding = await getSetting("branding");
    if (!branding.primaryColor || branding.primaryColor.toLowerCase() === "#e7425d" || branding.primaryColor.toLowerCase() === "#fe2c55") branding.primaryColor = "#FE2C56";
    if (!branding.buttonColor || branding.buttonColor.toLowerCase() === "#e7425d" || branding.buttonColor.toLowerCase() === "#fe2c55") branding.buttonColor = "#FE2C56";
    send(res, 200, {
      product: await getSetting("product"),
      checkout: await getSetting("checkout"),
      branding,
      offers: advancedOffers.length ? advancedOffers : legacyOffers,
      pixels,
    });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
