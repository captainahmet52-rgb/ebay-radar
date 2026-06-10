export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 animate-pulse" />
        <p className="text-slate-500 text-sm">Yükleniyor...</p>
      </div>
    </div>
  );
}
