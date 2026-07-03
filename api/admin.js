const { getSetting, readBody, requireAdmin, send, setSetting, supabase } = require("./_utils");

const resources = {
  products: "checkout_products",
  offers_v2: "checkout_offers",
  gateways: "checkout_gateways",
  integrations: "checkout_integrations",
  shipments: "checkout_shipments",
  customers: "checkout_customers",
  logs: "checkout_logs",
  admin_users: "checkout_admin_users",
  activity: "checkout_activity_logs",
};

function enc(value) {
  return encodeURIComponent(String(value));
}

function sum(rows, pick) {
  return rows.reduce((total, row) => total + Number(pick(row) || 0), 0);
}

function dayKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function dashboard() {
  let orders = [];
  let logs = [];
  try { orders = await supabase("checkout_orders?select=*&order=created_at.desc&limit=1000"); } catch (_) {}
  try { logs = await supabase("checkout_logs?select=*&order=created_at.desc&limit=80"); } catch (_) {}

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const since7 = new Date(now.getTime() - 7 * 86400000);
  const paid = orders.filter((order) => ["PAID", "paid", "APPROVED"].includes(order.status));
  const pending = orders.filter((order) => ["PENDING", "pending", "CREATED"].includes(order.status));
  const expired = orders.filter((order) => ["EXPIRED", "expired"].includes(order.status));
  const paidToday = paid.filter((order) => dayKey(order.created_at) === today);
  const paid7 = paid.filter((order) => new Date(order.created_at) >= since7);
  const revenue = sum(paid, (order) => order.amount);
  const visitors = new Set(orders.map((order) => order.customer?.email || order.customer?.phone || order.public_id)).size;
  const series = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 86400000);
    const key = dayKey(date);
    return { date: key, revenue: sum(paid.filter((order) => dayKey(order.created_at) === key), (order) => order.amount), orders: orders.filter((order) => dayKey(order.created_at) === key).length };
  });

  return {
    metrics: {
      revenue,
      todayRevenue: sum(paidToday, (order) => order.amount),
      sevenDayRevenue: sum(paid7, (order) => order.amount),
      paidOrders: paid.length,
      pendingOrders: pending.length,
      conversionRate: orders.length ? Math.round((paid.length / orders.length) * 1000) / 10 : 0,
      averageTicket: paid.length ? Math.round(revenue / paid.length) : 0,
      uniqueVisitors: visitors,
      pixGenerated: orders.length,
      pixPaid: paid.length,
      pixExpired: expired.length,
      checkoutAbandonment: orders.length ? Math.round((pending.length / orders.length) * 1000) / 10 : 0,
    },
    charts: {
      salesByDay: series,
      ordersByStatus: Object.entries(orders.reduce((acc, order) => { acc[order.status] = (acc[order.status] || 0) + 1; return acc; }, {})).map(([status, count]) => ({ status, count })),
      conversionBySource: [],
      salesByProduct: [],
      utmPerformance: [],
      peakHours: [],
    },
    recent: {
      orders: orders.slice(0, 8),
      logs: logs.slice(0, 8),
    },
  };
}

async function listResource(name) {
  const table = resources[name];
  if (!table) throw new Error("Unknown resource");
  const order = name === "logs" || name === "activity" ? "created_at.desc" : "updated_at.desc";
  return supabase(`${table}?select=*&order=${order}&limit=500`);
}

async function upsertResource(name, payload) {
  const table = resources[name];
  if (!table) throw new Error("Unknown resource");
  const body = { ...payload, updated_at: new Date().toISOString() };
  if (payload.id) {
    const id = payload.id;
    delete body.id;
    const rows = await supabase(`${table}?id=eq.${enc(id)}`, { method: "PATCH", body: JSON.stringify(body) });
    return rows[0];
  }
  const rows = await supabase(table, { method: "POST", body: JSON.stringify(body) });
  return rows[0];
}

async function deleteResource(name, id) {
  const table = resources[name];
  if (!table) throw new Error("Unknown resource");
  await supabase(`${table}?id=eq.${enc(id)}`, { method: "DELETE" });
  return { ok: true };
}

module.exports = async function handler(req, res) {
  try {
    if (!requireAdmin(req, res)) return;
    const url = new URL(req.url, "http://localhost");
    const action = url.searchParams.get("action") || "dashboard";

    if (req.method === "GET" && action === "dashboard") return send(res, 200, await dashboard());
    if (req.method === "GET" && action === "settings") {
      const keys = ["store", "product", "checkout", "branding", "gateway", "gateway_names", "appearance", "integrations", "system", "offers"];
      const data = {};
      for (const key of keys) data[key] = await getSetting(key);
      return send(res, 200, data);
    }
    if (req.method === "POST" && action === "settings") {
      const body = await readBody(req);
      for (const [key, value] of Object.entries(body)) await setSetting(key, value);
      return send(res, 200, { ok: true });
    }
    if (req.method === "GET" && action === "list") return send(res, 200, await listResource(url.searchParams.get("resource")));
    if (req.method === "POST" && action === "upsert") return send(res, 200, await upsertResource(url.searchParams.get("resource"), await readBody(req)));
    if (req.method === "DELETE" && action === "delete") return send(res, 200, await deleteResource(url.searchParams.get("resource"), url.searchParams.get("id")));
    if (req.method === "POST" && action === "test") {
      const body = await readBody(req);
      try {
        await supabase("checkout_logs", { method: "POST", body: JSON.stringify({ type: body.type || "test", level: "info", source: body.source || "admin", message: body.message || "Teste executado", payload: body }) });
      } catch (_) {}
      return send(res, 200, { ok: true, status: "success", checkedAt: new Date().toISOString(), echo: body });
    }
    send(res, 404, { error: "Action not found" });
  } catch (error) {
    send(res, 500, { error: error.message });
  }
};
