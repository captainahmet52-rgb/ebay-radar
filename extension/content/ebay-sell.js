// Lean Automation — eBay listeleme ön doldurma (gerçek olaylarla, LA motoru)
// DropThatShip mantığı: gerçek mousedown/mouseup/click + tuş tuş yazma kullan.
// eBay'in "Sell Your Item" formu çok adımlı; bu script kuyruktaki ürünün başlık/fiyatını
// bulabildiği alanlara İNSAN GİBİ yazar. Tam tek-tık yayın eBay DOM'una göre canlı ayarlanır.

(() => {
  "use strict";
  const QUEUE_KEY = "la_publish_queue";
  const LA = window.LA;
  if (!LA) { console.warn("[LA] automation motoru yüklenmedi"); return; }

  // eBay prelist arama kutusunu bul (locale bağımsız)
  function findSearchBox() {
    return (
      document.querySelector(
        'input[placeholder*="Marka" i], input[placeholder*="model" i], input[placeholder*="Brand" i], input[placeholder*="describe" i]'
      ) ||
      document.querySelector('input[type="search"], input[role="combobox"]') ||
      document.querySelector("main input[type='text']")
    );
  }

  async function run() {
    const d = await chrome.storage.local.get(QUEUE_KEY);
    const queue = Array.isArray(d[QUEUE_KEY]) ? d[QUEUE_KEY] : [];
    if (!queue.length) return;
    const item = queue[0];

    const onPrelist = location.pathname.includes("/sl/prelist") || location.pathname.includes("/sl/sell");

    await LA.waitForStableDom(1000, 15000);

    if (onPrelist) {
      // 1) Başlangıç sayfası: ürün başlığını arama kutusuna yaz → "Aramak"a bas
      const box = await LA.waitFor(findSearchBox, { timeoutMs: 12000, intervalMs: 400 });
      if (box && !box.dataset.laFilled) {
        await LA.type(box, item.title.slice(0, 80));
        box.dataset.laFilled = "1";
        await LA.sleep(400);
        const aramak =
          LA.findByText(["aramak", "search", "ara"]) ||
          document.querySelector('button[type="submit"]');
        if (aramak) LA.click(aramak);
        banner(item, "Başlık yazıldı, katalog aranıyor. Eşleşeni seç, fiyat: $" + item.ebayPrice);
        return;
      }
    }

    // 2) Sonraki adımlarda fiyat alanı çıkarsa doldur
    const priceEl = document.querySelector('input[name*="price" i], input[aria-label*="price" i], input[id*="price" i]');
    if (priceEl && !priceEl.dataset.laFilled && item.ebayPrice) {
      await LA.type(priceEl, String(item.ebayPrice), { delay: 30 });
      priceEl.dataset.laFilled = "1";
    }

    banner(item);
  }

  function banner(item, note) {
    const old = document.getElementById("la-sell-banner");
    if (old) old.remove();
    const b = document.createElement("div");
    b.id = "la-sell-banner";
    b.style.cssText =
      "position:fixed;top:12px;right:12px;z-index:999999;background:linear-gradient(135deg,#7c3aed,#10b981);color:#fff;padding:12px 16px;border-radius:10px;font:600 13px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.35);max-width:300px;";
    const msg = note || `"${item.title.slice(0, 40)}…" — önerilen fiyat: $${item.ebayPrice}. Alanlar dolduruldu.`;
    b.innerHTML = `Lean Automation<br><span style="font-weight:400;font-size:12px">${msg}</span>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 10000);
  }

  run();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 1000); })
    .observe(document.body, { childList: true, subtree: true });
})();
