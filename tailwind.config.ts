import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class" as const,
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Portal v1.5 — editorial card radius (design spec §6.1)
        editorial: "var(--radius-editorial, 0.75rem)",
      },
      // Portal layout spacing tokens (design spec §3.2 shell dimensions)
      width: {
        sidebar: "var(--portal-sidebar-width)",
        "sidebar-compact": "var(--portal-sidebar-width-compact)",
        // Portal v1.5 Stitch re-skin — Context Rail + filter column widths (design spec §6.1)
        rail: "var(--portal-rail-width, 20rem)",
        "rail-compact": "var(--portal-rail-width-compact, 17.5rem)",
        filter: "var(--portal-filter-width, 12.5rem)",
      },
      height: {
        topbar: "var(--portal-topbar-height)",
      },
      // Portal v1.5 — display (Fraunces) font family (design spec §6.1; P1-03 adds next/font var)
      fontFamily: {
        display: ["var(--portal-brand-display)", "Iowan Old Style", "Charter", "Georgia", "serif"],
      },
      // Portal v1.5 — brand tagline letter-spacing (design spec §6.3)
      letterSpacing: {
        "brand-wide": "0.18em",
      },
      // Portal v1.5 — hero card box shadow (design spec §6.1)
      boxShadow: {
        hero: "var(--portal-shadow-hero, 0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(15 23 42 / 0.12))",
      },
      // Breakpoints match design spec: 320 (mobile) / 768 (tablet) / 1024 (desktop)
      screens: {
        xs: "320px",
      },
    },
  },
  plugins: [],
};

export default config;
