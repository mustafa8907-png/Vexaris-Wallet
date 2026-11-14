/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "#09080c",
        surface: {
          950: "#09080c",
          900: "#0e0d13",
          850: "#14121a",
          800: "#1a1822",
          700: "#24212e",
          600: "#302c3d",
          500: "#413c50",
        },
        accent: {
          DEFAULT: "#e5484d",
          hover: "#ef5b60",
          press: "#cf3b40",
          soft: "rgba(229, 72, 77, 0.10)",
        },
        // Konuya ait tam doygunlukta vurgular: yükseliş, bilgi, uyarı, seri.
        success: "#3ecf8e",
        danger: "#ff5c60",
        warning: "#ffb020",
        info: "#4c8dff",
        magenta: "#ff4d9d",
        violet: "#a78bfa",
        teal: "#2dd4bf",
        lime: "#c7f284",
        up: "#3ecf8e",
        down: "#ff5c60",
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono Variable", "JetBrains Mono", "Cascadia Code", "monospace"],
      },
      borderRadius: {
        xl2: "1rem",
        xl3: "1.375rem",
      },
      boxShadow: {
        panel: "0 1px 0 rgba(255,255,255,0.03) inset, 0 20px 40px -32px rgba(0,0,0,0.9)",
        lift: "0 18px 44px -26px rgba(0,0,0,0.95), 0 1px 0 rgba(255,255,255,0.04) inset",
        glow: "0 0 0 1px rgba(229,72,77,0.28), 0 12px 36px -18px rgba(229,72,77,0.55)",
      },
      backgroundImage: {
        "mesh-brand":
          "radial-gradient(900px 520px at 12% -10%, rgba(229,72,77,0.16), transparent 62%), radial-gradient(760px 460px at 92% 4%, rgba(76,141,255,0.13), transparent 60%), radial-gradient(700px 500px at 60% 108%, rgba(167,139,250,0.12), transparent 62%)",
        "rail-up": "linear-gradient(180deg, rgba(62,207,142,0.22), rgba(62,207,142,0))",
        "rail-down": "linear-gradient(180deg, rgba(255,92,96,0.22), rgba(255,92,96,0))",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-in-right": {
          "0%": { opacity: "0", transform: "translateX(18px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%": { transform: "translateX(-5px)" },
          "40%": { transform: "translateX(5px)" },
          "60%": { transform: "translateX(-3px)" },
          "80%": { transform: "translateX(3px)" },
        },
        "live-pulse": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.35", transform: "scale(0.82)" },
        },
        "flash-up": {
          "0%": { backgroundColor: "rgba(62,207,142,0.22)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-down": {
          "0%": { backgroundColor: "rgba(255,92,96,0.22)" },
          "100%": { backgroundColor: "transparent" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-420px 0" },
          "100%": { backgroundPosition: "420px 0" },
        },
        "draw-line": {
          "0%": { strokeDashoffset: "1400" },
          "100%": { strokeDashoffset: "0" },
        },
        drift: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%, -2%, 0) scale(1.06)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.22s ease-out both",
        "fade-in": "fade-in 0.2s ease-out both",
        "slide-in-right": "slide-in-right 0.24s cubic-bezier(0.22,1,0.36,1) both",
        shake: "shake 0.32s ease-in-out",
        "live-pulse": "live-pulse 1.6s ease-in-out infinite",
        "flash-up": "flash-up 0.7s ease-out",
        "flash-down": "flash-down 0.7s ease-out",
        shimmer: "shimmer 1.5s linear infinite",
        "draw-line": "draw-line 0.9s ease-out both",
        drift: "drift 26s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
