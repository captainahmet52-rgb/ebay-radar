// Lean Automation — eBay listeleme sayfası (en iyi-çaba ön doldurma)
// NOT: eBay'in "Sell Your Item" akışı çok adımlı ve sık değişir. Bu script kuyruktaki
// ürünün BAŞLIĞINI/FİYATINI bulabildiği alanlara yazar; tam tek-tık yayın canlı testle ayarlanır.

(() => {
  "use strict";
  const QUEUE_KEY = "la_publish_queue";

  function setVal(el, val) {
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter ? setter.call(el, val) : (el.value = val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function fillFromQueue() {
    const d = await chrome.storage.local.get(QUEUE_KEY);
    const queue = Array.isArray(d[QUEUE_KEY]) ? d[QUEUE_KEY] : [];
    if (!queue.length) return;
    const item = queue[0];

    // Başlık / keyword alanı (eBay sell giriş kutusu ya da başlık inputu)
    const titleEl =
      document.querySelector('input[name="title"], input[aria-label*="title" i], #s0-1-1-7-7-\\@keyword-\\@box-\\@input') ||
      document.querySelector('input[placeholder*="Tell us what you" i], input[placeholder*="keyword" i], input[type="search"]');
    if (titleEl && !titleEl.dataset.laFilled) {
      setVal(titleEl, item.title.slice(0, 80));
      titleEl.dataset.laFilled = "1";
    }

    // Fiyat alanı (varsa)
    const priceEl = document.querySelector('input[name*="price" i], input[aria-label*="price" i], input[id*="price" i]');
    if (priceEl && !priceEl.dataset.laFilled && item.ebayPrice) {
      setVal(priceEl, String(item.ebayPrice));
      priceEl.dataset.laFilled = "1";
    }

    showBanner(item);
  }

  function showBanner(item) {
    if (document.getElementById("la-sell-banner")) return;
    const b = document.createElement("div");
    b.id = "la-sell-banner";
    b.style.cssText = [
      "position:fixed", "top:12px", "right:12px", "z-index:999999",
      "background:linear-gradient(135deg,#7c3aed,#10b981)", "color:#fff",
      "padding:12px 16px", "border-radius:10px", "font:600 13px sans-serif",
      "box-shadow:0 6px 20px rgba(0,0,0,0.35)", "max-width:280px",
    ].join(";");
    b.innerHTML = `Lean Automation<br><span style="font-weight:400;font-size:12px">
      "${item.title.slice(0, 40)}…"<br>Önerilen eBay fiyatı: <b>$${item.ebayPrice}</b><br>
      Başlık/fiyat dolduruldu, kontrol edip yayınla.</span>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 8000);
  }

  // Sayfa yüklenince + dinamik değişimlerde dene
  const run = () => fillFromQueue();
  run();
  let t = null;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(run, 800); })
    .observe(document.body, { childList: true, subtree: true });
})();
