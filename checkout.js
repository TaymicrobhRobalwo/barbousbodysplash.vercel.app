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
  paymentMethod: "pix",
  card: null,
};

const $ = (selector) => document.querySelector(selector);
const money = (cents) => (Number(cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\s/g, "");
const digits = (value) => String(value || "").replace(/\D/g, "");

function formatPhone(value) {
  const d = digits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatCpf(value) {
  const d = digits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

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

function cardTotal() {
  const fee = Number(state.checkout.creditCardInstallmentFee || 3.99) / 100;
  return Math.round(total() * (1 + fee));
}

function renderInstallments() {
  const select = $("#installments");
  if (!select) return;
  const max = Number(state.checkout.creditCardMaxInstallments || 12);
  const amount = total();
  const cardAmount = cardTotal();
  select.innerHTML = Array.from({ length: max }).map((_, index) => {
    const installments = index + 1;
    const base = installments === 1 ? amount : cardAmount;
    const label = installments === 1
      ? `1x de ${money(amount).replace("R$", "")} Sem juros`
      : `${installments}x de ${money(Math.round(base / installments)).replace("R$", "")}`;
    return `<option value="${installments}" ${installments === max ? "selected" : ""}>${label}</option>`;
  }).join("");
  $("#installmentFeeText").textContent = `Taxa de parcelamento de ${String(state.checkout.creditCardInstallmentFee || 3.99).replace(".", ",")}% no cartão de crédito.`;
}

function setPaymentMethod(method) {
  state.paymentMethod = method;
  document.querySelectorAll("[data-payment]").forEach((item) => item.classList.toggle("selected", item.dataset.payment === method));
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
      body: JSON.stringify({ paymentMethod: state.paymentMethod, card: state.card, customer: state.customer, address: state.address, offerIds: [...state.selectedOffers], utms: collectUtm() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Erro ao gerar Pix");
    if (state.paymentMethod === "credit_card") {
      alert("Pagamento enviado para aprovação.");
      return;
    }
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
  if (state.checkout.creditCardEnabled !== false) $("#creditPayment").classList.remove("hidden");
  updateTotals();
  renderInstallments();
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
  state.customer.phone = formatPhone(state.customer.phone);
  state.customer.cpf = formatCpf(state.customer.cpf);
  const phoneDigits = digits(state.customer.phone);
  const cpfDigits = digits(state.customer.cpf);
  if (phoneDigits.length < 10 || phoneDigits.length > 11) return alert("Informe um telefone válido com DDD.");
  if (cpfDigits.length !== 11) return alert("Informe um CPF válido.");
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

document.querySelectorAll("[data-payment]").forEach((item) => {
  item.addEventListener("click", () => setPaymentMethod(item.dataset.payment));
});

$("#payButton").onclick = () => {
  if (!state.customer.name) return show("customerScreen");
  if (state.paymentMethod === "credit_card" && !state.card) return show("cardScreen");
  createPix();
};

$("#cardForm").onsubmit = (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.currentTarget));
  const [month, year] = String(form.validity || "").split("/");
  state.card = {
    number: digits(form.number),
    holder_name: form.holder_name,
    expiration_month: Number(month),
    expiration_year: Number(year?.length === 2 ? `20${year}` : year),
    cvv: digits(form.cvv),
    installments: Number(form.installments || 1),
  };
  setPaymentMethod("credit_card");
  show("summaryScreen");
};

$("#cardNumber").addEventListener("input", (event) => {
  event.target.value = digits(event.target.value).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");
});

$("#cardValidity").addEventListener("input", (event) => {
  const value = digits(event.target.value).slice(0, 4);
  event.target.value = value.length > 2 ? `${value.slice(0, 2)}/${value.slice(2)}` : value;
});

$("#phone").addEventListener("input", (event) => {
  event.target.value = formatPhone(event.target.value);
});

$("#cpf").addEventListener("input", (event) => {
  event.target.value = formatCpf(event.target.value);
});

function formatCep(value) {
  const d = digits(value).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

async function lookupCep(rawCep) {
  const status = $("#cepStatus");
  const cepDigits = digits(rawCep);
  if (cepDigits.length !== 8) return;

  status.className = "cep-status loading";
  status.textContent = "Buscando CEP...";

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
    const data = await response.json();

    if (data.erro) {
      status.className = "cep-status error";
      status.textContent = "CEP não encontrado. Verifique e tente novamente.";
      return;
    }

    const states = {
      AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
      CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
      MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
      PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
      RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
      RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
      SE: "Sergipe", TO: "Tocantins",
    };

    $("#street").value = data.logradouro || "";
    $("#neighborhood").value = data.bairro || "";
    $("#city").value = data.localidade || "";
    if (states[data.uf]) $("#state").value = states[data.uf];

    [$("#street"), $("#neighborhood"), $("#city")].forEach((el) => el.removeAttribute("readonly"));

    status.className = "cep-status success";
    status.textContent = "Endereço encontrado!";
    $("#cepHelp").classList.add("hidden");
    $("#addressDetails").classList.remove("hidden");

    setTimeout(() => $("#number")?.focus(), 150);
  } catch (_) {
    status.className = "cep-status error";
    status.textContent = "Erro ao buscar CEP. Tente novamente.";
  }
}

$("#cep").addEventListener("input", (event) => {
  event.target.value = formatCep(event.target.value);
  const cepDigits = digits(event.target.value);
  if (cepDigits.length === 8) lookupCep(cepDigits);
  else {
    $("#cepStatus").className = "cep-status";
    $("#cepStatus").textContent = "";
  }
});

init();
