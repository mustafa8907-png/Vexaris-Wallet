import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri hazır olmadığı dönemde `vite` ile tarayıcı modunda da çalışır.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    outDir: "dist",
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      output: {
        // Satıcı kodu uygulama kodundan ayrı önbelleklenir. Fonksiyon biçimi
        // kullanılıyor: dizi biçimi paketi giriş sayıp tüm ikon barrell'ını
        // (9000+ ikon) ağaca sokar, tree-shaking'i bozar.
        manualChunks(id) {
          if (id.includes("@phosphor-icons")) return "icons";
          if (/node_modules\/\.pnpm\/(react|react-dom|react-router|react-router-dom|scheduler)@/.test(id)) {
            return "react";
          }
        },
      },
    },
  },
});
