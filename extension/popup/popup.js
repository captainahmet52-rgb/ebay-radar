// Lean Automation — popup mantığı
const STORAGE_KEY = "la_selected_asins";
const $ = (id) => document.getElementById(id);

function setMsg(t, ok = true) {
  const el = $("msg");
  el.textContent = t;
  el.style.color = ok ? "#10b981" : "#f85149";
  if (t) setTimeout(() => (el.textContent = ""), 2500);
}

function render(list) {
  $("count").textContent = String(list.length);
  const box = $("list");
  if (!list.length) {
    box.innerHTML = '<p class="empty">Amazon\'da ürün seçin…</p>';
    return;
  }
  box.innerHTML = list.map((a) => `<div class="item">${a}</div>`).join("");
}

async function loadFromStorage() {
  const d = await chrome.storage.local.get(STORAGE_KEY);
  render(Array.isArray(d[STORAGE_KEY]) ? d[STORAGE_KEY] : []);
}

// Aktif Amazon sekmesini bul
async function amazonTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https:\/\/www\.amazon\./.test(tab.url || "")) return null;
  return tab;
}

async function send(action, extra = {}) {
  const tab = await amazonTab();
  if (!tab) {
    setMsg("Önce bir Amazon sayfası aç.", false);
    return null;
  }
  try {
    return await chrome.tabs.sendMessage(tab.id, { action, ...extra });
  } catch {
    setMsg("Sayfayı yenile ve tekrar dene.", false);
    return null;
  }
}

function readFilters() {
  const num = (id) => {
    const v = parseFloat($(id).value);
    return Number.isFinite(v) ? v : null;
  };
  return {
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    minReviews: num("minReviews"),
    minRating: $("minRating").value ? parseFloat($("minRating").value) : null,
    prime: $("prime").checked,
  };
}

// ── Olaylar ──────────────────────────────────────────────────────────────────
$("selectAll").addEventListener("click", async () => {
  const r = await send("LA_SELECT_ALL", { filters: readFilters() });
  if (r) { await loadFromStorage(); setMsg(`${r.count} ürün seçili`); }
});

$("deselect").addEventListener("click", async () => {
  const r = await send("LA_DESELECT_ALL");
  if (r) { await loadFromStorage(); setMsg("Seçim kaldırıldı"); }
});

$("clear").addEventListener("click", async () => {
  // Sayfa açık değilse bile hafızayı temizle
  const tab = await amazonTab();
  if (tab) await send("LA_CLEAR");
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  await loadFromStorage();
  setMsg("Liste temizlendi");
});

$("copy").addEventListener("click", async () => {
  const d = await chrome.storage.local.get(STORAGE_KEY);
  const list = Array.isArray(d[STORAGE_KEY]) ? d[STORAGE_KEY] : [];
  if (!list.length) { setMsg("Liste boş", false); return; }
  await navigator.clipboard.writeText(list.join("\n"));
  setMsg(`${list.length} ASIN kopyalandı`);
});

// Depodaki değişiklikleri canlı yansıt
chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && c[STORAGE_KEY]) render(c[STORAGE_KEY].newValue || []);
  if (area === "local" && c.la_prepared) loadPrepared();
});

loadFromStorage();

// ── Hazırlananlar (eBay'e) ────────────────────────────────────────────────────
const PREP_KEY = "la_prepared";
const SETTINGS_KEY = "la_settings";
const QUEUE_KEY = "la_publish_queue";

function ebayPrice(amazon, marginPct, commission = 0.13) {
  const fixed = amazon >= 10 ? 0.4 : 0.3;
  const div = 1 - commission - marginPct / 100;
  if (div <= 0) return null;
  return Math.round(((amazon + fixed) / div) * 100) / 100;
}

function prepMsg(t, ok = true) {
  const el = $("prepMsg");
  el.textContent = t; el.style.color = ok ? "#10b981" : "#f85149";
  if (t) setTimeout(() => (el.textContent = ""), 2500);
}

let prepared = [];

async function loadPrepared() {
  const [d, s] = await Promise.all([
    chrome.storage.local.get(PREP_KEY),
    chrome.storage.local.get(SETTINGS_KEY),
  ]);
  prepared = Array.isArray(d[PREP_KEY]) ? d[PREP_KEY] : [];
  const margin = Number(s[SETTINGS_KEY]?.marginPct) > 0 ? Number(s[SETTINGS_KEY].marginPct) : 25;
  $("marginPct").value = margin;
  renderPrepared(margin);
}

function renderPrepared(margin) {
  $("prepCount").textContent = String(prepared.length);
  const box = $("prepList");
  if (!prepared.length) {
    box.innerHTML = '<p class="empty">Amazon ürün sayfasında "Lean\'e Aktar"a bas…</p>';
    return;
  }
  box.innerHTML = prepared
    .map((it) => {
      const p = ebayPrice(it.amazonPrice, margin) ?? it.ebayPrice;
      return `<div class="prep-item"><span class="t">${it.title}</span><span class="p">$${p}</span></div>`;
    })
    .join("");
}

$("marginPct").addEventListener("input", async () => {
  const m = Number($("marginPct").value) || 25;
  await chrome.storage.local.set({ [SETTINGS_KEY]: { marginPct: m } });
  renderPrepared(m);
});

$("ebayUpload").addEventListener("click", async () => {
  if (!prepared.length) { prepMsg("Liste boş", false); return; }
  const m = Number($("marginPct").value) || 25;
  const queue = prepared.map((it) => ({ ...it, ebayPrice: ebayPrice(it.amazonPrice, m) ?? it.ebayPrice }));
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
  await chrome.tabs.create({ url: "https://www.ebay.com/sl/prelist/home?sr=shstart" });
  prepMsg("eBay listeleme açıldı, başlık aranıyor…");
});

$("csv").addEventListener("click", () => {
  if (!prepared.length) { prepMsg("Liste boş", false); return; }
  const m = Number($("marginPct").value) || 25;
  const head = "ASIN,Title,AmazonPrice,eBayPrice,Image,URL";
  const rows = prepared.map((it) => {
    const p = ebayPrice(it.amazonPrice, m) ?? it.ebayPrice;
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    return [it.asin, esc(it.title), it.amazonPrice, p, esc(it.images?.[0] ?? ""), esc(it.url)].join(",");
  });
  const blob = new Blob([head + "\n" + rows.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lean-products-${Date.now()}.csv`;
  a.click();
  prepMsg(`${prepared.length} ürün CSV indirildi`);
});

$("prepClear").addEventListener("click", async () => {
  await chrome.storage.local.set({ [PREP_KEY]: [] });
  await loadPrepared();
  prepMsg("Hazırlananlar temizlendi");
});

loadPrepared();
