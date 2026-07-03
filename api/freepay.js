const { readBody, sanitizeGatewayData, send, supabase } = require("./_utils");

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return send(res, 200, {
        ok: true,
        service: "freepay-webhook",
        message: "Webhook ativo. A Freepay deve enviar eventos via POST para esta URL.",
      });
    }
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
    const event = await readBody(req);
    const transactionId = event.Id || event.id || event.TransactionId || event.transaction_id || event.transactionId;
    const externalId = event.ExternalId || event.external_id || event.externalId || event.ExternalRef || event.external_ref || event.externalRef;
    const status = event.Status || event.status || event.PaymentStatus || event.payment_status || event.paymentStatus;
    const safeEvent = sanitizeGatewayData(event);

    if (transactionId || externalId) {
      const filters = [];
      if (transactionId) filters.push(`freepay_transaction_id.eq.${encodeURIComponent(transactionId)}`);
      if (externalId) filters.push(`external_order_id.eq.${encodeURIComponent(externalId)}`);
      await supabase(`checkout_orders?or=(${filters.join(",")})`, {
        method: "PATCH",
        body: JSON.stringify({ status, updated_at: new Date().toISOString(), raw_gateway_response: safeEvent }),
      });
    }

    send(res, 200, { ok: true });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
