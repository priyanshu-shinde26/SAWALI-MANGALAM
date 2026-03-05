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

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 2500);

  try {
    const response = await fetch("/api/firebase-config", {
      cache: "no-store",
      signal: abortController.signal,
    });
    if (!response.ok) return;

    const payload = await response.json();
    if (!hasRequiredFirebaseConfig(payload)) return;

    window.__RUNTIME_FIREBASE_CONFIG__ = payload;
  } catch {
    // Ignore runtime config fetch errors; app will show missing-key message instead.
  } finally {
    clearTimeout(timeout);
  }
};

const renderApp = (App, AuthProvider) => {
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

const bootstrap = async () => {
  await loadRuntimeFirebaseConfig();

  const [{ default: App }, { AuthProvider }] = await Promise.all([
    import("./App"),
    import("./context/AuthContext"),
  ]);

  renderApp(App, AuthProvider);
};

bootstrap().catch((error) => {
  console.error("App bootstrap failed:", error);

  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="padding:16px;font-family:Arial,sans-serif;color:#7f1d1d;">App failed to load. Please refresh.</div>';
  }
});
