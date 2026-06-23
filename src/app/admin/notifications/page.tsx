"use client";
import useSWR from "swr";

interface Notif {
  id: string;
  type: string;
  title: string;
  message: string;
  userEmail: string | null;
  isRead: boolean;
  createdAt: string;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => r.json()) as Promise<{ data: Notif[]; unread: number }>;

function badgeColor(type: string): string {
  if (type === "balance_empty") return "bg-red-500/15 text-red-400";
  if (type === "balance_low") return "bg-amber-500/15 text-amber-400";
  return "bg-slate-500/15 text-slate-400";
}

export default function AdminNotificationsPage() {
  const { data, mutate, isLoading } = useSWR("/api/admin/notifications", fetcher, {
    refreshInterval: 30000, // 30 sn'de bir tazele
  });
  const items = data?.data ?? [];
  const unread = data?.unread ?? 0;

  async function markRead(id?: string, markAllRead?: boolean) {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id } : { markAllRead }),
    });
    mutate();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold">
          Bildirimler {unread > 0 && <span className="text-red-400">({unread} okunmamış)</span>}
        </h1>
        {unread > 0 && (
          <button
            onClick={() => markRead(undefined, true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            Tümünü okundu işaretle
          </button>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Bakiye biten/azalan kullanıcılar burada görünür. Bakiye bitince takip kodu çevrilemez → eBay riski; yükletmek için kullanıcıyla iletişime geç.
      </p>

      {isLoading ? (
        <p className="text-slate-400 text-sm">Yükleniyor…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm">Bildirim yok. 🎉</p>
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                n.isRead ? "border-slate-800 bg-slate-900/30 opacity-60" : "border-slate-700/50 bg-slate-900/60"
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor(n.type)}`}>
                    {n.type === "balance_empty" ? "BAKİYE BİTTİ" : n.type === "balance_low" ? "BAKİYE DÜŞÜK" : n.type}
                  </span>
                  <span className="text-white font-semibold text-sm">{n.title}</span>
                </div>
                <p className="text-sm text-slate-300 mt-1">{n.message}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {new Date(n.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
              {!n.isRead && (
                <button
                  onClick={() => markRead(n.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white whitespace-nowrap"
                >
                  Okundu
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
