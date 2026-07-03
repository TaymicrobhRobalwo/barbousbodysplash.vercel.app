const {
  cents,
  digits,
  formatPublicId,
  getSetting,
  pickPix,
  readBody,
  sanitizeGatewayData,
  send,
  supabase,
} = require("./_utils");

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
}

async function callFreepay(payload, gateway) {
  const publicKey = gateway.publicKey || process.env.FREEPAY_PUBLIC_KEY;
  const secretKey = gateway.secretKey || process.env.FREEPAY_SECRET_KEY;
  if (!publicKey || !secretKey) throw new Error("Configure as chaves da Freepay no admin ou nas variáveis de ambiente.");

  const response = await fetch("https://api.freepaybrasil.com/v1/payment-transaction/create", {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${publicKey}:${secretKey}`).toString("base64"),
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.message || data?.error || `Freepay error ${response.status}`);
  return data;
}

function validateFreepayPayload(payload) {
  if (!payload.amount || payload.amount < 1) throw new Error("Valor do pedido inválido.");
  if (!payload.customer?.name) throw new Error("Nome do cliente é obrigatório.");
  if (!payload.customer?.email) throw new Error("E-mail do cliente é obrigatório.");
  if (!payload.customer?.document?.number) throw new Error("CPF do cliente é obrigatório.");
  if (!payload.customer?.phone) throw new Error("Telefone do cliente é obrigatório.");
  if (!payload.items?.length) throw new Error("Pedido sem itens.");

  if (payload.payment_method === "pix" && !payload.pix?.expires_in_days) {
    throw new Error("Configuração Pix inválida.");
  }

  if (payload.payment_method === "credit_card") {
    const card = payload.card || {};
    if (!card.number || !card.holder_name || !card.expiration_month || !card.expiration_year || !card.cvv) {
      throw new Error("Dados do cartão incompletos.");
    }
  }
}

async function getCheckoutOffers() {
  try {
    const rows = await supabase("checkout_offers?status=eq.active&select=*&order=created_at.asc");
    const mapped = rows
      .filter((offer) => ["order_bump", "checkout", "cart"].includes(offer.type) || ["checkout", "cart"].includes(offer.placement))
      .map((offer) => ({
        id: offer.id,
        name: offer.title,
        price: offer.price,
        compareAtPrice: offer.compare_at_price,
        image: offer.image,
        enabled: offer.status === "active",
      }));
    if (mapped.length) return mapped;
  } catch (_) {}
  return getSetting("offers");
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

    const body = await readBody(req);
    const product = await getSetting("product");
    const gateway = await getSetting("gateway");
    const checkout = await getSetting("checkout");
    const gatewayNames = await getSetting("gateway_names");
    const gatewayMasking = await getSetting("gateway_masking");
    const offers = await getCheckoutOffers();
    const paymentMethod = body.paymentMethod === "credit_card" ? "credit_card" : "pix";
    if (paymentMethod === "credit_card" && checkout.creditCardEnabled === false) {
      return send(res, 400, { error: "Pagamento por cartão está desativado." });
    }
    const selectedOfferIds = new Set(body.offerIds || []);
    const enabledOffers = (offers || []).filter((offer) => offer.enabled && selectedOfferIds.has(offer.id));
    const publicId = formatPublicId();
    const externalOrderId = gatewayMasking?.maskExternalOrderId === false
      ? `ORDER-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : publicId;
    const providerName = gatewayMasking?.providerName || gateway.providerName || "Elly Perfumaria";
    const customer = body.customer || {};
    const address = body.address || {};
    const itemRef = (index, fallback) => gatewayMasking?.maskItemRefs === false ? fallback : `ITEM-${index}`;

    const alternateNames = Array.isArray(gatewayNames?.names) ? [...new Set(gatewayNames.names.map((name) => String(name).trim()).filter(Boolean))] : [];
    const pickGatewayName = (realTitle) => gatewayNames?.enabled && alternateNames.length
      ? alternateNames[Math.floor(Math.random() * alternateNames.length)]
      : realTitle;

    const mainRealTitle = product.productName;
    const mainSentTitle = pickGatewayName(mainRealTitle);
    const mainItem = {
      title: mainSentTitle,
      unit_price: cents(product.price),
      quantity: Number(product.quantity || 1),
      tangible: true,
      external_ref: itemRef(1, publicId),
    };
    const offerItems = enabledOffers.map((offer, index) => ({
      title: pickGatewayName(offer.name),
      unit_price: cents(offer.price),
      quantity: 1,
      tangible: true,
      external_ref: itemRef(index + 2, `${publicId}-OFFER-${index + 1}`),
    }));
    const requestedInstallments = Math.max(1, Number(body.card?.installments || 1));
    const maxInstallments = Math.max(1, Number(checkout.creditCardMaxInstallments || 12));
    const installments = paymentMethod === "credit_card" ? Math.min(requestedInstallments, maxInstallments) : 1;
    const items = [mainItem, ...offerItems];
    const localItems = [
      { ...mainItem, real_title: mainRealTitle, sent_title: mainSentTitle },
      ...enabledOffers.map((offer, index) => ({ ...offerItems[index], real_title: offer.name, sent_title: offerItems[index].title })),
    ];
    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const shippingFee = 0;
    const installmentFee = paymentMethod === "credit_card" && installments > 1
      ? Math.round(subtotal * (Number(checkout.creditCardInstallmentFee || 0) / 100))
      : 0;
    if (installmentFee > 0) {
      const feeItem = {
        title: "Taxa de parcelamento",
        unit_price: installmentFee,
        quantity: 1,
        tangible: false,
        external_ref: itemRef(items.length + 1, `${publicId}-INSTALLMENT-FEE`),
      };
      items.push(feeItem);
      localItems.push({ ...feeItem, real_title: feeItem.title, sent_title: feeItem.title });
    }
    const amount = subtotal + shippingFee + installmentFee;

    const metadata = {
      provider_name: providerName,
      external_order_id: externalOrderId,
    };
    if (gatewayMasking?.sendUtmsToGateway === true) metadata.utms = body.utms || {};
    else if (gatewayMasking?.defaultUtm) metadata.utm_source = gatewayMasking.defaultUtm;

    const gatewayPayload = {
      amount,
      payment_method: paymentMethod,
      external_id: externalOrderId,
      external_ref: externalOrderId,
      postback_url: gateway.postbackUrl || "https://6a4437ee-6a2c-83e9-4571-7d0fa732u9e.vercel.app/api/freepay",
      customer: {
        name: customer.name,
        email: customer.noEmail ? `${publicId.toLowerCase()}@cliente.local` : customer.email,
        document: { number: digits(customer.cpf), type: "cpf" },
        phone: digits(customer.phone),
      },
      shipping: {
        fee: shippingFee,
        address: {
          street: address.street,
          street_number: address.number || "S/N",
          complement: address.complement || "",
          zip_code: digits(address.cep),
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          country: "BR",
        },
      },
      items,
      metadata: JSON.stringify(metadata),
      ip: getClientIp(req),
    };

    if (paymentMethod === "pix") {
      gatewayPayload.pix = { expires_in_days: Number(gateway.pixExpiresInDays || 1) };
    } else {
      const card = body.card || {};
      gatewayPayload.card = {
        number: digits(card.number),
        holder_name: card.holder_name,
        expiration_month: Number(card.expiration_month),
        expiration_year: Number(card.expiration_year),
        cvv: digits(card.cvv),
      };
      gatewayPayload.installments = installments;
    }

    validateFreepayPayload(gatewayPayload);

    const gatewayResponse = await callFreepay(gatewayPayload, gateway);
    const safeGatewayResponse = sanitizeGatewayData(gatewayResponse);
    const pix = pickPix(gatewayResponse);

    await supabase("checkout_orders", {
      method: "POST",
      body: JSON.stringify({
        public_id: publicId,
        external_order_id: externalOrderId,
        provider: providerName,
        status: pix.status || "PENDING",
        amount,
        subtotal,
        shipping_fee: shippingFee,
        payment_method: paymentMethod,
        freepay_transaction_id: pix.id,
        pix_code: pix.qrCode,
        pix_url: pix.url,
        pix_expires_at: pix.expiresAt,
        customer,
        shipping_address: address,
        items: localItems,
        utms: body.utms || {},
        raw_gateway_response: safeGatewayResponse,
      }),
    });

    try {
      await supabase("checkout_logs", {
        method: "POST",
        body: JSON.stringify({
          type: "gateway",
          level: "info",
          source: "freepay",
          order_public_id: publicId,
          message: paymentMethod === "pix" ? "Transação Pix criada" : "Transação cartão criada",
          payload: {
            providerName,
            masking: {
              sendUtmsToGateway: gatewayMasking?.sendUtmsToGateway === true,
              maskExternalOrderId: gatewayMasking?.maskExternalOrderId !== false,
              maskItemRefs: gatewayMasking?.maskItemRefs !== false,
              defaultUtm: gatewayMasking?.defaultUtm || "",
            },
            item_name_map: localItems.map((item) => ({ real_title: item.real_title, sent_title: item.sent_title, external_ref: item.external_ref })),
          },
          response: safeGatewayResponse,
          status_code: 200,
        }),
      });
    } catch (_) {}

    send(res, 200, {
      orderId: publicId,
      status: pix.status,
      amount,
      paymentMethod,
      pixCode: pix.qrCode,
      pixUrl: pix.url,
      expiresAt: pix.expiresAt,
    });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
