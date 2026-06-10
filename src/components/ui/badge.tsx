import { cn } from "@/lib/utils";

type BadgeVariant =
  | "active"
  | "paused"
  | "out"
  | "hot"
  | "normal"
  | "dead"
  | "pro"
  | "free"
  | "enterprise"
  | "verified"
  | "pending"
  | "cancelled"
  | "fulfilled";

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
  className?: string;
}

const variantConfig: Record<BadgeVariant, { dot: string; bg: string; text: string }> = {
  active:    { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  paused:    { dot: "bg-amber-400",   bg: "bg-amber-500/10",   text: "text-amber-400"   },
  out:       { dot: "bg-red-400",     bg: "bg-red-500/10",     text: "text-red-400"     },
  hot:       { dot: "bg-red-400",     bg: "bg-red-500/10",     text: "text-red-400"     },
  normal:    { dot: "bg-blue-400",    bg: "bg-blue-500/10",    text: "text-blue-400"    },
  dead:      { dot: "bg-slate-400",   bg: "bg-slate-500/10",   text: "text-slate-400"   },
  pro:       { dot: "bg-violet-400",  bg: "bg-violet-500/10",  text: "text-violet-400"  },
  enterprise:{ dot: "bg-violet-400",  bg: "bg-violet-500/10",  text: "text-violet-400"  },
  free:      { dot: "bg-slate-400",   bg: "bg-slate-500/10",   text: "text-slate-400"   },
  verified:  { dot: "bg-emerald-400", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  pending:   { dot: "bg-amber-400",   bg: "bg-amber-500/10",   text: "text-amber-400"   },
  cancelled: { dot: "bg-red-400",     bg: "bg-red-500/10",     text: "text-red-400"     },
  fulfilled: { dot: "bg-blue-400",    bg: "bg-blue-500/10",    text: "text-blue-400"    },
};

const variantLabels: Record<BadgeVariant, string> = {
  active:    "Aktif",
  paused:    "Duraklatıldı",
  out:       "Tükendi",
  hot:       "Sıcak",
  normal:    "Normal",
  dead:      "Ölü",
  pro:       "Pro",
  enterprise:"Enterprise",
  free:      "Ücretsiz",
  verified:  "Doğrulandı",
  pending:   "Bekliyor",
  cancelled: "İptal",
  fulfilled: "Tamamlandı",
};

export function Badge({ variant, children, className }: BadgeProps) {
  const config = variantConfig[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {children ?? variantLabels[variant]}
    </span>
  );
}
