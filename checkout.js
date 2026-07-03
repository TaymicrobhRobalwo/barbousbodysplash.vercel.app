const state = {
  product: null,
  offers: [],
  offerIndex: 0,
  selectedOffers: new Set(),
  customer: {},
  address: {},
  pixels: [],
  checkout: {},
  branding: {},
};

const $ = (selector) => document.querySelector(selector);
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, "");
const digits = (value) => String(value || "").replace(/\D/g, "");

function show(id) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.remove("active"));
  $("#" + id).classList.add("active");
  window.scrollTo(0, 0);
}

function total() {
  let value = state.product?.price || 9749;
  for (const id of state.selectedOffers) {
    const offer = state.offers.find((item) => item.id === id);
    if (offer) value += Number(offer.price || 0);
  }
  return value;
}

function updateTotals() {
  const subtotal = total();
  const count = 1 + state.selectedOffers.size;
  $("#subtotalText").textContent = money(subtotal);
  $("#totalTopText").textContent = money(subtotal);
  $("#footerTotal").textContent = money(subtotal);
  $("#itemCount").textContent = count;
  $("#pixAmountTitle").textContent = money(subtotal);
  $("#chargedAs").textContent = money(subtotal);
}

function renderOffer() {
  const offer = state.offers[state.offerIndex];
  if (!offer) return;
  const selected = state.selectedOffers.has(offer.id);
  const name = offer.name || offer.title || "Oferta especial";
  $("#offerCard").innerHTML = `
    <img src="${offer.image || "IMG_2112.PNG.png"}" alt="${name}">
    <h3>${name}</h3>
    <del>${money(offer.compareAtPrice)}</del>
    <strong>${money(offer.price)}</strong>
    <button type="button" class="${selected ? "selected" : ""}" id="toggleOffer"><span></span>PEGAR OFERTA</button>
    <p>${offer.description || "Aplique antes do Body Splash e seu cheiro dura o DIA INTEIRO."}</p>
    <a href="#">Ver mais</a>
  `;
  $("#offerDots").innerHTML = state.offers.map((_, index) => `<span class="${index === state.offerIndex ? "active" : ""}"></span>`).join("");
  $("#toggleOffer").onclick = () => {
    if (state.selectedOffers.has(offer.id)) state.selectedOffers.delete(offer.id);
    else state.selectedOffers.add(offer.id);
    updateTotals();
    renderOffer();
  };
}

function applyCheckoutTheme() {
  const branding = state.branding || {};
  const checkout = state.checkout || {};
  const primary = branding.buttonColor || branding.primaryColor || "#FE2C56";
  document.documentElement.style.setProperty("--checkout-primary", primary);
  document.documentElement.style.setProperty("--checkout-text", branding.textColor || "#161823");
  document.documentElement.style.setProperty("--checkout-font", `${branding.fontPrimary || "Inter"}, Arial, sans-serif`);
  document.body.style.background = branding.backgroundColor || "#f4f4f5";
  if (checkout.buttonText) $("#payButton").textContent = checkout.buttonText;
  if (checkout.securityText) document.querySelector(".topbar span").textContent = `♡ ${checkout.securityText}`;
}

function startCountdown(minutes, target) {
  let seconds = minutes * 60;
  const tick = () => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    target.textContent = `${h}:${m}:${s}`;
    seconds = Math.max(0, seconds - 1);
  };
  tick();
  return setInterval(tick, 1000);
}

function loadPixels() {
  for (const pixel of state.pixels) {
    if (!pixel.enabled && pixel.enabled !== undefined) continue;
    if (pixel.platform === "meta" && pixel.pixel_id && !window.fbq) {
      window.fbq = function(){ window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments); };
      window.fbq.queue = [];
      window.fbq.loaded = true;
      window.fbq.version = "2.0";
      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }
    if (pixel.platform === "meta" && pixel.pixel_id) {
      window.fbq("init", pixel.pixel_id);
      if (pixel.events?.page_view !== false) window.fbq("track", "PageView");
    }
    if (pixel.platform === "tiktok" && pixel.pixel_id && !window.ttq) {
      !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid="+e+"&lib="+t;document.head.appendChild(n)};}(window,document,"ttq");
    }
    if (pixel.platform === "tiktok" && pixel.pixel_id) {
      window.ttq.load(pixel.pixel_id);
      if (pixel.events?.page_view !== false) window.ttq.page();
    }
  }
}

function track(event, params = {}) {
  for (const pixel of state.pixels) {
    if (pixel.platform === "meta" && window.fbq) window.fbq("track", event, params);
    if (pixel.platform === "tiktok" && window.ttq) window.ttq.track(event, params);
  }
}

function collectUtm() {
  const params = new URLSearchParams(location.search);
  const utms = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "ttclid"]) {
    if (params.get(key)) utms[key] = params.get(key);
  }
  return utms;
}

async function createPix() {
  const button = $("#payButton");
  button.classList.add("loading");
  button.textContent = "";
  button.disabled = true;
  button.innerHTML = "○";
  try {
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customer: state.customer, address: state.address, offerIds: [...state.selectedOffers], utms: collectUtm() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro ao gerar Pix");
    $("#pixCode").textContent = data.pixCode || data.pixUrl || "Código Pix não retornado pelo gateway";
    $("#pixDeadline").textContent = new Date(data.expiresAt || Date.now() + 20 * 60000).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "numeric" });
    track("Purchase", { value: total() / 100, currency: "BRL", order_id: data.orderId });
    show("pixScreen");
  } catch (error) {
    alert(error.message);
  } finally {
    button.classList.remove("loading");
    button.disabled = false;
    button.textContent = "Pagar";
  }
}

async function init() {
  try {
    const config = await fetch("/api/config").then((res) => res.json());
    state.product = config.product;
    state.checkout = config.checkout || {};
    state.branding = config.branding || {};
    state.offers = (config.offers || []).filter((offer) => offer.enabled);
    state.pixels = config.pixels || [];
  } catch (_) {
    state.product = { productName: "Kit 4 Body Splash Barbours Beauty 200ml | Delight + Very Sexy + Roses ...", price: 9749, image: "IMG_2103.jpg", expirationMinutes: 20 };
    state.offers = [];
  }

  $("#productName").textContent = state.product.productName;
  $("#productPrice").textContent = money(state.product.price);
  $("#productImage").src = state.product.image || "IMG_2103.jpg";
  $("#offerCount").textContent = `${state.offers.length} ofertas`;
  applyCheckoutTheme();
  updateTotals();
  renderOffer();
  startCountdown(state.checkout.timerMinutes || state.product.expirationMinutes || 20, $("#countdown"));
  startCountdown(10, $("#pixCountdown"));
  loadPixels();
  track("InitiateCheckout", { value: total() / 100, currency: "BRL" });
}

$("#openCustomer").onclick = () => show("customerScreen");
document.querySelectorAll(".back").forEach((button) => button.onclick = () => show(button.dataset.back));
$("#prevOffer").onclick = () => { state.offerIndex = (state.offerIndex - 1 + state.offers.length) % state.offers.length; renderOffer(); };
$("#nextOffer").onclick = () => { state.offerIndex = (state.offerIndex + 1) % state.offers.length; renderOffer(); };
$("#payButton").onclick = () => state.customer.name ? createPix() : show("customerScreen");
$("#copyPix").onclick = async () => { await navigator.clipboard.writeText($("#pixCode").textContent); $("#copyPix").textContent = "Copiado"; };

$("#customerForm").onsubmit = (event) => {
  event.preventDefault();
  state.customer = Object.fromEntries(new FormData(event.currentTarget));
  state.customer.noEmail = event.currentTarget.noEmail.checked;
  show("addressScreen");
};

$("#addressForm").onsubmit = (event) => {
  event.preventDefault();
  state.address = Object.fromEntries(new FormData(event.currentTarget));
  $("#addressTitle").textContent = `${state.customer.name} (${state.customer.phone})`;
  $("#addressSubtitle").textContent = `${state.address.street}, ${state.address.number || "S/N"} — ${state.address.city}/${state.address.state}`;
  show("summaryScreen");
};

$("#cep").addEventListener("blur", async (event) => {
  const cep = digits(event.target.value);
  if (cep.length !== 8) return;
  try {
    const data = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((res) => res.json());
    if (data.erro) return;
    $("#street").value = data.logradouro || "";
    $("#neighborhood").value = data.bairro || "";
    $("#city").value = data.localidade || "";
    const states = { MG: "Minas Gerais", SP: "São Paulo", RJ: "Rio de Janeiro", BA: "Bahia", PR: "Paraná", SC: "Santa Catarina", RS: "Rio Grande do Sul" };
    if (states[data.uf]) $("#state").value = states[data.uf];
  } catch (_) {}
});

init();
