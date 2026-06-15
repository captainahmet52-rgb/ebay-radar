import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/** Açılı "LA" monogram — beyaz L + mor degrade A. */
export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 46"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Lean Automation"
    >
      <defs>
        <linearGradient id="la-grad" x1="22" y1="42" x2="44" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#a855f7" />
          <stop offset="1" stopColor="#e9d5ff" />
        </linearGradient>
      </defs>
      {/* L — beyaz */}
      <path
        d="M9 4 V39 H25"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="square"
      />
      {/* A — mor degrade */}
      <path
        d="M22 41 L33 5 L44 41"
        stroke="url(#la-grad)"
        strokeWidth="7"
        strokeLinejoin="round"
        strokeLinecap="square"
      />
      {/* A çubuğu */}
      <path
        d="M27 28 H39"
        stroke="url(#la-grad)"
        strokeWidth="6"
        strokeLinecap="square"
      />
    </svg>
  );
}

interface LogoProps {
  size?: number;
  /** Logonun yanındaki LEAN / AUTOMATION yazısını göster. */
  withText?: boolean;
  className?: string;
}

export function Logo({ size = 40, withText = true, className }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LogoMark size={size} className="flex-shrink-0" />
      {withText && (
        <div className="leading-none">
          <p className="font-black text-white text-sm tracking-[0.22em]">LEAN</p>
          <p className="text-[#6b7280] text-[10px] tracking-[0.22em] mt-1">AUTOMATION</p>
        </div>
      )}
    </div>
  );
}
