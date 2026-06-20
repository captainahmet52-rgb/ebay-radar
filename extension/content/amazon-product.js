// Lean Automation — Amazon ÜRÜN SAYFASI scripti (/dp/)
// Ürün detayını (başlık, fiyat, görseller) çeker, eBay fiyatını hesaplar,
// "Lean'e Aktar" ile hazırlananlar listesine ekler. Temiz kod.

(() => {
  "use strict";

  const PREP_KEY = "la_prepared";
  const SETTINGS_KEY = "la_settings";
  const MAX_PREP = 500;

  function asinFromUrl() {
    const m = location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    return m ? m[1].toUpperCase() : null;
  }

  // eBay fiyatı (panel repricer mantığı): (amazon + sabit) / (1 - komisyon - marj)
  function ebayPrice(amazon, marginPct, commission = 0.13) {
    const fixed = amazon >= 10 ? 0.4 : 0.3;
    const divisor = 1 - commission - marginPct / 100;
    if (divisor <= 0) return null;
    return Math.round(((amazon + fixed) / divisor) * 100) / 100;
  }

  function parsePrice() {
    const sels = [
      "#corePrice_feature_div .a-offscreen",
      "#corePriceDisplay_desktop_feature_div .a-offscreen",
      "span.a-price .a-offscreen",
      "#priceblock_ourprice",
      "#priceblock_dealprice",
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el) {
        const v = parseFloat((el.textContent || "").replace(/[^\d.]/g, ""));
        if (Number.isFinite(v) && v > 0) return v;
      }
    }
    return null;
  }

  function parseTitle() {
    return (document.getElementById("productTitle")?.textContent || "").trim();
  }

  function parseImages() {
    const urls = new Set();
    document.querySelectorAll("#altImages img, #imgTagWrapperId img, #landingImage").forEach((img) => {
      let src = img.getAttribute("src") || "";
      // küçük thumbnail → büyük versiyon
      src = src.replace(/\._[^.]+_\./, ".");
      if (src.startsWith("http")) urls.add(src);
    });
    return Array.from(urls).slice(0, 12);
  }

  function inStock() {
    const t = (document.getElementById("availability")?.textContent || "").toLowerCase();
    if (/unavailable|out of stock|mevcut değil|tükendi/.test(t)) return false;
    return true;
  }

  async function addPrepButton() {
    const asin = asinFromUrl();
    if (!asin || document.getElementById("la-prep-btn")) return;
    const titleEl = document.getElementById("titleSection") || document.getElementById("title") || document.getElementById("productTitle");
    if (!titleEl) return;

    const btn = document.createElement("button");
    btn.id = "la-prep-btn";
    btn.textContent = "📤 Lean'e Aktar";
    btn.style.cssText = [
      "display:inline-flex", "align-items:center", "gap:6px", "margin-top:10px",
      "padding:8px 16px", "background:linear-gradient(135deg,#7c3aed,#10b981)",
      "color:#fff", "border:none", "border-radius:8px", "font-size:13px",
      "font-weight:700", "cursor:pointer", "box-shadow:0 2px 8px rgba(124,58,237,0.35)",
    ].join(";");

    btn.addEventListener("click", async () => {
      const price = parsePrice();
      const title = parseTitle();
      if (!price || !title) { alert("Ürün fiyatı/başlığı okunamadı."); return; }

      const s = (await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY] || {};
      const marginPct = Number(s.marginPct) > 0 ? Number(s.marginPct) : 25;

      const item = {
        asin, title,
        amazonPrice: price,
        ebayPrice: ebayPrice(price, marginPct),
        images: parseImages(),
        inStock: inStock(),
        url: location.href.split("?")[0],
        addedAt: Date.now(),
      };

      const d = await chrome.storage.local.get(PREP_KEY);
      const list = Array.isArray(d[PREP_KEY]) ? d[PREP_KEY] : [];
      if (list.some((x) => x.asin === asin)) { flash(btn, "Zaten ekli"); return; }
      if (list.length >= MAX_PREP) { alert(`En fazla ${MAX_PREP} ürün.`); return; }
      list.push(item);
      await chrome.storage.local.set({ [PREP_KEY]: list });
      flash(btn, `✓ Eklendi ($${item.ebayPrice})`);
    });

    titleEl.insertAdjacentElement("afterend", btn);
  }

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    setTimeout(() => { btn.textContent = old; btn.disabled = false; }, 1600);
  }

  if (location.pathname.match(/\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i)) {
    addPrepButton();
    new MutationObserver(() => addPrepButton()).observe(document.body, { childList: true, subtree: true });
  }
})();
