// Lean Automation — Amazon ASIN Grabber (sayfa-üstü panel)
// Amazon arama/sonuç sayfalarındaki ürünlere onay kutusu ekler; sağ üstte yüzen bir
// panel gösterir. Seçili ASIN'ler kalıcı (chrome.storage.local). eBay otomasyonu YOK —
// sadece ASIN topla, filtrele, kopyala. Temiz kod, minified değil.

(() => {
  "use strict";

  const STORAGE_KEY = "la_selected_asins";
  const FILTERS_KEY = "la_filters";
  const MAX_ASINS = 5000;
  const ASIN_RE = /^[A-Z0-9]{10}$/i;

  /** Seçili ASIN seti (hafıza). */
  const selected = new Set();
  let filters = { minPrice: null, maxPrice: null, minReviews: null, minRating: null, maxDeliveryDays: null, prime: false };

  // ── Başlangıç: kayıtlı liste + filtreleri yükle ─────────────────────────────
  chrome.storage.local.get([STORAGE_KEY, FILTERS_KEY]).then((d) => {
    const list = d[STORAGE_KEY];
    if (Array.isArray(list)) list.slice(0, MAX_ASINS).forEach((a) => selected.add(a));
    if (d[FILTERS_KEY]) filters = { ...filters, ...d[FILTERS_KEY] };
    injectCheckboxes();
    buildPanel();
    renderList();
    renderDetail();
  });

  function persist() {
    chrome.storage.local.set({ [STORAGE_KEY]: Array.from(selected) });
    chrome.runtime.sendMessage({ action: "LA_COUNT", count: selected.size }).catch(() => {});
  }
  function persistFilters() {
    chrome.storage.local.set({ [FILTERS_KEY]: filters });
  }

  // ── Sonuç kartlarına onay kutusu ekle ───────────────────────────────────────
  function injectCheckboxes() {
    document.querySelectorAll('[data-asin]:not([data-asin=""])').forEach((card) => {
      const asin = card.getAttribute("data-asin");
      if (!asin || !ASIN_RE.test(asin) || card.querySelector(".la-asin-cb")) return;

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
        renderList();
      });
      anchor.appendChild(cb);
    });
  }

  // ── Dinamik içerik için gözlemci ────────────────────────────────────────────
  let debounce = null;
  new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      injectCheckboxes();
      renderDetail();
    }, 400);
  }).observe(document.body, { childList: true, subtree: true });

  // ── Tekli ürün (detay) sayfası ASIN algılama ────────────────────────────────
  // Arama sonucu kartlarının aksine /dp/ASIN sayfasında "kart" elemanı yok; ASIN'i
  // URL'den veya sayfadaki gizli inputtan/data-asin'den okuyup ayrı bir kutu gösteririz.
  function detailPageAsin() {
    const m = location.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if (m) return m[1].toUpperCase();
    const input = document.querySelector('input#ASIN, input[name="ASIN"]');
    if (input && ASIN_RE.test(input.value)) return input.value.toUpperCase();
    const el = document.querySelector('[data-asin]:not([data-asin=""])');
    if (el) {
      const a = el.getAttribute("data-asin");
      if (a && ASIN_RE.test(a)) return a.toUpperCase();
    }
    return null;
  }

  function renderDetail() {
    const box = document.getElementById("la-detail");
    if (!box) return;
    const asin = detailPageAsin();
    if (!asin) {
      box.style.display = "none";
      return;
    }
    box.style.display = "flex";
    box.textContent = "";

    const label = document.createElement("span");
    label.className = "la-detail-asin";
    label.textContent = `Bu ürün: ${asin}`;

    const isSel = selected.has(asin);
    const btn = document.createElement("button");
    btn.className = `la-btn ${isSel ? "la-danger" : "la-primary"} la-detail-btn`;
    btn.textContent = isSel ? "Listeden Çıkar" : "Listeye Ekle";
    btn.addEventListener("click", () => {
      if (selected.has(asin)) {
        selected.delete(asin);
      } else {
        if (selected.size >= MAX_ASINS) {
          alert(`En fazla ${MAX_ASINS} ASIN seçilebilir.`);
          return;
        }
        selected.add(asin);
      }
      persist();
      renderList();
      renderDetail();
    });

    box.appendChild(label);
    box.appendChild(btn);
  }

  // ── Kart filtre yardımcıları ────────────────────────────────────────────────
  // Çok-yerelli sayı ayrıştırma: "2.249,00" (TR/AB) ve "2,249.00" (US/UK) ikisini de doğru okur.
  function parseLocaleNumber(text) {
    if (!text) return null;
    const m = String(text).trim().match(/[\d.,\s]+/);
    if (!m) return null;
    let r = m[0].replace(/\s+/g, "").replace(/[^\d.,]/g, "");
    if (!r) return null;
    const dot = r.lastIndexOf(".");
    const comma = r.lastIndexOf(",");
    const hasDot = dot >= 0, hasComma = comma >= 0;
    if (hasDot && hasComma) {
      // Sonda gelen ondalık ayırıcıdır; diğeri binlik
      const dec = dot > comma ? "." : ",";
      const thou = dec === "." ? "," : ".";
      r = r.split(thou).join("");
      if (dec === ",") r = r.replace(",", ".");
    } else if (hasComma) {
      // Sadece virgül: son gruptaki 2 hane ondalık demek, değilse binlik
      r = r.length - comma - 1 === 2 ? r.replace(",", ".") : r.replace(/,/g, "");
    } else if (hasDot) {
      // Sadece nokta: son grup 2 hane değilse binlik ayırıcıdır
      if (r.length - dot - 1 !== 2) r = r.replace(/\./g, "");
    }
    const v = parseFloat(r);
    return Number.isFinite(v) ? v : null;
  }

  function cardPrice(card) {
    // Önce whole+fraction (yerelden bağımsız: binlik whole'da, ondalık fraction'da)
    const whole = card.querySelector(".a-price .a-price-whole");
    if (whole) {
      const w = (whole.textContent || "").replace(/[^\d]/g, "");
      if (w) {
        const frac = ((card.querySelector(".a-price .a-price-fraction")?.textContent || "").replace(/[^\d]/g, "") || "00").slice(0, 2).padEnd(2, "0");
        const v = parseFloat(`${w}.${frac}`);
        if (Number.isFinite(v)) return v;
      }
    }
    const off = card.querySelector(".a-price .a-offscreen, span.a-price > span.a-offscreen");
    if (off) {
      const v = parseLocaleNumber(off.textContent || "");
      if (v != null) return v;
    }
    return null;
  }

  function cardReviews(card) {
    const sels = [
      'span[aria-label*="ratings"]', 'span[aria-label*="rating"]',
      "[data-csa-c-content-id='alf-customer-ratings-count-component']",
      "span.a-size-base.s-underline-text", ".s-underline-text",
    ];
    for (const s of sels) {
      const el = card.querySelector(s);
      if (!el) continue;
      const t = (el.textContent || el.getAttribute("aria-label") || "").trim();
      if (!t) continue;
      if (/[\d.,]+\s*[bk]\b/i.test(t)) return Math.round(parseFloat(t.replace(",", ".")) * 1e3);
      if (/[\d.,]+\s*m\b/i.test(t)) return Math.round(parseFloat(t.replace(",", ".")) * 1e6);
      const n = parseInt(t.replace(/[^\d]/g, ""), 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  }

  function cardRating(card) {
    const el = card.querySelector('i.a-icon-star-small span, i.a-icon-star span, [aria-label*="out of 5 stars"], [aria-label*="5 yıldız"]');
    if (!el) return null;
    const m = (el.textContent || el.getAttribute("aria-label") || "").replace(",", ".").match(/[\d.]+/);
    return m ? parseFloat(m[0]) : null;
  }

  function cardPrime(card) {
    return [".a-icon-prime", ".a-icon-addon-prime", 'i[class*="prime"]'].some((s) => {
      const el = card.querySelector(s);
      return el && el.offsetParent !== null;
    });
  }

  // Teslimat gün sayısı (en iyi-çaba): kart metnindeki teslimat tarihini bulup bugüne uzaklığı.
  const MONTHS = {
    ocak: 0, oca: 0, şubat: 1, şub: 1, sub: 1, mart: 2, mar: 2, nisan: 3, nis: 3,
    mayıs: 4, may: 4, haziran: 5, haz: 5, temmuz: 6, tem: 6, ağustos: 7, ağu: 7, agu: 7,
    eylül: 8, eyl: 8, ekim: 9, eki: 9, kasım: 10, kas: 10, aralık: 11, ara: 11,
    january: 0, jan: 0, february: 1, feb: 1, march: 2, april: 3, apr: 3, june: 5, jun: 5,
    july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9,
    november: 10, nov: 10, december: 11, dec: 11,
  };
  function cardDeliveryDays(card) {
    const txt = (card.textContent || "").toLowerCase();
    // Hızlı yol: anahtar kelimeler (DTS mantığı)
    if (/one-day|same-day|tomorrow|overnight|yarın|bugün/i.test(txt)) return 1;
    if (/two-day|2-day/i.test(txt)) return 2;
    const kw = txt.match(/(\d+)\s*(day|days|gün)/i);
    if (kw) return parseInt(kw[1], 10);
    // teslimat/delivery/arrives yakınındaki tarih: "26 haz", "haz 26", "jun 26", "26 june"
    const dayMonth = txt.match(/(\d{1,2})\s+([a-zçğıöşü]{3,9})/i);
    const monthDay = txt.match(/([a-zçğıöşü]{3,9})\s+(\d{1,2})/i);
    let day = null, mon = null;
    if (dayMonth && MONTHS[dayMonth[2]] != null) { day = parseInt(dayMonth[1], 10); mon = MONTHS[dayMonth[2]]; }
    else if (monthDay && MONTHS[monthDay[1]] != null) { day = parseInt(monthDay[2], 10); mon = MONTHS[monthDay[1]]; }
    if (day == null || mon == null) return null;

    const now = new Date();
    let target = new Date(now.getFullYear(), mon, day);
    // Geçmişteyse gelecek yılın aynı tarihi (yıl sonu kayması)
    if (target.getTime() < now.getTime() - 36e5) target = new Date(now.getFullYear() + 1, mon, day);
    const diff = Math.round((target - now) / 86400000);
    return diff >= 0 && diff < 60 ? diff : null;
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
    if (f.maxDeliveryDays != null) {
      const dd = cardDeliveryDays(card);
      // Tarih okunamazsa eleme (fail-open); okunduysa ve fazlaysa ele
      if (dd != null && dd > f.maxDeliveryDays) return false;
    }
    return true;
  }

  // ── Eylemler ────────────────────────────────────────────────────────────────
  function selectAll() {
    const hasFilter = Object.values(filters).some((v) => v != null && v !== false && v !== "");
    document.querySelectorAll(".la-asin-cb").forEach((cb) => {
      const card = cb.closest("[data-asin]");
      const ok = hasFilter ? (card ? passesFilters(card, filters) : false) : true;
      if (ok && selected.size < MAX_ASINS) {
        selected.add(cb.dataset.asin);
        cb.checked = true;
      }
    });
    persist();
    renderList();
    flashStatus(`${selected.size} ürün seçili`);
  }
  function deselectAll() {
    document.querySelectorAll(".la-asin-cb").forEach((cb) => (cb.checked = false));
    selected.clear();
    persist();
    renderList();
    flashStatus("Seçim kaldırıldı");
  }
  function clearList() {
    selected.clear();
    document.querySelectorAll(".la-asin-cb").forEach((cb) => (cb.checked = false));
    persist();
    renderList();
    flashStatus("Liste temizlendi");
  }
  async function copyList() {
    if (!selected.size) { flashStatus("Liste boş", false); return; }
    try {
      await navigator.clipboard.writeText(Array.from(selected).join("\n"));
      flashStatus(`${selected.size} ASIN kopyalandı ✓`);
    } catch {
      flashStatus("Kopyalanamadı (izin yok)", false);
    }
  }

  // ── Yüzen panel ───────────────────────────────────────────────────────────
  function buildPanel() {
    if (document.getElementById("la-panel")) return;

    const launcher = document.createElement("button");
    launcher.id = "la-launcher";
    launcher.title = "Lean Automation — ASIN Grabber";
    launcher.textContent = "LA";

    const panel = document.createElement("div");
    panel.id = "la-panel";
    panel.innerHTML = `
      <div id="la-head">
        <div class="la-brand"><span class="la-logo">LA</span><b>Lean Automation</b></div>
        <div class="la-head-right">
          <span class="la-dot" title="Aktif"></span>
          <button id="la-close" title="Kapat">✕</button>
        </div>
      </div>
      <p class="la-detected"><b>●</b> Amazon algılandı <span>— ürün köşesindeki kutularla ASIN seç</span></p>
      <div id="la-detail" class="la-detail" style="display:none"></div>

      <div class="la-row"><span>Seçili ASIN'ler</span><span id="la-count" class="la-badge">0</span></div>
      <div id="la-list" class="la-list"><p class="la-empty">Ürün seç…</p></div>

      <details class="la-filters">
        <summary>Filtreler (Tümünü Seç için)</summary>
        <div class="la-grid">
          <label>Min Fiyat<input id="la-minPrice" type="number" placeholder="Min" /></label>
          <label>Max Fiyat<input id="la-maxPrice" type="number" placeholder="Max" /></label>
          <label>Min Yorum<input id="la-minReviews" type="number" placeholder="0" /></label>
          <label>Min Puan
            <select id="la-minRating">
              <option value="">Hepsi</option><option value="3">3+</option>
              <option value="4">4+</option><option value="4.5">4.5+</option>
            </select>
          </label>
          <label>Teslimat (gün)<input id="la-maxDelivery" type="number" placeholder="≤" /></label>
          <label class="la-chk"><input id="la-prime" type="checkbox" /> Sadece Prime</label>
        </div>
      </details>

      <div class="la-actions">
        <button id="la-selectAll" class="la-btn la-primary">Tümünü Seç</button>
        <button id="la-copy" class="la-btn">Kopyala</button>
      </div>
      <div class="la-actions-quiet">
        <button id="la-deselect" class="la-btn-ghost">Seçimi kaldır</button>
        <button id="la-clear" class="la-btn-ghost la-danger-ghost">Listeyi temizle</button>
      </div>
      <p id="la-msg" class="la-msg"></p>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    // Aç/kapa
    const setOpen = (open) => {
      panel.style.display = open ? "block" : "none";
      launcher.style.display = open ? "none" : "flex";
      localStorage.setItem("la_panel_open", open ? "1" : "0");
    };
    launcher.addEventListener("click", () => setOpen(true));
    panel.querySelector("#la-close").addEventListener("click", () => setOpen(false));
    setOpen(localStorage.getItem("la_panel_open") !== "0");

    // Sürükle
    makeDraggable(panel, panel.querySelector("#la-head"));

    // Filtre alanlarını doldur + dinle
    const f = filters;
    const set = (id, v) => { const el = panel.querySelector(id); if (el != null && v != null) el.value = v; };
    set("#la-minPrice", f.minPrice); set("#la-maxPrice", f.maxPrice);
    set("#la-minReviews", f.minReviews); set("#la-minRating", f.minRating);
    set("#la-maxDelivery", f.maxDeliveryDays);
    panel.querySelector("#la-prime").checked = !!f.prime;

    const num = (id) => { const v = parseFloat(panel.querySelector(id).value); return Number.isFinite(v) ? v : null; };
    const readFilters = () => {
      filters = {
        minPrice: num("#la-minPrice"), maxPrice: num("#la-maxPrice"),
        minReviews: num("#la-minReviews"),
        minRating: panel.querySelector("#la-minRating").value ? parseFloat(panel.querySelector("#la-minRating").value) : null,
        maxDeliveryDays: num("#la-maxDelivery"),
        prime: panel.querySelector("#la-prime").checked,
      };
      persistFilters();
    };
    panel.querySelectorAll("#la-minPrice,#la-maxPrice,#la-minReviews,#la-minRating,#la-maxDelivery,#la-prime")
      .forEach((el) => el.addEventListener("change", readFilters));

    // Butonlar
    panel.querySelector("#la-selectAll").addEventListener("click", () => { readFilters(); selectAll(); });
    panel.querySelector("#la-deselect").addEventListener("click", deselectAll);
    panel.querySelector("#la-copy").addEventListener("click", copyList);
    panel.querySelector("#la-clear").addEventListener("click", clearList);
  }

  function renderList() {
    const list = document.getElementById("la-list");
    const count = document.getElementById("la-count");
    if (!list || !count) return;
    const arr = Array.from(selected);
    count.textContent = String(arr.length);

    // Güvenli render: ASIN'ler depodan/sayfadan gelir. innerHTML + string birleştirme
    // depo zehirlenmesinde DOM-injection riski taşır. Bunun yerine düğümleri elle kurup
    // değeri textContent ile yazıyoruz (HTML olarak yorumlanmaz).
    list.textContent = "";
    if (arr.length === 0) {
      const empty = document.createElement("p");
      empty.className = "la-empty";
      empty.textContent = "Ürün seç…";
      list.appendChild(empty);
      return;
    }
    const frag = document.createDocumentFragment();
    for (const a of arr) {
      const item = document.createElement("div");
      item.className = "la-item";
      item.textContent = a;
      frag.appendChild(item);
    }
    list.appendChild(frag);
  }

  let msgTimer = null;
  function flashStatus(text, ok = true) {
    const el = document.getElementById("la-msg");
    if (!el) return;
    el.textContent = text;
    el.style.color = ok ? "#10b981" : "#f87171";
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => (el.textContent = ""), 2500);
  }

  function makeDraggable(el, handle) {
    let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    handle.style.cursor = "move";
    handle.addEventListener("mousedown", (e) => {
      if (e.target.id === "la-close") return;
      dragging = true;
      const r = el.getBoundingClientRect();
      sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      el.style.right = "auto"; el.style.left = ox + "px"; el.style.top = oy + "px";
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      el.style.left = Math.max(0, ox + e.clientX - sx) + "px";
      el.style.top = Math.max(0, oy + e.clientY - sy) + "px";
    });
    window.addEventListener("mouseup", () => (dragging = false));
  }

  // ── Depo değişimini (popup vb.) panele yansıt ───────────────────────────────
  chrome.storage.onChanged.addListener((c, area) => {
    if (area !== "local" || !c[STORAGE_KEY]) return;
    const list = c[STORAGE_KEY].newValue || [];
    selected.clear();
    list.forEach((a) => selected.add(a));
    document.querySelectorAll(".la-asin-cb").forEach((cb) => (cb.checked = selected.has(cb.dataset.asin)));
    renderList();
    renderDetail();
  });

  // ── Popup mesajları (geriye dönük uyumluluk) ────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "LA_GET_LIST") sendResponse({ list: Array.from(selected) });
    else if (msg.action === "LA_CLEAR") { clearList(); sendResponse({ count: 0 }); }
    return true;
  });
})();
