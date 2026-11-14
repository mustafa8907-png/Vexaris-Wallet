import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/fonts.css";
import App from "./App";
import { applyLocale } from "@/lib/utils";
import { useSettingsStore } from "@/stores/settingsStore";
import "./styles/globals.css";

applyLocale(useSettingsStore.getState().locale);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
