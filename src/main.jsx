import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

const bootstrap = async () => {
  // On Firebase Hosting, load runtime app config when Vite env vars are not present.
  if (!import.meta.env.VITE_FIREBASE_API_KEY) {
    try {
      const response = await fetch("/__/firebase/init.json", { cache: "no-store" });
      if (response.ok) {
        window.__RUNTIME_FIREBASE_CONFIG__ = await response.json();
      }
    } catch {
      // Ignore runtime config fetch errors; UI will show missing key message.
    }
  }

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
