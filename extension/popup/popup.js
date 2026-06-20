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
});

loadFromStorage();
