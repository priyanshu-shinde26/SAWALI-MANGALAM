import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { adminConfigReady, loginAdmin } from "../services/authService";
import { firebaseMissingKeys } from "../services/firebase";
import { useAuth } from "../context/AuthContext";

const LoginPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setupMissingKeys = [...firebaseMissingKeys];

  if (user) {
    return <Navigate to="/hall-bookings" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await loginAdmin(form.email, form.password);
      navigate("/hall-bookings");
    } catch (loginError) {
      setError(loginError.message || "Unable to login right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-maroon-glow px-3 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-maroon-200 bg-white shadow-card">
        <div className="bg-gradient-to-r from-maroon-900 to-maroon-700 px-4 py-4 text-white">
          <div className="flex items-center gap-3">
            <img
              src="/sawali-logo.svg"
              alt="Sawali Mangalam"
              className="h-12 w-12 rounded-xl border border-white/35 bg-white/10 p-1 object-cover"
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-200">
                Sawali Mangalam
              </p>
              <h1 className="text-lg font-bold leading-tight">Admin Login</h1>
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {setupMissingKeys.length > 0 ? (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Setup incomplete. Missing `.env` keys:{" "}
              {setupMissingKeys.join(", ")}.
            </p>
          ) : null}
          {!adminConfigReady ? (
            <p className="mb-3 rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-900">
              Optional hardening: set `VITE_ADMIN_EMAIL` in `.env` to restrict admin
              access to one email.
            </p>
          ) : null}

          <form className="space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="label">Admin Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                required
              />
            </div>

            {error ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "Signing In..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
