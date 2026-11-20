import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/fonts.css";
import App from "./App";
import { applyLocale } from "@/lib/utils";
import { installKeyboardInset } from "@/lib/keyboard";
import { useSettingsStore } from "@/stores/settingsStore";
import "./styles/globals.css";

applyLocale(useSettingsStore.getState().locale);
installKeyboardInset();

function dismissBoot() {
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.classList.add("gone");
  window.setTimeout(() => boot.remove(), 400);
}

const container = document.getElementById("root")!;
const root = ReactDOM.createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.requestAnimationFrame(() => {
  window.requestAnimationFrame(dismissBoot);
});

window.setTimeout(dismissBoot, 2500);
