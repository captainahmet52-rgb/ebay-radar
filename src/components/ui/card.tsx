"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "glow";

interface CardProps extends Omit<HTMLMotionProps<"div">, "children"> {
  variant?: CardVariant;
  children?: React.ReactNode;
}

export function Card({ variant = "default", className, children, ...props }: CardProps) {
  return (
    <motion.div
      className={cn(
        "bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6",
        variant === "glow" &&
          "hover:border-violet-500/30 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-300",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}
