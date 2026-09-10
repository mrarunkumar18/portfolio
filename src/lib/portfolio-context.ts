/**
 * portfolio-context.ts
 *
 * Builds a structured, server-safe portfolio context from the existing
 * src/data/*.ts files — the single source of truth.
 *
 * This module is intentionally side-effect free and has no client-only imports.
 * It can be safely called from any Next.js Server Component, Route Handler,
 * or server-side utility.
 *
 * Usage:
 *   import { getPortfolioContext, serializePortfolioContext } from "@/lib/portfolio-context";
 *
 *   const ctx   = getPortfolioContext();           // typed object
 *   const block = serializePortfolioContext(ctx);  // plain text for AI prompt
 */

import { personal, socialLinks, stats } from "@/data/personal";
import { projects } from "@/data/projects";
import { skills, skillCategories } from "@/data/skills";
import { certifications } from "@/data/certifications";

/* ── Typed shapes ─────────────────────────────────────────────────────────── */

export interface PortfolioProfile {
  name: string;
  headline: string;
  bio: string;
  education: string;
  location: string;
  focusAreas: string[];
  currentGoal: string;
}

export interface PortfolioLink {
  platform: string;
  url: string;
}

export interface PortfolioProject {
  id: string;
  title: string;
  description: string;
  category: string;
  technologies: string[];
  github?: string;
  liveDemo?: string;
}

export interface PortfolioSkillGroup {
  category: string;
  skills: string[];
}

export interface PortfolioCertification {
  name: string;
  issuer: string;
  date: string;
  verificationUrl?: string;
}

export interface PortfolioStats {
  label: string;
  value: number;
}

export interface PortfolioContext {
  profile: PortfolioProfile;
  links: PortfolioLink[];
  projects: PortfolioProject[];
  skillGroups: PortfolioSkillGroup[];
  certifications: PortfolioCertification[];
  stats: PortfolioStats[];
}

/* ── Builder ──────────────────────────────────────────────────────────────── */

/**
 * Returns a fully typed, normalized snapshot of the portfolio.
 * All data is sourced from src/data/*.ts — nothing is invented here.
 */
export function getPortfolioContext(): PortfolioContext {
  // Profile
  const profile: PortfolioProfile = {
    name: personal.name,
    headline: personal.headline,
    bio: personal.bio,
    education: "Bachelor of Computer Applications (BCA)", // Derived from bio/typingRoles
    location: personal.location,
    focusAreas: ["Cybersecurity", "Linux", "Networking", "Web Development"],
    currentGoal:
      "Become internship-ready in cybersecurity through hands-on technical execution.",
  };

  // Links — flatten all social links into a single list
  const links: PortfolioLink[] = [
    { platform: "Website", url: personal.website },
    { platform: "Resume", url: personal.resumeUrl },
    { platform: "Email", url: `mailto:${personal.email}` },
    ...socialLinks.professional.map((l) => ({
      platform: l.name,
      url: l.url,
    })),
  ];

  // Projects — map from data/projects.ts
  const normalizedProjects: PortfolioProject[] = projects.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    technologies: p.skills,
    ...(p.github ? { github: p.github } : {}),
    ...(p.liveDemo ? { liveDemo: p.liveDemo } : {}),
  }));

  // Skills — group by category using the existing skillCategories order
  const skillGroups: PortfolioSkillGroup[] = skillCategories.map((cat) => ({
    category: cat,
    skills: skills
      .filter((s) => s.category === cat)
      .map((s) => s.name),
  }));

  // Certifications — only verified entries
  const normalizedCerts: PortfolioCertification[] = certifications
    .filter((c) => c.status === "verified")
    .map((c) => ({
      name: c.name,
      issuer: c.issuer,
      date: c.date,
      ...(c.verificationUrl ? { verificationUrl: c.verificationUrl } : {}),
    }));

  // Stats
  const normalizedStats: PortfolioStats[] = stats.map((s) => ({
    label: s.label,
    value: s.value,
  }));

  return {
    profile,
    links,
    projects: normalizedProjects,
    skillGroups,
    certifications: normalizedCerts,
    stats: normalizedStats,
  };
}

/* ── Text serializer ──────────────────────────────────────────────────────── */

/**
 * Converts a PortfolioContext into a clean, structured text block
 * suitable for injection into an AI system prompt.
 *
 * Prefer structured JSON internally; this function is called by the API route
 * when building the final prompt string for the AI provider.
 */
export function serializePortfolioContext(ctx: PortfolioContext): string {
  const lines: string[] = [];

  // ── PROFILE ───────────────────────────────────────────────────────────────
  lines.push("## PROFILE");
  lines.push(`Name: ${ctx.profile.name}`);
  lines.push(`Headline: ${ctx.profile.headline}`);
  lines.push(`Education: ${ctx.profile.education}`);
  lines.push(`Location: ${ctx.profile.location}`);
  lines.push(`Bio: ${ctx.profile.bio}`);
  lines.push(`Focus Areas: ${ctx.profile.focusAreas.join(", ")}`);
  lines.push(`Current Goal: ${ctx.profile.currentGoal}`);
  lines.push("");

  // ── LINKS ─────────────────────────────────────────────────────────────────
  lines.push("## PUBLIC LINKS");
  for (const link of ctx.links) {
    lines.push(`${link.platform}: ${link.url}`);
  }
  lines.push("");

  // ── PROJECTS ──────────────────────────────────────────────────────────────
  lines.push("## PROJECTS");
  for (const project of ctx.projects) {
    lines.push(`### ${project.title}`);
    lines.push(`Category: ${project.category}`);
    lines.push(`Description: ${project.description}`);
    lines.push(`Technologies: ${project.technologies.join(", ")}`);
    if (project.github) lines.push(`GitHub: ${project.github}`);
    if (project.liveDemo) lines.push(`Live Demo: ${project.liveDemo}`);
    lines.push("");
  }

  // ── SKILLS ────────────────────────────────────────────────────────────────
  lines.push("## SKILLS");
  for (const group of ctx.skillGroups) {
    if (group.skills.length > 0) {
      lines.push(`${group.category}: ${group.skills.join(", ")}`);
    }
  }
  lines.push("");

  // ── CERTIFICATIONS ────────────────────────────────────────────────────────
  lines.push("## CERTIFICATIONS");
  if (ctx.certifications.length === 0) {
    lines.push("No verified certifications listed at this time.");
  } else {
    for (const cert of ctx.certifications) {
      lines.push(`- ${cert.name} | Issuer: ${cert.issuer} | Date: ${cert.date}`);
      if (cert.verificationUrl) {
        lines.push(`  Verification: ${cert.verificationUrl}`);
      }
    }
  }
  lines.push("");

  // ── STATS ─────────────────────────────────────────────────────────────────
  lines.push("## PORTFOLIO STATS");
  for (const stat of ctx.stats) {
    lines.push(`${stat.label}: ${stat.value}`);
  }
  lines.push("");

  // ── IMPORTANT CONSTRAINTS FOR AI ──────────────────────────────────────────
  lines.push("## IMPORTANT");
  lines.push(
    "Only use the information above to answer questions. Do not invent projects, certifications, skills, jobs, internships, companies, achievements, statistics, or any other facts not listed here. If asked about information not present above, say you do not have verified information about that in Arun's portfolio."
  );

  return lines.join("\n");
}
