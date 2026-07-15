"use client";

import { motion } from "framer-motion";
import { Chrome, Download, MousePointerClick, FolderOpen, ToggleRight, CheckCircle2 } from "lucide-react";

const EXTENSION_ZIP = "/lean-automation-extension.zip";

const steps = [
  {
    icon: Download,
    title: "1. Eklentiyi indir",
    desc: "Aşağıdaki butondan .zip dosyasını indir ve bilgisayarında bir klasöre çıkar (sağ tık → Tümünü ayıkla).",
  },
  {
    icon: Chrome,
    title: "2. Chrome'da eklenti sayfasını aç",
    desc: "Adres çubuğuna chrome://extensions yaz ve Enter'a bas. (Edge için edge://extensions)",
  },
  {
    icon: ToggleRight,
    title: "3. Geliştirici modunu aç",
    desc: "Sağ üst köşedeki \"Geliştirici modu\" (Developer mode) anahtarını aç.",
  },
  {
    icon: FolderOpen,
    title: "4. Paketlenmemiş öğe yükle",
    desc: "\"Paketlenmemiş öğe yükle\" (Load unpacked) butonuna tıkla → az önce çıkardığın klasörü seç.",
  },
  {
    icon: CheckCircle2,
    title: "5. Hazır!",
    desc: "Eklenti çubuğa eklenir (LA simgesi). Amazon'da arama yap → kârlı ürünleri işaretle → ASIN'leri panele aktar.",
  },
];

const features = [
  "Amazon aramasında ürünlere onay kutusu — kârlıları işaretle, ASIN topla",
  "Tekli ürün sayfasında (dp) da ASIN'i tanır — panelden tek tıkla listeye ekle",
  "Sayfa üstünde yüzen panel (sürüklenebilir) — tek tek ya da \"Tümünü Seç\"",
  "Filtreler: Min/Max Fiyat, Min Yorum, Min Puan, Teslimat (gün), Sadece Prime",
  "Filtreyle \"Tümünü Seç\" — sadece kritere uyan ürünleri işaretler",
  "Seçili ASIN'leri kopyala → panele \"Toplu ASIN\" ile yapıştır",
  "Sadece ASIN toplar — eBay/otomasyon yok, güvenli ve sade",
];

export default function ExtensionPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8 max-w-3xl mx-auto"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
            <Chrome className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Chrome Eklentisi</h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Amazon&apos;da kârlı ürün bul, ASIN topla, eBay&apos;e yüklemeye hazırla.
            </p>
          </div>
        </div>
      </div>

      {/* Download card */}
      <div className="bg-gradient-to-br from-violet-600/15 to-blue-600/10 border border-violet-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-white font-semibold">Lean Automation — Amazon ASIN Grabber</p>
          <p className="text-sm text-slate-400 mt-1">Sürüm 0.4.0 · Chrome / Edge · ~14 KB</p>
        </div>
        <a
          href={EXTENSION_ZIP}
          download
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-violet-500/20 transition-all whitespace-nowrap"
        >
          <Download className="h-5 w-5" />
          Eklentiyi İndir (.zip)
        </a>
      </div>

      {/* Install steps */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MousePointerClick className="h-5 w-5 text-violet-400" />
          Kurulum (2 dakika)
        </h2>
        <div className="space-y-3">
          {steps.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="flex gap-4 p-4 rounded-xl border border-slate-700/50 bg-slate-900/60"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">{title}</p>
                <p className="text-slate-400 text-sm mt-0.5">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Eklenti ne yapar?</h2>
        <ul className="space-y-2">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-slate-500 border-t border-slate-700/50 pt-4">
        Not: Eklenti şu an &quot;Paketlenmemiş öğe&quot; olarak kurulur (Chrome Web Store onayı sürecinde).
        Tüm kod açık ve okunurdur. Yakında mağaza üzerinden tek tıkla kurulum gelecek.
      </p>
    </motion.div>
  );
}
