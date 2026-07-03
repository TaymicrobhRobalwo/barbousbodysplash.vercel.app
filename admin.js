const state = {
  token: localStorage.getItem("admin_token") || "",
  view: localStorage.getItem("admin_view") === "products" ? "store" : (localStorage.getItem("admin_view") || "dashboard"),
  settings: {},
  dashboard: null,
  cache: {},
  pixels: [],
  dirty: false,
};

const menus = [
  ["dashboard", "Dashboard", "◈", "Visão geral da operação"],
  ["store", "Página / Checkout", "⚙", "Oferta principal, formulário e pagamento"],
  ["offers", "Ofertas", "✦", "Order bumps, upsells e kits"],
  ["orders", "Pedidos", "▤", "Gestão de pedidos"],
  ["gateway", "Gateways", "◆", "Freepay, mascaramento e logs"],
  ["integrations", "Integrações", "↗", "Pixels, UTMify, webhooks e scripts"],
  ["logistics", "Logística", "▣", "Envios e rastreios"],
  ["customers", "Clientes", "◉", "Compradores e histórico"],
  ["reports", "Relatórios", "▥", "Métricas e exportações"],
  ["appearance", "Aparência", "◐", "Tema, textos e conteúdo"],
  ["users", "Usuários/Admins", "◇", "Permissões e acessos"],
  ["system", "Sistema", "⌘", "Logs, segurança e backup"],
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (cents = 0) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (value = "") => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const fmtDate = (value) => value ? new Date(value).toLocaleString("pt-BR") : "-";
const uid = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.textContent = message;
  $("#toastRoot").appendChild(node);
  setTimeout(() => node.remove(), 3800);
}

function setLoading(button, loading, label = "Salvar") {
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? "Salvando..." : label;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", authorization: `Bearer ${state.token}`, ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}

const adminApi = (params, options = {}) => api(`/api/admin?${new URLSearchParams(params)}`, options);

async function validateLogin(candidate, persist = false) {
  if (!candidate) return showLogin();
  const previous = state.token;
  state.token = candidate;
  try {
    state.settings = await adminApi({ action: "settings" });
    if (persist) localStorage.setItem("admin_token", state.token);
    $("#loginError").classList.add("hidden");
    document.body.classList.remove("auth-pending");
    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    renderShell();
    await renderView(state.view);
  } catch (_) {
    state.token = previous;
    localStorage.removeItem("admin_token");
    showLogin("Acesso negado");
  }
}

function showLogin(error) {
  document.body.classList.add("auth-pending");
  $("#login").classList.remove("hidden");
  $("#app").classList.add("hidden");
  if (error) {
    $("#loginError").textContent = error;
    $("#loginError").classList.remove("hidden");
  }
}

function renderShell() {
  $("#sideNav").innerHTML = menus.map(([id, label, icon]) => `<button class="nav-item ${state.view === id ? "active" : ""}" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join("");
  $$(".nav-item").forEach((button) => button.onclick = () => navigate(button.dataset.view));
}

async function navigate(view) {
  if (state.dirty && !confirm("Existem alterações não salvas. Deseja sair mesmo assim?")) return;
  state.view = view;
  state.dirty = false;
  localStorage.setItem("admin_view", view);
  document.body.classList.remove("drawer-open");
  renderShell();
  await renderView(view);
}

function header(title, description, actions = "") {
  $("#breadcrumbs").textContent = `Painel / ${title}`;
  $("#viewHeader").innerHTML = `<div class="view-title"><h1>${title}</h1><p>${description}</p></div><div class="header-actions">${actions}</div>`;
}

function skeleton() {
  $("#viewRoot").innerHTML = `<div class="grid grid-4"><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div><div class="card skeleton"></div></div><div class="card skeleton" style="height:320px;margin-top:18px"></div>`;
}

async function renderView(view) {
  skeleton();
  const routes = { dashboard: renderDashboard, store: renderStore, offers: renderOffers, orders: renderOrders, gateway: renderGateway, integrations: renderIntegrations, logistics: renderLogistics, customers: renderCustomers, reports: renderReports, appearance: renderAppearance, users: renderUsers, system: renderSystem };
  await (routes[view] || renderDashboard)();
}

async function refreshSettings() {
  state.settings = await adminApi({ action: "settings" });
}

async function saveSettings(keys, button) {
  setLoading(button, true);
  try {
    await adminApi({ action: "settings" }, { method: "POST", body: JSON.stringify(keys) });
    state.settings = { ...state.settings, ...keys };
    state.dirty = false;
    toast("Configurações salvas com sucesso");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoading(button, false);
  }
}

function metric(label, value, help = "") {
  return `<article class="card metric"><span>${label}</span><strong>${value}</strong><small>${help || "Atualizado agora"}</small></article>`;
}

async function renderDashboard() {
  header("Dashboard", "Visão geral da operação, pedidos, Pix, conversão e atividade recente.", `<button class="secondary-action" id="reloadDash">Atualizar</button>`);
  state.dashboard = await adminApi({ action: "dashboard" });
  const m = state.dashboard.metrics;
  $("#viewRoot").innerHTML = `
    <section class="grid grid-4">
      ${metric("Faturamento total", money(m.revenue), `${m.paidOrders} pedidos pagos`)}
      ${metric("Hoje", money(m.todayRevenue), "Faturamento do dia")}
      ${metric("Últimos 7 dias", money(m.sevenDayRevenue), "Receita recente")}
      ${metric("Taxa de conversão", `${m.conversionRate}%`, "Pedidos pagos / gerados")}
      ${metric("Ticket médio", money(m.averageTicket), "Média de pedidos pagos")}
      ${metric("Pix gerados", m.pixGenerated, `${m.pixPaid} pagos`)}
      ${metric("Pix expirados", m.pixExpired, "Monitoramento Pix")}
      ${metric("Abandono", `${m.checkoutAbandonment}%`, `${m.pendingOrders} pendentes`)}
    </section>
    <section class="grid grid-2" style="margin-top:18px">
      <div class="card"><div class="section-title"><h2>Vendas por dia</h2><span class="badge blue">7 dias</span></div><div class="chart">${state.dashboard.charts.salesByDay.map((d) => `<div class="bar" title="${d.date}: ${money(d.revenue)}" style="height:${Math.max(8, d.revenue / Math.max(1, m.sevenDayRevenue) * 100)}%"></div>`).join("")}</div></div>
      <div class="card"><div class="section-title"><h2>Pedidos por status</h2><span class="badge gray">tempo real</span></div>${statusList(state.dashboard.charts.ordersByStatus)}</div>
    </section>
    <section class="grid grid-2" style="margin-top:18px">
      <div class="card"><div class="section-title"><h2>Atividade recente</h2></div>${recentList(state.dashboard.recent.orders)}</div>
      <div class="card"><div class="section-title"><h2>Alertas e logs</h2></div>${logList(state.dashboard.recent.logs)}</div>
    </section>`;
  $("#reloadDash").onclick = () => renderDashboard();
}

function statusList(rows = []) {
  if (!rows.length) return `<div class="empty-state"><b>Nenhum pedido ainda</b><span>Os status aparecerão quando o checkout gerar pedidos.</span></div>`;
  return rows.map((row) => `<div class="switch-row"><div><b>${esc(row.status)}</b><br><small>${row.count} pedido(s)</small></div><span class="badge ${badgeColor(row.status)}">${row.count}</span></div>`).join("");
}

function recentList(rows = []) {
  if (!rows.length) return `<div class="empty-state"><b>Sem pedidos recentes</b><span>Quando houver pedidos, eles aparecem aqui.</span></div>`;
  return rows.map((order) => `<div class="switch-row"><div><b>${order.public_id}</b><br><small>${esc(order.customer?.name || "Cliente")} · ${fmtDate(order.created_at)}</small></div><span class="badge ${badgeColor(order.status)}">${order.status}</span></div>`).join("");
}

function logList(rows = []) {
  if (!rows.length) return `<div class="empty-state"><b>Sem logs</b><span>Eventos do gateway, pixel e sistema aparecerão aqui.</span></div>`;
  return rows.map((log) => `<div class="switch-row"><div><b>${esc(log.message)}</b><br><small>${esc(log.type)} · ${fmtDate(log.created_at)}</small></div><span class="badge ${log.level === "error" ? "red" : "gray"}">${log.level}</span></div>`).join("");
}

function badgeColor(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("paid") || s.includes("active") || s.includes("entreg")) return "green";
  if (s.includes("pending") || s.includes("aguard")) return "amber";
  if (s.includes("error") || s.includes("refused") || s.includes("cancel") || s.includes("expired")) return "red";
  return "gray";
}

function tabs(tabs, active, body) {
  return `<div class="tabs">${tabs.map(([id, label]) => `<button class="tab-btn ${id === active ? "active" : ""}" data-tab="${id}">${label}</button>`).join("")}</div><div>${body}</div>`;
}

async function renderStore(active = "offer") {
  header("Página / Checkout", "Controle a oferta principal e a experiência de pagamento desta página única.", `<button class="primary-action" id="saveStore">Salvar alterações</button>`);
  await refreshSettings();
  const s = state.settings;
  const tabBody = {
    offer: productMainForm(s.product),
    checkout: checkoutForm(s.checkout),
    form: formRulesForm(s.checkout),
    payment: paymentForm(s.checkout),
    trust: trustForm(s.checkout, s.store),
    advanced: advancedPageForm(s.store, s.product),
    branding: brandingForm(s.branding),
  }[active];
  $("#viewRoot").innerHTML = `<section class="card">${tabs([["offer","Oferta Principal"],["checkout","Checkout"],["form","Formulário"],["payment","Pagamento"],["trust","Textos e Confiança"],["branding","Aparência"],["advanced","Avançado"]], active, tabBody)}</section>`;
  bindTabs((id) => renderStore(id));
  bindDirty();
  $("#saveStore").onclick = (event) => saveStore(active, event.currentTarget);
  bindPreview();
}

function productMainForm(v = {}) {
  return `<div class="grid grid-2"><div><div class="form-grid">${field("Nome da oferta principal","productName",v.productName)}${field("Descrição curta","shortDescription",v.shortDescription)}${field("Preço em centavos","price",v.price,"number")}${field("Preço riscado em centavos","compareAtPrice",v.compareAtPrice,"number")}${field("Imagem principal","image",v.image)}${field("Galeria simples (uma imagem por linha)","gallery",Array.isArray(v.gallery)?v.gallery.join("\n"):"")}${field("Quantidade do kit","quantity",v.quantity || 1,"number")}${selectField("Status da oferta","status",v.status || "active",["active","inactive"])}</div><div style="margin-top:16px">${areaField("Descrição completa / HTML","description",v.description || "",8)}</div></div><div class="preview-box"><h3>Preview do resumo</h3><div class="preview-checkout"><header>${esc(v.storeName || state.settings.store?.storeName || "Oferta")}</header><div><img src="${esc(v.image || "IMG_2103.jpg")}" style="width:86px;height:86px;border-radius:16px;object-fit:cover;margin-bottom:12px"><b>${esc(v.productName || "Oferta principal")}</b><p>${esc(v.shortDescription || "Produto principal vendido nesta página.")}</p><strong>${money(v.price || 0)}</strong><button type="button">Ir para pagamento</button></div></div></div></div>`;
}

function checkoutForm(v = {}) {
  const toggles = [["Compra rápida","quickBuy"],["Pular carrinho","skipCart"],["Campo de cupom","couponEnabled"]];
  return `<div class="form-grid">${field("Timer em minutos","timerMinutes",v.timerMinutes,"number")}${field("Texto do botão principal","buttonText",v.buttonText)}${field("Desconto no Pix (%)","pixDiscount",v.pixDiscount,"number")}</div><div class="flat-card" style="margin-top:18px">${toggles.map(([label,key]) => switchRow(label,key,v[key])).join("")}</div>`;
}

function formRulesForm(v = {}) {
  const toggles = [["Telefone obrigatório","phoneRequired"],["CPF obrigatório","cpfRequired"],["Endereço obrigatório","addressRequired"],["Autocomplete de e-mail","emailAutocomplete"],["Máscaras telefone/CPF/CEP","masksEnabled"]];
  return `<div class="flat-card">${toggles.map(([label,key]) => switchRow(label,key,v[key])).join("")}</div>`;
}

function paymentForm(v = {}) {
  return `<div class="form-grid">${field("Máximo de parcelas no cartão","creditCardMaxInstallments",v.creditCardMaxInstallments || 12,"number")}${field("Taxa de parcelamento cartão (%)","creditCardInstallmentFee",v.creditCardInstallmentFee || 3.99,"number")}</div><div class="flat-card" style="margin-top:18px">${switchRow("Pagamento por cartão de crédito","creditCardEnabled",v.creditCardEnabled !== false)}</div>`;
}

function trustForm(checkout = {}, store = {}) {
  return `<div class="form-grid">${field("Texto de segurança","securityText",checkout.securityText)}${field("Nome exibido da página","storeName",store.storeName)}${field("WhatsApp de suporte","whatsapp",store.whatsapp)}${field("E-mail de suporte","supportEmail",store.supportEmail)}${areaField("Mensagem quando a página estiver inativa","closedMessage",store.closedMessage,5)}</div>`;
}

function advancedPageForm(store = {}, product = {}) {
  return `<div class="form-grid">${field("Domínio principal","domain",store.domain)}${field("Cidade padrão","defaultCity",store.defaultCity)}${field("Estado padrão","defaultState",store.defaultState)}${selectField("Status da página","status",store.status || "active",["active","inactive"])}${field("Moeda","currency",store.currency)}${field("Fuso horário","timezone",store.timezone)}${field("SKU interno (opcional)","sku",product.sku)}${field("Estoque interno (opcional)","stock",product.stock,"number")}</div>`;
}

function brandingForm(v = {}) {
  return `<div class="grid grid-2"><div class="form-grid one">${field("Logo","logo",v.logo)}${field("Favicon","favicon",v.favicon)}${field("Cor primária","primaryColor",v.primaryColor,"color")}${field("Cor secundária","secondaryColor",v.secondaryColor,"color")}${field("Cor dos botões","buttonColor",v.buttonColor,"color")}${field("Cor do fundo","backgroundColor",v.backgroundColor,"color")}${field("Cor dos textos","textColor",v.textColor,"color")}${field("Fonte principal","fontPrimary",v.fontPrimary)}${field("Fonte dos títulos","fontHeadings",v.fontHeadings)}${field("Imagem de fundo","backgroundImage",v.backgroundImage)}${field("Banner principal","mainBanner",v.mainBanner)}</div><div class="preview-box"><h3>Preview</h3><div class="preview-checkout"><header id="previewStore">${esc(state.settings.store?.storeName || "Loja")}</header><div><b id="previewProduct">${esc(state.settings.product?.productName || "Produto")}</b><p>Compra segura via Pix.</p><button id="previewButton">Pagar agora</button></div></div></div></div>`;
}

function field(label, key, value = "", type = "text") {
  if (key === "token") return "";
  if (key === "postbackUrl") return "";
  return `<label class="field">${label}<input data-key="${key}" type="${type}" value="${esc(value)}"></label>`;
}

function areaField(label, key, value = "", rows = 4) {
  return `<label class="field">${label}<textarea data-key="${key}" rows="${rows}">${esc(value)}</textarea></label>`;
}

function selectField(label, key, value, options) {
  return `<label class="field">${label}<select data-key="${key}">${options.map((option) => `<option value="${option}" ${option === value ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
}

function switchRow(label, key, checked) {
  return `<div class="switch-row"><div><b>${label}</b><br><small>Ativar/desativar recurso</small></div><span class="switch ${checked ? "active" : ""}" data-key="${key}" data-switch="true"></span></div>`;
}

function bindTabs(callback) {
  $$(".tab-btn").forEach((button) => button.onclick = () => callback(button.dataset.tab));
}

function bindDirty() {
  $$("input,textarea,select").forEach((el) => el.addEventListener("input", () => state.dirty = true));
  $$("[data-switch]").forEach((sw) => sw.onclick = () => { sw.classList.toggle("active"); state.dirty = true; });
}

function collectForm() {
  const data = {};
  $$('[data-key]').forEach((el) => {
    const key = el.dataset.key;
    if (el.dataset.switch) data[key] = el.classList.contains("active");
    else if (el.type === "number") data[key] = Number(el.value || 0);
    else if (el.type === "color") data[key] = el.value;
    else data[key] = el.value;
  });
  return data;
}

async function saveStore(active, button) {
  const form = collectForm();
  if (active === "offer") {
    form.gallery = String(form.gallery || "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
    return saveSettings({ product: { ...state.settings.product, ...form } }, button);
  }
  if (["checkout", "form", "payment"].includes(active)) return saveSettings({ checkout: { ...state.settings.checkout, ...form } }, button);
  if (active === "trust") return saveSettings({ checkout: { ...state.settings.checkout, securityText: form.securityText }, store: { ...state.settings.store, storeName: form.storeName, whatsapp: form.whatsapp, supportEmail: form.supportEmail, closedMessage: form.closedMessage } }, button);
  if (active === "advanced") return saveSettings({ store: { ...state.settings.store, domain: form.domain, defaultCity: form.defaultCity, defaultState: form.defaultState, status: form.status, currency: form.currency, timezone: form.timezone }, product: { ...state.settings.product, sku: form.sku, stock: form.stock } }, button);
  if (active === "branding") return saveSettings({ branding: form }, button);
}

function bindPreview() {
  const primary = $('[data-key="buttonColor"]') || $('[data-key="primaryColor"]');
  if (primary) primary.addEventListener("input", () => document.documentElement.style.setProperty("--primary", primary.value));
}

async function list(resource) {
  state.cache[resource] = await adminApi({ action: "list", resource });
  return state.cache[resource];
}

async function upsert(resource, payload) {
  const row = await adminApi({ action: "upsert", resource }, { method: "POST", body: JSON.stringify(payload) });
  toast("Registro salvo com sucesso");
  return row;
}

async function remove(resource, id) {
  if (!confirm("Confirmar exclusão?")) return false;
  await adminApi({ action: "delete", resource, id }, { method: "DELETE" });
  toast("Registro removido");
  return true;
}

function badge(status) { return `<span class="badge ${badgeColor(status)}">${esc(status || "-")}</span>`; }

function resourceTable({ rows, resource, empty, columns }) {
  if (!rows.length) return `<div class="card empty-state"><b>${empty}</b><span>Use o botão principal para criar o primeiro registro.</span></div>`;
  return `<div class="toolbar"><input data-search placeholder="Buscar..."><select data-filter><option value="">Todos os status</option><option value="active">Ativo</option><option value="inactive">Inativo</option><option value="pending">Pendente</option><option value="paid">Pago</option></select></div><div class="table-wrap"><table><thead><tr>${columns.map(([h]) => `<th>${h}</th>`).join("")}<th>Ações</th></tr></thead><tbody>${rows.map((row) => `<tr data-row="${row.id}">${columns.map(([, fn]) => `<td>${fn(row)}</td>`).join("")}<td><button class="secondary-action" data-edit="${row.id}">Editar</button> <button class="danger-action" data-delete="${row.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div>`;
}

function bindResourceActions(resource, modalFn, rerender) {
  $$('[data-edit]').forEach((button) => button.onclick = () => modalFn(state.cache[resource].find((row) => row.id === button.dataset.edit)));
  $$('[data-delete]').forEach((button) => button.onclick = async () => { if (await remove(resource, button.dataset.delete)) rerender(); });
}

function openModal(title, body, footer = "") {
  $("#modalRoot").classList.remove("hidden");
  $("#modalRoot").innerHTML = `<section class="modal"><header><h2>${title}</h2><button class="modal-close" type="button">×</button></header><div class="modal-body">${body}${footer}</div></section>`;
  $(".modal-close").onclick = closeModal;
}
function closeModal() { $("#modalRoot").classList.add("hidden"); $("#modalRoot").innerHTML = ""; }

async function renderOffers() {
  header("Ofertas / Order Bumps", "Complementos exibidos no checkout desta página única.", `<button class="primary-action" id="newOffer">Novo order bump</button>`);
  const rows = await getOfferRows();
  $("#viewRoot").innerHTML = `<section class="grid grid-4" style="margin-bottom:18px">${metric("Order bumps", rows.length, "cadastrados")}${metric("Ativos", rows.filter(r => r.status === "active").length, "aparecem no checkout")}${metric("Inativos", rows.filter(r => r.status !== "active").length, "ocultos")}${metric("Ticket adicional", money(rows.reduce((s,r)=>s+Number(r.price||0),0)), "soma das ofertas")}</section>` + resourceTable({ rows, resource: "offers_v2", empty: "Nenhum order bump cadastrado", columns: [["Order bump", r => `<div style="display:flex;align-items:center;gap:10px">${offerThumb(r)}<div><b>${esc(r.title)}</b><br><small>${esc(r.internal_name || (r._legacy ? "Legado - salve para migrar" : "Complemento do checkout"))}</small></div></div>`], ["Origem", r => r._legacy ? `<span class="badge amber">legado</span>` : `<span class="badge green">tabela</span>`], ["Onde aparece", r => esc(r.placement)], ["Preço", r => `${money(r.price)}<br><small><s>${money(r.compare_at_price)}</s></small>`], ["Status", r => badge(r.status)], ["Limite", r => r.max_quantity || 1]] });
  bindResourceActions("offers_v2", offerModal, () => renderOffers());
  $("#newOffer").onclick = () => offerModal({ status: "active", type: "order_bump", placement: "checkout", price: 1990, compare_at_price: 3990, max_quantity: 1, image: "" });
}

function offerModal(row = {}) {
  openModal(row.id ? "Editar order bump" : "Novo order bump", `<div class="tabs"><button class="tab-btn active">Informações</button><button class="tab-btn">Preço</button><button class="tab-btn">Mídia</button><button class="tab-btn">Regras</button><button class="tab-btn">Preview</button></div><div class="grid grid-2"><div><div class="form-grid">${field("Nome interno","internal_name",row.internal_name)}${field("Nome exibido no checkout","title",row.title)}${field("Preço em centavos","price",row.price,"number")}${field("Preço riscado em centavos","compare_at_price",row.compare_at_price,"number")}${selectField("Status","status",row.status || "active",["active","inactive"])}${selectField("Tipo","type",row.type || "order_bump",["order_bump","upsell","downsell","kit","post_purchase","cart"])}${selectField("Onde aparece","placement",row.placement || "checkout",["checkout","cart","post_purchase","product"])}${field("Quantidade máxima por pedido","max_quantity",row.max_quantity || 1,"number")}${selectField("Condição de exibição","condition_type",row.display_condition?.type || "all",["all","product_in_cart","min_value","utm","origin"])}</div>${areaField("Descrição exibida","description",row.description || "Aplique antes do Body Splash e seu cheiro dura o DIA INTEIRO.")}${field("Imagem / URL","image",row.image || "IMG_2112.PNG.png")}<label class="field">Upload da imagem<input id="offerImageUpload" type="file" accept="image/*"></label><div style="margin-top:18px"><button class="primary-action" id="saveModal">Salvar order bump</button></div></div><div class="preview-box"><h3>Preview no checkout</h3><div class="offer" style="min-height:auto"><img id="offerPreviewImg" src="${esc(row.image || "IMG_2112.PNG.png")}" alt=""><h3 id="offerPreviewTitle">${esc(row.title || "Essential Body Cream")}</h3><del id="offerPreviewCompare">${money(row.compare_at_price || 3990)}</del><strong id="offerPreviewPrice">${money(row.price || 1990)}</strong><button type="button"><span></span>PEGAR OFERTA</button><p id="offerPreviewDescription">${esc(row.description || "Aplique antes do Body Splash e seu cheiro dura o DIA INTEIRO.")}</p><a>Ver mais</a></div><p class="badge blue" style="margin-top:14px">Essa prévia é a mesma estrutura usada no checkout.</p></div></div>`);
  const refreshPreview = () => { const form = collectForm(); $("#offerPreviewImg").src = form.image || "IMG_2112.PNG.png"; $("#offerPreviewTitle").textContent = form.title || "Essential Body Cream"; $("#offerPreviewCompare").textContent = money(form.compare_at_price || 0); $("#offerPreviewPrice").textContent = money(form.price || 0); $("#offerPreviewDescription").textContent = form.description || ""; };
  $$('[data-key]').forEach((el) => el.addEventListener("input", refreshPreview));
  $("#offerImageUpload").onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('[data-key="image"]').value = reader.result; refreshPreview(); };
    reader.readAsDataURL(file);
  };
  $("#saveModal").onclick = async () => { const data = collectForm(); data.display_condition = { type: data.condition_type }; delete data.condition_type; await upsert("offers_v2", { ...row, ...data }); closeModal(); renderOffers(); };
}

async function getOfferRows() {
  await refreshSettings();
  let tableRows = [];
  try { tableRows = await list("offers_v2"); } catch (_) { tableRows = []; }
  const seen = new Set(tableRows.map((row) => row.id || row.internal_name || row.title));
  const legacyRows = (state.settings.offers || [])
    .filter((offer) => !seen.has(offer.id))
    .map((offer) => ({
      id: `legacy-${offer.id || uid()}`,
      _legacy: true,
      legacy_id: offer.id,
      internal_name: offer.id || offer.name,
      title: offer.name,
      description: offer.description || "Aplique antes do Body Splash e seu cheiro dura o DIA INTEIRO.",
      price: offer.price,
      compare_at_price: offer.compareAtPrice,
      image: offer.image === "IMG_2112.PNG.png" ? "" : offer.image,
      status: offer.enabled === false ? "inactive" : "active",
      type: "order_bump",
      placement: "checkout",
      max_quantity: 1,
      display_condition: { type: "all" },
    }));
  const rows = [...tableRows, ...legacyRows];
  state.cache.offers_v2 = rows;
  return rows;
}

function offerThumb(row = {}) {
  const image = row.image && row.image !== "IMG_2112.PNG.png" ? row.image : "";
  return image
    ? `<img src="${esc(image)}" style="width:46px;height:46px;border-radius:12px;object-fit:cover">`
    : `<div class="empty-thumb">sem imagem</div>`;
}

function offerModal(row = {}) {
  const image = row.image === "IMG_2112.PNG.png" ? "" : row.image;
  openModal(row.id ? "Editar order bump" : "Novo order bump", `
    <div class="tabs"><button class="tab-btn active">Informações</button><button class="tab-btn">Preço</button><button class="tab-btn">Mídia</button><button class="tab-btn">Regras</button><button class="tab-btn">Preview</button></div>
    <div class="grid grid-2">
      <div>
        <div class="form-grid">
          ${field("Nome interno", "internal_name", row.internal_name)}
          ${field("Nome exibido no checkout", "title", row.title)}
          ${field("Preço em centavos", "price", row.price, "number")}
          ${field("Preço riscado em centavos", "compare_at_price", row.compare_at_price, "number")}
          ${selectField("Status", "status", row.status || "active", ["active", "inactive"])}
          ${selectField("Tipo", "type", row.type || "order_bump", ["order_bump", "upsell", "downsell", "kit", "post_purchase", "cart"])}
          ${selectField("Onde aparece", "placement", row.placement || "checkout", ["checkout", "cart", "post_purchase"])}
          ${field("Quantidade máxima por pedido", "max_quantity", row.max_quantity || 1, "number")}
          ${selectField("Condição de exibição", "condition_type", row.display_condition?.type || "all", ["all", "min_value", "utm", "origin"])}
        </div>
        ${areaField("Descrição exibida", "description", row.description || "Aplique antes do Body Splash e seu cheiro dura o DIA INTEIRO.")}
        ${field("Imagem / URL", "image", image || "")}
        <label class="field">Upload da imagem<input id="offerImageUpload" type="file" accept="image/*"></label>
        <div style="margin-top:18px"><button class="primary-action" id="saveModal">Salvar order bump</button></div>
      </div>
      <div class="preview-box">
        <h3>Preview no checkout</h3>
        <div class="offer" style="min-height:auto">
          <img id="offerPreviewImg" src="${esc(image || "")}" alt="">
          <h3 id="offerPreviewTitle">${esc(row.title || "Essential Body Cream")}</h3>
          <del id="offerPreviewCompare">${money(row.compare_at_price || 3990)}</del>
          <strong id="offerPreviewPrice">${money(row.price || 1990)}</strong>
          <button type="button"><span></span>PEGAR OFERTA</button>
          <p id="offerPreviewDescription">${esc(row.description || "")}</p>
          <a>Ver mais</a>
        </div>
      </div>
    </div>`);
  const refreshPreview = () => {
    const form = collectForm();
    $("#offerPreviewImg").src = form.image || "";
    $("#offerPreviewTitle").textContent = form.title || "Essential Body Cream";
    $("#offerPreviewCompare").textContent = money(form.compare_at_price || 0);
    $("#offerPreviewPrice").textContent = money(form.price || 0);
    $("#offerPreviewDescription").textContent = form.description || "";
  };
  $$('[data-key]').forEach((el) => el.addEventListener("input", refreshPreview));
  $("#offerImageUpload").onchange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { $('[data-key="image"]').value = reader.result; refreshPreview(); };
    reader.readAsDataURL(file);
  };
  $("#saveModal").onclick = async () => {
    const data = collectForm();
    data.display_condition = { type: data.condition_type };
    delete data.condition_type;
    const payload = { ...row, ...data };
    if (payload._legacy) {
      delete payload.id;
      delete payload._legacy;
      delete payload.legacy_id;
    }
    await upsert("offers_v2", payload);
    closeModal();
    renderOffers();
  };
}

async function renderOrders() {
  header("Pedidos", "Gestão completa dos pedidos, Pix, logística, UTMs e ações operacionais.", `<button class="secondary-action" id="exportOrders">Exportar CSV</button>`);
  const rows = await api("/api/orders");
  state.cache.orders = rows;
  if (!rows.length) { $("#viewRoot").innerHTML = `<div class="card empty-state"><b>Nenhum pedido ainda</b><span>Os pedidos gerados no checkout aparecerão aqui.</span></div>`; return; }
  $("#viewRoot").innerHTML = `<div class="toolbar"><input placeholder="Buscar pedido, cliente ou telefone"><select><option>Todos</option><option>Pago</option><option>Pendente</option><option>Expirado</option></select><select><option>Todos os gateways</option><option>Freepay</option></select></div><div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Contato</th><th>Valor</th><th>Pagamento</th><th>Logística</th><th>UTM</th><th>Data</th><th>Ações</th></tr></thead><tbody>${rows.map((order) => `<tr><td><b>${order.public_id}</b><br><small>${order.freepay_transaction_id || "-"}</small></td><td>${esc(order.customer?.name || "-")}</td><td>${esc(order.customer?.phone || "-")}<br><small>${esc(order.customer?.email || "")}</small></td><td>${money(order.amount)}</td><td>${badge(order.status)}</td><td>${badge("aguardando envio")}</td><td>${esc(order.utms?.utm_campaign || order.utms?.utm_source || "-")}</td><td>${fmtDate(order.created_at)}</td><td><button class="secondary-action" data-order="${order.id}">Detalhes</button></td></tr>`).join("")}</tbody></table></div>`;
  $$('[data-order]').forEach((button) => button.onclick = () => orderDetails(rows.find((row) => row.id === button.dataset.order)));
  $("#exportOrders").onclick = () => exportCsv("orders.csv", rows);
}

function orderDetails(order) {
  openModal(`Pedido ${order.public_id}`, `<div class="grid grid-2"><div class="flat-card"><h3>Cliente</h3><p>${esc(order.customer?.name)}<br>${esc(order.customer?.phone)}<br>${esc(order.customer?.email)}</p></div><div class="flat-card"><h3>Pagamento</h3><p>Status: ${badge(order.status)}<br>Total: ${money(order.amount)}<br>Gateway: Freepay<br>TXID: ${esc(order.freepay_transaction_id || "-")}</p></div><div class="flat-card"><h3>Endereço</h3><p>${esc(order.shipping_address?.street || "")}, ${esc(order.shipping_address?.number || "")}<br>${esc(order.shipping_address?.city || "")}/${esc(order.shipping_address?.state || "")}</p></div><div class="flat-card"><h3>UTMs</h3><pre class="log-payload">${esc(JSON.stringify(order.utms || {}, null, 2))}</pre></div></div><h3>Itens</h3><pre class="log-payload">${esc(JSON.stringify(order.items || [], null, 2))}</pre><h3>Histórico</h3><div class="switch-row"><b>Pedido criado</b><small>${fmtDate(order.created_at)}</small></div><div class="header-actions" style="margin-top:18px"><button class="secondary-action" onclick="navigator.clipboard.writeText('${esc(order.customer?.phone || "")}')">Copiar telefone</button><a class="secondary-action" style="text-decoration:none;display:inline-flex;align-items:center" href="https://wa.me/55${esc(order.customer?.phone || "")}" target="_blank">Abrir WhatsApp</a><button class="secondary-action" onclick="navigator.clipboard.writeText('${esc(order.pix_code || "")}')">Copiar Pix</button></div>`);
}

async function renderGateway() {
  header("Gateway Pix", "Configure Freepay, gateways futuros, logs, testes e nomes enviados ao gateway.", `<button class="primary-action" id="saveGatewayAll">Salvar gateway</button>`);
  await refreshSettings();
  const gateway = state.settings.gateway || {};
  const names = state.settings.gateway_names || { enabled: false, names: [] };
  $("#viewRoot").innerHTML = `<section class="grid grid-3"><div class="card"><span class="status-dot"></span> <b>Freepay</b><p>Gateway ativo para Pix.</p><span class="badge green">Conectável</span></div><div class="card"><span class="status-dot off"></span> <b>Buckpay</b><p>Preparado para integração futura.</p><span class="badge gray">Inativo</span></div><div class="card"><span class="status-dot off"></span> <b>Personalizado</b><p>Gateway customizado futuro.</p><span class="badge gray">Inativo</span></div></section><section class="grid grid-2" style="margin-top:18px"><div class="card"><h2>Credenciais Freepay</h2><div class="form-grid one">${field("Public Key","publicKey",gateway.publicKey)}${field("Secret Key","secretKey",gateway.secretKey,"password")}${field("Token","token",gateway.token,"password")}${field("Webhook URL","postbackUrl",gateway.postbackUrl)}${selectField("Ambiente","environment",gateway.environment || "production",["production","sandbox"])}${field("Pix expira em dias","pixExpiresInDays",gateway.pixExpiresInDays || 1,"number")}${field("Nome enviado no metadata","providerName",gateway.providerName || "Elly Perfumaria")}</div><div class="header-actions" style="margin-top:14px"><button class="secondary-action" id="testGateway">Testar conexão</button><button class="secondary-action" id="testPix">Gerar Pix de teste</button></div></div><div class="card"><h2>Nome enviado ao gateway</h2>${switchRow("Ativar nomes alternativos","enabled",names.enabled)}${areaField("Lista de nomes (vírgula ou um por linha)","names",(names.names || []).join("\n"),10)}<p><span class="badge blue" id="nameCount">0 nomes válidos</span></p><div class="name-list-tools"><button class="secondary-action" id="dedupeNames">Remover duplicados</button><button class="secondary-action" id="previewName">Preview sorteado</button><button class="secondary-action" id="generateNames">Gerar nomes</button><button class="secondary-action" id="clearNames">Limpar</button><button class="secondary-action" id="exportNames">Exportar .txt</button><label class="secondary-action" style="display:inline-flex;align-items:center;cursor:pointer">Importar .txt<input type="file" id="importNames" accept=".txt" hidden></label></div><p id="namePreview" class="kbd">Nenhum nome sorteado</p></div></section><section class="card" style="margin-top:18px"><div class="section-title"><h2>Logs de gateway</h2><button class="secondary-action" id="reloadGatewayLogs">Atualizar</button></div><div id="gatewayLogs"></div></section>`;
  bindDirty();
  bindGatewayNames();
  $("#saveGatewayAll").onclick = (e) => saveGateway(e.currentTarget);
  $("#testGateway").onclick = () => testAction("gateway", "Teste de conexão Freepay");
  $("#testPix").onclick = () => testAction("gateway", "Pix de teste solicitado");
  await renderLogs("gateway", "#gatewayLogs");
}

function parseNames() { return String($('[data-key="names"]')?.value || "").split(/[\n,]+/).map((name) => name.trim()).filter(Boolean); }
function bindGatewayNames() { const update = () => $("#nameCount").textContent = `${new Set(parseNames()).size} nomes válidos`; $('[data-key="names"]').addEventListener("input", update); update(); $("#dedupeNames").onclick = () => { $('[data-key="names"]').value = [...new Set(parseNames())].join("\n"); update(); }; $("#previewName").onclick = () => { const list = parseNames(); $("#namePreview").textContent = list.length ? list[Math.floor(Math.random()*list.length)] : "Lista vazia"; }; $("#generateNames").onclick = () => { $('[data-key="names"]').value += "\nElly Perfumaria\nKit Cuidados Pessoais\nEssenciais de Beleza\nCombo Perfumaria"; update(); }; $("#clearNames").onclick = () => { $('[data-key="names"]').value = ""; update(); }; $("#exportNames").onclick = () => download("gateway-nomes.txt", parseNames().join("\n")); $("#importNames").onchange = async (e) => { $('[data-key="names"]').value = await e.target.files[0].text(); update(); }; }
async function saveGateway(button) { const form = collectForm(); const names = [...new Set(parseNames())]; await saveSettings({ gateway: { ...state.settings.gateway, publicKey: form.publicKey, secretKey: form.secretKey, postbackUrl: form.postbackUrl, environment: form.environment, pixExpiresInDays: form.pixExpiresInDays, providerName: form.providerName }, gateway_names: { enabled: $('[data-key="enabled"]').classList.contains("active"), names, dedupe: true } }, button); }

async function renderGateway(active = "gateways") {
  header("Gateways", "Gateway de pagamento, postbacks e mascaramento enviados ao provedor.", `<button class="primary-action" id="saveGatewayAll">Salvar gateway</button>`);
  await refreshSettings();
  const gateway = state.settings.gateway || {};
  const masking = state.settings.gateway_masking || {};
  const names = state.settings.gateway_names || { enabled: false, names: [] };
  const body = {
    gateways: gatewaySettingsView(gateway),
    masking: gatewayMaskingView(gateway, masking, names),
    logs: `<section class="card"><div class="section-title"><h2>Logs do gateway</h2><button class="secondary-action" id="reloadGatewayLogs">Atualizar</button></div><div id="gatewayLogs"></div></section>`,
  }[active];
  $("#viewRoot").innerHTML = `<section class="card gateway-tabs-card">${tabs([["gateways","Gateways"],["masking","Mascaramento pro Gateway"],["logs","Logs"]], active, body)}</section>`;
  bindTabs((id) => renderGateway(id));
  bindDirty();
  $("#saveGatewayAll").onclick = (event) => saveGatewaySettings(active, event.currentTarget);
  if (active === "gateways") {
    $$(".flat-card").forEach((card) => { if (card.textContent.includes("Freepay") && card.querySelector("small")) card.querySelector("small").textContent = `${location.origin}/api/freepay`; });
    $("#testGateway").onclick = () => testAction("gateway", "Teste de conexão Freepay");
    $("#testPix").onclick = () => testAction("gateway", "Pix de teste solicitado");
  }
  if (active === "masking") bindGatewayMasking();
  if (active === "logs") { $("#reloadGatewayLogs").onclick = () => renderGateway("logs"); await renderLogs("gateway", "#gatewayLogs"); }
}

function gatewaySettingsView(gateway = {}) {
  const systemWebhook = `${location.origin}/api/freepay`;
  return `<section class="grid grid-3"><div class="card"><span class="status-dot"></span> <b>Freepay</b><p>Gateway ativo para Pix e cartão.</p><span class="badge green">Ativo</span></div><div class="card"><span class="status-dot off"></span> <b>Buckpay</b><p>Preparado para integração futura.</p><span class="badge gray">Inativo</span></div><div class="card"><span class="status-dot off"></span> <b>Personalizado</b><p>Gateway customizado futuro.</p><span class="badge gray">Inativo</span></div></section><section class="grid grid-2" style="margin-top:18px"><div class="card"><h2>Credenciais Freepay</h2><div class="form-grid one">${field("Public Key","publicKey",gateway.publicKey)}${field("Secret Key","secretKey",gateway.secretKey,"password")}${field("Webhook URL","postbackUrl",gateway.postbackUrl)}${selectField("Ambiente","environment",gateway.environment || "production",["production","sandbox"])}${field("Pix expira em dias","pixExpiresInDays",gateway.pixExpiresInDays || 1,"number")}</div><div class="header-actions" style="margin-top:14px"><button class="secondary-action" id="testGateway">Testar conexão</button><button class="secondary-action" id="testPix">Gerar Pix de teste</button></div></div><div class="card"><h2>Webhooks em uso</h2><p>URL efetivamente enviada ao gateway ao criar a transação.</p><div class="flat-card"><b>Freepay</b><br><small>${esc(gateway.postbackUrl || "https://6a4437ee-6a2c-83e9-4571-7d0fa732u9e.vercel.app/api/freepay")}</small></div></div></section>`;
}

function gatewayMaskingView(gateway = {}, masking = {}, names = {}) {
  const validNames = [...new Set((names.names || []).map((name) => String(name).trim()).filter(Boolean))];
  const duplicateCount = Math.max(0, parseNamesFromValue((names.names || []).join("\n")).length - validNames.length);
  const sampleReal = state.settings.product?.productName || "Oferta principal";
  const sampleSent = validNames[0] || sampleReal;
  return `<section class="gateway-hero"><div><span class="badge gray">CAMADA INTELIGENTE</span><h2>Mascaramento pro Gateway</h2><p>Controle somente nomes, metadados e referências externas. Não altera valores, cliente, documentos nem webhooks.</p></div><div class="gateway-hero-switch">${switchRow("Utilizar nomes personalizados","enabled",names.enabled)}</div></section><section class="grid grid-2" style="margin-top:18px"><div class="card"><div class="section-title"><h2>Lista e privacidade</h2></div><div class="form-grid one">${field("Nome do provedor enviado ao gateway","providerName",masking.providerName || gateway.providerName || "Elly Perfumaria")}</div><div class="privacy-box"><h3>Privacidade do envio ao Gateway</h3><p>Controla apenas metadados e referências externas. Não altera valores, cliente, documentos nem webhooks.</p><div class="grid grid-2">${switchRow("Enviar UTMs ao gateway","sendUtmsToGateway",masking.sendUtmsToGateway === true)}${switchRow("Mascarar ID externo do pedido","maskExternalOrderId",masking.maskExternalOrderId !== false)}${switchRow("Mascarar referência dos itens","maskItemRefs",masking.maskItemRefs !== false)}${field("UTM padrão enviada ao gateway","defaultUtm",masking.defaultUtm || "")}</div><small>Quando UTMs reais estiverem desligadas, a UTM padrão pode ser enviada no metadata.</small></div>${areaField("Lista de nomes personalizados (vírgula ou um por linha)","names",validNames.join("\n"),14)}<p><span class="badge blue" id="nameCount">${validNames.length} nomes válidos</span></p><div class="name-list-tools"><button class="secondary-action" id="dedupeNames">Remover duplicados</button><button class="secondary-action" id="previewName">Preview sorteado</button><button class="secondary-action" id="generateNames">Gerar nomes</button><button class="secondary-action" id="clearNames">Limpar</button><button class="secondary-action" id="exportNames">Exportar .txt</button><label class="secondary-action" style="cursor:pointer">Importar .txt<input class="hidden" id="importNames" type="file" accept=".txt"></label></div></div><aside><div class="card"><h2>Pré-visualização</h2><div class="preview-flow"><div><small>NOME REAL</small><b>${esc(sampleReal)}</b></div><span>↓</span><div class="sent"><small>NOME ENVIADO</small><b id="namePreview">${esc(sampleSent)}</b></div></div></div><section class="grid grid-2" style="margin-top:18px">${metric("Cadastrados", validNames.length, "nomes na lista")}${metric("Válidos", validNames.length, "após limpeza")}${metric("Duplicados", duplicateCount, "removíveis")}${metric("Status", names.enabled ? "Ativo" : "Inativo", "nomes personalizados")}</section><div class="card" style="margin-top:18px"><h2>Auditoria rápida</h2><div class="audit-row"><span>Provedor enviado</span><b>${esc(masking.providerName || gateway.providerName || "Elly Perfumaria")}</b></div><div class="audit-row"><span>UTMs no gateway</span><b>${masking.sendUtmsToGateway === true ? "Ligadas" : "Desligadas"}</b></div><div class="audit-row"><span>ID do pedido</span><b>${masking.maskExternalOrderId !== false ? "Mascarado" : "Real"}</b></div><div class="audit-row"><span>Ref. dos itens</span><b>${masking.maskItemRefs !== false ? "Mascarada" : "Real"}</b></div></div></aside></section><section class="card" style="margin-top:18px"><div class="section-title"><h2>Logs de nomes enviados</h2><button class="secondary-action" id="reloadGatewayMaskLogs">Atualizar</button></div><div id="gatewayMaskLogs"></div></section>`;
}

function parseNamesFromValue(value) { return String(value || "").split(/[\n,]+/).map((name) => name.trim()).filter(Boolean); }

function bindGatewayMasking() {
  const update = () => {
    const names = [...new Set(parseNames())];
    if ($("#nameCount")) $("#nameCount").textContent = `${names.length} nomes válidos`;
  };
  $('[data-key="names"]')?.addEventListener("input", update);
  update();
  $("#dedupeNames").onclick = () => { $('[data-key="names"]').value = [...new Set(parseNames())].join("\n"); update(); };
  $("#previewName").onclick = () => { const list = parseNames(); $("#namePreview").textContent = list.length ? list[Math.floor(Math.random() * list.length)] : "Lista vazia"; };
  $("#generateNames").onclick = () => { $('[data-key="names"]').value += "\nBody Splash Vanilla Dream\nBody Splash Cherry Blossom\nBody Splash Cotton Fresh\nPerfume Royal Night\nPerfume Ocean Blue\nPerfume Crystal Bloom"; update(); };
  $("#clearNames").onclick = () => { $('[data-key="names"]').value = ""; update(); };
  $("#exportNames").onclick = () => download("gateway-nomes.txt", parseNames().join("\n"));
  $("#importNames").onchange = async (event) => { $('[data-key="names"]').value = await event.target.files[0].text(); update(); };
  $("#reloadGatewayMaskLogs").onclick = () => renderGateway("masking");
  renderLogs("gateway", "#gatewayMaskLogs");
}

async function saveGatewaySettings(active, button) {
  const form = collectForm();
  if (active === "gateways") {
    return saveSettings({ gateway: { ...state.settings.gateway, publicKey: form.publicKey, secretKey: form.secretKey, postbackUrl: "", environment: form.environment, pixExpiresInDays: form.pixExpiresInDays } }, button);
  }
  if (active === "masking") {
    const names = [...new Set(parseNames())];
    return saveSettings({
      gateway: { ...state.settings.gateway, providerName: form.providerName },
      gateway_names: { enabled: $('[data-key="enabled"]')?.classList.contains("active") || false, names, dedupe: true },
      gateway_masking: {
        ...state.settings.gateway_masking,
        providerName: form.providerName,
        sendUtmsToGateway: $('[data-key="sendUtmsToGateway"]')?.classList.contains("active") || false,
        maskExternalOrderId: $('[data-key="maskExternalOrderId"]')?.classList.contains("active") !== false,
        maskItemRefs: $('[data-key="maskItemRefs"]')?.classList.contains("active") !== false,
        defaultUtm: form.defaultUtm || "",
      },
    }, button);
  }
  toast("Nada para salvar nesta aba.");
}
async function testAction(type, message) { const res = await adminApi({ action: "test" }, { method: "POST", body: JSON.stringify({ type, source: "admin", message }) }); toast(`Teste executado: ${res.status}`); }

async function renderIntegrations() {
  header("Integrações", "Meta Pixel, TikTok Pixel, UTMify, webhooks, scripts externos e logs de eventos.", `<button class="primary-action" id="saveIntegrationSettings">Salvar integrações</button>`);
  const pixels = await api("/api/pixels"); state.pixels = pixels;
  await refreshSettings();
  $("#viewRoot").innerHTML = `<section class="grid grid-2"><div class="card"><h2>Meta Pixel</h2>${pixelManager("meta")}</div><div class="card"><h2>TikTok Pixel</h2>${pixelManager("tiktok")}</div></section><section class="grid grid-2" style="margin-top:18px"><div class="card"><h2>UTMify</h2><div class="form-grid one">${field("Token da API","utmifyToken",state.settings.integrations?.utmifyToken || "")}${selectField("Status","utmifyEnabled",state.settings.integrations?.utmifyEnabled ? "active":"inactive",["active","inactive"])}</div><div class="flat-card" style="margin-top:14px">${switchRow("Enviar pedidos pendentes","sendPending",true)}${switchRow("Enviar pedidos pagos","sendPaid",true)}${switchRow("Enviar pedidos cancelados","sendCanceled",false)}</div><button class="secondary-action" id="testUtmify" style="margin-top:14px">Testar integração</button></div><div class="card"><h2>Webhooks e scripts externos</h2>${areaField("Scripts externos no checkout","externalScripts",state.settings.integrations?.externalScripts || "",8)}${field("Webhook adicional","extraWebhook",state.settings.integrations?.extraWebhook || "")}</div></section><section class="card" style="margin-top:18px"><div class="section-title"><h2>Logs de eventos</h2></div><div id="pixelLogs"></div></section>`;
  bindPixelButtons(); bindDirty(); $("#saveIntegrationSettings").onclick = (e) => saveSettings({ integrations: collectForm() }, e.currentTarget); $("#testUtmify").onclick = () => testAction("utmify", "Evento UTMify de teste"); await renderLogs("pixel", "#pixelLogs");
}

function pixelManager(platform) { const rows = state.pixels.filter((p) => p.platform === platform); return `<div class="form-grid one">${field("Nome","pixelName","")}${field("Pixel ID","pixelId","")}${field("Access Token","pixelToken","")}${field("Test Event Code","testEventCode","")}</div><div class="flat-card" style="margin-top:14px">${switchRow("Browser Pixel","browserPixel",true)}${switchRow(platform === "meta" ? "Conversions API" : "Events API","serverApi",false)}</div><div class="header-actions" style="margin-top:14px"><button class="secondary-action add-pixel" data-platform="${platform}">Adicionar pixel</button><button class="secondary-action test-pixel" data-platform="${platform}">Testar evento</button></div><div style="margin-top:16px">${rows.length ? rows.map((p) => `<div class="switch-row"><div><b>${esc(p.name)}</b><br><small>${esc(p.pixel_id)}</small></div><span>${badge(p.enabled ? "active" : "inactive")}</span></div>`).join("") : `<div class="empty-state"><b>Nenhum pixel</b><span>Adicione quantos pixels quiser.</span></div>`}</div>`; }
function bindPixelButtons() { $$('.add-pixel').forEach((btn) => btn.onclick = async () => { const card = btn.closest(".card"); await api("/api/pixels", { method: "POST", body: JSON.stringify({ platform: btn.dataset.platform, name: $('[data-key="pixelName"]', card).value || `${btn.dataset.platform} pixel`, pixel_id: $('[data-key="pixelId"]', card).value, access_token: $('[data-key="pixelToken"]', card).value, enabled: true, events: { page_view:true, view_content:true, add_to_cart:true, initiate_checkout:true, add_payment_info:true, purchase:true } }) }); toast("Pixel adicionado"); renderIntegrations(); }); $$('.test-pixel').forEach((btn) => btn.onclick = () => testAction("pixel", `Teste ${btn.dataset.platform}`)); }

async function renderLogistics() { header("Logística", "Envios, códigos de rastreio, status logístico e exportação CSV.", `<button class="primary-action" id="newShipment">Novo envio</button><button class="secondary-action" id="exportShipments">Exportar CSV</button>`); const rows = await list("shipments"); $("#viewRoot").innerHTML = resourceTable({ rows, resource:"shipments", empty:"Nenhum envio cadastrado", columns:[["Pedido",r=>esc(r.public_order_id||"-")],["Cliente",r=>`${esc(r.customer_name||"-")}<br><small>${esc(r.customer_phone||"")}</small>`],["Pagamento",r=>badge(r.payment_status||"pending")],["Envio",r=>badge(r.shipping_status)],["Transportadora",r=>esc(r.carrier||"-")],["Rastreio",r=>esc(r.tracking_code||"-")]] }); bindResourceActions("shipments", shipmentModal, () => renderLogistics()); $("#newShipment").onclick = () => shipmentModal({ shipping_status:"awaiting_shipment" }); }
function shipmentModal(row={}) { openModal("Envio", `<div class="form-grid">${field("Pedido","public_order_id",row.public_order_id)}${field("Cliente","customer_name",row.customer_name)}${field("Telefone","customer_phone",row.customer_phone)}${selectField("Status envio","shipping_status",row.shipping_status||"awaiting_shipment",["awaiting_shipment","shipped","delivered","sync_error"])}${field("Transportadora","carrier",row.carrier)}${field("Código de rastreio","tracking_code",row.tracking_code)}</div><p class="badge gray">Formato Correios: XX123456789BR</p><div style="margin-top:18px"><button class="primary-action" id="saveModal">Salvar envio</button></div>`); $("#saveModal").onclick = async () => { const data=collectForm(); if(data.tracking_code && !/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(data.tracking_code)) toast("Rastreio fora do padrão Correios, mas salvo como informado", "error"); await upsert("shipments", {...row,...data}); closeModal(); renderLogistics(); }; }

async function renderCustomers() { header("Clientes", "Lista de compradores, histórico, origem, tags e observações internas."); const rows = await list("customers"); $("#viewRoot").innerHTML = resourceTable({ rows, resource:"customers", empty:"Nenhum cliente consolidado", columns:[["Cliente",r=>`<b>${esc(r.name||"-")}</b><br><small>${esc(r.email||"")}</small>`],["Telefone",r=>esc(r.phone||"-")],["CPF",r=>esc(r.cpf||"-")],["Cidade",r=>`${esc(r.city||"-")}/${esc(r.state||"")}`],["Total gasto",r=>money(r.total_spent)],["Pedidos",r=>r.orders_count||0],["Status",r=>badge(r.status)]] }); bindResourceActions("customers", customerModal, () => renderCustomers()); }
function customerModal(row={}) { openModal("Ficha do cliente", `<div class="grid grid-2"><div class="flat-card"><h3>Dados pessoais</h3><p>${esc(row.name)}<br>${esc(row.phone)}<br>${esc(row.email)}<br>${esc(row.cpf)}</p></div><div class="flat-card"><h3>Histórico</h3><p>${row.orders_count||0} pedidos<br>${money(row.total_spent)} total gasto<br>Último pedido: ${fmtDate(row.last_order_at)}</p></div></div>${areaField("Observações internas","notes",row.notes||"")}<div style="margin-top:18px"><button class="primary-action" id="saveModal">Salvar cliente</button></div>`); $("#saveModal").onclick = async () => { await upsert("customers", {...row,...collectForm()}); closeModal(); renderCustomers(); }; }

async function renderReports() { header("Relatórios", "Vendas, conversão, Pix, UTMs, ticket médio e exportações.", `<button class="secondary-action" id="exportReport">Exportar CSV</button>`); const dash = await adminApi({ action:"dashboard" }); const m = dash.metrics; $("#viewRoot").innerHTML = `<div class="toolbar"><select><option>Hoje</option><option>Ontem</option><option>Últimos 7 dias</option><option>Últimos 30 dias</option><option>Mês atual</option><option>Mês anterior</option><option>Personalizado</option></select></div><section class="grid grid-4">${metric("Vendas", money(m.revenue))}${metric("Pedidos pagos", m.paidOrders)}${metric("Pix gerados vs pagos", `${m.pixGenerated}/${m.pixPaid}`)}${metric("Ticket médio", money(m.averageTicket))}</section><section class="grid grid-2" style="margin-top:18px"><div class="card"><h2>Faturamento por dia</h2><div class="chart">${dash.charts.salesByDay.map(d=>`<div class="bar" style="height:${Math.max(8,d.revenue/Math.max(1,m.sevenDayRevenue)*100)}%"></div>`).join("")}</div></div><div class="card"><h2>UTMs com maior faturamento</h2><div class="empty-state"><b>Sem UTMs suficientes</b><span>Os dados aparecem quando houver tráfego com parâmetros.</span></div></div></section>`; $("#exportReport").onclick = () => exportCsv("relatorio.csv", dash.charts.salesByDay); }

async function renderAppearance() { header("Aparência", "Logo, favicon, cores, textos, reviews, FAQ, selos e rodapé.", `<button class="primary-action" id="saveAppearance">Salvar aparência</button>`); await refreshSettings(); $("#viewRoot").innerHTML = `<section class="grid grid-2"><div class="card"><h2>Tema</h2><div class="form-grid one">${field("Logo","logo",state.settings.branding?.logo)}${field("Favicon","favicon",state.settings.branding?.favicon)}${field("Cor principal","primaryColor",state.settings.branding?.primaryColor,"color")}${field("Cor secundária","secondaryColor",state.settings.branding?.secondaryColor,"color")}${field("Cor dos botões","buttonColor",state.settings.branding?.buttonColor,"color")}${field("Cor dos textos","textColor",state.settings.branding?.textColor,"color")}${field("Fonte","fontPrimary",state.settings.branding?.fontPrimary)}</div></div><div class="card"><h2>Conteúdo visual</h2>${areaField("Selos de segurança (JSON)","badges",JSON.stringify(state.settings.appearance?.badges||[],null,2),6)}${areaField("Reviews (JSON)","reviews",JSON.stringify(state.settings.appearance?.reviews||[],null,2),6)}${areaField("FAQ (JSON)","faq",JSON.stringify(state.settings.appearance?.faq||[],null,2),6)}${areaField("Rodapé","footerText",state.settings.appearance?.footerText||"")}</div></section>`; bindDirty(); $("#saveAppearance").onclick = (e) => { const form=collectForm(); saveSettings({ branding:{...state.settings.branding,...form}, appearance:{ badges:safeJson(form.badges,[]), reviews:safeJson(form.reviews,[]), faq:safeJson(form.faq,[]), footerText:form.footerText } }, e.currentTarget); }; }
function safeJson(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }

async function renderUsers() { header("Usuários/Admins", "Estrutura para admins, permissões, bloqueios e logs de acesso.", `<button class="primary-action" id="newUser">Novo admin</button>`); const rows = await list("admin_users"); $("#viewRoot").innerHTML = resourceTable({ rows, resource:"admin_users", empty:"Nenhum usuário cadastrado", columns:[["Nome",r=>`<b>${esc(r.name)}</b><br><small>${esc(r.email||"")}</small>`],["Função",r=>esc(r.role)],["Permissões",r=>`<span class="kbd">${esc(JSON.stringify(r.permissions||{}))}</span>`],["Status",r=>badge(r.status)],["Último login",r=>fmtDate(r.last_login_at)]] }); bindResourceActions("admin_users", userModal, () => renderUsers()); $("#newUser").onclick=()=>userModal({role:"admin",status:"active",permissions:{all:true}}); }
function userModal(row={}) { openModal("Admin", `<div class="form-grid">${field("Nome","name",row.name)}${field("E-mail","email",row.email)}${selectField("Função","role",row.role||"admin",["admin","orders","reports","settings","logistics"])}${selectField("Status","status",row.status||"active",["active","blocked"])}</div>${areaField("Permissões JSON","permissions",JSON.stringify(row.permissions||{all:true},null,2),6)}<div style="margin-top:18px"><button class="primary-action" id="saveModal">Salvar admin</button></div>`); $("#saveModal").onclick=async()=>{const data=collectForm(); data.permissions=safeJson(data.permissions,{all:true}); await upsert("admin_users",{...row,...data}); closeModal(); renderUsers();}; }

async function renderSystem() { header("Sistema", "Logs, webhooks, segurança, backup, status do banco e aplicação.", `<button class="secondary-action" id="reloadLogs">Atualizar logs</button>`); const logs = await list("logs"); $("#viewRoot").innerHTML = `<section class="grid grid-4">${metric("Status do banco","Online","Supabase configurado")}${metric("Logs",logs.length,"últimos registros")}${metric("Segurança","Token","ADMIN_TOKEN ativo")}${metric("Backup","Manual","exportações CSV disponíveis")}</section><section class="card" style="margin-top:18px"><div class="toolbar"><select><option>Todos os tipos</option><option>gateway</option><option>pixel</option><option>utmify</option><option>webhook</option><option>error</option></select><input placeholder="Buscar log"></div>${logs.length?`<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Nível</th><th>Origem</th><th>Mensagem</th><th>Status</th><th>Payload</th></tr></thead><tbody>${logs.map(l=>`<tr><td>${fmtDate(l.created_at)}</td><td>${esc(l.type)}</td><td>${badge(l.level)}</td><td>${esc(l.source||"-")}</td><td>${esc(l.message)}</td><td>${l.status_code||"-"}</td><td><pre class="log-payload">${esc(JSON.stringify(l.payload||{},null,2))}</pre></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty-state"><b>Nenhum log registrado</b><span>Logs de gateway, pixel e webhooks aparecerão aqui.</span></div>`}</section>`; $("#reloadLogs").onclick = renderSystem; }

async function renderLogs(type, target) { try { const logs = await list("logs"); const filtered = logs.filter(l => !type || l.type === type || l.source === type).slice(0, 12); $(target).innerHTML = filtered.length ? logList(filtered) : `<div class="empty-state"><b>Sem logs</b><span>Nenhum evento registrado ainda.</span></div>`; } catch { $(target).innerHTML = `<div class="empty-state"><b>Tabela de logs ausente</b><span>Rode o schema atualizado no Supabase.</span></div>`; } }

function exportCsv(filename, rows) { const csv = rows.length ? [Object.keys(rows[0]).join(","), ...rows.map(r => Object.values(r).map(v => `"${String(typeof v === "object" ? JSON.stringify(v) : v ?? "").replace(/"/g,'""')}"`).join(","))].join("\n") : ""; download(filename, csv); }
function download(filename, text) { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"})); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }

$("#saveToken").onclick = () => validateLogin($("#token").value.trim(), true);
$("#token").addEventListener("keydown", (e) => { if (e.key === "Enter") validateLogin($("#token").value.trim(), true); });
$("#logoutButton").onclick = () => { localStorage.removeItem("admin_token"); state.token = ""; showLogin(); };
$("#menuButton").onclick = () => document.body.classList.toggle("drawer-open");
$("#themeToggle").onclick = () => { const next = document.body.dataset.theme === "dark" ? "light" : "dark"; document.body.dataset.theme = next; localStorage.setItem("admin_theme", next); $("#themeToggle").textContent = next === "dark" ? "Modo claro" : "Modo escuro"; };
$("#quickSave").onclick = () => toast("Use o botão salvar da seção atual para persistir alterações.");
window.addEventListener("beforeunload", (event) => { if (state.dirty) { event.preventDefault(); event.returnValue = ""; } });
document.body.dataset.theme = localStorage.getItem("admin_theme") || "light";
validateLogin(state.token, false);
