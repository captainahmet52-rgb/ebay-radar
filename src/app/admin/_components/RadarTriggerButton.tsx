"use client";
import { useState } from "react";

export function RadarTriggerButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const trigger = async () => {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/radar", { method: "POST" });
      const data = (await res.json()) as { message?: string };
      setMsg(data.message ?? "Baslatildi");
    } catch {
      setMsg("Hata olustu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={trigger}
        disabled={loading}
        className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
      >
        {loading ? "Taraniyor..." : "Tum Magazalari Tara"}
      </button>
      {msg && <span className="text-sm text-emerald-400">{msg}</span>}
    </div>
  );
}
