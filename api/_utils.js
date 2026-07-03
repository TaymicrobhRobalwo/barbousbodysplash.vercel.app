const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || process.env.ADMIN_PASSWORD;

const defaults = {
  product: {
    storeName: "Barbour's Beauty",
    productName: "Kit 4 Body Splash Barbours Beauty 200ml | Delight + Very Sexy + Roses + Good Grace",
    price: 9749,
    compareAtPrice: 29900,
    image: "IMG_2103.jpg",
    quantity: 1,
    expirationMinutes: 20,
  },
  gateway: {
    providerName: "Elly Perfumaria",
    postbackUrl: "https://6a4437ee-6a2c-83e9-4571-7d0fa732u9e.vercel.app/api/freepay",
    pixExpiresInDays: 1,
  },
  offers: [
    { id: "my-sweet-delight", name: "Essential Body Cream - My Sweet Delight 230g", price: 1990, compareAtPrice: 3990, image: "IMG_2112.PNG.png", enabled: true },
    { id: "very-sexy", name: "Essential Body Cream - Very Sexy 230g", price: 1990, compareAtPrice: 3990, image: "IMG_2112.PNG.png", enabled: true },
    { id: "roses", name: "Essential Body Cream - Roses 230g", price: 1990, compareAtPrice: 3990, image: "IMG_2112.PNG.png", enabled: true },
    { id: "good-graces", name: "Essential Body Cream - Good Graces 230g", price: 1990, compareAtPrice: 3990, image: "IMG_2112.PNG.png", enabled: true },
  ],
};

function send(res, status, data) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(data));
}

function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) {
    send(res, 500, { error: "ADMIN_TOKEN is not configured" });
    return false;
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    send(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase error ${response.status}`);
  }
  return data;
}

async function getSetting(key) {
  try {
    const rows = await supabase(`checkout_settings?key=eq.${encodeURIComponent(key)}&select=value&limit=1`);
    return rows?.[0]?.value ?? defaults[key];
  } catch (error) {
    if (process.env.NODE_ENV !== "production") return defaults[key];
    throw error;
  }
}

async function setSetting(key, value) {
  return supabase("checkout_settings?on_conflict=key", {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
}

function cents(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? number : Math.round(number * 100);
}

function formatPublicId() {
  return `ORD-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function pickPix(transaction) {
  const data = Array.isArray(transaction?.data) ? transaction.data[0] : transaction?.data || transaction;
  const pix = Array.isArray(data?.pix) ? data.pix[0] : data?.pix || {};
  return {
    transaction: data || transaction,
    id: data?.id || transaction?.id,
    status: data?.status || transaction?.status || "PENDING",
    qrCode: pix?.qr_code || pix?.qrcode || pix?.copy_paste || pix?.emv || "",
    url: pix?.url || "",
    expiresAt: pix?.expiration_date || null,
  };
}

module.exports = {
  cents,
  defaults,
  digits,
  formatPublicId,
  getSetting,
  pickPix,
  readBody,
  requireAdmin,
  send,
  setSetting,
  supabase,
};
