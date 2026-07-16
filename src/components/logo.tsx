import { cn } from "@/lib/utils";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

/** Radar pingi — dedektör noktası + tek yöne yayılan üç kavis. Marka rengi tek başına, degrade yok. */
export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Lean Automation"
    >
      <circle cx="11" cy="21" r="2.6" fill="#7c3aed" />
      <path d="M11 15 A6 6 0 0 1 17 21" stroke="#7c3aed" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M11 10 A11 11 0 0 1 22 21" stroke="#7c3aed" strokeWidth="2.6" strokeLinecap="round" opacity="0.65" />
      <path d="M11 5 A16 16 0 0 1 27 21" stroke="#7c3aed" strokeWidth="2.6" strokeLinecap="round" opacity="0.4" />
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
