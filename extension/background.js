// Lean Automation — arka plan service worker
// Şimdilik minimal: seçili ASIN sayısını rozet olarak gösterir.

const STORAGE_KEY = "la_selected_asins";

async function refreshBadge() {
  const d = await chrome.storage.local.get(STORAGE_KEY);
  const n = Array.isArray(d[STORAGE_KEY]) ? d[STORAGE_KEY].length : 0;
  await chrome.action.setBadgeText({ text: n > 0 ? String(n) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: "#7c3aed" });
}

chrome.runtime.onInstalled.addListener(refreshBadge);
chrome.runtime.onStartup.addListener(refreshBadge);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "LA_COUNT") refreshBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[STORAGE_KEY]) refreshBadge();
});
