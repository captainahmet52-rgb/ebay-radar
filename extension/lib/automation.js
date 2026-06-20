// Lean Automation — otomasyon motoru (genel primitive'ler)
// Sayfalarda İNSAN GİBİ etkileşim: gerçek fare olayları + tuş tuş yazma + bekleme.
// (Naif value= ataması siteler tarafından sahte sayılır; bu yüzden gerçek olaylar şart.)
// window.LA olarak global açılır; diğer content scriptler kullanır.

(() => {
  "use strict";
  if (window.LA) return;

  const sleep = (ms = 800) => new Promise((r) => setTimeout(r, ms));
  const rand = (base = 800, jitter = 200) =>
    sleep(Math.floor(Math.random() * (jitter * 2 + 1)) + Math.max(0, base - jitter));

  /** Koşul sağlanana kadar bekle (ms aralıkla, timeout). */
  function waitFor(fn, { timeoutMs = 20000, intervalMs = 300 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        let v;
        try { v = fn(); } catch { v = null; }
        if (v) return resolve(v);
        if (Date.now() - start >= timeoutMs) return resolve(null);
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  const waitForElement = (sel, opts) => waitFor(() => document.querySelector(sel), opts);

  /** DOM bir süre sabit kalana kadar bekle (dinamik sayfalar için). */
  function waitForStableDom(quietMs = 1200, maxMs = 20000) {
    return new Promise((resolve) => {
      if (!document.body) return resolve();
      const start = Date.now();
      let last = Date.now();
      const obs = new MutationObserver(() => (last = Date.now()));
      obs.observe(document.body, { attributes: true, childList: true, subtree: true });
      const check = () => {
        if (Date.now() - last >= quietMs || Date.now() - start >= maxMs) {
          obs.disconnect();
          return resolve();
        }
        setTimeout(check, 200);
      };
      check();
    });
  }

  /** Gerçek fare tıklaması (mousedown→mouseup→click). */
  function click(el) {
    if (!el) return false;
    el.scrollIntoView({ block: "center", inline: "center" });
    for (const type of ["mousedown", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, buttons: 1 }));
    }
    return true;
  }

  /** Checkbox/select değişimini tetikle. */
  function setChecked(el, checked) {
    if (!el) return false;
    if (typeof checked === "boolean") el.checked = checked;
    el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
    return true;
  }

  /** İnsan gibi tuş tuş yazma (keydown/input/keyup), React/eBay uyumlu. */
  async function type(el, text, { delay = 45 } = {}) {
    if (!el) return false;
    text = String(text);
    click(el);
    // Mevcut değeri temizle
    if ("value" in el) {
      el.value = "";
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    } else if (el.isContentEditable) {
      el.textContent = "";
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }
    for (const ch of text) {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: ch, bubbles: true }));
      if ("value" in el) el.value += ch;
      else if (el.isContentEditable) el.textContent += ch;
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: ch, bubbles: true }));
      await sleep(delay);
    }
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  /** Metne göre buton/link bul (çoklu dil). */
  function findByText(texts, root = document) {
    const wanted = texts.map((t) => t.toLowerCase().trim());
    return (
      Array.from(root.querySelectorAll("button, a, span[role=button]")).find((el) => {
        const t = (el.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        return t && wanted.some((w) => t === w || t.includes(w));
      }) || null
    );
  }

  window.LA = { sleep, rand, waitFor, waitForElement, waitForStableDom, click, setChecked, type, findByText };
})();
