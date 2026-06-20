// Lean Automation — eBay listeleme ön doldurma (gerçek olaylarla, LA motoru)
// DropThatShip mantığı: gerçek mousedown/mouseup/click + tuş tuş yazma kullan.
// eBay'in "Sell Your Item" formu çok adımlı; bu script kuyruktaki ürünün başlık/fiyatını
// bulabildiği alanlara İNSAN GİBİ yazar. Tam tek-tık yayın eBay DOM'una göre canlı ayarlanır.

(() => {
  "use strict";
  const QUEUE_KEY = "la_publish_queue";
  const LA = window.LA;
  if (!LA) { console.warn("[LA] automation motoru yüklenmedi"); return; }

  async function run() {
    const d = await chrome.storage.local.get(QUEUE_KEY);
    const queue = Array.isArray(d[QUEUE_KEY]) ? d[QUEUE_KEY] : [];
    if (!queue.length) return;
    const item = queue[0];

    await LA.waitForStableDom(1000, 15000);

    // Başlık alanı — eBay keyword/title inputları
    const titleEl = await LA.waitFor(
      () =>
        document.querySelector('input[name="title" i], input[aria-label*="title" i]') ||
        document.querySelector('input[placeholder*="what you" i], input[placeholder*="keyword" i], input[type="search"]'),
      { timeoutMs: 12000, intervalMs: 400 }
    );
    if (titleEl && !titleEl.dataset.laFilled) {
      await LA.type(titleEl, item.title.slice(0, 80));
      titleEl.dataset.laFilled = "1";
    }

    // Fiyat alanı
    const priceEl = document.querySelector('input[name*="price" i], input[aria-label*="price" i], input[id*="price" i]');
    if (priceEl && !priceEl.dataset.laFilled && item.ebayPrice) {
      await LA.type(priceEl, String(item.ebayPrice), { delay: 30 });
      priceEl.dataset.laFilled = "1";
    }

    banner(item);
  }

  function banner(item) {
    if (document.getElementById("la-sell-banner")) return;
    const b = document.createElement("div");
    b.id = "la-sell-banner";
    b.style.cssText =
      "position:fixed;top:12px;right:12px;z-index:999999;background:linear-gradient(135deg,#7c3aed,#10b981);color:#fff;padding:12px 16px;border-radius:10px;font:600 13px sans-serif;box-shadow:0 6px 20px rgba(0,0,0,0.35);max-width:280px;";
    b.innerHTML = `Lean Automation<br><span style="font-weight:400;font-size:12px">"${item.title.slice(0, 40)}…"<br>Önerilen fiyat: <b>$${item.ebayPrice}</b><br>Alanlar dolduruldu, kontrol edip yayınla.</span>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 9000);
  }

  run();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 1000); })
    .observe(document.body, { childList: true, subtree: true });
})();
