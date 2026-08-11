"use client";

/**
 * EtsyFlow'un kendi tasarım sistemi (KODLAR/etsyflow-project'ten porte edildi,
 * listflow.pro DEĞİL — o ayrı bir referanstı, kullanılmadı).
 * Renk dili: zemin #0a0e1a · panel #111827 · çizgi #1e293b · altın #d4a054.
 */

import { cn } from "@/lib/utils";
import { Loader2, X } from "lucide-react";
import {
  useEffect,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// ─── Badge ──────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "success" | "warning" | "danger" | "brand" | "purple" | "blue" | "muted";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  default: "bg-[#1e293b] text-[#94a3b8] border border-[#334155]",
  success: "bg-green-400/10 text-green-400 border border-green-400/30",
  warning: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/30",
  danger: "bg-red-400/10 text-red-400 border border-red-400/30",
  brand: "bg-[#d4a054]/10 text-[#d4a054] border border-[#d4a054]/30",
  purple: "bg-purple-400/10 text-purple-400 border border-purple-400/30",
  blue: "bg-blue-400/10 text-blue-400 border border-blue-400/30",
  muted: "bg-[#0c1322] text-[#475569] border border-[#1e293b]",
};

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        BADGE_STYLES[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ─── Button ─────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-gradient-to-r from-[#d4a054] to-[#c08430] hover:opacity-90 text-[#0a0e1a] border-0",
  secondary: "bg-[#1e293b] text-[#e2e8f0] hover:bg-[#334155] border border-[#334155]",
  ghost: "bg-transparent border-0 text-[#94a3b8] hover:text-white hover:bg-[#111827]",
  danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-4 py-2.5 text-sm rounded-xl",
  lg: "px-6 py-3.5 text-sm rounded-xl",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
}) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
        BUTTON_STYLES[variant],
        BUTTON_SIZES[size],
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// ─── Input ──────────────────────────────────────────────────────────────────

export function Input({
  className,
  label,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-[#94a3b8]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3.5 py-2.5 text-sm text-[#e2e8f0] placeholder:text-[#475569]",
          "focus:outline-none focus:border-[#d4a054]/50 transition-colors duration-200",
          error && "border-red-500/50 focus:border-red-500",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Select ─────────────────────────────────────────────────────────────────

export function Select({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-[#94a3b8]">{label}</label>}
      <select
        className={cn(
          "w-full bg-[#0a0e1a] border border-[#1e293b] rounded-lg px-3.5 py-2.5 text-sm text-[#e2e8f0] cursor-pointer",
          "focus:outline-none focus:border-[#d4a054]/50 transition-colors duration-200",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

const MODAL_SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: keyof typeof MODAL_SIZES;
}) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0a0e1a]/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-[#0c1322] border border-[#1e293b] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto",
          MODAL_SIZES[size]
        )}
      >
        <div className="flex items-center justify-between px-6 pt-6">
          {title && <h2 className="text-lg font-extrabold text-[#f8fafc]">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg bg-[#111827] border border-[#1e293b] text-[#94a3b8] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// StatsCard ve PageHeader artık burada değil — tekrar etmesin diye
// `@/components/etsy/shared` içindeki Stat / PageHeader kullanılıyor
// (ETSY_ACCENT = "#d4a054" olarak güncellendi, tek kaynak orası).
