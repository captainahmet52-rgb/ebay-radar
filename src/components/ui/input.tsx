"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-slate-300"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full bg-slate-800/60 border rounded-xl px-4 py-2.5 text-white placeholder:text-slate-500",
              "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50",
              "transition-all duration-200 text-sm",
              icon ? "pl-10" : "",
              error
                ? "border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50"
                : "border-slate-700/50 hover:border-slate-600/50",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1">
            <span>⚠</span>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
