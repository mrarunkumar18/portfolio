"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { useThemeContext } from "@/components/providers/ThemeProvider";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "brutalist";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
  children: ReactNode;
  href?: string;
  download?: boolean;
  external?: boolean;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  href,
  download,
  external,
  className,
  ...props
}: ButtonProps) {
  const { theme } = useThemeContext();
  const isCyberpunk = theme === "cyberpunk";
  const isColobus = theme === "colobus";

  // In cyberpunk mode, all buttons become brutalist
  if (isCyberpunk || variant === "brutalist") {
    const brutalistClass = cn(
      "btn-brutalist",
      size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
      className
    );

    if (href) {
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          download={download || undefined}
          className={brutalistClass}
        >
          {icon}
          {children}
        </a>
      );
    }

    return (
      <button
        className={brutalistClass}
        {...(props as Record<string, unknown>)}
      >
        {icon}
        {children}
      </button>
    );
  }

  const baseStyles = cn(
    "inline-flex items-center justify-center gap-2 font-medium rounded-[var(--radius-md)] transition-all duration-[var(--transition-base)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]",
    isColobus && "btn-colobus"
  );

  const variants = {
    primary:
      "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md hover:shadow-lg hover:shadow-[var(--accent-primary-glow)]",
    ghost:
      "bg-transparent text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-surface)]",
    outline:
      "bg-transparent text-[var(--accent-primary)] border border-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white",
    brutalist: "", // handled above
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-2.5 text-sm",
    lg: "px-8 py-3 text-base",
  };

  const combinedClassName = cn(baseStyles, variants[variant], sizes[size], className);

  if (href) {
    return (
      <motion.a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        download={download || undefined}
        className={combinedClassName}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {icon}
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button
      className={combinedClassName}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      {...(props as Record<string, unknown>)}
    >
      {icon}
      {children}
    </motion.button>
  );
}
