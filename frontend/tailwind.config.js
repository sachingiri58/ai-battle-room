/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Mono'", "monospace"],
        body: ["'DM Sans'", "sans-serif"],
      },
      colors: {
        void: "#050508",
        surface: "#0d0d14",
        panel: "#12121c",
        border: "#1e1e30",
        accent: "#6c63ff",
        "accent-hot": "#ff3cac",
        "accent-glow": "#00f5ff",
        muted: "#4a4a6a",
        text: "#e8e8f0",
        "text-dim": "#8888aa",
      },
      animation: {
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "slide-up": "slideUp 0.4s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px #6c63ff44" },
          "100%": { boxShadow: "0 0 20px #6c63ff88, 0 0 40px #6c63ff22" },
        },
        slideUp: {
          "0%": { transform: "translateY(12px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
