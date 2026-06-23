// Lean Automation — popup (sayfa-üstü panelin küçük yedeği)
// Sadece seçili ASIN'leri gösterir + kopyala/temizle. Asıl iş Amazon'daki yüzen panelde.
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
  box.innerHTML = list.length
    ? list.map((a) => `<div class="item">${a}</div>`).join("")
    : '<p class="empty">Amazon\'da ürün seçin…</p>';
}

async function load() {
  const d = await chrome.storage.local.get(STORAGE_KEY);
  render(Array.isArray(d[STORAGE_KEY]) ? d[STORAGE_KEY] : []);
}

$("copy").addEventListener("click", async () => {
  const d = await chrome.storage.local.get(STORAGE_KEY);
  const list = Array.isArray(d[STORAGE_KEY]) ? d[STORAGE_KEY] : [];
  if (!list.length) { setMsg("Liste boş", false); return; }
  await navigator.clipboard.writeText(list.join("\n"));
  setMsg(`${list.length} ASIN kopyalandı`);
});

$("clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ [STORAGE_KEY]: [] });
  await load();
  setMsg("Liste temizlendi");
});

chrome.storage.onChanged.addListener((c, area) => {
  if (area === "local" && c[STORAGE_KEY]) render(c[STORAGE_KEY].newValue || []);
});

load();
