// Dashboard rotasına ilk girişte sayfa chunk'ı inerken anında iskelet göster —
// kullanıcı "takıldı mı?" hissi yaşamasın.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-8 w-48 bg-slate-800/60 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-slate-900/50 border border-slate-700/50 rounded-2xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-[340px] bg-slate-900/50 border border-slate-700/50 rounded-2xl" />
        <div className="h-[340px] bg-slate-900/50 border border-slate-700/50 rounded-2xl" />
      </div>
    </div>
  );
}
