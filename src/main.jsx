import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

const REQUIRED_FIREBASE_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
];

const hasRequiredFirebaseConfig = (config) =>
  REQUIRED_FIREBASE_KEYS.every((key) => String(config?.[key] || "").trim());

const loadRuntimeFirebaseConfig = async () => {
  if (import.meta.env.VITE_FIREBASE_API_KEY) return;

  const endpoints = ["/__/firebase/init.json", "/api/firebase-config"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) continue;

      const payload = await response.json();
      if (!hasRequiredFirebaseConfig(payload)) continue;

      window.__RUNTIME_FIREBASE_CONFIG__ = payload;
      return;
    } catch {
      // Ignore runtime config fetch errors; UI will show missing key message.
    }
  }
};

const bootstrap = async () => {
  await loadRuntimeFirebaseConfig();

  const [{ default: App }, { AuthProvider }] = await Promise.all([
    import("./App"),
    import("./context/AuthContext"),
  ]);

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
};

bootstrap();
