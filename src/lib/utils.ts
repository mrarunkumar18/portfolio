/**
 * Merge class names, filtering out falsy values.
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * Detect if running in browser environment.
 */
export function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if user has visited before (for loading screen skip).
 */
export function hasVisitedBefore(): boolean {
  if (!isBrowser()) return false;
  return localStorage.getItem("portfolio-visited") === "true";
}

/**
 * Mark the user as having visited.
 */
export function markVisited(): void {
  if (!isBrowser()) return;
  localStorage.setItem("portfolio-visited", "true");
}

/**
 * Get current theme from localStorage.
 */
export function getStoredTheme(): "dark" | "light" | "cyberpunk" | "terminal" | "colobus" | null {
  if (!isBrowser()) return null;
  const stored = localStorage.getItem("portfolio-theme");
  if (
    stored === "dark" ||
    stored === "light" ||
    stored === "cyberpunk" ||
    stored === "terminal" ||
    stored === "colobus"
  ) return stored;
  return null;
}

/**
 * Store theme preference.
 */
export function setStoredTheme(theme: "dark" | "light" | "cyberpunk" | "terminal" | "colobus"): void {
  if (!isBrowser()) return;
  localStorage.setItem("portfolio-theme", theme);
}
