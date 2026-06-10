import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      <div className="text-center space-y-4">
        <div className="text-8xl font-bold gradient-text">404</div>
        <p className="text-slate-400 text-lg">Sayfa bulunamadı</p>
        <Link
          href="/"
          className="inline-block mt-4 px-6 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-medium hover:opacity-90 transition-opacity"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
