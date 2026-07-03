const { readBody, send, supabase } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const event = await readBody(req);
    const transactionId = event.Id || event.id;
    const externalId = event.ExternalId || event.external_id;
    const status = event.Status || event.status;

    if (transactionId || externalId) {
      const filters = [];
      if (transactionId) filters.push(`freepay_transaction_id.eq.${encodeURIComponent(transactionId)}`);
      if (externalId) filters.push(`external_order_id.eq.${encodeURIComponent(externalId)}`);
      await supabase(`checkout_orders?or=(${filters.join(",")})`, {
        method: "PATCH",
        body: JSON.stringify({ status, updated_at: new Date().toISOString(), raw_gateway_response: event }),
      });
    }

    send(res, 200, { ok: true });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
