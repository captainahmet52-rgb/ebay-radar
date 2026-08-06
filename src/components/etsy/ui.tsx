"use client";

/**
 * listflow.pro tasarım sistemi — Etsy paneli UI kiti.
 * Renk dili: zemin #0a0a0f · panel #12121a · çizgi #1e1e2e · mor #8b5cf6 ·
 * camgöbeği #06b6d4 · yeşil #10b981. (listflow.pro reposundan porte edildi.)
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
import type { LucideIcon } from "lucide-react";

// ─── Badge ──────────────────────────────────────────────────────────────────

type BadgeVariant = "default" | "success" | "warning" | "danger" | "purple" | "cyan" | "turbo" | "muted";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  default: "bg-[#1e1e2e] text-[#a0a0b0] border border-[#2e2e4e]",
  success: "bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20",
  warning: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20",
  danger: "bg-red-400/10 text-red-400 border border-red-400/20",
  purple: "bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20",
  cyan: "bg-[#06b6d4]/10 text-[#06b6d4] border border-[#06b6d4]/20",
  turbo: "bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] text-white border-0",
  muted: "bg-[#0d0d14] text-[#6b6b80] border border-[#1e1e2e]",
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
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
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

type ButtonVariant = "primary" | "gradient" | "secondary" | "ghost" | "danger" | "cyan";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-[#8b5cf6] hover:bg-[#7c3aed] text-white border border-[#8b5cf6]",
  gradient: "bg-gradient-to-r from-[#06b6d4] to-[#8b5cf6] hover:opacity-90 text-white border-0",
  cyan: "bg-[#06b6d4] hover:bg-[#0891b2] text-white border border-[#06b6d4]",
  secondary: "bg-transparent border border-[#1e1e2e] text-[#a0a0b0] hover:border-[#8b5cf6] hover:text-white",
  ghost: "bg-transparent border-0 text-[#a0a0b0] hover:text-white hover:bg-[#12121a]",
  danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30",
};

const BUTTON_SIZES = {
  sm: "px-3 py-1.5 text-xs rounded-md",
  md: "px-4 py-2 text-sm rounded-lg",
  lg: "px-6 py-3 text-base rounded-lg",
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
        "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
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
        <label htmlFor={inputId} className="text-xs font-medium text-[#a0a0b0] uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-[#6b6b80]",
          "focus:outline-none focus:border-[#8b5cf6] focus:ring-1 focus:ring-[#8b5cf6]/50 transition-all duration-200",
          error && "border-red-500/50 focus:border-red-500 focus:ring-red-500/20",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

// ─── Select (listflow form select stili) ────────────────────────────────────

export function Select({
  label,
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-[#a0a0b0] uppercase tracking-wider">{label}</label>
      )}
      <select
        className={cn(
          "w-full bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-2.5 text-sm text-white",
          "focus:outline-none focus:border-[#8b5cf6] transition-all duration-200",
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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full bg-[#12121a] border border-[#1e1e2e] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto",
          MODAL_SIZES[size]
        )}
      >
        <div className="flex items-center justify-between px-6 pt-6">
          {title && <h2 className="text-lg font-semibold text-white">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto text-[#6b6b80] hover:text-white transition-colors p-1 rounded-md hover:bg-[#1e1e2e]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}

// ─── StatsCard ──────────────────────────────────────────────────────────────

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-[#8b5cf6]",
  accentColor = "bg-[#8b5cf6]/10",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  accentColor?: string;
}) {
  return (
    <div className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider">{title}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", accentColor)}>
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {subtitle && <div className="text-xs text-[#6b6b80] mt-1">{subtitle}</div>}
      </div>
    </div>
  );
}

// ─── Sayfa başlığı (listflow eyebrow + başlık kalıbı) ───────────────────────

export function ListflowHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-[#6b6b80] uppercase tracking-wider border border-[#1e1e2e] px-2 py-0.5 rounded-md">
            {eyebrow}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
        {subtitle && <p className="text-sm text-[#a0a0b0]">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
