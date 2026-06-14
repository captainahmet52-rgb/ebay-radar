"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Zap, X } from "lucide-react";

interface TrialStatus {
  onTrial: boolean;
  daysLeft: number;
  hasSubscription: boolean;
  trialExpired: boolean;
  trialStarted: boolean;
}

export function TrialBanner() {
  const [status, setStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/user/trial-status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status || dismissed) return null;
  if (status.hasSubscription) return null;

  // Henüz mağaza bağlanmamış → trial başlamamış
  if (!status.trialStarted) {
    return (
      <div className="bg-violet-600/10 border-b border-violet-500/20 px-6 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Zap className="h-4 w-4 text-violet-400 flex-shrink-0" />
          <span className="text-slate-300">
            eBay mağazanı bağla ve{" "}
            <span className="text-white font-semibold">7 günlük ücretsiz denemeyi</span> başlat.
          </span>
        </div>
        <Link
          href="/dashboard/settings"
          className="flex-shrink-0 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
        >
          Mağaza Bağla
        </Link>
      </div>
    );
  }

  // Trial aktif
  if (status.onTrial) {
    const isLow = status.daysLeft <= 2;
    return (
      <div
        className={`border-b px-6 py-2.5 flex items-center justify-between gap-4 ${
          isLow
            ? "bg-amber-500/10 border-amber-500/20"
            : "bg-blue-500/10 border-blue-500/20"
        }`}
      >
        <div className="flex items-center gap-2 text-sm">
          <Zap
            className={`h-4 w-4 flex-shrink-0 ${isLow ? "text-amber-400" : "text-blue-400"}`}
          />
          <span className="text-slate-300">
            Deneme süresi:{" "}
            <span className={`font-semibold ${isLow ? "text-amber-300" : "text-white"}`}>
              {status.daysLeft} gün kaldı
            </span>
            {isLow && " — süre dolmadan planını seç!"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/pricing"
            className="flex-shrink-0 text-xs bg-violet-600 hover:bg-violet-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
          >
            Plan Al
          </Link>
          {!isLow && (
            <button
              onClick={() => setDismissed(true)}
              className="text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Trial doldu
  return (
    <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
        <span className="text-slate-300">
          <span className="text-red-400 font-semibold">Deneme süreniz doldu.</span>{" "}
          Sisteme erişmek için bir plan seçin.
        </span>
      </div>
      <Link
        href="/dashboard/pricing"
        className="flex-shrink-0 text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
      >
        Plan Seç
      </Link>
    </div>
  );
}
