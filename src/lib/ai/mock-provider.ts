/**
 * Mock AI Provider
 *
 * Returns deterministic, realistic responses without making any real API call.
 * Used for:
 *   - Local UI development
 *   - Build verification
 *   - Testing without API credits
 *   - CI environments
 *
 * Set AI_PROVIDER=mock in .env.local to activate.
 */

import { type AIProvider, type AIMessage, type AIResponse } from "./provider";

/* ── Response library ─────────────────────────────────────────────────────── */

const MOCK_RESPONSES: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ["project", "build", "built", "made", "created", "work"],
    answer:
      "Arun has built several hands-on technical projects:\n\n- **Linux Access Control Simulation** (Security) — Simulated real-world Linux permission systems using `chmod`, user roles, and file access management.\n- **Weather UI Dashboard** (Web) — A React + Next.js weather app with 7-day forecasts and saved cities, deployed on Vercel.\n- **System Programming Practice Toolkit** (Programming) — C programs covering arrays, loops, file handling, and low-level fundamentals.\n- **AI Workflow Exploration** (AI) — Experiments with prompt engineering and AI-powered productivity systems.\n- **Personal Portfolio Website** (Web) — This very site, built with Next.js and deployed with Vercel.\n\nYou can explore Arun's code on [GitHub](https://github.com/arun-codex).",
  },
  {
    keywords: ["skill", "tech", "know", "language", "tool", "stack", "use"],
    answer:
      "Arun's technical skills span four areas:\n\n**Cybersecurity & Linux**\nLinux, Networking\n\n**Programming**\nC, JavaScript, Python\n\n**Web Development**\nHTML, CSS, JavaScript\n\n**Tools**\nGit, GitHub, VS Code, MySQL, Excel\n\nHis current primary focus is cybersecurity and Linux — building practical skills through real labs rather than theory alone.",
  },
  {
    keywords: ["intern", "hire", "recruit", "job", "position", "candidate", "why"],
    answer:
      "Arun would bring genuine, hands-on value to a cybersecurity internship:\n\n- Built a real **Linux Access Control lab** exploring `chmod`, user roles, and file permissions\n- Actively studying Linux and networking through practical experiments\n- BCA student focused on execution — building skills through real projects\n- Experience with low-level C programming and web development gives broader technical context\n- Has a portfolio of work demonstrating initiative and self-direction\n\nYou can review his projects at [github.com/arun-codex](https://github.com/arun-codex) and his full profile at [arunsingh.xyz](https://arunsingh.xyz).",
  },
  {
    keywords: ["linux", "access", "permission", "chmod", "security lab"],
    answer:
      "Arun's **Linux Access Control Simulation** is one of his core cybersecurity projects.\n\nIt simulates real-world Linux permission systems — covering `chmod`, user roles, user/group management, and file access control in a controlled lab environment. The project demonstrates understanding of how access control works in Linux, a foundational skill for cybersecurity work.\n\nYou can find it on [GitHub](https://github.com/mrarunkumar18).",
  },
  {
    keywords: ["contact", "email", "reach", "message", "touch"],
    answer:
      "You can reach Arun through these verified channels:\n\n- **Email:** arun.cyberx@gmail.com\n- **GitHub:** [github.com/arun-codex](https://github.com/arun-codex)\n- **LinkedIn:** [linkedin.com/in/arun-codex](https://www.linkedin.com/in/arun-codex/)\n- **Website:** [arunsingh.xyz](https://arunsingh.xyz)\n- **X (Twitter):** [@itz_arun_1806](https://x.com/itz_arun_1806)",
  },
  {
    keywords: ["github", "repository", "repo", "code", "open source"],
    answer:
      "Arun's GitHub is at [github.com/arun-codex](https://github.com/arun-codex).\n\nHis repositories include his portfolio site, weather dashboard, C learning project, and Python learning project. He currently has around 10 public repositories.",
  },
  {
    keywords: ["resume", "cv", "download", "pdf"],
    answer:
      "You can view or download Arun's resume directly from his portfolio at [arunsingh.xyz](https://arunsingh.xyz) — look for the Resume section or the download button on the page.",
  },
  {
    keywords: ["certification", "cert", "certificate", "course"],
    answer:
      "Arun currently holds one verified certification:\n\n- **Introduction to Generative AI** — issued by Google (February 2026)\n  [View credential](https://www.skills.google/public_profiles/28c98619-745d-4f60-ac6e-900f1f52afff/badges/21915333)\n\nHe is actively building toward more cybersecurity-focused certifications.",
  },
  {
    keywords: ["education", "study", "bca", "college", "degree", "student"],
    answer:
      "Arun is pursuing a **Bachelor of Computer Applications (BCA)**. He is a student currently building practical cybersecurity skills alongside his formal education through labs, real projects, and hands-on technical experiments.",
  },
  {
    keywords: ["cybersecurity", "security", "cyber", "hacking", "interest", "focus"],
    answer:
      "Cybersecurity is Arun's primary focus area. He is building practical skills through:\n\n- **Linux labs** — access control, user management, permissions\n- **Networking experiments** — understanding how networks work at a protocol level\n- **Secure development** — writing software with security in mind\n- **AI and security** — exploring how AI intersects with cybersecurity workflows\n\nHis current goal is to become internship-ready in cybersecurity through real execution rather than theory alone.",
  },
  {
    keywords: ["weather", "dashboard", "react", "vercel"],
    answer:
      "Arun built a **Weather UI Dashboard** using React and Next.js. It features:\n\n- 7-day weather forecasts\n- Saved cities\n- Responsive UI with smooth animations\n- Deployed on Vercel\n\nYou can try it live: [weather-omega-pink.vercel.app](https://weather-omega-pink.vercel.app/) and view the source on [GitHub](https://github.com/arun-codex/Weather).",
  },
  {
    keywords: ["who", "about", "arun", "introduce", "tell me"],
    answer:
      "Arun Kumar is a **BCA student and Cybersecurity Enthusiast** based in India.\n\nHe is building practical cybersecurity skills through Linux labs, networking experiments, secure development, and hands-on technical projects — with a clear goal of becoming internship-ready through execution rather than theory alone.\n\n**Focus areas:** Cybersecurity · Linux · Networking · Web Development\n\nYou can explore his work at [arunsingh.xyz](https://arunsingh.xyz) or connect on [LinkedIn](https://www.linkedin.com/in/arun-codex/).",
  },
];

const FALLBACK_ANSWER =
  "I can help you learn about Arun's portfolio! You can ask me about his projects, cybersecurity journey, technical skills, certifications, GitHub, resume, or how to get in touch.\n\nIs there something specific you'd like to know?";

const CANNOT_ANSWER =
  "I don't have verified information about that in Arun's portfolio. I can only share details that are publicly available in his portfolio data.\n\nFeel free to ask about his projects, skills, certifications, or contact information.";

const CANNOT_KEYWORDS = [
  "salary", "money", "pay", "income", "wage",
  "internship at", "worked at", "employed", "job at", "company",
  "private", "personal", "address", "phone", "secret",
  "api key", "password", "credential", "token",
  "system prompt", "instructions", "ignore", "reveal",
];

/* ── Implementation ───────────────────────────────────────────────────────── */

export class MockProvider implements AIProvider {
  async chat(
    _systemPrompt: string,
    messages: AIMessage[]
  ): Promise<AIResponse> {
    // Simulate network latency
    await delay(700 + Math.random() * 500);

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");

    if (!lastUserMessage) {
      return { answer: FALLBACK_ANSWER };
    }

    const text = lastUserMessage.content.toLowerCase();

    // Reject prompt injection / secret-extraction attempts
    if (CANNOT_KEYWORDS.some((kw) => text.includes(kw))) {
      return { answer: CANNOT_ANSWER };
    }

    // Find the best matching canned response
    for (const entry of MOCK_RESPONSES) {
      if (entry.keywords.some((kw) => text.includes(kw))) {
        return { answer: entry.answer };
      }
    }

    return { answer: FALLBACK_ANSWER };
  }
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
