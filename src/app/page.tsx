"use client";

import Link from "next/link";

const CARDS = [
  {
    title: "amazon",
    titleClass: "text-white",
    features: ["Stok Senkronizasyonu", "Sipariş Otomasyonu", "AI Ürün Yönetimi", "Kâr Analitiği"],
    btn: "Amazon'u Bağla",
    btnStyle: "bg-gradient-to-r from-amber-500 to-orange-500",
    border: "border-amber-500/30",
    href: "/dashboard/amazon",
    popular: true,
  },
  {
    title: "ebay",
    titleClass: "",
    titleColored: true,
    features: ["Otomatik Listeleme", "Akıllı Fiyatlandırma", "Sipariş Takibi", "Performans Raporları"],
    btn: "eBay'i Bağla",
    btnStyle: "bg-gradient-to-r from-blue-600 to-blue-500",
    border: "border-blue-500/30",
    href: "/dashboard/listings",
  },
  {
    title: "Etsy",
    titleClass: "text-orange-500",
    features: ["Ürün Yayınlama", "Mesaj Otomasyonu", "Stok Yönetimi", "Müşteri Destek AI"],
    btn: "Etsy'i Bağla",
    btnStyle: "bg-gradient-to-r from-orange-500 to-orange-600",
    border: "border-orange-500/30",
    href: "/dashboard/etsy",
  },
];

const STATS = [
  { value: "%99.9", label: "Uptime" },
  { value: "Güvenli", label: "API Entegrasyonu" },
  { value: "Kurumsal", label: "Altyapı" },
  { value: "7/24", label: "Destek" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-black to-black" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-12 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 flex items-center justify-center font-black text-sm">
            LA
          </div>
          <div>
            <h1 className="font-bold text-xl leading-none">LEAN</h1>
            <p className="text-sm text-gray-400 leading-none mt-0.5">AUTOMATION</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className="border border-purple-500 px-6 py-3 rounded-xl hover:bg-purple-600 transition font-semibold"
        >
          Dashboard
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center pt-16">
        <span className="border border-purple-600 px-4 py-2 rounded-full text-purple-400 text-sm font-semibold tracking-widest">
          • YAPAY ZEKA DESTEKLİ PAZAR YERİ OTOMASYONU
        </span>

        <h1 className="text-6xl md:text-7xl font-bold mt-8 leading-tight">
          Pazar Yeri İşinizi
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI ile Ölçeklendirin
          </span>
        </h1>

        <p className="text-gray-400 mt-6 text-xl">
          Amazon, eBay ve Etsy satıcıları için tam otomasyonlu çözümler.
          <br />
          Listeleme, sipariş, stok ve müşteriyi tek platformdan yönetin.
        </p>
      </section>

      {/* Cards */}
      <section className="relative z-10 max-w-7xl mx-auto mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 px-8">
        {CARDS.map((card) => (
          <div
            key={card.title}
            className={`backdrop-blur-xl bg-white/5 border ${card.border} rounded-3xl p-8 hover:scale-[1.03] transition duration-300 flex flex-col relative`}
          >
            {card.popular && (
              <div className="absolute top-5 right-5 flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400">
                ★ EN POPÜLER
              </div>
            )}

            {card.titleColored ? (
              <h2 className="text-5xl font-bold">
                <span className="text-red-500">e</span>
                <span className="text-blue-500">b</span>
                <span className="text-amber-500">a</span>
                <span className="text-green-500">y</span>
              </h2>
            ) : (
              <h2 className={`text-5xl font-bold ${card.titleClass}`}>{card.title}</h2>
            )}

            <ul className="mt-8 space-y-4 text-gray-300 flex-1">
              {card.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>

            <Link
              href={card.href}
              className={`mt-10 w-full ${card.btnStyle} py-4 rounded-xl font-semibold hover:opacity-90 transition text-center block`}
            >
              {card.btn}
            </Link>
          </div>
        ))}
      </section>

      {/* Footer Stats */}
      <section className="relative z-10 max-w-6xl mx-auto mt-16 mb-20 px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((s) => (
            <div key={s.value} className="bg-white/5 rounded-2xl p-6">
              <h3 className="text-2xl font-bold">{s.value}</h3>
              <p className="text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
