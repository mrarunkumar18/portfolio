"use client";

import { useState, useEffect, useCallback } from "react";
import { getStoredTheme, setStoredTheme } from "@/lib/utils";

export type Theme = "dark" | "light" | "cyberpunk" | "terminal" | "colobus";

const THEME_ORDER: Theme[] = ["dark", "light", "cyberpunk", "terminal", "colobus"];

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "cyberpunk", "terminal", "colobus");
  if (theme === "light") root.classList.add("light");
  if (theme === "cyberpunk") root.classList.add("cyberpunk");
  if (theme === "terminal") root.classList.add("terminal");
  if (theme === "colobus") root.classList.add("colobus");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const stored = getStoredTheme();
    if (stored) {
      setTheme(stored);
      applyTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial: Theme = prefersDark ? "dark" : "light";
      setTheme(initial);
      applyTheme(initial);
    }
  }, []);

  const setSelectedTheme = useCallback((nextTheme: Theme) => {
    setTheme(nextTheme);
    setStoredTheme(nextTheme);
    applyTheme(nextTheme);
  }, []);

  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const currentIndex = THEME_ORDER.indexOf(prev);
      const next = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
      setStoredTheme(next);
      applyTheme(next);
      return next;
    });
  }, []);

  // Keep backward compat: toggleTheme still cycles
  const toggleTheme = cycleTheme;

  return { theme, setTheme: setSelectedTheme, cycleTheme, toggleTheme, mounted };
}

