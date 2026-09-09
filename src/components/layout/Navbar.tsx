"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { navbarVariants, mobileMenuVariants } from "@/lib/animations";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { useThemeContext } from "@/components/providers/ThemeProvider";
import { navLinks, personal } from "@/data/personal";
import { cn } from "@/lib/utils";
import { Menu, X, ChevronDown } from "lucide-react";

const sectionIds = navLinks.map((l) => l.href.replace("#", ""));

/* Numeric prefix labels for cyberpunk mode */
const cyberpunkNavLabels: Record<string, string> = {
  Home: "01_HOME",
  About: "02_ABOUT",
  Skills: "03_SKILLS",
  Projects: "04_PROJECTS",
  Certifications: "05_CERTS",
  Resume: "06_RESUME",
  Contact: "07_CONTACT",
};

const themeOptions = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "cyberpunk", label: "Cyberpunk" },
  { key: "terminal", label: "Terminal" },
  { key: "colobus", label: "Colobus Curio" },
] as const;

function ThemeMenuControl({
  theme,
  setTheme,
  isCyberpunk,
  open,
  onToggle,
  onClose,
}: {
  theme: string;
  setTheme: (theme: (typeof themeOptions)[number]["key"]) => void;
  isCyberpunk: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const panelClass = isCyberpunk
    ? "border border-[#FFFFFF] bg-black"
    : "border border-[var(--border-subtle)] bg-[var(--bg-glass)]";

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-all duration-200",
          isCyberpunk
            ? "border border-[#333333] bg-black text-white hover:border-[#00FF00]"
            : "border border-[var(--border-subtle)] bg-[var(--bg-glass)] hover:bg-[var(--bg-surface-hover)]"
        )}
        style={{ color: isCyberpunk ? "#FFFFFF" : "var(--text-secondary)" }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className={isCyberpunk ? "font-mono text-[11px] uppercase tracking-[0.08em]" : ""}>
          Theme
        </span>
        <ChevronDown size={14} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className={cn(
              "absolute right-0 top-full z-20 mt-2 w-[220px] rounded-[var(--radius-md)] p-2 shadow-lg",
              panelClass,
              isCyberpunk && "font-mono"
            )}
          >
            <div
              className={cn(
                "px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em]",
                isCyberpunk ? "text-[#FFFFFF]" : "text-[var(--text-muted)]"
              )}
            >
              Theme List
            </div>
            <div className="flex flex-col gap-1">
              {themeOptions.map((option) => {
                const isActive = theme === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      setTheme(option.key);
                      onClose();
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-all duration-200",
                      isCyberpunk && "text-[11px] uppercase tracking-[0.08em]"
                    )}
                    style={{
                      background: isActive
                        ? isCyberpunk
                          ? "#00FF00"
                          : "var(--accent-primary)"
                        : "transparent",
                      color: isActive
                        ? isCyberpunk
                          ? "#000000"
                          : "#ffffff"
                        : isCyberpunk
                        ? "#FFFFFF"
                        : "var(--text-secondary)",
                      border: `1px solid ${
                        isActive
                          ? isCyberpunk
                            ? "#00FF00"
                            : "var(--accent-primary)"
                          : isCyberpunk
                          ? "#333333"
                          : "transparent"
                      }`,
                    }}
                    aria-pressed={isActive}
                  >
                    <span className="font-medium">{option.label}</span>
                    <span
                      className="text-[11px] uppercase tracking-[0.16em]"
                      style={{
                        color: isActive
                          ? isCyberpunk
                            ? "#000000"
                            : "#ffffff"
                          : isCyberpunk
                          ? "#888888"
                          : "var(--text-muted)",
                      }}
                    >
                      {isActive ? "Active" : "Select"}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const activeId = useScrollSpy(sectionIds);
  const { theme, setTheme, mounted } = useThemeContext();
  const isCyberpunk = theme === "cyberpunk";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  /* ── Cyberpunk Navbar ── */
  if (isCyberpunk) {
    return (
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: "80px",
          background: "#000000",
          borderBottom: "1px solid #FFFFFF",
          display: "flex",
          alignItems: "center",
        }}
      >
        <nav
          style={{
            width: "100%",
            maxWidth: "1400px",
            margin: "0 auto",
            padding: "0 1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "2rem",
          }}
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <a
            href="#home"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "14px",
              fontWeight: 700,
              color: "#FFFFFF",
              textDecoration: "none",
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
            aria-label="Go to top"
          >
            <span style={{ color: "#00FF00" }}>&gt; </span>
            {personal.name.split(" ")[0].toLowerCase()}
            <span style={{ color: "#555555" }}>@portfolio</span>
            <span className="cursor-blink" />
          </a>

          {/* Desktop Nav Links */}
          <div
            className="hidden md:flex"
            style={{ alignItems: "center", gap: "0rem" }}
          >
            {navLinks.map((link) => {
              const isActive = activeId === link.href.replace("#", "");
              const label = cyberpunkNavLabels[link.label] || link.label;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? "#00FF00" : "#555555",
                    padding: "0.5rem 0.75rem",
                    textDecoration: "none",
                    letterSpacing: "0.05em",
                    borderBottom: isActive ? "2px solid #00FF00" : "2px solid transparent",
                    transition: "all 0.1s steps(2)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#FFFFFF";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = isActive ? "#00FF00" : "#555555";
                  }}
                >
                  {label}
                </a>
              );
            })}
          </div>

          {/* Right: Theme list + Mobile */}
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            {mounted && (
              <ThemeMenuControl
                theme={theme}
                setTheme={setTheme}
                isCyberpunk={true}
                open={isThemeMenuOpen}
                onToggle={() => setIsThemeMenuOpen((prev) => !prev)}
                onClose={() => setIsThemeMenuOpen(false)}
              />
            )}
            <button
              className="flex md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "12px",
                color: "#FFFFFF",
                background: "none",
                border: "1px solid #333333",
                padding: "0.4rem 0.6rem",
                cursor: "pointer",
              }}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </nav>

        {/* Cyberpunk Mobile Menu */}
        {mobileOpen && (
          <div
            style={{
              position: "fixed",
              top: "80px",
              right: 0,
              bottom: 0,
              width: "280px",
              background: "#000000",
              borderLeft: "1px solid #FFFFFF",
              padding: "1.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              zIndex: 50,
            }}
          >
            {navLinks.map((link) => {
              const isActive = activeId === link.href.replace("#", "");
              const label = cyberpunkNavLabels[link.label] || link.label;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12px",
                    color: isActive ? "#00FF00" : "#666666",
                    padding: "0.75rem 1rem",
                    textDecoration: "none",
                    borderBottom: "1px solid #111111",
                    display: "block",
                  }}
                >
                  {label}
                </a>
              );
            })}
          </div>
        )}
      </header>
    );
  }

  /* ── Default (dark / light) Navbar ── */
  return (
    <motion.header
      variants={navbarVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "glass shadow-md"
          : "bg-transparent"
      )}
    >
      <nav
        className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between"
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo */}
        <a
          href="#home"
          className="font-mono text-sm font-semibold tracking-tight transition-colors"
          style={{ color: "var(--accent-primary)" }}
          aria-label="Go to top"
        >
          {personal.name.split(" ")[0].toLowerCase()}
          <span style={{ color: "var(--text-muted)" }}>@portfolio</span>
          <span className="cursor-blink" />
        </a>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-3">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-[var(--radius-sm)] transition-all duration-200",
                activeId === link.href.replace("#", "")
                  ? "bg-[var(--accent-primary-glow)]"
                  : "hover:bg-[var(--bg-surface-hover)]"
              )}
              style={{
                color:
                  activeId === link.href.replace("#", "")
                    ? "var(--accent-primary)"
                    : "var(--text-secondary)",
              }}
            >
              {link.label}
            </a>
          ))}

          {/* Theme menu */}
          {mounted && (
            <ThemeMenuControl
              theme={theme}
              setTheme={setTheme}
              isCyberpunk={false}
              open={isThemeMenuOpen}
              onToggle={() => setIsThemeMenuOpen((prev) => !prev)}
              onClose={() => setIsThemeMenuOpen(false)}
            />
          )}
        </div>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 rounded-[var(--radius-sm)]"
            style={{ color: "var(--text-primary)" }}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-16 bg-black/50 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              variants={mobileMenuVariants}
              initial="closed"
              animate="open"
              exit="closed"
              className="fixed top-16 right-0 bottom-0 w-72 md:hidden p-6 flex flex-col gap-2"
              style={{ background: "var(--bg-surface)", borderLeft: "1px solid var(--border-subtle)" }}
            >
              {mounted && (
                <ThemeMenuControl
                  theme={theme}
                  setTheme={setTheme}
                  isCyberpunk={false}
                  open={isThemeMenuOpen}
                  onToggle={() => setIsThemeMenuOpen((prev) => !prev)}
                  onClose={() => setIsThemeMenuOpen(false)}
                />
              )}
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium rounded-[var(--radius-sm)] transition-all",
                    activeId === link.href.replace("#", "")
                      ? "bg-[var(--accent-primary-glow)]"
                      : ""
                  )}
                  style={{
                    color:
                      activeId === link.href.replace("#", "")
                        ? "var(--accent-primary)"
                        : "var(--text-secondary)",
                  }}
                >
                  {link.label}
                </a>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
