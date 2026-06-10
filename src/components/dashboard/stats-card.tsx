"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  prefix?: string;
  suffix?: string;
  change?: number;
  icon: React.ReactNode;
  color?: "violet" | "blue" | "green" | "amber";
  delay?: number;
}

const colorClasses = {
  violet: {
    icon: "from-violet-600 to-violet-400",
    glow: "shadow-violet-500/20",
    change: "bg-violet-500/10",
  },
  blue: {
    icon: "from-blue-600 to-blue-400",
    glow: "shadow-blue-500/20",
    change: "bg-blue-500/10",
  },
  green: {
    icon: "from-emerald-600 to-emerald-400",
    glow: "shadow-emerald-500/20",
    change: "bg-emerald-500/10",
  },
  amber: {
    icon: "from-amber-600 to-amber-400",
    glow: "shadow-amber-500/20",
    change: "bg-amber-500/10",
  },
};

function useCountUp(target: number, duration = 1500) {
  const [count, setCount] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [target, duration]);

  return count;
}

export function StatsCard({
  title,
  value,
  prefix = "",
  suffix = "",
  change,
  icon,
  color = "violet",
  delay = 0,
}: StatsCardProps) {
  const colors = colorClasses[color];
  const numericValue = typeof value === "number" ? value : 0;
  const counted = useCountUp(numericValue);
  const displayValue = typeof value === "number" ? counted : value;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className={cn(
        "bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6",
        "hover:border-slate-600/50 transition-all duration-300",
        "shadow-lg", colors.glow
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">
            {prefix}
            {displayValue}
            {suffix}
          </p>
          {change !== undefined && (
            <div
              className={cn(
                "inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium",
                change >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </div>
          )}
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-2xl bg-gradient-to-br flex items-center justify-center flex-shrink-0",
            colors.icon,
            "shadow-lg"
          )}
        >
          <div className="text-white [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
        </div>
      </div>
    </motion.div>
  );
}
