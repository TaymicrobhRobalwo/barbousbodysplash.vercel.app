let token = localStorage.getItem("admin_token") || "";
let settings = { product: {}, gateway: {}, offers: [] };
let pixels = [];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}

function requireLogin() {
  if (!token) return;
  $("#login").classList.add("hidden");
  $("#app").classList.remove("hidden");
  loadAll();
}

function switchTab(id) {
  $$("aside button").forEach((button) => button.classList.toggle("active", button.dataset.tab === id));
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.id === id));
  $("#pageTitle").textContent = $(`aside button[data-tab="${id}"]`).textContent;
  if (id === "orders") loadOrders();
}

function renderSettings() {
  for (const key of ["storeName", "productName", "price", "compareAtPrice", "image", "expirationMinutes"]) {
    $("#" + key).value = settings.product?.[key] ?? "";
  }
  for (const key of ["publicKey", "secretKey", "providerName", "postbackUrl", "pixExpiresInDays"]) {
    $("#" + key).value = settings.gateway?.[key] ?? "";
  }
  renderOffers();
}

function renderOffers() {
  $("#offersEditor").innerHTML = (settings.offers || []).map((offer, index) => `
    <div class="offer-editor" data-index="${index}">
      <label>Nome<input data-key="name" value="${offer.name || ""}"></label>
      <label>Preço<input data-key="price" type="number" value="${offer.price || 0}"></label>
      <label>De<input data-key="compareAtPrice" type="number" value="${offer.compareAtPrice || 0}"></label>
      <label>Imagem<input data-key="image" value="${offer.image || ""}"></label>
      <label>Ativa<select data-key="enabled"><option value="true" ${offer.enabled ? "selected" : ""}>Sim</option><option value="false" ${!offer.enabled ? "selected" : ""}>Não</option></select></label>
      <button class="removeOffer" type="button">Remover</button>
    </div>
  `).join("");
  $$(".removeOffer").forEach((button) => button.onclick = () => {
    settings.offers.splice(Number(button.closest(".offer-editor").dataset.index), 1);
    renderOffers();
  });
}

function collectSettings() {
  settings.product = {
    storeName: $("#storeName").value,
    productName: $("#productName").value,
    price: Number($("#price").value),
    compareAtPrice: Number($("#compareAtPrice").value),
    image: $("#image").value,
    quantity: 1,
    expirationMinutes: Number($("#expirationMinutes").value || 20),
  };
  settings.gateway = {
    ...settings.gateway,
    publicKey: $("#publicKey").value,
    secretKey: $("#secretKey").value,
    providerName: $("#providerName").value || "Elly Perfumaria",
    postbackUrl: $("#postbackUrl").value,
    pixExpiresInDays: Number($("#pixExpiresInDays").value || 1),
  };
  settings.offers = $$(".offer-editor").map((row, index) => ({
    id: settings.offers[index]?.id || `offer-${Date.now()}-${index}`,
    name: $('[data-key="name"]', row).value,
    price: Number($('[data-key="price"]', row).value),
    compareAtPrice: Number($('[data-key="compareAtPrice"]', row).value),
    image: $('[data-key="image"]', row).value,
    enabled: $('[data-key="enabled"]', row).value === "true",
  }));
}

async function loadAll() {
  settings = await api("/api/settings");
  renderSettings();
  await loadPixels();
}

async function loadOrders() {
  const orders = await api("/api/orders");
  $("#ordersBody").innerHTML = orders.map((order) => `
    <tr>
      <td><b>${order.public_id}</b><br><small>${order.external_order_id}</small></td>
      <td><span class="status">${order.status}</span></td>
      <td>${money(order.amount)}</td>
      <td>${order.customer?.name || ""}<br><small>${order.customer?.email || ""}</small></td>
      <td>${order.freepay_transaction_id || "-"}</td>
      <td>${new Date(order.created_at).toLocaleString("pt-BR")}</td>
    </tr>
  `).join("");
}

async function loadPixels() {
  pixels = await api("/api/pixels");
  for (const platform of ["meta", "tiktok"]) {
    const root = $(`.pixel-tab[data-platform="${platform}"]`);
    $(".pixelList", root).innerHTML = pixels.filter((pixel) => pixel.platform === platform).map((pixel) => `
      <div class="pixel-item" data-id="${pixel.id}">
        <label>Nome<input data-key="name" value="${pixel.name || ""}"></label>
        <label>Pixel ID<input data-key="pixel_id" value="${pixel.pixel_id || ""}"></label>
        <label>Ativo<select data-key="enabled"><option value="true" ${pixel.enabled ? "selected" : ""}>Sim</option><option value="false" ${!pixel.enabled ? "selected" : ""}>Não</option></select></label>
        <div><button class="savePixel" type="button">Salvar</button><button class="deletePixel secondary" type="button">Excluir</button></div>
      </div>
    `).join("");
  }
  $$(".savePixel").forEach((button) => button.onclick = () => saveExistingPixel(button.closest(".pixel-item")));
  $$(".deletePixel").forEach((button) => button.onclick = () => deletePixel(button.closest(".pixel-item").dataset.id));
}

async function saveExistingPixel(row) {
  await api("/api/pixels", {
    method: "PUT",
    body: JSON.stringify({
      id: row.dataset.id,
      name: $('[data-key="name"]', row).value,
      pixel_id: $('[data-key="pixel_id"]', row).value,
      enabled: $('[data-key="enabled"]', row).value === "true",
    }),
  });
  await loadPixels();
}

async function deletePixel(id) {
  if (!confirm("Excluir pixel?")) return;
  await api(`/api/pixels?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  await loadPixels();
}

async function addPixel(root) {
  await api("/api/pixels", {
    method: "POST",
    body: JSON.stringify({
      platform: root.dataset.platform,
      name: $(".pixelName", root).value,
      pixel_id: $(".pixelId", root).value,
      access_token: $(".pixelToken", root).value,
      enabled: true,
      events: { page_view: true, initiate_checkout: true, purchase: true },
    }),
  });
  $$("input", root).forEach((input) => input.value = "");
  await loadPixels();
}

$("#saveToken").onclick = () => {
  token = $("#token").value;
  localStorage.setItem("admin_token", token);
  requireLogin();
};
$("#reload").onclick = loadAll;
$$('aside button').forEach((button) => button.onclick = () => switchTab(button.dataset.tab));
$("#addOffer").onclick = () => { settings.offers.push({ id: `offer-${Date.now()}`, name: "Nova oferta", price: 1990, compareAtPrice: 3990, image: "IMG_2112.PNG.png", enabled: true }); renderOffers(); };
$("#saveSettings").onclick = async () => { collectSettings(); await api("/api/settings", { method: "POST", body: JSON.stringify({ product: settings.product, offers: settings.offers }) }); alert("Configurações salvas"); };
$("#saveGateway").onclick = async () => { collectSettings(); await api("/api/settings", { method: "POST", body: JSON.stringify({ gateway: settings.gateway }) }); alert("Gateway salvo"); };
$$('.addPixel').forEach((button) => button.onclick = () => addPixel(button.closest(".pixel-tab")));
requireLogin();
