const { readBody, sanitizeGatewayData, send, sendToUtmify, supabase } = require("./_utils");

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
      const orClause = `or=(${filters.join(",")})`;
      await supabase(`checkout_orders?${orClause}`, {
        method: "PATCH",
        body: JSON.stringify({ status, updated_at: new Date().toISOString(), raw_gateway_response: safeEvent }),
      });

      try {
        const rows = await supabase(`checkout_orders?${orClause}&select=*`);
        if (rows?.[0]) {
          await sendToUtmify(rows[0]);
        }
      } catch (_) {
        try {
          await supabase("checkout_logs", {
            method: "POST",
            body: JSON.stringify({
              type: "utmify",
              level: "error",
              source: "utmify",
              message: "Erro ao atualizar pedido na UTMify",
              payload: { transactionId, externalId, status },
              status_code: 400,
            }),
          });
        } catch (__) {}
      }
    }

    send(res, 200, { ok: true });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
