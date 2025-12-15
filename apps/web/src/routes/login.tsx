import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/auth-context.js";
import { Button } from "../components/ui/button.js";
import { useTranslation } from "../hooks/use-translation.js";

const AuthForm = ({ mode }: { mode: "login" | "register" }) => {
  const { t } = useTranslation();
  const { login, register, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(form);
      } else {
        await register(form);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="glass-panel w-full max-w-md space-y-6 rounded-3xl p-8">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-slate-400">{t("uptivalab")}</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">{mode === "login" ? t("welcomeBack") : t("createAccount")}</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {mode === "login" ? t("useEmailPassword") : t("provisionCredentials")}
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">{t("email")}</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.4em] text-slate-400">{t("password")}</label>
            <input
              className="w-full rounded-2xl border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-3 text-sm text-slate-900 dark:text-white"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              required
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("working") : mode === "login" ? t("signIn") : t("register")}
          </Button>
        </form>
        {mode === "login" && (
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Need an account? Contact your administrator.
          </p>
        )}
      </div>
    </div>
  );
};

export const LoginRoute = () => <AuthForm mode="login" />;
