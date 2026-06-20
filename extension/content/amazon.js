// Lean Automation — Amazon içerik scripti (ASIN grabber)
// Amazon arama/sonuç sayfalarındaki ürünlere onay kutusu ekler, seçilenleri saklar.
// Temiz kod — minified değil. chrome.storage.local ile kalıcı.

(() => {
  "use strict";

  const STORAGE_KEY = "la_selected_asins";
  const MAX_ASINS = 5000;
  const ASIN_RE = /^[A-Z0-9]{10}$/i;

  /** Seçili ASIN seti (hafıza). */
  const selected = new Set();

  // ── Başlangıç: kayıtlı listeyi yükle ────────────────────────────────────────
  chrome.storage.local.get(STORAGE_KEY).then((d) => {
    const list = d[STORAGE_KEY];
    if (Array.isArray(list)) list.slice(0, MAX_ASINS).forEach((a) => selected.add(a));
    injectCheckboxes();
  });

  function persist() {
    chrome.storage.local.set({ [STORAGE_KEY]: Array.from(selected) });
    chrome.runtime.sendMessage({ action: "LA_COUNT", count: selected.size }).catch(() => {});
  }

  // ── Sonuç kartlarına onay kutusu ekle ───────────────────────────────────────
  function injectCheckboxes() {
    document.querySelectorAll('[data-asin]:not([data-asin=""])').forEach((card) => {
      const asin = card.getAttribute("data-asin");
      if (!asin || !ASIN_RE.test(asin) || card.querySelector(".la-asin-cb")) return;

      // Görsel kabını bul (köşeye koymak için)
      let anchor = card.querySelector(".s-product-image-container");
      if (!anchor) {
        const img = card.querySelector("img[src]");
        if (img) anchor = img.parentElement;
      }
      if (!anchor) return;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "la-asin-cb";
      cb.dataset.asin = asin;
      cb.checked = selected.has(asin);
      anchor.style.position = "relative";
      cb.addEventListener("change", (e) => {
        if (e.target.checked) {
          if (selected.size >= MAX_ASINS) {
            e.target.checked = false;
            alert(`En fazla ${MAX_ASINS} ASIN seçilebilir.`);
            return;
          }
          selected.add(asin);
        } else {
          selected.delete(asin);
        }
        persist();
      });
      anchor.appendChild(cb);
    });
  }

  // ── Dinamik içerik için gözlemci ────────────────────────────────────────────
  let debounce = null;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(injectCheckboxes, 400);
  }).observe(document.body, { childList: true, subtree: true });

  // ── Kart filtre yardımcıları ────────────────────────────────────────────────
  function cardPrice(card) {
    const whole = card.querySelector(".a-price .a-price-whole");
    if (whole) {
      const w = (whole.textContent || "").replace(/[^\d]/g, "");
      const frac = (card.querySelector(".a-price .a-price-fraction")?.textContent || "00").replace(/[^\d]/g, "").slice(0, 2);
      const v = parseFloat(`${w}.${frac || "00"}`);
      if (Number.isFinite(v)) return v;
    }
    const off = card.querySelector(".a-price .a-offscreen");
    if (off) {
      const v = parseFloat((off.textContent || "").replace(/[^\d.]/g, ""));
      if (Number.isFinite(v)) return v;
    }
    return null;
  }

  function cardReviews(card) {
    const el = card.querySelector('[aria-label*="rating"], .s-underline-text, span.a-size-base.s-underline-text');
    if (!el) return null;
    const t = (el.textContent || el.getAttribute("aria-label") || "").trim();
    if (/[\d.]+k/i.test(t)) return Math.round(parseFloat(t) * 1000);
    const n = parseInt(t.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  }

  function cardRating(card) {
    const el = card.querySelector('i.a-icon-star-small span, i.a-icon-star span, [aria-label*="out of 5 stars"]');
    if (!el) return null;
    const m = (el.textContent || el.getAttribute("aria-label") || "").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }

  function cardPrime(card) {
    return [".a-icon-prime", ".a-icon-addon-prime"].some((s) => {
      const el = card.querySelector(s);
      return el && el.offsetParent !== null;
    });
  }

  function passesFilters(card, f) {
    if (f.prime && !cardPrime(card)) return false;
    const price = cardPrice(card);
    if (f.minPrice != null && (price == null || price < f.minPrice)) return false;
    if (f.maxPrice != null && (price == null || price > f.maxPrice)) return false;
    if (f.minReviews != null) {
      const r = cardReviews(card);
      if (r == null || r < f.minReviews) return false;
    }
    if (f.minRating != null) {
      const r = cardRating(card);
      if (r == null || r < f.minRating) return false;
    }
    return true;
  }

  // ── Popup mesajları ─────────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "LA_GET_LIST") {
      sendResponse({ list: Array.from(selected) });
    } else if (msg.action === "LA_SELECT_ALL") {
      const f = msg.filters || {};
      const hasFilter = Object.values(f).some((v) => v != null && v !== false && v !== "");
      document.querySelectorAll(".la-asin-cb").forEach((cb) => {
        const card = cb.closest("[data-asin]");
        const ok = hasFilter ? (card ? passesFilters(card, f) : false) : true;
        if (ok && selected.size < MAX_ASINS) {
          selected.add(cb.dataset.asin);
          cb.checked = true;
        }
      });
      persist();
      sendResponse({ count: selected.size });
    } else if (msg.action === "LA_DESELECT_ALL") {
      document.querySelectorAll(".la-asin-cb").forEach((cb) => (cb.checked = false));
      selected.clear();
      persist();
      sendResponse({ count: 0 });
    } else if (msg.action === "LA_CLEAR") {
      selected.clear();
      document.querySelectorAll(".la-asin-cb").forEach((cb) => (cb.checked = false));
      persist();
      sendResponse({ count: 0 });
    }
    return true;
  });
})();
